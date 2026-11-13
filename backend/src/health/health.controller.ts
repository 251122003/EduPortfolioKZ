import { Controller, Get, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';

export interface HealthStatus {
  status: 'ok';
  database: 'up';
}

// GET /health: answers 200 when the API and the database both work, 503 otherwise.
// Used to check a deployment and by uptime monitors.
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthStatus> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      this.logger.error(`Database check failed: ${reason}`);
      throw new ServiceUnavailableException('Database is unavailable');
    }
    return { status: 'ok', database: 'up' };
  }
}
