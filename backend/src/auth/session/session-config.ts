// Session settings (BE-08). The session is a JWT in an httpOnly cookie, valid for 8 hours.

export const SESSION_COOKIE = 'session';
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

// 32 random bytes written as hex give 64 characters; anything shorter than 32 is too weak for HS256.
const MIN_SECRET_LENGTH = 32;

/** Reads JWT_SECRET from the environment. The app refuses to start without a strong secret. */
export function loadJwtSecret(env: NodeJS.ProcessEnv = process.env): string {
  const secret = env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET must be set in backend/.env');
  }
  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters long`);
  }
  return secret;
}
