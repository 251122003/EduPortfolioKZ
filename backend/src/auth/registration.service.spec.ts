import { ConflictException, GoneException, HttpException, HttpStatus } from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { IdentityCrypto } from '../common/identity/identity-crypto.js';
import type { OtpCode } from '../generated/prisma/client.js';
import type { DbClient, TransactionRunner } from '../prisma/transaction-runner.js';
import type { RegisterStudentInput } from './auth.contracts.js';
import { studentDataMismatch, tooManyCodes } from './auth.errors.js';
import type { MatchingService } from './matching.service.js';
import type { OtpService } from './otp.service.js';
import { RegistrationService } from './registration.service.js';
import type { AuditLogRepository } from './repositories/audit-log.repository.js';
import type { StudentRepository } from './repositories/student.repository.js';
import type { UserRepository } from './repositories/user.repository.js';
import type { SmsSender } from './sms/sms-sender.js';

const NOW = new Date('2026-11-16T10:00:00Z');
const crypto = new IdentityCrypto(randomBytes(32).toString('hex'), randomBytes(32).toString('hex'));

// Synthetic data. 080315600016: born 2008-03-15 (adult on NOW); 100101500012: born 2010-01-01 (minor).
const ADULT_IIN = '080315600016';
const MINOR_IIN = '100101500012';
const input: RegisterStudentInput = {
  iin: ADULT_IIN,
  fullName: 'Сейтқали Аружан',
  phone: '+77010000001',
  password: 'Correct-Horse-1',
  locale: 'kk',
};

function payloadFor(iin: string): Uint8Array<ArrayBuffer> {
  return crypto.encrypt(
    JSON.stringify({
      iin,
      phone: input.phone,
      fullName: input.fullName,
      passwordHash: 'argon2-hash',
      locale: 'kk',
    }),
  );
}

function otpRow(overrides: Partial<OtpCode> = {}): OtpCode {
  return {
    id: 'otp-1',
    phoneHash: crypto.hash('phone', input.phone),
    iinHash: crypto.hash('iin', ADULT_IIN),
    codeHash: 'hash',
    payloadEncrypted: payloadFor(ADULT_IIN),
    expiresAt: new Date(NOW.getTime() + 300_000),
    attempts: 0,
    status: 'issued',
    createdAt: NOW,
    verifiedAt: null,
    lockedAt: null,
    ...overrides,
  };
}

