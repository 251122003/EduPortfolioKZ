import { GUARDS_METADATA } from '@nestjs/common/constants.js';
import { ROLES_KEY } from '../auth/session/roles.decorator.js';
import { RolesGuard } from '../auth/session/roles.guard.js';
import { SessionGuard } from '../auth/session/session.guard.js';
import { MeAwardsController } from './me-awards.controller.js';
import type { StudentAwardsService } from './student-awards.service.js';

describe('MeAwardsController', () => {
  const studentAwards = {
    listForUser: vi.fn().mockResolvedValue({ awards: [] }),
  };
  const controller = new MeAwardsController(
    studentAwards as unknown as StudentAwardsService,
  );

  it('lists the awards of the signed-in user', async () => {
    await expect(
      controller.awards({ userId: 'user-1', role: 'student' }),
    ).resolves.toEqual({
      awards: [],
    });
    expect(studentAwards.listForUser).toHaveBeenCalledWith('user-1');
  });

  it('is protected by SessionGuard and RolesGuard and open only to students', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, MeAwardsController)).toEqual([
      SessionGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, MeAwardsController)).toEqual([
      'student',
    ]);
  });
});
