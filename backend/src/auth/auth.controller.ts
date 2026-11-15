import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import {
  type OtpSentResponse,
  type RegisterStudentInput,
  type ResendOtpRequest,
  resendOtpSchema,
  registerStudentSchema,
  type StudentRegisteredResponse,
  type VerifyOtpRequest,
  verifyOtpSchema,
} from './auth.contracts.js';
import { RegistrationService } from './registration.service.js';

// Student registration endpoints (UC-1). Only validation and delegation here; rules live in services.
@Controller('auth')
export class AuthController {
  constructor(private readonly registration: RegistrationService) {}

  @Post('register/student')
  @HttpCode(HttpStatus.ACCEPTED)
  register(
    @Body(new ZodValidationPipe(registerStudentSchema)) body: RegisterStudentInput,
  ): Promise<OtpSentResponse> {
    return this.registration.startRegistration(body);
  }

  @Post('verify-otp')
  @HttpCode(HttpStatus.CREATED)
  verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpRequest,
  ): Promise<StudentRegisteredResponse> {
    return this.registration.completeRegistration(body.otpId, body.code);
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.ACCEPTED)
  resendOtp(
    @Body(new ZodValidationPipe(resendOtpSchema)) body: ResendOtpRequest,
  ): Promise<OtpSentResponse> {
    return this.registration.resendCode(body.otpId);
  }
}
