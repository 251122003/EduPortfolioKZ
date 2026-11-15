import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { CLOCK, systemClock } from './clock.js';
import { MatchingService } from './matching.service.js';
import { OtpService } from './otp.service.js';
import { RegistrationService } from './registration.service.js';
import { AuditLogRepository } from './repositories/audit-log.repository.js';
import { OtpRepository } from './repositories/otp.repository.js';
import { StudentRepository } from './repositories/student.repository.js';
import { UserRepository } from './repositories/user.repository.js';
import { createSmsSender, SMS_SENDER } from './sms/sms-sender.js';

// Student registration (UC-1). Login and sessions come in BE-08.
@Module({
  controllers: [AuthController],
  providers: [
    RegistrationService,
    OtpService,
    MatchingService,
    OtpRepository,
    StudentRepository,
    UserRepository,
    AuditLogRepository,
    { provide: SMS_SENDER, useFactory: () => createSmsSender() },
    { provide: CLOCK, useValue: systemClock },
  ],
})
export class AuthModule {}
