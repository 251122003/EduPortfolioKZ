import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMe, login, logout, registerStudent, resendOtp, verifyOtp } from './auth';

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('auth API', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('login posts the body to /api/auth/login', async () => {
    const fetchFn = mockFetch(Response.json({ userId: 'u1', role: 'student' }));
    const body = { phone: '+77001234567', password: 'secret123' };

    await expect(login(body)).resolves.toEqual({ userId: 'u1', role: 'student' });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('logout posts to /api/auth/logout', async () => {
    const fetchFn = mockFetch(new Response(null, { status: 204 }));

    await expect(logout()).resolves.toBeUndefined();
    expect(fetchFn).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('getMe reads /api/auth/me', async () => {
    const fetchFn = mockFetch(Response.json({ userId: 'u1' }));

    await expect(getMe()).resolves.toEqual({ userId: 'u1' });
    expect(fetchFn).toHaveBeenCalledWith('/api/auth/me', expect.any(Object));
  });

  it('registerStudent posts the body to /api/auth/register/student', async () => {
    const fetchFn = mockFetch(Response.json({ otpId: 'o1' }, { status: 202 }));
    const body = {
      iin: '000000000000',
      fullName: 'Иванов Иван',
      phone: '+77001234567',
      password: 'secret123',
      locale: 'ru' as const,
    };

    await expect(registerStudent(body)).resolves.toEqual({ otpId: 'o1' });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/register/student',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('verifyOtp posts otpId and code to /api/auth/verify-otp', async () => {
    const result = { studentId: 's1', guardianConsentRequired: false };
    const fetchFn = mockFetch(Response.json(result, { status: 201 }));
    const body = { otpId: 'o1', code: '123456' };

    await expect(verifyOtp(body)).resolves.toEqual(result);
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/verify-otp',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(body) }),
    );
  });

  it('resendOtp posts otpId to /api/auth/resend-otp', async () => {
    const fetchFn = mockFetch(Response.json({ otpId: 'o2' }, { status: 202 }));

    await expect(resendOtp({ otpId: 'o1' })).resolves.toEqual({ otpId: 'o2' });
    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/resend-otp',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ otpId: 'o1' }) }),
    );
  });
});
