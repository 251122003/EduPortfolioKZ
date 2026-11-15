import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from './prisma.service.js';

// A database client that repositories accept so that several writes can share one transaction.
// Services only pass it along; they never call Prisma themselves.
export type DbClient = Prisma.TransactionClient;

@Injectable()
export class TransactionRunner {
  constructor(private readonly prisma: PrismaService) {}

  /** Runs the work in one transaction: if it throws, every write inside is rolled back. */
  run<T>(work: (db: DbClient) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(work);
  }
}
