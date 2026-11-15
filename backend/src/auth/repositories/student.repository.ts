import { Injectable } from '@nestjs/common';
import type { Student } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DbClient } from '../../prisma/transaction-runner.js';

export interface NewClaimedStudent {
  userId: string;
  iinHash: string;
  iinEncrypted: Uint8Array<ArrayBuffer>;
  phoneHash: string;
  phoneEncrypted: Uint8Array<ArrayBuffer>;
  fullName: string;
}

// students table. Looks records up only by HMAC hashes, never by plain IIN or phone.
@Injectable()
export class StudentRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByIinHash(iinHash: string, db: DbClient = this.prisma): Promise<Student | null> {
    return db.student.findUnique({ where: { iinHash } });
  }

  async isIinClaimed(iinHash: string, db: DbClient = this.prisma): Promise<boolean> {
    const student = await db.student.findFirst({
      where: { iinHash, userId: { not: null } },
      select: { id: true },
    });
    return student !== null;
  }

  async isPhoneClaimed(phoneHash: string, db: DbClient = this.prisma): Promise<boolean> {
    const student = await db.student.findFirst({
      where: { phoneHash, userId: { not: null } },
      select: { id: true },
    });
    return student !== null;
  }

  claim(id: string, userId: string, db: DbClient = this.prisma): Promise<Student> {
    return db.student.update({ where: { id }, data: { userId, status: 'claimed' } });
  }

  createClaimed(data: NewClaimedStudent, db: DbClient = this.prisma): Promise<Student> {
    return db.student.create({ data: { ...data, status: 'claimed' } });
  }
}
