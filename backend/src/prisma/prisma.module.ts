import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service.js';
import { TransactionRunner } from './transaction-runner.js';

// @Global: every feature module can inject PrismaService without importing this module again.
@Global()
@Module({
  providers: [PrismaService, TransactionRunner],
  exports: [PrismaService, TransactionRunner],
})
export class PrismaModule {}
