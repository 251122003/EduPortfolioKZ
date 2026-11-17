import type { Response } from 'express';
import { AuthController } from './auth.controller.js';
import type { RegisterStudentInput } from './auth.contracts.js';
import type { LoginService } from './login.service.js';
import type { RegistrationService } from './registration.service.js';
import type { SessionService } from './session/session.service.js';

// The controller only hands validated bodies to services and sets or clears the session cookie.
describe('AuthController', () => {
  const registration = {
    startRegistration: vi.fn().mockResolvedValue({ otpId: 'otp-1' }),
    completeRegistration: vi.fn().mockResolvedValue({
      userId: 'user-1',
      studentId: 'student-1',
      guardianConsentRequired: false,
    }),
    resendCode: vi.fn().mockResolvedValue({ otpId: 'otp-2' }),
  };
  const loginService = {
    login: vi.fn().mockResolvedValue({ userId: 'user-2', role: 'organization' }),
    me: vi.fn().mockResolvedValue({ userId: 'user-2', role: 'organization' }),
  };
  const sessions = { issue: vi.fn().mockResolvedValue('signed-token') };
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };

  const controller = new AuthController(
    registration as unknown as RegistrationService,
    loginService as unknown as LoginService,
    sessions as unknown as SessionService,
  );

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('register passes the body to startRegistration', async () => {
    const body = { iin: '080315600016' } as RegisterStudentInput;
    await expect(controller.register(body)).resolves.toEqual({ otpId: 'otp-1' });
    expect(registration.startRegistration).toHaveBeenCalledWith(body);
  });

  it('verifyOtp signs the new student in and does not return the user id', async () => {
    const body = await controller.verifyOtp(
      { otpId: 'otp-1', code: '123456' },
      res as unknown as Response,
    );
    expect(registration.completeRegistration).toHaveBeenCalledWith('otp-1', '123456');
    expect(body).toEqual({ studentId: 'student-1', guardianConsentRequired: false });
    expect(sessions.issue).toHaveBeenCalledWith({ userId: 'user-1', role: 'student' });
    expect(res.cookie).toHaveBeenCalledWith(
      'session',
      'signed-token',
      expect.objectContaining({ httpOnly: true, sameSite: 'strict' }),
    );
  });

  it('resendOtp passes otpId', async () => {
    await expect(controller.resendOtp({ otpId: 'otp-1' })).resolves.toEqual({ otpId: 'otp-2' });
    expect(registration.resendCode).toHaveBeenCalledWith('otp-1');
  });

  it('login sets the session cookie and returns who signed in', async () => {
    const input = { login: 'org@eduportfolio.test', password: 'secret' };
    const body = await controller.login(input, res as unknown as Response);
    expect(loginService.login).toHaveBeenCalledWith(input);
    expect(sessions.issue).toHaveBeenCalledWith({ userId: 'user-2', role: 'organization' });
    expect(res.cookie).toHaveBeenCalledWith('session', 'signed-token', expect.any(Object));
    expect(body).toEqual({ userId: 'user-2', role: 'organization' });
  });

  it('logout clears the session cookie', () => {
    controller.logout(res as unknown as Response);
    expect(res.clearCookie).toHaveBeenCalledWith('session', expect.objectContaining({ path: '/' }));
  });

  it('me reads the profile of the signed-in user', async () => {
    await controller.me({ userId: 'user-2', role: 'organization' });
    expect(loginService.me).toHaveBeenCalledWith('user-2');
  });
});
