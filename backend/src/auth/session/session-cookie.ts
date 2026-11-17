import type { CookieOptions, Request, Response } from 'express';
import { SESSION_COOKIE, SESSION_TTL_SECONDS } from './session-config.js';

// Session cookie helpers. Used by the controller and the guard only: services never touch req or res.
// NFR-5: httpOnly, SameSite=Strict, Secure in production (local development runs on plain http).

function baseOptions(env: NodeJS.ProcessEnv): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: env.NODE_ENV === 'production',
    path: '/',
  };
}

export function setSessionCookie(
  res: Response,
  token: string,
  env: NodeJS.ProcessEnv = process.env,
): void {
  res.cookie(SESSION_COOKIE, token, { ...baseOptions(env), maxAge: SESSION_TTL_SECONDS * 1000 });
}

export function clearSessionCookie(res: Response, env: NodeJS.ProcessEnv = process.env): void {
  res.clearCookie(SESSION_COOKIE, baseOptions(env));
}

/** The token from the cookie (parsed by cookie-parser), or null when there is none. */
export function readSessionCookie(req: Request): string | null {
  const cookies: unknown = req.cookies;
  if (typeof cookies !== 'object' || cookies === null) {
    return null;
  }
  const value: unknown = (cookies as Record<string, unknown>)[SESSION_COOKIE];
  return typeof value === 'string' && value !== '' ? value : null;
}
