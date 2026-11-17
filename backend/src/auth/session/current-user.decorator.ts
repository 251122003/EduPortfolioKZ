import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { notSignedIn } from '../auth.errors.js';
import type { AuthenticatedRequest, SessionUser } from './session.service.js';

/** Reads the user that SessionGuard put on the request. */
export function currentUserFrom(context: ExecutionContext): SessionUser {
  const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
  if (user === undefined) {
    throw notSignedIn();
  }
  return user;
}

/** Route parameter with the signed-in user. Use together with @UseGuards(SessionGuard). */
export const CurrentUser = createParamDecorator((_data: unknown, context: ExecutionContext) =>
  currentUserFrom(context),
);
