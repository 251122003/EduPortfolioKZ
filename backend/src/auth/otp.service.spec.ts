import { BadRequestException, GoneException, HttpException, HttpStatus } from '@nestjs/common';
import argon2 from 'argon2';
import type { OtpCode } from '../generated/prisma/client.js';
import type { DbClient } from '../prisma/transaction-runner.js';
import {
  dummyOtpId,
  generateOtpCode,
  OTP_LOCK_MS,
  OTP_RESEND_INTERVAL_MS,
  OTP_TTL_MS,
  OtpService,
} from './otp.service.js';
import type { OtpRepository } from './repositories/otp.repository.js';

const NOW = new Date('2026-11-16T10:00:00Z');

function fakeRepo(): { [K in keyof OtpRepository]: ReturnType<typeof vi.fn> } {
  return {
    create: vi.fn(),
    findById: vi.fn(),
    findLatestForPhone: vi.fn().mockResolvedValue(null),
    countSentSince: vi.fn().mockResolvedValue(0),
    hasLockSince: vi.fn().mockResolvedValue(false),
    addFailedAttempt: vi.fn(),
    lock: vi.fn(),
    markExpired: vi.fn(),
    markVerified: vi.fn(),
  };
}

async function otpRow(overrides: Partial<OtpCode> = {}, code = '123456'): Promise<OtpCode> {
  return {
    id: '0190a000-0000-7000-8000-000000000001',
    phoneHash: 'p'.repeat(64),
    iinHash: 'i'.repeat(64),
    codeHash: await argon2.hash(code),
    payloadEncrypted: new Uint8Array([1]),
    expiresAt: new Date(NOW.getTime() + OTP_TTL_MS),
    attempts: 0,
    status: 'issued',
    createdAt: NOW,
    verifiedAt: null,
    lockedAt: null,
    ...overrides,
  };
}

function statusOf(promise: Promise<unknown>): Promise<number> {
  return promise.then(
    () => 0,
    (error: unknown) => (error instanceof HttpException ? error.getStatus() : -1),
  );
}

