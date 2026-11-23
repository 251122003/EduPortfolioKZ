import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, request } from './http';

function mockFetch(response: Response): ReturnType<typeof vi.fn> {
  const fn = vi.fn().mockResolvedValue(response);
  vi.stubGlobal('fetch', fn);
  return fn;
}

describe('request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the /api prefix and same-origin credentials', async () => {
    const fetchFn = mockFetch(Response.json({ ok: true }));
    await expect(request('/auth/me')).resolves.toEqual({ ok: true });

    expect(fetchFn).toHaveBeenCalledWith(
      '/api/auth/me',
      expect.objectContaining({ credentials: 'same-origin' }),
    );
  });

  it('returns undefined for 204', async () => {
    mockFetch(new Response(null, { status: 204 }));
    await expect(request('/auth/logout', { method: 'POST' })).resolves.toBeUndefined();
  });

  it('throws ApiError with code and message from the error body', async () => {
    mockFetch(Response.json({ error: { code: 'UNAUTHORIZED', message: 'Sign in required' } }, { status: 401 }));
    const error: unknown = await request('/auth/me').catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 401, code: 'UNAUTHORIZED', message: 'Sign in required' });
  });

  it('reads attemptsLeft when the error body has it', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'OTP_INVALID', message: 'Wrong code', attemptsLeft: 3 } },
        { status: 400 },
      ),
    );
    await expect(request('/auth/verify-otp')).rejects.toMatchObject({
      status: 400,
      code: 'OTP_INVALID',
      attemptsLeft: 3,
    });
  });

  it('ignores attemptsLeft that is not a number', async () => {
    mockFetch(
      Response.json(
        { error: { code: 'OTP_INVALID', message: 'Wrong code', attemptsLeft: 'x' } },
        { status: 400 },
      ),
    );
    await expect(request('/auth/verify-otp')).rejects.toMatchObject({ attemptsLeft: undefined });
  });

  it('uses UNKNOWN when the error body has another shape', async () => {
    mockFetch(new Response('oops', { status: 500, statusText: 'Internal Server Error' }));
    await expect(request('/auth/me')).rejects.toMatchObject({ status: 500, code: 'UNKNOWN' });
  });

  it('uses NETWORK_ERROR when fetch fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    await expect(request('/auth/me')).rejects.toMatchObject({ status: 0, code: 'NETWORK_ERROR' });
  });
});
