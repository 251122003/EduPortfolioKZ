import { Injectable } from '@nestjs/common';
import type { Locale, User } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DbClient } from '../../prisma/transaction-runner.js';

// users table. Students have no login: they will sign in by phone (students.phone_hash).
@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  createStudentUser(
    data: { passwordHash: string; locale: Locale },
    db: DbClient = this.prisma,
  ): Promise<User> {
    return db.user.create({ data: { ...data, role: 'student' } });
  }
}
