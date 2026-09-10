// src/modules/health/health.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { ConsumerStatusService } from '@shared/infrastructure/messaging/consumer-status.service';

describe('HealthController', () => {
  let controller: HealthController;
  let consumerStatus: ConsumerStatusService;

  const mockPrismaRead = {
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaReadService, useValue: mockPrismaRead },
        ConsumerStatusService,
      ],
    }).compile();

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
});
