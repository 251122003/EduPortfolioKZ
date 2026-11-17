import { type CustomDecorator, SetMetadata } from '@nestjs/common';
import type { UserRoleName } from '../auth.contracts.js';

export const ROLES_KEY = 'roles';

/** Allows a route (or a whole controller) only for the listed roles. Needs SessionGuard + RolesGuard. */
export function Roles(...roles: UserRoleName[]): CustomDecorator<string> {
  return SetMetadata(ROLES_KEY, roles);
}
