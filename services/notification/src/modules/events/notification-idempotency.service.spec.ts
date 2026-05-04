import { ConfigService } from '@nestjs/config';
import { NotificationIdempotencyService } from './notification-idempotency.service';

describe('NotificationIdempotencyService', () => {
  const makeConfig = (overrides?: Record<string, string | undefined>) =>
    ({
      get: (key: string) => overrides?.[key],
    }) as unknown as ConfigService;

  it('should skip duplicate events when redis key already exists', async () => {
    const service = new NotificationIdempotencyService(
      makeConfig({
        NOTIFICATION_IDEMPOTENCY_ENABLED: 'true',
      }),
    );

    const setMock = jest
      .fn<Promise<'OK' | null>, [string, string, 'EX', number, 'NX']>()
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);
    service.setRedisClientForTesting({
      set: setMock,
      disconnect: jest.fn(),
    });

    const first = await service.shouldProcess(
      'payment.succeeded',
      { payment_id: 'pay-1' },
      {},
    );
    const second = await service.shouldProcess(
      'payment.succeeded',
      { payment_id: 'pay-1' },
      {},
    );

    expect(first.shouldProcess).toBe(true);
    expect(first.reason).toBe('new');
    expect(second.shouldProcess).toBe(false);
    expect(second.reason).toBe('duplicate');
  });

  it('should allow processing when idempotency is disabled', async () => {
    const service = new NotificationIdempotencyService(
      makeConfig({
        NOTIFICATION_IDEMPOTENCY_ENABLED: 'false',
      }),
    );

    const result = await service.shouldProcess(
      'user.registered',
      { email: 'test@example.com' },
      {},
    );

    expect(result.shouldProcess).toBe(true);
    expect(result.reason).toBe('disabled');
  });

  it('should fallback to processing on redis error', async () => {
    const service = new NotificationIdempotencyService(
      makeConfig({
        NOTIFICATION_IDEMPOTENCY_ENABLED: 'true',
      }),
    );

    service.setRedisClientForTesting({
      set: jest.fn().mockRejectedValue(new Error('redis down')),
      disconnect: jest.fn(),
    });

    const result = await service.shouldProcess(
      'support.ticket.created',
      { id: 'ticket-1' },
      {},
    );

    expect(result.shouldProcess).toBe(true);
    expect(result.reason).toBe('fallback');
  });
});
