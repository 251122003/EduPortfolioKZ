import { ForbiddenException, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRoleName } from '../auth.contracts.js';
import { currentUserFrom } from './current-user.decorator.js';
import { Roles } from './roles.decorator.js';
import { RolesGuard } from './roles.guard.js';
import { SessionGuard } from './session.guard.js';
import type { AuthenticatedRequest, SessionService } from './session.service.js';

class ExampleController {
  @Roles('admin')
  adminOnly(this: void): void {}

  open(this: void): void {}
}

function contextFor(request: Partial<AuthenticatedRequest>, handler: () => void): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => handler,
    getClass: () => ExampleController,
  } as unknown as ExecutionContext;
}

const { adminOnly, open } = ExampleController.prototype;

describe('SessionGuard', () => {
  const sessions = { verify: vi.fn() };
  const guard = new SessionGuard(sessions as unknown as SessionService);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('answers 401 without a session cookie and does not look at tokens', async () => {
    await expect(guard.canActivate(contextFor({ cookies: {} }, open))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(sessions.verify).not.toHaveBeenCalled();
  });

  it('answers 401 for an invalid token', async () => {
    sessions.verify.mockResolvedValue(null);
    await expect(
      guard.canActivate(contextFor({ cookies: { session: 'bad' } }, open)),
    ).rejects.toMatchObject({ response: { code: 'UNAUTHORIZED' } });
  });

  it('puts the session user on the request', async () => {
    const user = { userId: 'user-1', role: 'student' };
    sessions.verify.mockResolvedValue(user);
    const request: Partial<AuthenticatedRequest> = { cookies: { session: 'good' } };
    await expect(guard.canActivate(contextFor(request, open))).resolves.toBe(true);
    expect(sessions.verify).toHaveBeenCalledWith('good');
    expect(request.user).toEqual(user);
  });
});

describe('RolesGuard', () => {
  const guard = new RolesGuard(new Reflector());
  const as = (role: UserRoleName): Partial<AuthenticatedRequest> => ({
    user: { userId: 'user-1', role },
  });

  it('lets any signed-in user through a route without @Roles', () => {
    expect(guard.canActivate(contextFor(as('student'), open))).toBe(true);
  });

  it('lets the listed role through', () => {
    expect(guard.canActivate(contextFor(as('admin'), adminOnly))).toBe(true);
  });

  it('answers 403 for another role', () => {
    expect(() => guard.canActivate(contextFor(as('organization'), adminOnly))).toThrow(
      ForbiddenException,
    );
  });

  it('answers 401 when SessionGuard did not run', () => {
    expect(() => guard.canActivate(contextFor({}, adminOnly))).toThrow(UnauthorizedException);
  });
});

describe('currentUserFrom', () => {
  it('returns the user that SessionGuard set', () => {
    const user = { userId: 'user-1', role: 'admin' as const };
    expect(currentUserFrom(contextFor({ user }, open))).toBe(user);
  });

  it('answers 401 without a user', () => {
    expect(() => currentUserFrom(contextFor({}, open))).toThrow(UnauthorizedException);
  });
});
