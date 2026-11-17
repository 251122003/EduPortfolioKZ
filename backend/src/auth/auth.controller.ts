import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ZodValidationPipe } from '../common/validation/zod-validation.pipe.js';
import {
  type LoginInput,
  loginSchema,
  type MeResponse,
  type OtpSentResponse,
  type RegisterStudentInput,
  type ResendOtpRequest,
  resendOtpSchema,
  registerStudentSchema,
  type SessionResponse,
  type StudentRegisteredResponse,
  type VerifyOtpRequest,
  verifyOtpSchema,
} from './auth.contracts.js';
import { LoginService } from './login.service.js';
import { RegistrationService } from './registration.service.js';
import { CurrentUser } from './session/current-user.decorator.js';
import { clearSessionCookie, setSessionCookie } from './session/session-cookie.js';
import { SessionGuard } from './session/session.guard.js';
import { type SessionUser, SessionService } from './session/session.service.js';

// Registration (UC-1) and sign-in (FR-25) endpoints. Only validation, delegation and the
// session cookie here; rules live in services.
@Controller('auth')
export class AuthController {
  constructor(
    private readonly registration: RegistrationService,
    private readonly loginService: LoginService,
    private readonly sessions: SessionService,
  ) {}

  @Post('register/student')
  @HttpCode(HttpStatus.ACCEPTED)
  register(
    @Body(new ZodValidationPipe(registerStudentSchema)) body: RegisterStudentInput,
  ): Promise<OtpSentResponse> {
    return this.registration.startRegistration(body);
  }

  /** Finishes registration and signs the student in (sequence diagram 2: 201 + Set-Cookie). */
  @Post('verify-otp')
  @HttpCode(HttpStatus.CREATED)
  async verifyOtp(
    @Body(new ZodValidationPipe(verifyOtpSchema)) body: VerifyOtpRequest,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StudentRegisteredResponse> {
    const result = await this.registration.completeRegistration(body.otpId, body.code);
    setSessionCookie(res, await this.sessions.issue({ userId: result.userId, role: 'student' }));
    return { studentId: result.studentId, guardianConsentRequired: result.guardianConsentRequired };
  }

  @Post('resend-otp')
  @HttpCode(HttpStatus.ACCEPTED)
  resendOtp(
    @Body(new ZodValidationPipe(resendOtpSchema)) body: ResendOtpRequest,
  ): Promise<OtpSentResponse> {
    return this.registration.resendCode(body.otpId);
  }

  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body(new ZodValidationPipe(loginSchema)) body: LoginInput,
    @Res({ passthrough: true }) res: Response,
  ): Promise<SessionResponse> {
    const user = await this.loginService.login(body);
    setSessionCookie(res, await this.sessions.issue(user));
    return { userId: user.userId, role: user.role };
  }

  /** Always 204, with or without a session: the cookie is simply removed. */
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  logout(@Res({ passthrough: true }) res: Response): void {
    clearSessionCookie(res);
  }

  @Get('me')
  @UseGuards(SessionGuard)
  me(@CurrentUser() user: SessionUser): Promise<MeResponse> {
    return this.loginService.me(user.userId);
  }
}
