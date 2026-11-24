import { Injectable } from '@nestjs/common';
import type {
  AwardStatus,
  AwardType,
  EventLevel,
  OrgStatus,
} from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';

/** An award row with only the fields GET /me/awards may show. */
export interface StudentAwardRow {
  id: string;
  type: AwardType;
  place: number | null;
  documentNumber: string;
  status: AwardStatus;
  event: {
    title: string;
    subject: string;
    eventDate: Date;
    level: EventLevel;
    organization: { name: string; status: OrgStatus };
  };
  /** At most one: the latest approved revoke request. */
  changeRequests: { reason: string }[];
}

// Read side of awards for the student profile (FR-12).
// Selects fields explicitly, so IIN, phone and encrypted columns never leave the database.
@Injectable()
export class StudentAwardsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findStudentIdByUserId(userId: string): Promise<string | null> {
    const student = await this.prisma.student.findUnique({
      where: { userId },
      select: { id: true },
    });
    return student?.id ?? null;
  }

  /** Awards of one student, newest event first, then newest record first. */
  findByStudentId(studentId: string): Promise<StudentAwardRow[]> {
    return this.prisma.award.findMany({
      where: { studentId },
      orderBy: [
        { event: { eventDate: 'desc' } },
        { createdAt: 'desc' },
        { id: 'desc' },
      ],
      select: {
        id: true,
        type: true,
        place: true,
        documentNumber: true,
        status: true,
        event: {
          select: {
            title: true,
            subject: true,
            eventDate: true,
            level: true,
            organization: { select: { name: true, status: true } },
          },
        },
        changeRequests: {
          where: { type: 'revoke', status: 'approved' },
          orderBy: { reviewedAt: 'desc' },
          take: 1,
          select: { reason: true },
        },
      },
    });
  }
}
