import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module.js';
import { MeAwardsController } from './me-awards.controller.js';
import { StudentAwardsRepository } from './student-awards.repository.js';
import { StudentAwardsService } from './student-awards.service.js';

// Awards as the student sees them (FR-12). AuthModule gives SessionGuard and RolesGuard.
@Module({
  imports: [AuthModule],
  controllers: [MeAwardsController],
  providers: [StudentAwardsService, StudentAwardsRepository],
})
export class AwardsModule {}
