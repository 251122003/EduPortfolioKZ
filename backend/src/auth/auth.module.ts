import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller.js';
import { CLOCK, systemClock } from './clock.js';
import { LoginService } from './login.service.js';
import { MatchingService } from './matching.service.js';
import { OtpService } from './otp.service.js';
import { RegistrationService } from './registration.service.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { OtpRepository } from './repositories/otp.repository.js';
import { StudentRepository } from './repositories/student.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { RolesGuard } from './session/roles.guard.js';
import { loadJwtSecret } from './session/session-config.js';
import { SessionGuard } from './session/session.guard.js';
import { SessionService } from './session/session.service.js';
import { createSmsSender, SMS_SENDER } from './sms/sms-sender.js';

// Student registration (UC-1), sign-in and sessions (FR-25).
// Other modules import AuthModule to protect routes with SessionGuard, RolesGuard and @Roles.
@Module({
  imports: [
    // loadJwtSecret throws without JWT_SECRET, so the app does not start without it.
    JwtModule.registerAsync({ useFactory: () => ({ secret: loadJwtSecret() }) }),
  ],
  controllers: [AuthController],
  providers: [
    RegistrationService,
    LoginService,
    SessionService,
    SessionGuard,
    RolesGuard,
    OtpService,
    MatchingService,
    OtpRepository,
    StudentRepository,
    UserRepository,
    AuditLogRepository,
    { provide: SMS_SENDER, useFactory: () => createSmsSender() },
    { provide: CLOCK, useValue: systemClock },
  ],
  exports: [SessionService, SessionGuard, RolesGuard],
})
export class AuthModule {}
