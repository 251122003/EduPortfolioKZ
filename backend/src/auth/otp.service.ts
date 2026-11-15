import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { randomBytes, randomInt } from 'node:crypto';
import type { OtpCode } from '../generated/prisma/client.js';
import type { DbClient } from '../prisma/transaction-runner.js';
import { otpExpired, otpInvalid, otpLocked, tooManyCodes } from './auth.errors.js';
import { CLOCK, type Clock } from './clock.js';
import { OtpRepository } from './repositories/otp.repository.js';

// Limits from specifications.md NFR-7 and UC-1.
export const OTP_TTL_MS = 5 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_LOCK_MS = 15 * 60_000;
export const OTP_RESEND_INTERVAL_MS = 60_000;
export const OTP_MAX_PER_HOUR = 3;
const HOUR_MS = 60 * 60_000;

/** Six random digits from a cryptographic source, leading zeros kept. */
export function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

/**
 * An otpId that is never stored, for answers that must look like success (UC-1 A2).
 * Real ids are UUID v7 from PostgreSQL, so this one is v7 too: a v4 id would reveal
 * that the IIN or phone is already registered.
 */
export function dummyOtpId(now: Date): string {
  const bytes = randomBytes(16);
  bytes.writeUIntBE(now.getTime(), 0, 6); // 48-bit Unix time in milliseconds
  bytes[6] = (bytes[6] & 0x0f) | 0x70; // version 7
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export interface IssuedOtp {
  otpId: string;
  code: string;
}

// The life of one SMS code: issued -> verified | expired | locked (state-machine-otp.puml).
// The code itself is stored only as an argon2 hash.
@Injectable()
export class OtpService {
  constructor(
    private readonly otps: OtpRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** Throws 429 when this phone may not get a new code yet. */
  async assertCanSend(phoneHash: string): Promise<void> {
    const now = this.clock().getTime();
    if (await this.otps.hasLockSince(phoneHash, new Date(now - OTP_LOCK_MS))) {
      throw tooManyCodes();
    }
    const latest = await this.otps.findLatestForPhone(phoneHash);
    if (latest !== null && now - latest.createdAt.getTime() < OTP_RESEND_INTERVAL_MS) {
      throw tooManyCodes();
    }
    const sentLastHour = await this.otps.countSentSince(phoneHash, new Date(now - HOUR_MS));
    if (sentLastHour >= OTP_MAX_PER_HOUR) {
      throw tooManyCodes();
    }
  }

  async issue(data: {
    phoneHash: string;
    iinHash: string | null;
    payloadEncrypted: Uint8Array<ArrayBuffer>;
  }): Promise<IssuedOtp> {
    const code = generateOtpCode();
    const codeHash = await argon2.hash(code);
    const now = this.clock();
    const row = await this.otps.create({
      ...data,
      codeHash,
      createdAt: now,
      expiresAt: new Date(now.getTime() + OTP_TTL_MS),
    });
    return { otpId: row.id, code };
  }

  /** A code that resend-otp may replace, or null when it is unknown or already used. */
  async findReplaceable(otpId: string): Promise<OtpCode | null> {
    const row = await this.otps.findById(otpId);
    if (row === null || row.status === 'verified' || row.payloadEncrypted === null) {
      return null;
    }
    return row;
  }

  /** Ends an issued code because a new one replaces it. */
  async retire(otpId: string): Promise<void> {
    await this.otps.markExpired(otpId);
  }

  /**
   * Checks the code. Returns the row when it matches; otherwise throws
   * 410 (unknown, used or expired), 423 (locked) or 400 with attempts left.
   */
  async check(otpId: string, code: string): Promise<OtpCode> {
    const row = await this.otps.findById(otpId);
    if (row === null || row.status === 'verified' || row.status === 'expired') {
      throw otpExpired();
    }
    if (row.status === 'locked') {
      throw otpLocked();
    }
    if (this.clock().getTime() >= row.expiresAt.getTime()) {
      await this.otps.markExpired(row.id);
      throw otpExpired();
    }
    if (await argon2.verify(row.codeHash, code)) {
      return row;
    }

    const attempts = await this.otps.addFailedAttempt(row.id, OTP_MAX_ATTEMPTS);
    if (attempts === null) {
      // Another request changed the code meanwhile; read it again to answer correctly.
      const current = await this.otps.findById(row.id);
      throw current?.status === 'locked' ? otpLocked() : otpExpired();
    }
    if (attempts >= OTP_MAX_ATTEMPTS) {
      await this.otps.lock(row.id, this.clock());
      throw otpLocked();
    }
    throw otpInvalid(OTP_MAX_ATTEMPTS - attempts);
  }

  /** Marks a checked code as used, inside the registration transaction. Throws 410 if it was used meanwhile. */
  async consume(otpId: string, db: DbClient): Promise<void> {
    const consumed = await this.otps.markVerified(otpId, this.clock(), db);
    if (!consumed) {
      throw otpExpired();
    }
  }
}
