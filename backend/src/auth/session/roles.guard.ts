import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRoleName } from '../auth.contracts.js';
import { forbidden, notSignedIn } from '../auth.errors.js';
import { ROLES_KEY } from './roles.decorator.js';
import type { AuthenticatedRequest } from './session.service.js';

// Checks @Roles(...). Runs after SessionGuard: 403 FORBIDDEN when the role is not in the list.
// A route without @Roles is open to any signed-in user.
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const roles = this.reflector.getAllAndOverride<UserRoleName[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (roles === undefined || roles.length === 0) {
      return true;
    }
    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;
    if (user === undefined) {
      // RolesGuard used without SessionGuard in front of it.
      throw notSignedIn();
    }
    if (!roles.includes(user.role)) {
      throw forbidden();
    }
    return true;
  }
}
