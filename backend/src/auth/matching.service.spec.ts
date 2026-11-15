import { ConflictException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';
import type { Student } from '../generated/prisma/client.js';
import { IdentityCrypto } from '../common/identity/identity-crypto.js';
import type { DbClient } from '../prisma/transaction-runner.js';
import { MatchingService, type NewStudentIdentity } from './matching.service.js';
import type { AuditLogRepository } from './repositories/audit-log.repository.js';
import type { StudentRepository } from './repositories/student.repository.js';

const crypto = new IdentityCrypto(randomBytes(32).toString('hex'), randomBytes(32).toString('hex'));
const db = {} as DbClient;

// Synthetic data: the IIN has a valid check digit but belongs to nobody.
const identity: NewStudentIdentity = {
  userId: 'user-1',
  iin: '080315600016',
  phone: '+77010000001',
  fullName: 'Сейтқали Аружан',
};

function unclaimed(overrides: Partial<Student> = {}): Student {
  return {
    id: 'student-1',
    userId: null,
    iinHash: crypto.hash('iin', identity.iin),
    iinEncrypted: crypto.encrypt(identity.iin),
    phoneHash: crypto.hash('phone', identity.phone),
    phoneEncrypted: crypto.encrypt(identity.phone),
    fullName: 'СЕЙТҚАЛИ  аружан ',
    status: 'unclaimed',
    guardianConsentAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('MatchingService', () => {
  const students = {
    findByIinHash: vi.fn(),
    isPhoneClaimed: vi.fn(),
    claim: vi.fn(),
    createClaimed: vi.fn(),
  };
  const audit = { record: vi.fn() };
  const service = new MatchingService(
    students as unknown as StudentRepository,
    audit as unknown as AuditLogRepository,
    crypto,
  );

  beforeEach(() => {
    vi.clearAllMocks();
    students.isPhoneClaimed.mockResolvedValue(false);
  });

  it('links the unclaimed record when IIN, normalized name and phone match', async () => {
    students.findByIinHash.mockResolvedValue(unclaimed());
    students.claim.mockResolvedValue({ id: 'student-1' });

    await expect(service.linkOrCreate(identity, db)).resolves.toBe('student-1');
    expect(students.claim).toHaveBeenCalledWith('student-1', 'user-1', db);
    expect(students.createClaimed).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'student', action: 'claim', entityId: 'student-1' }),
      db,
    );
  });

  it('treats Ё and Е as the same letter', async () => {
    students.findByIinHash.mockResolvedValue(unclaimed({ fullName: 'Семёнов Пётр' }));
    students.claim.mockResolvedValue({ id: 'student-1' });
    await expect(service.linkOrCreate({ ...identity, fullName: 'семенов петр' }, db)).resolves.toBe(
      'student-1',
    );
  });

  it('creates an empty claimed profile when there is no record for the IIN', async () => {
    students.findByIinHash.mockResolvedValue(null);
    students.createClaimed.mockResolvedValue({ id: 'student-new' });

    await expect(service.linkOrCreate(identity, db)).resolves.toBe('student-new');
    const data = students.createClaimed.mock.calls[0][0] as Record<string, unknown>;
    expect(data.iinHash).toBe(crypto.hash('iin', identity.iin));
    expect(crypto.decrypt(data.iinEncrypted as Uint8Array)).toBe(identity.iin);
    expect(crypto.decrypt(data.phoneEncrypted as Uint8Array)).toBe(identity.phone);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ entity: 'student', action: 'create', entityId: 'student-new' }),
      db,
    );
  });

  it('answers 409 when the name differs', async () => {
    students.findByIinHash.mockResolvedValue(unclaimed({ fullName: 'Другой Человек' }));
    await expect(service.linkOrCreate(identity, db)).rejects.toBeInstanceOf(ConflictException);
    expect(students.claim).not.toHaveBeenCalled();
    expect(students.createClaimed).not.toHaveBeenCalled();
  });

  it('answers 409 when the phone differs', async () => {
    students.findByIinHash.mockResolvedValue(
      unclaimed({ phoneHash: crypto.hash('phone', '+77019999999') }),
    );
    await expect(service.linkOrCreate(identity, db)).rejects.toBeInstanceOf(ConflictException);
    expect(students.claim).not.toHaveBeenCalled();
  });

  it('answers 409 when the record already belongs to an account', async () => {
    students.findByIinHash.mockResolvedValue(unclaimed({ userId: 'someone', status: 'claimed' }));
    await expect(service.linkOrCreate(identity, db)).rejects.toBeInstanceOf(ConflictException);
  });

  it('answers 409 when the phone already belongs to an account', async () => {
    students.isPhoneClaimed.mockResolvedValue(true);
    await expect(service.linkOrCreate(identity, db)).rejects.toBeInstanceOf(ConflictException);
    expect(students.findByIinHash).not.toHaveBeenCalled();
  });

  it('gives the same 409 text for every mismatch reason', async () => {
    students.findByIinHash.mockResolvedValue(unclaimed({ fullName: 'Другой Человек' }));
    const byName = (await service
      .linkOrCreate(identity, db)
      .catch((e: unknown) => e)) as ConflictException;
    students.isPhoneClaimed.mockResolvedValue(true);
    const byPhone = (await service
      .linkOrCreate(identity, db)
      .catch((e: unknown) => e)) as ConflictException;
    expect(byName.getResponse()).toEqual(byPhone.getResponse());
  });

  it('never puts IIN, phone or name into the audit log', async () => {
    students.findByIinHash.mockResolvedValue(null);
    students.createClaimed.mockResolvedValue({ id: 'student-new' });
    await service.linkOrCreate(identity, db);
    const logged = JSON.stringify(audit.record.mock.calls);
    expect(logged).not.toContain(identity.iin);
    expect(logged).not.toContain(identity.phone);
    expect(logged).not.toContain('Аружан');
  });
});
