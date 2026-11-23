import { afterEach, describe, expect, it, vi } from 'vitest';
import { getMe, login, logout } from './auth';

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
});
