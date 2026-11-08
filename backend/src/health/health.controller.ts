import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';

/** Liveness = process is up. Readiness = dependencies reachable. Used by Docker/Kubernetes probes. */
@Public()
@SkipThrottle()
@ApiExcludeController()
@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  @Get('live')
  live() {
    return { status: 'ok' };
  }

  @Get('ready')
  async ready() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      await this.redis.ping();
    } catch {
      throw new ServiceUnavailableException('Dependencies unavailable');
    }
    return { status: 'ok' };
  }
}