describe('RegistrationService', () => {
  const db = { tx: true } as unknown as DbClient;
  const otp = {
    assertCanSend: vi.fn(),
    issue: vi.fn(),
    findReplaceable: vi.fn(),
    retire: vi.fn(),
    check: vi.fn(),
    consume: vi.fn(),
  };
  const matching = { linkOrCreate: vi.fn() };
  const students = { isIinClaimed: vi.fn(), isPhoneClaimed: vi.fn() };
  const users = { createStudentUser: vi.fn() };
  const audit = { record: vi.fn() };
  const transactions = { run: vi.fn((work: (tx: DbClient) => Promise<unknown>) => work(db)) };
  const sms = { sendOtp: vi.fn() };

  const service = new RegistrationService(
    otp as unknown as OtpService,
    matching as unknown as MatchingService,
    students as unknown as StudentRepository,
    users as unknown as UserRepository,
    audit as unknown as AuditLogRepository,
    transactions as unknown as TransactionRunner,
    crypto,
    sms as SmsSender,
    () => NOW,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    students.isIinClaimed.mockResolvedValue(false);
    students.isPhoneClaimed.mockResolvedValue(false);
    otp.assertCanSend.mockResolvedValue(undefined);
    otp.issue.mockResolvedValue({ otpId: 'otp-1', code: '123456' });
    users.createStudentUser.mockResolvedValue({ id: 'user-1' });
    matching.linkOrCreate.mockResolvedValue('student-1');
  });

  describe('startRegistration', () => {
    it('saves the pending registration encrypted and sends the code', async () => {
      await expect(service.startRegistration(input)).resolves.toEqual({ otpId: 'otp-1' });

      const issued = otp.issue.mock.calls[0][0] as {
        phoneHash: string;
        iinHash: string;
        payloadEncrypted: Uint8Array;
      };
      expect(issued.phoneHash).toBe(crypto.hash('phone', input.phone));
      expect(issued.iinHash).toBe(crypto.hash('iin', input.iin));
      const pending = JSON.parse(crypto.decrypt(issued.payloadEncrypted)) as Record<string, string>;
      expect(pending).toMatchObject({ iin: input.iin, phone: input.phone, locale: 'kk' });
      expect(pending.password).toBeUndefined();
      expect(await argon2.verify(pending.passwordHash, input.password)).toBe(true);

      expect(sms.sendOtp).toHaveBeenCalledWith({
        phone: input.phone,
        otpId: 'otp-1',
        code: '123456',
        locale: 'kk',
      });
    });

    it('answers the same way without SMS when the IIN already has an account', async () => {
      students.isIinClaimed.mockResolvedValue(true);
      const result = await service.startRegistration(input);
      // Looks like a real id (UUID v7), so the answer does not reveal the registered IIN.
      expect(result.otpId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
      );
      expect(otp.issue).not.toHaveBeenCalled();
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it('answers the same way without SMS when the phone already has an account', async () => {
      students.isPhoneClaimed.mockResolvedValue(true);
      await service.startRegistration(input);
      expect(otp.issue).not.toHaveBeenCalled();
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it('sends nothing when the phone hit the limit', async () => {
      otp.assertCanSend.mockRejectedValue(tooManyCodes());
      await expect(service.startRegistration(input)).rejects.toBeInstanceOf(HttpException);
      expect(otp.issue).not.toHaveBeenCalled();
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });
  });

  describe('resendCode', () => {
    it('retires the old code and sends a new one with the same data', async () => {
      const previous = otpRow({ status: 'expired' });
      otp.findReplaceable.mockResolvedValue(previous);
      otp.issue.mockResolvedValue({ otpId: 'otp-2', code: '654321' });

      await expect(service.resendCode('otp-1')).resolves.toEqual({ otpId: 'otp-2' });
      expect(otp.assertCanSend).toHaveBeenCalledWith(previous.phoneHash);
      expect(otp.retire).toHaveBeenCalledWith('otp-1');
      expect(otp.issue).toHaveBeenCalledWith(
        expect.objectContaining({ phoneHash: previous.phoneHash, iinHash: previous.iinHash }),
      );
      expect(sms.sendOtp).toHaveBeenCalledWith(
        expect.objectContaining({ otpId: 'otp-2', code: '654321', phone: input.phone }),
      );
    });

    it('answers 202 with a dummy id for an unknown or used code', async () => {
      otp.findReplaceable.mockResolvedValue(null);
      const result = await service.resendCode('otp-x');
      expect(result.otpId).not.toBe('otp-x');
      expect(sms.sendOtp).not.toHaveBeenCalled();
    });

    it('answers 429 inside the limits and keeps the old code', async () => {
      otp.findReplaceable.mockResolvedValue(otpRow());
      otp.assertCanSend.mockRejectedValue(tooManyCodes());
      const error: unknown = await service.resendCode('otp-1').catch((e: unknown) => e);
      expect((error as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect(otp.retire).not.toHaveBeenCalled();
    });
  });

  describe('completeRegistration', () => {
    it('creates the user, links the student and writes the audit log in one transaction', async () => {
      otp.check.mockResolvedValue(otpRow());

      await expect(service.completeRegistration('otp-1', '123456')).resolves.toEqual({
        userId: 'user-1',
        studentId: 'student-1',
        guardianConsentRequired: false,
      });
      expect(transactions.run).toHaveBeenCalledTimes(1);
      expect(otp.consume).toHaveBeenCalledWith('otp-1', db);
      expect(users.createStudentUser).toHaveBeenCalledWith(
        { passwordHash: 'argon2-hash', locale: 'kk' },
        db,
      );
      expect(matching.linkOrCreate).toHaveBeenCalledWith(
        { userId: 'user-1', iin: ADULT_IIN, phone: input.phone, fullName: input.fullName },
        db,
      );
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ entity: 'user', action: 'create', entityId: 'user-1' }),
        db,
      );
    });

    it('returns guardianConsentRequired for a student under 18', async () => {
      otp.check.mockResolvedValue(otpRow({ payloadEncrypted: payloadFor(MINOR_IIN) }));
      const result = await service.completeRegistration('otp-1', '123456');
      expect(result.guardianConsentRequired).toBe(true);
    });

    it('passes on errors from the code check and creates nothing', async () => {
      otp.check.mockRejectedValue(new GoneException());
      await expect(service.completeRegistration('otp-1', '123456')).rejects.toBeInstanceOf(
        GoneException,
      );
      expect(transactions.run).not.toHaveBeenCalled();
    });

    it('answers 410 when the code has no registration data', async () => {
      otp.check.mockResolvedValue(otpRow({ payloadEncrypted: null }));
      await expect(service.completeRegistration('otp-1', '123456')).rejects.toBeInstanceOf(
        GoneException,
      );
    });

    it('passes on 409 from matching (the transaction rolls back)', async () => {
      otp.check.mockResolvedValue(otpRow());
      matching.linkOrCreate.mockRejectedValue(studentDataMismatch());
      await expect(service.completeRegistration('otp-1', '123456')).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('never returns IIN or phone', async () => {
      otp.check.mockResolvedValue(otpRow());
      const body = JSON.stringify(await service.completeRegistration('otp-1', '123456'));
      expect(body).not.toContain(ADULT_IIN);
      expect(body).not.toContain(input.phone);
    });
  });
});
