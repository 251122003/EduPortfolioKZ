import { Injectable } from '@nestjs/common';
import { IdentityCrypto, normalizeName } from '../common/identity/identity-crypto.js';
import type { DbClient } from '../prisma/transaction-runner.js';
import { studentDataMismatch } from './auth.errors.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { StudentRepository } from './repositories/student.repository.js';

export interface NewStudentIdentity {
  userId: string;
  iin: string;
  phone: string;
  fullName: string;
}

// UC-1 step 7-8 (FR-9, FR-10): attaches the new account to the organizer's record
// only when IIN, normalized full name and phone all match. With no record for the IIN
// an empty profile is created. Any partial match is refused with 409, and no awards are attached.
@Injectable()
export class MatchingService {
  constructor(
    private readonly students: StudentRepository,
    private readonly audit: AuditLogRepository,
    private readonly crypto: IdentityCrypto,
  ) {}

  /** Returns the id of the student linked to the user. Runs inside the registration transaction. */
  async linkOrCreate(identity: NewStudentIdentity, db: DbClient): Promise<string> {
    const iinHash = this.crypto.hash('iin', identity.iin);
    const phoneHash = this.crypto.hash('phone', identity.phone);

    // One phone belongs to one account (partial unique index in migration.sql).
    if (await this.students.isPhoneClaimed(phoneHash, db)) {
      throw studentDataMismatch();
    }

    const existing = await this.students.findByIinHash(iinHash, db);
    if (existing === null) {
      const created = await this.students.createClaimed(
        {
          userId: identity.userId,
          iinHash,
          iinEncrypted: this.crypto.encrypt(identity.iin),
          phoneHash,
          phoneEncrypted: this.crypto.encrypt(identity.phone),
          fullName: identity.fullName,
        },
        db,
      );
      await this.audit.record(
        {
          actorId: identity.userId,
          entity: 'student',
          entityId: created.id,
          action: 'create',
          after: { status: 'claimed', userId: identity.userId },
        },
        db,
      );
      return created.id;
    }

    const sameRecord =
      existing.userId === null &&
      existing.phoneHash === phoneHash &&
      normalizeName(existing.fullName) === normalizeName(identity.fullName);
    if (!sameRecord) {
      throw studentDataMismatch();
    }

    const claimed = await this.students.claim(existing.id, identity.userId, db);
    await this.audit.record(
      {
        actorId: identity.userId,
        entity: 'student',
        entityId: claimed.id,
        action: 'claim',
        before: { status: existing.status, userId: null },
        after: { status: 'claimed', userId: identity.userId },
      },
      db,
    );
    return claimed.id;
  }
}
