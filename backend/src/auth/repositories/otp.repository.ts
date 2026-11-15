import { Injectable } from '@nestjs/common';
import type { OtpCode } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DbClient } from '../../prisma/transaction-runner.js';

export interface NewOtp {
  phoneHash: string;
  iinHash: string | null;
  codeHash: string;
  payloadEncrypted: Uint8Array<ArrayBuffer>;
  createdAt: Date;
  expiresAt: Date;
}

// otp_codes table. Holds only hashes and the encrypted pending registration.
@Injectable()
export class OtpRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: NewOtp): Promise<OtpCode> {
    return this.prisma.otpCode.create({ data });
  }

  findById(id: string): Promise<OtpCode | null> {
    return this.prisma.otpCode.findUnique({ where: { id } });
  }

  findLatestForPhone(phoneHash: string): Promise<OtpCode | null> {
    return this.prisma.otpCode.findFirst({
      where: { phoneHash },
      orderBy: { createdAt: 'desc' },
    });
  }

  countSentSince(phoneHash: string, since: Date): Promise<number> {
    return this.prisma.otpCode.count({ where: { phoneHash, createdAt: { gte: since } } });
  }

  async hasLockSince(phoneHash: string, since: Date): Promise<boolean> {
    const locked = await this.prisma.otpCode.findFirst({
      where: { phoneHash, status: 'locked', lockedAt: { gte: since } },
      select: { id: true },
    });
    return locked !== null;
  }

  /**
   * Adds one wrong attempt to a code that is still issued and returns the new count,
   * or null when the code is no longer issued (another request changed it first).
   */
  async addFailedAttempt(id: string, maxAttempts: number): Promise<number | null> {
    const { count } = await this.prisma.otpCode.updateMany({
      where: { id, status: 'issued', attempts: { lt: maxAttempts } },
      data: { attempts: { increment: 1 } },
    });
    if (count === 0) {
      return null;
    }
    const row = await this.prisma.otpCode.findUnique({ where: { id }, select: { attempts: true } });
    return row?.attempts ?? null;
  }

  async lock(id: string, now: Date): Promise<void> {
    await this.prisma.otpCode.update({ where: { id }, data: { status: 'locked', lockedAt: now } });
  }

  async markExpired(id: string): Promise<void> {
    await this.prisma.otpCode.updateMany({
      where: { id, status: 'issued' },
      data: { status: 'expired' },
    });
  }

  /** Moves an issued, not expired code to verified. False when another request used it first. */
  async markVerified(id: string, now: Date, db: DbClient = this.prisma): Promise<boolean> {
    const { count } = await db.otpCode.updateMany({
      where: { id, status: 'issued', expiresAt: { gt: now } },
      data: { status: 'verified', verifiedAt: now },
    });
    return count === 1;
  }
}
