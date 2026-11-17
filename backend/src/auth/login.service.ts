import { Injectable, type OnModuleInit } from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes } from 'node:crypto';
import { IdentityCrypto } from '../common/identity/identity-crypto.js';
import type { LoginInput, MeResponse } from './auth.contracts.js';
import { invalidCredentials, notSignedIn } from './auth.errors.js';
import { StudentRepository } from './repositories/student.repository.js';
import { type LoginAccount, UserRepository } from './repositories/user.repository.js';
import type { SessionUser } from './session/session.service.js';

// FR-25: sign-in by phone (student) or email (staff), and "who am I".
// Unknown user and wrong password give the same 401 and take the same time:
// argon2.verify always runs, against a dummy hash when there is no user.
@Injectable()
export class LoginService implements OnModuleInit {
  private dummyHash: Promise<string> | undefined;

  constructor(
    private readonly students: StudentRepository,
    private readonly users: UserRepository,
    private readonly crypto: IdentityCrypto,
  ) {}

  /** Prepares the dummy hash at startup, so the first login is not slower than the rest. */
  async onModuleInit(): Promise<void> {
    await this.dummyPasswordHash();
  }

  async login(input: LoginInput): Promise<SessionUser> {
    const account: LoginAccount | null =
      'phone' in input
        ? await this.students.findAccountByPhoneHash(this.crypto.hash('phone', input.phone))
        : await this.users.findStaffByLogin(input.login);

    const hash = account?.passwordHash ?? (await this.dummyPasswordHash());
    const passwordMatches = await argon2.verify(hash, input.password);
    if (account === null || !passwordMatches) {
      throw invalidCredentials();
    }
    return { userId: account.id, role: account.role };
  }

  /** GET /auth/me. A user that no longer exists is treated as signed out. */
  async me(userId: string): Promise<MeResponse> {
    const profile = await this.users.findProfile(userId);
    if (profile === null) {
      throw notSignedIn();
    }
    return {
      userId: profile.id,
      role: profile.role,
      locale: profile.locale,
      studentId: profile.student?.id ?? null,
      organization: profile.organization,
    };
  }

  // Same argon2 settings as real password hashes (library defaults), so verify costs the same.
  private dummyPasswordHash(): Promise<string> {
    this.dummyHash ??= argon2.hash(randomBytes(32).toString('hex'));
    return this.dummyHash;
  }
}
