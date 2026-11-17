import { Injectable } from '@nestjs/common';
import type { Locale, OrgStatus, User, UserRole } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DbClient } from '../../prisma/transaction-runner.js';

/** The fields login needs: who it is and the password hash to check. */
export interface LoginAccount {
  id: string;
  role: UserRole;
  passwordHash: string;
}

/** What GET /auth/me shows. Selected field by field, so encrypted IIN and phone never leave the database. */
export interface UserProfile {
  id: string;
  role: UserRole;
  locale: Locale;
  student: { id: string } | null;
  organization: { id: string; name: string; status: OrgStatus } | null;
}

// users table. Students have no login: they sign in by phone (students.phone_hash).
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  createStudentUser(
    data: { passwordHash: string; locale: Locale },
    db: DbClient = this.prisma,
  ): Promise<User> {
    return db.user.create({ data: { ...data, role: 'student' } });
  }

  /** Organization staff or admin by email login. */
  findStaffByLogin(login: string, db: DbClient = this.prisma): Promise<LoginAccount | null> {
    return db.user.findFirst({
      where: { login, role: { in: ['organization', 'admin'] } },
      select: { id: true, role: true, passwordHash: true },
    });
  }

  findProfile(id: string, db: DbClient = this.prisma): Promise<UserProfile | null> {
    return db.user.findUnique({
      where: { id },
      select: {
        id: true,
        role: true,
        locale: true,
        student: { select: { id: true } },
        organization: { select: { id: true, name: true, status: true } },
      },
    });
  }
}
