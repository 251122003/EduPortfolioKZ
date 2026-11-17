import { Inject, Injectable } from '@nestjs/common';
import argon2 from 'argon2';
import { z } from 'zod';
import { IdentityCrypto } from '../common/identity/identity-crypto.js';
import { isMinor } from '../common/identity/iin.js';
import { TransactionRunner } from '../prisma/transaction-runner.js';
import type {
  OtpSentResponse,
  RegisterStudentInput,
  StudentRegisteredResponse,
} from './auth.contracts.js';
import { otpExpired } from './auth.errors.js';
import { CLOCK, type Clock } from './clock.js';
import { MatchingService } from './matching.service.js';
import { dummyOtpId, OtpService } from './otp.service.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { StudentRepository } from './repositories/student.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { SMS_SENDER, type SmsSender } from './sms/sms-sender.js';

// The registration data kept encrypted in otp_codes.payload_encrypted until the code is confirmed.
const pendingRegistrationSchema = z.object({
  iin: z.string(),
  phone: z.string(),
  fullName: z.string(),
  passwordHash: z.string(),
  locale: z.enum(['kk', 'ru']),
});
type PendingRegistration = z.infer<typeof pendingRegistrationSchema>;

/** Result of verify-otp: the response body plus the new user's id, which the controller needs for the session. */
export interface CompletedRegistration extends StudentRegisteredResponse {
  userId: string;
}

// UC-1: student registration by IIN and SMS code.
// IIN and phone exist in plain text only in memory: stored encrypted, looked up by HMAC hash,
// never logged and never returned.
@Injectable()
export class RegistrationService {
  constructor(
    private readonly otp: OtpService,
    private readonly matching: MatchingService,
    private readonly students: StudentRepository,
    private readonly users: UserRepository,
    private readonly audit: AuditLogRepository,
    private readonly transactions: TransactionRunner,
    private readonly crypto: IdentityCrypto,
    @Inject(SMS_SENDER) private readonly sms: SmsSender,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** POST /auth/register/student: saves the pending registration and sends a code. */
  async startRegistration(input: RegisterStudentInput): Promise<OtpSentResponse> {
    // Hashed before any lookup, so a registered IIN answers about as fast as a new one.
    const passwordHash = await argon2.hash(input.password);
    const iinHash = this.crypto.hash('iin', input.iin);
    const phoneHash = this.crypto.hash('phone', input.phone);

    // UC-1 A2: an IIN or phone that already has an account gets the same 202, but no SMS.
    if (
      (await this.students.isIinClaimed(iinHash)) ||
      (await this.students.isPhoneClaimed(phoneHash))
    ) {
      return { otpId: dummyOtpId(this.clock()) };
    }

    await this.otp.assertCanSend(phoneHash);
    const pending: PendingRegistration = {
      iin: input.iin,
      phone: input.phone,
      fullName: input.fullName,
      passwordHash,
      locale: input.locale,
    };
    const issued = await this.otp.issue({
      phoneHash,
      iinHash,
      payloadEncrypted: this.crypto.encrypt(JSON.stringify(pending)),
    });
    await this.sms.sendOtp({
      phone: pending.phone,
      otpId: issued.otpId,
      code: issued.code,
      locale: pending.locale,
    });
    return { otpId: issued.otpId };
  }

  /** POST /auth/resend-otp: replaces the code with a new one, within the same limits. */
  async resendCode(otpId: string): Promise<OtpSentResponse> {
    const previous = await this.otp.findReplaceable(otpId);
    if (previous === null || previous.payloadEncrypted === null) {
      // Unknown or already used: same answer as success, so nothing is revealed.
      return { otpId: dummyOtpId(this.clock()) };
    }
    await this.otp.assertCanSend(previous.phoneHash);
    const pending = this.decryptPending(previous.payloadEncrypted);

    await this.otp.retire(previous.id);
    const issued = await this.otp.issue({
      phoneHash: previous.phoneHash,
      iinHash: previous.iinHash,
      payloadEncrypted: new Uint8Array(previous.payloadEncrypted),
    });
    await this.sms.sendOtp({
      phone: pending.phone,
      otpId: issued.otpId,
      code: issued.code,
      locale: pending.locale,
    });
    return { otpId: issued.otpId };
  }

  /** POST /auth/verify-otp: checks the code, creates the account and links the student record. */
  async completeRegistration(otpId: string, code: string): Promise<CompletedRegistration> {
    const row = await this.otp.check(otpId, code);
    if (row.payloadEncrypted === null) {
      throw otpExpired();
    }
    const pending = this.decryptPending(row.payloadEncrypted);

    const { userId, studentId } = await this.transactions.run(async (db) => {
      await this.otp.consume(row.id, db);
      const user = await this.users.createStudentUser(
        { passwordHash: pending.passwordHash, locale: pending.locale },
        db,
      );
      await this.audit.record(
        {
          actorId: user.id,
          entity: 'user',
          entityId: user.id,
          action: 'create',
          after: { role: 'student', locale: pending.locale },
        },
        db,
      );
      const linkedStudentId = await this.matching.linkOrCreate(
        { userId: user.id, iin: pending.iin, phone: pending.phone, fullName: pending.fullName },
        db,
      );
      return { userId: user.id, studentId: linkedStudentId };
    });

    // FR-11: the account exists, guardian_consent_at stays empty; consent is a separate step.
    return { userId, studentId, guardianConsentRequired: isMinor(pending.iin, this.clock()) };
  }

  private decryptPending(payload: Uint8Array): PendingRegistration {
    const parsed: unknown = JSON.parse(this.crypto.decrypt(payload));
    return pendingRegistrationSchema.parse(parsed);
  }
}
