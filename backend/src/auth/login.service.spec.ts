import { UnauthorizedException } from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { IdentityCrypto } from '../common/identity/identity-crypto.js';
import { LoginService } from './login.service.js';
import type { StudentRepository } from './repositories/student.repository.js';
import type { UserRepository } from './repositories/user.repository.js';

const crypto = new IdentityCrypto(randomBytes(32).toString('hex'), randomBytes(32).toString('hex'));
const PASSWORD = 'Correct-Horse-1';
const PHONE = '+77010000001';

describe('LoginService', () => {
  const students = { findAccountByPhoneHash: vi.fn() };
  const users = { findStaffByLogin: vi.fn(), findProfile: vi.fn() };
  const service = new LoginService(
    students as unknown as StudentRepository,
    users as unknown as UserRepository,
    crypto,
  );
  let passwordHash: string;

  beforeAll(async () => {
    passwordHash = await argon2.hash(PASSWORD);
    await service.onModuleInit();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    students.findAccountByPhoneHash.mockReset();
    users.findStaffByLogin.mockReset();
    users.findProfile.mockReset();
  });

  async function errorOf(promise: Promise<unknown>): Promise<UnauthorizedException> {
    const error: unknown = await promise.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(UnauthorizedException);
    return error as UnauthorizedException;
  }

  it('signs a student in by phone, looking it up only by hash', async () => {
    students.findAccountByPhoneHash.mockResolvedValue({ id: 'u-1', role: 'student', passwordHash });
    await expect(service.login({ phone: PHONE, password: PASSWORD })).resolves.toEqual({
      userId: 'u-1',
      role: 'student',
    });
    expect(students.findAccountByPhoneHash).toHaveBeenCalledWith(crypto.hash('phone', PHONE));
    expect(users.findStaffByLogin).not.toHaveBeenCalled();
  });

  it('signs staff in by email', async () => {
    users.findStaffByLogin.mockResolvedValue({ id: 'u-2', role: 'organization', passwordHash });
    await expect(
      service.login({ login: 'org@eduportfolio.test', password: PASSWORD }),
    ).resolves.toEqual({ userId: 'u-2', role: 'organization' });
    expect(users.findStaffByLogin).toHaveBeenCalledWith('org@eduportfolio.test');
  });

  it('answers 401 INVALID_CREDENTIALS for a wrong password', async () => {
    users.findStaffByLogin.mockResolvedValue({ id: 'u-2', role: 'admin', passwordHash });
    const error = await errorOf(service.login({ login: 'a@b.test', password: 'wrong' }));
    expect(error.getResponse()).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Wrong login or password',
    });
  });

  it('gives an unknown user the same answer and still runs argon2.verify', async () => {
    users.findStaffByLogin.mockResolvedValue({ id: 'u-2', role: 'admin', passwordHash });
    const wrongPassword = await errorOf(service.login({ login: 'a@b.test', password: 'wrong' }));

    users.findStaffByLogin.mockResolvedValue(null);
    const verify = vi.spyOn(argon2, 'verify');
    const unknownUser = await errorOf(service.login({ login: 'nobody@b.test', password: PASSWORD }));

    expect(unknownUser.getResponse()).toEqual(wrongPassword.getResponse());
    expect(verify).toHaveBeenCalledTimes(1);
    // The dummy hash is a real argon2 hash with the same settings, so the check costs the same.
    const [dummyHash] = verify.mock.calls[0];
    expect(dummyHash).toMatch(/^\$argon2id\$/);
    expect(dummyHash).not.toBe(passwordHash);
  });

  it('answers 401 for an unknown phone', async () => {
    students.findAccountByPhoneHash.mockResolvedValue(null);
    await errorOf(service.login({ phone: PHONE, password: PASSWORD }));
  });

  describe('me', () => {
    it('returns role, locale and organization for staff', async () => {
      const organization = { id: 'org-1', name: 'Demo', status: 'pending' };
      users.findProfile.mockResolvedValue({
        id: 'u-2',
        role: 'organization',
        locale: 'ru',
        student: null,
        organization,
      });
      await expect(service.me('u-2')).resolves.toEqual({
        userId: 'u-2',
        role: 'organization',
        locale: 'ru',
        studentId: null,
        organization,
      });
    });

    it('returns the student id for a student', async () => {
      users.findProfile.mockResolvedValue({
        id: 'u-1',
        role: 'student',
        locale: 'kk',
        student: { id: 'student-1' },
        organization: null,
      });
      await expect(service.me('u-1')).resolves.toMatchObject({
        studentId: 'student-1',
        organization: null,
      });
    });

    it('answers 401 when the user no longer exists', async () => {
      users.findProfile.mockResolvedValue(null);
      await errorOf(service.me('gone'));
    });
  });
});
