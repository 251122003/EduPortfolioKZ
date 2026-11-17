import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { notSignedIn } from '../auth.errors.js';
import { readSessionCookie } from './session-cookie.js';
import { type AuthenticatedRequest, SessionService } from './session.service.js';

// Lets the request through only with a valid session cookie; otherwise 401 UNAUTHORIZED.
// Puts { userId, role } into request.user for RolesGuard and @CurrentUser().
// Usage: @UseGuards(SessionGuard) or, with roles, @UseGuards(SessionGuard, RolesGuard) @Roles('admin').
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(private readonly sessions: SessionService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const token = readSessionCookie(request);
    const user = token === null ? null : await this.sessions.verify(token);
    if (user === null) {
      throw notSignedIn();
    }
    request.user = user;
    return true;
  }
}
