import { Injectable } from '@nestjs/common';
import { notSignedIn } from '../auth/auth.errors.js';
import type { StudentAward, StudentAwardsResponse } from './awards.types.js';
import {
  type StudentAwardRow,
  StudentAwardsRepository,
} from './student-awards.repository.js';

// FR-12: a signed-in student sees all own awards, revoked ones included and marked.
@Injectable()
export class StudentAwardsService {
  constructor(private readonly awards: StudentAwardsRepository) {}

  /** GET /me/awards. A student account without a student record is treated as signed out. */
  async listForUser(userId: string): Promise<StudentAwardsResponse> {
    const studentId = await this.awards.findStudentIdByUserId(userId);
    if (studentId === null) {
      throw notSignedIn();
    }
    const rows = await this.awards.findByStudentId(studentId);
    return { awards: rows.map(toStudentAward) };
  }
}

function toStudentAward(row: StudentAwardRow): StudentAward {
  return {
    id: row.id,
    type: row.type,
    place: row.place,
    documentNumber: row.documentNumber,
    status: row.status,
    revokeReason:
      row.status === 'revoked' ? (row.changeRequests[0]?.reason ?? null) : null,
    event: {
      title: row.event.title,
      subject: row.event.subject,
      // eventDate is a DATE column: Prisma gives midnight UTC, so the UTC day is the event day.
      date: row.event.eventDate.toISOString().slice(0, 10),
      level: row.event.level,
    },
    organization: {
      name: row.event.organization.name,
      status: row.event.organization.status,
    },
  };
}
