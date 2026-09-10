import { Controller, Get, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly consumerStatus: ConsumerStatusService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Health check endpoint' })
  check() {
    // Public, unauthenticated route (no global APP_GUARD covers /v1/health —
    // see ConsumerStatusService for what that means for this response).
    //
    // This reports the RMQ consumer BOOTSTRAP, not consumer liveness, and the
    // field is named for what it actually measures. startRabbitMqConsumers
    // returns once it has connected and is never consulted again, so a broker
    // that dies an hour after boot leaves this reading 'complete'. Reporting
    // that as `consumers: 'connected'` would be the same defect as the old
    // hardcoded `database: 'connected'` on /health/db — a claim the endpoint
    // never checks. Runtime liveness needs the consumer-count signal
    // QueueMonitoringService already polls; that is filed separately.
    //
    // Never returns a non-200: a pending bootstrap is degraded, not unhealthy —
    // the HTTP process genuinely works.
    const { state } = this.consumerStatus.getSnapshot();
    const bootstrapState =
      state === 'connected' ? 'complete' : state === 'connecting' ? 'pending' : 'retrying';
    return {
      status: state === 'connected' ? 'ok' : 'degraded',
      consumerBootstrap: bootstrapState,
      timestamp: new Date().toISOString(),
      service: 'ybb-api-gateway',
      version: '1.0.0',
    };
  }

  @Get('db')
  @ApiOperation({ summary: 'Database health check' })
  async checkDatabase() {
    try {
      await this.prismaRead.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'connected',
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      // Public route — log the real error server-side, never in the response
      // body (no error string, no stack, nothing that leaks internals).
      this.logger.error(
        `Database health check failed: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      return {
        status: 'error',
        database: 'disconnected',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
