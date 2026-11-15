import { Injectable } from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import type { DbClient } from '../../prisma/transaction-runner.js';

export interface AuditEntry {
  actorId: string | null;
  entity: string;
  entityId: string;
  action: string;
  before?: Prisma.InputJsonObject;
  after?: Prisma.InputJsonObject;
}

// audit_log table (append-only, enforced by a trigger). Entries never contain IIN, phone or names.
@Injectable()
export class AuditLogRepository {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, db: DbClient = this.prisma): Promise<void> {
    await db.auditLog.create({ data: entry });
  }
}
