import { AuthController } from './auth.controller.js';
import type { RegisterStudentInput } from './auth.contracts.js';
import type { RegistrationService } from './registration.service.js';

// The controller only hands validated bodies to RegistrationService.
describe('AuthController', () => {
  const registration = {
    startRegistration: vi.fn().mockResolvedValue({ otpId: 'otp-1' }),
    completeRegistration: vi
      .fn()
      .mockResolvedValue({ studentId: 'student-1', guardianConsentRequired: false }),
    resendCode: vi.fn().mockResolvedValue({ otpId: 'otp-2' }),
  };
  const controller = new AuthController(registration as unknown as RegistrationService);

  it('register passes the body to startRegistration', async () => {
    const body = { iin: '080315600016' } as RegisterStudentInput;
    await expect(controller.register(body)).resolves.toEqual({ otpId: 'otp-1' });
    expect(registration.startRegistration).toHaveBeenCalledWith(body);
  });

  it('verifyOtp passes otpId and code', async () => {
    await controller.verifyOtp({ otpId: 'otp-1', code: '123456' });
    expect(registration.completeRegistration).toHaveBeenCalledWith('otp-1', '123456');
  });

  it('resendOtp passes otpId', async () => {
    await expect(controller.resendOtp({ otpId: 'otp-1' })).resolves.toEqual({ otpId: 'otp-2' });
    expect(registration.resendCode).toHaveBeenCalledWith('otp-1');
  });
});