describe('OtpService', () => {
  let repo: ReturnType<typeof fakeRepo>;
  let now: Date;
  let service: OtpService;

  beforeEach(() => {
    repo = fakeRepo();
    now = NOW;
    service = new OtpService(repo as unknown as OtpRepository, () => now);
  });

  describe('generateOtpCode', () => {
    it('always gives 6 digits', () => {
      for (let i = 0; i < 200; i += 1) {
        expect(generateOtpCode()).toMatch(/^\d{6}$/);
      }
    });
  });

  describe('dummyOtpId', () => {
    it('looks like a PostgreSQL uuidv7 with the current time', () => {
      const id = dummyOtpId(NOW);
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
      const ms = parseInt(id.replace(/-/g, '').slice(0, 12), 16);
      expect(ms).toBe(NOW.getTime());
      expect(dummyOtpId(NOW)).not.toBe(id);
    });
  });

  describe('assertCanSend', () => {
    it('allows a phone with no recent codes', async () => {
      await expect(service.assertCanSend('h')).resolves.toBeUndefined();
    });

    it('answers 429 within 60 seconds of the last code', async () => {
      repo.findLatestForPhone.mockResolvedValue(
        await otpRow({ createdAt: new Date(NOW.getTime() - OTP_RESEND_INTERVAL_MS + 1000) }),
      );
      expect(await statusOf(service.assertCanSend('h'))).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });

    it('allows a new code after 60 seconds', async () => {
      repo.findLatestForPhone.mockResolvedValue(
        await otpRow({ createdAt: new Date(NOW.getTime() - OTP_RESEND_INTERVAL_MS) }),
      );
      await expect(service.assertCanSend('h')).resolves.toBeUndefined();
    });

    it('answers 429 after 3 codes in the last hour', async () => {
      repo.countSentSince.mockResolvedValue(3);
      expect(await statusOf(service.assertCanSend('h'))).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(repo.countSentSince).toHaveBeenCalledWith('h', new Date(NOW.getTime() - 3_600_000));
    });

    it('answers 429 for 15 minutes after a lock', async () => {
      repo.hasLockSince.mockResolvedValue(true);
      expect(await statusOf(service.assertCanSend('h'))).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(repo.hasLockSince).toHaveBeenCalledWith('h', new Date(NOW.getTime() - OTP_LOCK_MS));
    });
  });

  describe('issue', () => {
    it('stores only a hash of the code and a 5-minute expiry', async () => {
      repo.create.mockResolvedValue({ id: 'otp-1' });
      const issued = await service.issue({
        phoneHash: 'p',
        iinHash: 'i',
        payloadEncrypted: new Uint8Array([1]),
      });

      expect(issued.otpId).toBe('otp-1');
      expect(issued.code).toMatch(/^\d{6}$/);
      const saved = repo.create.mock.calls[0][0] as { codeHash: string; expiresAt: Date };
      expect(saved.codeHash).not.toContain(issued.code);
      expect(await argon2.verify(saved.codeHash, issued.code)).toBe(true);
      expect(saved.expiresAt).toEqual(new Date(NOW.getTime() + OTP_TTL_MS));
    });
  });

  describe('check', () => {
    it('returns the row for the right code', async () => {
      const row = await otpRow();
      repo.findById.mockResolvedValue(row);
      await expect(service.check(row.id, '123456')).resolves.toBe(row);
      expect(repo.addFailedAttempt).not.toHaveBeenCalled();
    });

    it('answers 410 for an unknown id', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.check('x', '123456')).rejects.toBeInstanceOf(GoneException);
    });

    it('answers 410 for a code that was already used', async () => {
      repo.findById.mockResolvedValue(await otpRow({ status: 'verified' }));
      await expect(service.check('x', '123456')).rejects.toBeInstanceOf(GoneException);
    });

    it('answers 410 and marks the code expired after 5 minutes', async () => {
      const row = await otpRow();
      repo.findById.mockResolvedValue(row);
      now = new Date(NOW.getTime() + OTP_TTL_MS);
      await expect(service.check(row.id, '123456')).rejects.toBeInstanceOf(GoneException);
      expect(repo.markExpired).toHaveBeenCalledWith(row.id);
    });

    it('answers 423 for a locked code', async () => {
      repo.findById.mockResolvedValue(await otpRow({ status: 'locked' }));
      expect(await statusOf(service.check('x', '123456'))).toBe(HttpStatus.LOCKED);
    });

    it('answers 400 with attempts left for a wrong code', async () => {
      const row = await otpRow();
      repo.findById.mockResolvedValue(row);
      repo.addFailedAttempt.mockResolvedValue(1);

      const error: unknown = await service.check(row.id, '000000').catch((e: unknown) => e);
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as HttpException).getResponse()).toMatchObject({
        code: 'OTP_INVALID',
        attemptsLeft: 4,
      });
    });

    it('locks the code on the 5th wrong attempt and answers 423', async () => {
      const row = await otpRow({ attempts: 4 });
      repo.findById.mockResolvedValue(row);
      repo.addFailedAttempt.mockResolvedValue(5);

      expect(await statusOf(service.check(row.id, '000000'))).toBe(HttpStatus.LOCKED);
      expect(repo.lock).toHaveBeenCalledWith(row.id, NOW);
    });

    it('answers 423 when a parallel request locked the code first', async () => {
      const row = await otpRow({ attempts: 4 });
      repo.findById.mockResolvedValueOnce(row).mockResolvedValueOnce({ ...row, status: 'locked' });
      repo.addFailedAttempt.mockResolvedValue(null);
      expect(await statusOf(service.check(row.id, '000000'))).toBe(HttpStatus.LOCKED);
    });

    it('answers 410 when a parallel request used the code first', async () => {
      const row = await otpRow();
      repo.findById
        .mockResolvedValueOnce(row)
        .mockResolvedValueOnce({ ...row, status: 'verified' });
      repo.addFailedAttempt.mockResolvedValue(null);
      expect(await statusOf(service.check(row.id, '000000'))).toBe(HttpStatus.GONE);
    });
  });

  describe('findReplaceable', () => {
    it('returns an issued or expired code', async () => {
      const row = await otpRow({ status: 'expired' });
      repo.findById.mockResolvedValue(row);
      await expect(service.findReplaceable(row.id)).resolves.toBe(row);
    });

    it('returns null for an unknown or used code', async () => {
      repo.findById.mockResolvedValueOnce(null);
      await expect(service.findReplaceable('x')).resolves.toBeNull();
      repo.findById.mockResolvedValueOnce(await otpRow({ status: 'verified' }));
      await expect(service.findReplaceable('x')).resolves.toBeNull();
    });
  });

  describe('retire and consume', () => {
    const db = {} as DbClient;

    it('retire marks the old code expired', async () => {
      await service.retire('otp-1');
      expect(repo.markExpired).toHaveBeenCalledWith('otp-1');
    });

    it('consume marks the code verified', async () => {
      repo.markVerified.mockResolvedValue(true);
      await expect(service.consume('otp-1', db)).resolves.toBeUndefined();
      expect(repo.markVerified).toHaveBeenCalledWith('otp-1', NOW, db);
    });

    it('consume answers 410 when the code was used meanwhile', async () => {
      repo.markVerified.mockResolvedValue(false);
      await expect(service.consume('otp-1', db)).rejects.toBeInstanceOf(GoneException);
    });
  });
});
