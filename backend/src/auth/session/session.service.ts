import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import { z } from 'zod';
import { userRoles, type UserRoleName } from '../auth.contracts.js';
import { SESSION_TTL_SECONDS } from './session-config.js';

/** Who is signed in. Kept in the JWT; holds no personal data. */
export interface SessionUser {
  userId: string;
  role: UserRoleName;
}

/** A request that passed SessionGuard. */
export interface AuthenticatedRequest extends Request {
  user?: SessionUser;
}

const claimsSchema = z.object({
  sub: z.string().min(1),
  role: z.enum(userRoles),
});

// Issues and checks session tokens. Only HS256 is accepted, so a token with
// another algorithm (including "none") is rejected even if it is otherwise well formed.
@Injectable()
export class SessionService {
  constructor(private readonly jwt: JwtService) {}

  issue(user: SessionUser): Promise<string> {
    return this.jwt.signAsync(
      { sub: user.userId, role: user.role },
      { algorithm: 'HS256', expiresIn: SESSION_TTL_SECONDS },
    );
  }

  /** Returns the session user, or null for a missing, forged, expired or malformed token. */
  async verify(token: string): Promise<SessionUser | null> {
    let claims: unknown;
    try {
      claims = await this.jwt.verifyAsync<object>(token, { algorithms: ['HS256'] });
    } catch {
      return null;
    }
    const parsed = claimsSchema.safeParse(claims);
    return parsed.success ? { userId: parsed.data.sub, role: parsed.data.role } : null;
  }
}
