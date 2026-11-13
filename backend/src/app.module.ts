import { Module } from '@nestjs/common';
import { IdentityModule } from './common/identity/identity.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Root module: connects the feature modules. New modules (auth, awards, ...) are added to imports.
@Module({
  imports: [PrismaModule, IdentityModule, HealthModule],
})
export class AppModule {}
