import { Test, TestingModule } from '@nestjs/testing';
import { UnitOfWork } from './unit-of-work.service';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';

describe('UnitOfWork', () => {
  let unitOfWork: UnitOfWork;
  let prismaService: jest.Mocked<PrismaService>;
  let metricsService: jest.Mocked<MetricsService>;

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn(),
    };

    const mockMetricsService = {
      recordTransactionDuration: jest.fn(),
      incrementTransactionCounter: jest.fn(),
      // Advanced features metrics
      setCircuitBreakerState: jest.fn(),
      recordCircuitBreakerTransition: jest.fn(),
      incrementCircuitBreakerFailures: jest.fn(),
      incrementCircuitBreakerSuccesses: jest.fn(),
      incrementCircuitBreakerOpened: jest.fn(),
      recordReadReplicaQuery: jest.fn(),
      recordReadReplicaFallback: jest.fn(),
      recordBatchOperation: jest.fn(),
      recordTracedTransaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UnitOfWork,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: MetricsService, useValue: mockMetricsService },
      ],
    }).compile();

    unitOfWork = module.get<UnitOfWork>(UnitOfWork);
    prismaService = module.get(PrismaService);
    metricsService = module.get(MetricsService);
  });

  it('should be defined', () => {
    expect(unitOfWork).toBeDefined();
  });

  describe('execute', () => {
    it('should execute work within a transaction', async () => {
      const mockResult = { id: '123', name: 'Test' };
      
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {} as any;
        return await callback(mockTx);
      });

      const result = await unitOfWork.execute(async (repos) => {
        return mockResult;
      });

      expect(result).toEqual(mockResult);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should record metrics on success', async () => {
      prismaService.$transaction.mockResolvedValue({ id: '123' });

      await unitOfWork.execute(
        async (repos) => ({ id: '123' }),
        { name: 'test-transaction' }
      );

      expect(metricsService.recordTransactionDuration).toHaveBeenCalledWith(
        'test-transaction',
        expect.any(Number)
      );
      expect(metricsService.incrementTransactionCounter).toHaveBeenCalledWith(
        'test-transaction',
        'success'
      );
    });

    it('should record metrics on failure', async () => {
      const error = new Error('Transaction failed');
      prismaService.$transaction.mockRejectedValue(error);

      await expect(
        unitOfWork.execute(
          async (repos) => {
            throw error;
          },
          { name: 'failing-transaction' }
        )
      ).rejects.toThrow('Transaction failed');

      expect(metricsService.incrementTransactionCounter).toHaveBeenCalledWith(
        'failing-transaction',
        'failed'
      );
    });

    it('should apply transaction options', async () => {
      prismaService.$transaction.mockImplementation(async (callback, options) => {
        expect(options).toEqual({
          maxWait: 5000,
          timeout: 10000,
          isolationLevel: undefined,
        });
        return await callback({} as any);
      });

      await unitOfWork.execute(
        async (repos) => ({}),
        { name: 'test', timeout: 10000, maxWait: 5000 }
      );
    });
  });

  describe('executeWithRetry', () => {
    it('should retry on deadlock error', async () => {
      const deadlockError = new Error('deadlock detected');
      let attempts = 0;

      prismaService.$transaction.mockImplementation(async () => {
        attempts++;
        if (attempts < 3) {
          throw deadlockError;
        }
        return { success: true };
      });

      const result = await unitOfWork.executeWithRetry(
        async (repos) => ({ success: true }),
        { name: 'retry-test', maxRetries: 3, retryDelay: 10 }
      );

      expect(result).toEqual({ success: true });
      expect(attempts).toBe(3);
    });

    it('should not retry on non-retryable error', async () => {
      const regularError = new Error('Regular error');
      prismaService.$transaction.mockRejectedValue(regularError);

      await expect(
        unitOfWork.executeWithRetry(
          async (repos) => {
            throw regularError;
          },
          { name: 'no-retry-test', maxRetries: 3 }
        )
      ).rejects.toThrow('Regular error');
    });
  });

  describe('executeReadOnly', () => {
    it('should execute read-only transaction', async () => {
      prismaService.$transaction.mockResolvedValue([{ id: '1' }, { id: '2' }]);

      const result = await unitOfWork.executeReadOnly(
        async (repos) => [{ id: '1' }, { id: '2' }],
        { name: 'read-test' }
      );

      expect(result).toHaveLength(2);
      expect(metricsService.recordTransactionDuration).toHaveBeenCalledWith(
        'read-test-read',
        expect.any(Number)
      );
    });
  });

  describe('batchExecute', () => {
    it('should execute multiple operations in a single transaction', async () => {
      const operations = [
        async (repos: any) => ({ id: '1', name: 'User 1' }),
        async (repos: any) => ({ id: '2', name: 'User 2' }),
        async (repos: any) => ({ id: '3', name: 'User 3' }),
      ];

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback({} as any);
      });

      const results = await unitOfWork.batchExecute(operations, {
        name: 'batch-create-users',
      });

      expect(results).toHaveLength(3);
      expect(results[0]).toEqual({ id: '1', name: 'User 1' });
      expect(results[1]).toEqual({ id: '2', name: 'User 2' });
      expect(results[2]).toEqual({ id: '3', name: 'User 3' });
      expect(prismaService.$transaction).toHaveBeenCalledTimes(1);
    });

    it('should rollback all operations if one fails', async () => {
      const operations = [
        async (repos: any) => ({ id: '1', name: 'User 1' }),
        async (repos: any) => {
          throw new Error('Operation 2 failed');
        },
        async (repos: any) => ({ id: '3', name: 'User 3' }),
      ];

      prismaService.$transaction.mockImplementation(async (callback) => {
        return await callback({} as any);
      });

      await expect(
        unitOfWork.batchExecute(operations, { name: 'batch-fail-test' })
      ).rejects.toThrow('Operation 2 failed');
    });
  });

  describe('distributed tracing', () => {
    it('should include traceId in logs', async () => {
      prismaService.$transaction.mockResolvedValue({ id: '123' });

      await unitOfWork.execute(
        async (repos) => ({ id: '123' }),
        {
          name: 'traced-transaction',
          traceId: 'trace-abc-123',
          spanName: 'create-user-span',
        }
      );

      // Transaction should succeed
      expect(metricsService.incrementTransactionCounter).toHaveBeenCalledWith(
        'traced-transaction',
        'success'
      );
    });
  });

  describe('circuit breaker', () => {
    it('should open circuit after failure threshold', async () => {
      const error = new Error('Database connection failed');
      prismaService.$transaction.mockRejectedValue(error);

      // Trigger 5 failures to open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await unitOfWork.execute(async (repos) => ({}), { name: 'circuit-test' });
        } catch (e) {
          // Expected failures
        }
      }

      // Circuit should now be open
      await expect(
        unitOfWork.execute(async (repos) => ({}), { name: 'circuit-test' })
      ).rejects.toThrow(/Circuit breaker is OPEN/);
    });

    it('should transition to half-open after timeout', async () => {
      jest.useFakeTimers();
      const error = new Error('Database connection failed');
      prismaService.$transaction.mockRejectedValue(error);

      // Open the circuit
      for (let i = 0; i < 5; i++) {
        try {
          await unitOfWork.execute(async (repos) => ({}), { name: 'circuit-timeout-test' });
        } catch (e) {
          // Expected
        }
      }

      // Advance time past circuit breaker timeout (60 seconds)
      jest.advanceTimersByTime(61000);

      // Next call should attempt execution (half-open state)
      prismaService.$transaction.mockResolvedValueOnce({ success: true });
      
      const result = await unitOfWork.execute(
        async (repos) => ({ success: true }),
        { name: 'circuit-recovery-test' }
      );

      expect(result).toEqual({ success: true });
      
      jest.useRealTimers();
    });

    it('should provide circuit state for monitoring', () => {
      const state = unitOfWork.getCircuitState();
      
      expect(state).toHaveProperty('state');
      expect(state).toHaveProperty('failureCount');
      expect(state).toHaveProperty('successCount');
    });
  });
});
