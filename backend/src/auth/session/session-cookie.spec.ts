import type { Request, Response } from 'express';
import { clearSessionCookie, readSessionCookie, setSessionCookie } from './session-cookie.js';

describe('session cookie', () => {
  const res = { cookie: vi.fn(), clearCookie: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sets an httpOnly, SameSite=Strict cookie for 8 hours, not Secure outside production', () => {
    setSessionCookie(res as unknown as Response, 'token', { NODE_ENV: 'development' });
    expect(res.cookie).toHaveBeenCalledWith('session', 'token', {
      httpOnly: true,
      sameSite: 'strict',
      secure: false,
      path: '/',
      maxAge: 8 * 60 * 60 * 1000,
    });
  });

  it('marks the cookie Secure in production', () => {
    setSessionCookie(res as unknown as Response, 'token', { NODE_ENV: 'production' });
    expect(res.cookie).toHaveBeenCalledWith(
      'session',
      'token',
      expect.objectContaining({ secure: true }),
    );
  });

  it('clears the cookie with the same attributes', () => {
    clearSessionCookie(res as unknown as Response, { NODE_ENV: 'production' });
    expect(res.clearCookie).toHaveBeenCalledWith('session', {
      httpOnly: true,
      sameSite: 'strict',
      secure: true,
      path: '/',
    });
  });

  it.each([
    ['no cookies at all', undefined, null],
    ['no session cookie', { other: 'x' }, null],
    ['an empty value', { session: '' }, null],
    ['a non-string value', { session: { nested: true } }, null],
    ['a token', { session: 'abc' }, 'abc'],
  ])('reads %s', (_case, cookies, expected) => {
    expect(readSessionCookie({ cookies } as unknown as Request)).toBe(expected);
  });
});
