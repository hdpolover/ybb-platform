import { ConfigService } from '@nestjs/config';
import {
  NotificationIdempotencyService,
  abbreviateDedupeKey,
} from './notification-idempotency.service';

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

  it('should suppress repeated error logs during Redis outage (circuit breaker)', async () => {
    const service = new NotificationIdempotencyService(
      makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
    );
    service.setRedisClientForTesting({
      set: jest.fn().mockRejectedValue(new Error('redis down')),
      disconnect: jest.fn(),
    });

    const loggerErrorSpy = jest
      .spyOn(service['logger'], 'error')
      .mockImplementation(() => undefined);

    // Fire multiple failures in quick succession
    await service.shouldProcess('user.registered', {}, {});
    await service.shouldProcess('user.registered', {}, {});
    await service.shouldProcess('user.registered', {}, {});

    // Only the first failure should have triggered an error log
    expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
  });

  describe('dedupeKey derivation', () => {
    let service: NotificationIdempotencyService;

    beforeEach(() => {
      service = new NotificationIdempotencyService(
        makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'false' }),
      );
    });

    it('should produce different keys for same email with different tokens (forgot-password)', async () => {
      const email = 'user@example.com';
      const result1 = await service.shouldProcess(
        'user.forgot-password',
        { email, token: 'token-aaa' },
        {},
      );
      const result2 = await service.shouldProcess(
        'user.forgot-password',
        { email, token: 'token-bbb' },
        {},
      );

      expect(result1.dedupeKey).not.toBe(result2.dedupeKey);
    });

    it('should produce different keys for same email with different tokens (verify-email)', async () => {
      const email = 'user@example.com';
      const result1 = await service.shouldProcess(
        'user.verify-email',
        { email, token: 'tok-111' },
        {},
      );
      const result2 = await service.shouldProcess(
        'user.verify-email',
        { email, token: 'tok-222' },
        {},
      );

      expect(result1.dedupeKey).not.toBe(result2.dedupeKey);
    });

    it('should not include raw email in the dedupeKey', async () => {
      const email = 'plaintext@example.com';
      const result = await service.shouldProcess(
        'user.forgot-password',
        { email, token: 'some-token' },
        {},
      );

      expect(result.dedupeKey).not.toContain(email);
    });

    it('should use messageId when provided and not include raw email', async () => {
      const email = 'user@example.com';
      const result = await service.shouldProcess(
        'user.registered',
        { email },
        { messageId: 'msg-abc-123' },
      );

      expect(result.dedupeKey).toContain('msg-abc-123');
      expect(result.dedupeKey).not.toContain(email);
    });

    it('should produce the same key for identical payloads without an explicit id', async () => {
      const payload = { email: 'a@b.com', name: 'Alice' };
      const result1 = await service.shouldProcess(
        'user.registered',
        payload,
        {},
      );
      const result2 = await service.shouldProcess(
        'user.registered',
        payload,
        {},
      );

      expect(result1.dedupeKey).toBe(result2.dedupeKey);
    });
  });

  describe('abbreviateDedupeKey', () => {
    it('returns full key when shorter than or equal to limit', () => {
      expect(abbreviateDedupeKey('short', 12)).toBe('short');
      expect(abbreviateDedupeKey('exactly12chr', 12)).toBe('exactly12chr');
    });

    it('returns suffix prefixed with ... when longer than limit', () => {
      const key = 'notification:idempotency:user.forgot-password:abcdef123456';
      const abbreviated = abbreviateDedupeKey(key, 12);
      expect(abbreviated).toBe('...abcdef123456');
      expect(abbreviated).not.toContain('user@');
    });
  });
});
