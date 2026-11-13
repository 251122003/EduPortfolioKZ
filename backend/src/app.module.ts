import { Module } from '@nestjs/common';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Root module: connects the feature modules. New modules (auth, awards, ...) are added to imports.
@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
