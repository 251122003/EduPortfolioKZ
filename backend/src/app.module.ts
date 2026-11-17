import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AuthModule } from './auth/auth.module.js';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter.js';
import { IdentityModule } from './common/identity/identity.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';

// Root module: connects the feature modules. New modules (auth, awards, ...) are added to imports.
// The global filter and the cookie parser are registered here (not in main.ts),
// so e2e tests built from AppModule get them too.
@Module({
  imports: [PrismaModule, IdentityModule, HealthModule, AuthModule],
  providers: [{ provide: APP_FILTER, useClass: AllExceptionsFilter }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Fills req.cookies; SessionGuard reads the session cookie from it.
    consumer.apply(cookieParser()).forRoutes('{*path}');
  }
}
