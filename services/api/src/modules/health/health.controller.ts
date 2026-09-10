import { Controller, Get, Logger, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';

@ApiTags('health')
@Controller('health')
export class HealthController {
  private readonly logger = new Logger(HealthController.name);

  constructor(
    private readonly prismaRead: PrismaReadService,
    private readonly consumerStatus: ConsumerStatusService,
    // Global via PrismaModule (see prisma.module.ts) -- no import needed here
    // beyond the type itself.
    private readonly unitOfWork: UnitOfWork,
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
      // N-2026-09-10-G: the runtime half consumerBootstrap can't cover (see
      // ConsumerStatusService's ConsumerActivity doc for exactly what
      // 'active'/'inactive'/'unknown' mean and the cluster-wide-count caveat).
      // Deliberately not folded into `status` above -- consumerBootstrap and
      // consumerActivity answer different questions ("did we ever connect" vs
      // "is anyone consuming right now") and collapsing them into one overall
      // status would hide which one tripped.
      consumerActivity: this.consumerStatus.getConsumerActivity(),
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

  // N-2026-09-10-D: folded from the dead src/shared/presentation/health.controller.ts,
  // which was registered in no module and 404'd in production. Unlike GET /health
  // and GET /health/db above, these two expose UnitOfWork's internal failure/success
  // counters -- operational detail, not a public liveness check -- so they get the
  // same admin-only guard pattern as admin-programs.controller.ts rather than
  // joining the public routes on this controller. Method-level (not class-level)
  // guards so /health and /health/db stay anonymous.
  @Get('circuit-breaker')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get database circuit breaker status (admin only)' })
  @ApiResponse({
    status: 200,
    description: 'Circuit breaker state',
    schema: {
      example: {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        healthy: true,
        message: 'Database operations are functioning normally',
      },
    },
  })
  getCircuitBreakerState() {
    const { state, failureCount, successCount } = this.unitOfWork.getCircuitState();

    const stateMessages = {
      closed: 'Database operations are functioning normally',
      open: 'Circuit breaker is OPEN - database operations are being rejected due to failures',
      half_open: 'Circuit breaker is testing recovery - monitoring database health',
    };

    return {
      state,
      failureCount,
      successCount,
      healthy: state === 'closed',
      message: stateMessages[state],
      timestamp: new Date().toISOString(),
    };
  }

  @Get('detailed')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Detailed health check with subsystem status (admin only)' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  detailedHealthCheck() {
    const circuitState = this.unitOfWork.getCircuitState();

    return {
      status: circuitState.state === 'closed' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      subsystems: {
        database: {
          status: circuitState.state === 'closed' ? 'healthy' : 'unhealthy',
          circuitBreaker: circuitState,
        },
        api: {
          status: 'healthy',
          version: process.env.npm_package_version || '1.0.0',
        },
      },
    };
  }
}
