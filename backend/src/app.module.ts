import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { IdentityModule } from './common/identity/identity.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Root module: connects the feature modules. New modules (auth, awards, ...) are added to imports.
// The global filter is registered here (not in main.ts) so e2e tests built from AppModule get it too.
@Module({
  imports: [PrismaModule, IdentityModule, HealthModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule {}
