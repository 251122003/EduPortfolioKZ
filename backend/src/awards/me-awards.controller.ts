import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/session/current-user.decorator.js';
import { Roles } from '../auth/session/roles.decorator.js';
import { RolesGuard } from '../auth/session/roles.guard.js';
import { SessionGuard } from '../auth/session/session.guard.js';
import type { SessionUser } from '../auth/session/session.service.js';
import type { StudentAwardsResponse } from './awards.types.js';
import { StudentAwardsService } from './student-awards.service.js';

// Student's own data (FR-12). No body, query or params, so there is nothing to validate.
@Controller('me')
@UseGuards(SessionGuard, RolesGuard)
@Roles('student')
export class MeAwardsController {
  constructor(private readonly studentAwards: StudentAwardsService) {}

  @Get('awards')
  awards(@CurrentUser() user: SessionUser): Promise<StudentAwardsResponse> {
    return this.studentAwards.listForUser(user.userId);
  }
}
