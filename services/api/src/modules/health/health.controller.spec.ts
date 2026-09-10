// src/modules/health/health.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';

describe('HealthController', () => {
  let controller: HealthController;
  let consumerStatus: ConsumerStatusService;
  let mockUnitOfWork: { getCircuitState: jest.Mock };

  const mockPrismaRead = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    mockUnitOfWork = {
      getCircuitState: jest.fn().mockReturnValue({
        state: 'closed',
        failureCount: 0,
        successCount: 0,
      }),
    };

    // Guard reachability (that JwtAuthGuard/RolesGuard are actually decorated
    // onto the folded endpoints) is covered in route-authorization.spec.ts,
    // matching how the rest of the codebase splits that concern out. Here the
    // guards are stubbed to always allow, since these tests exercise handler
    // logic directly and have no interest in TokenBlacklistService/CacheService
    // plumbing.
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaReadService, useValue: mockPrismaRead },
        { provide: UnitOfWork, useValue: mockUnitOfWork },
        ConsumerStatusService,
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<HealthController>(HealthController);
    consumerStatus = module.get<ConsumerStatusService>(ConsumerStatusService);
  });

  describe('check (GET /health)', () => {
    it('reports ok and a complete bootstrap once consumers have connected', () => {
      consumerStatus.recordConnected();

      const result = controller.check();

      expect(result.status).toBe('ok');
      expect(result.consumerBootstrap).toBe('complete');
    });

    it('reports degraded while the consumer bootstrap is still pending (initial state)', () => {
      const result = controller.check();

      expect(result.status).toBe('degraded');
      expect(result.consumerBootstrap).toBe('pending');
    });

    it('carries consumerActivity from ConsumerStatusService alongside consumerBootstrap, without one overriding the other', () => {
      consumerStatus.recordConnected();
      consumerStatus.recordQueueObservation('audit_log_queue', 0);

      const result = controller.check();

      // Bootstrap completed, but a fresh zero-consumer reading still reports
      // 'inactive' -- the two fields answer different questions.
      expect(result.consumerBootstrap).toBe('complete');
      expect(result.consumerActivity).toBe('inactive');
    });

    it('reports consumerActivity unknown when no queue observation has ever been recorded', () => {
      const result = controller.check();

      expect(result.consumerActivity).toBe('unknown');
    });

    it('reports degraded while the bootstrap is retrying, without leaking the error message', () => {
      consumerStatus.recordFailure(new Error('amqp connection refused at 10.0.0.5:5672'));

      const result = controller.check();

      expect(result.status).toBe('degraded');
      expect(result.consumerBootstrap).toBe('retrying');
      expect(JSON.stringify(result)).not.toContain('10.0.0.5');
      expect(JSON.stringify(result)).not.toContain('amqp connection refused');
    });
  });

  describe('checkDatabase (GET /health/db)', () => {
    it('returns connected when the database responds', async () => {
      mockPrismaRead.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

      const result = await controller.checkDatabase();

      expect(result).toEqual({
        status: 'ok',
        database: 'connected',
        timestamp: expect.any(String),
      });
    });

    it('returns disconnected without leaking the error, and logs it server-side', async () => {
      const dbError = new Error('password authentication failed for user "app" at 10.0.0.9');
      mockPrismaRead.$queryRaw.mockRejectedValue(dbError);
      const errorSpy = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

      const result = await controller.checkDatabase();

      expect(result).toEqual({
        status: 'error',
        database: 'disconnected',
        timestamp: expect.any(String),
      });
      expect(JSON.stringify(result)).not.toContain('10.0.0.9');
      expect(JSON.stringify(result)).not.toContain('password authentication failed');
      expect(errorSpy).toHaveBeenCalled();

      errorSpy.mockRestore();
    });
  });

  // N-2026-09-10-D: these two were folded from the dead
  // shared/presentation/health.controller.ts onto this live controller.
  // Guard reachability itself (that the decorators are actually present, not
  // just that the handler logic works when called directly) is asserted in
  // route-authorization.spec.ts, matching how M74/M210 are covered there.
  describe('getCircuitBreakerState (GET /health/circuit-breaker)', () => {
    it('reports the circuit state from UnitOfWork', () => {
      const result = controller.getCircuitBreakerState();

      expect(result).toMatchObject({
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        healthy: true,
      });
    });

    it('reports unhealthy when the circuit is open', () => {
      mockUnitOfWork.getCircuitState.mockReturnValue({
        state: 'open',
        failureCount: 5,
        successCount: 0,
      });

      const result = controller.getCircuitBreakerState();

      expect(result.healthy).toBe(false);
      expect(result.message).toContain('being rejected due to failures');
    });
  });

  describe('detailedHealthCheck (GET /health/detailed)', () => {
    it('reports ok when the circuit is closed', () => {
      const result = controller.detailedHealthCheck();

      expect(result.status).toBe('ok');
      expect(result.subsystems.database.status).toBe('healthy');
    });

    it('reports degraded when the circuit is not closed', () => {
      mockUnitOfWork.getCircuitState.mockReturnValue({
        state: 'half_open',
        failureCount: 2,
        successCount: 1,
      });

      const result = controller.detailedHealthCheck();

      expect(result.status).toBe('degraded');
      expect(result.subsystems.database.status).toBe('unhealthy');
    });
  });
});
