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
      .fn<Promise<'OK' | null>, [string, string, 'EX', number, 'NX'?]>()
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null);
    service.setRedisClientForTesting({
      get: jest.fn(),
      set: setMock,
      del: jest.fn(),
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
      get: jest.fn(),
      set: jest.fn().mockRejectedValue(new Error('redis down')),
      del: jest.fn(),
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

  it('grants a redelivered message one reprocessing, then refuses', async () => {
    const service = new NotificationIdempotencyService(
      makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
    );
    const setMock = jest
      .fn<Promise<'OK' | null>, [string, string, 'EX', number, 'NX'?]>()
      .mockResolvedValueOnce('OK')
      .mockResolvedValueOnce(null)
      .mockRejectedValueOnce(new Error('redis down'));
    service.setRedisClientForTesting({
      get: jest.fn(),
      set: setMock,
      del: jest.fn(),
      disconnect: jest.fn(),
    });
    jest.spyOn(service['logger'], 'error').mockImplementation(() => undefined);

    expect(await service.claimRedelivery('some:key')).toBe(true);
    expect(await service.claimRedelivery('some:key')).toBe(false);
    // A Redis error must not turn into unbounded reprocessing.
    expect(await service.claimRedelivery('some:key')).toBe(false);
    expect(setMock.mock.calls[0][0]).toBe('some:key:redelivered');
  });

  it('should suppress repeated error logs during Redis outage (circuit breaker)', async () => {
    const service = new NotificationIdempotencyService(
      makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
    );
    service.setRedisClientForTesting({
      get: jest.fn(),
      set: jest.fn().mockRejectedValue(new Error('redis down')),
      del: jest.fn(),
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

  describe('release', () => {
    it('deletes the claimed key so a retried message is processed again', async () => {
      const service = new NotificationIdempotencyService(
        makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
      );
      const keys = new Set<string>();
      service.setRedisClientForTesting({
        get: jest.fn(),
        set: jest.fn((key: string) => {
          if (keys.has(key)) return Promise.resolve(null);
          keys.add(key);
          return Promise.resolve('OK' as const);
        }),
        del: jest.fn((key: string) =>
          Promise.resolve(Number(keys.delete(key))),
        ),
        disconnect: jest.fn(),
      });
      const payload = { email: 'a@example.com', token: 't-1' };

      const first = await service.shouldProcess(
        'user.verify-email',
        payload,
        {},
      );
      await service.release(first.dedupeKey);
      const retry = await service.shouldProcess(
        'user.verify-email',
        payload,
        {},
      );

      expect(retry.shouldProcess).toBe(true);
      expect(retry.reason).toBe('new');
    });

    it('logs and does not throw when redis del fails', async () => {
      const service = new NotificationIdempotencyService(
        makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
      );
      service.setRedisClientForTesting({
        get: jest.fn(),
        set: jest.fn(),
        del: jest.fn().mockRejectedValue(new Error('redis down')),
        disconnect: jest.fn(),
      });
      const loggerErrorSpy = jest
        .spyOn(service['logger'], 'error')
        .mockImplementation(() => undefined);

      await expect(service.release('some-key')).resolves.toBeUndefined();
      expect(loggerErrorSpy).toHaveBeenCalledTimes(1);
    });
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

  describe('per-recipient claims', () => {
    const KEY = 'notification:idempotency:loa.batch.released:m1:recipient:p-1';

    const makeRecipientService = (client?: Record<string, jest.Mock>) => {
      const service = new NotificationIdempotencyService(
        makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
      );
      const redis = {
        get: jest.fn().mockResolvedValue(null),
        set: jest.fn().mockResolvedValue('OK'),
        del: jest.fn(),
        disconnect: jest.fn(),
        ...client,
      };
      service.setRedisClientForTesting(redis);
      return { service, redis };
    };

    it('claims a fresh key with a processing value and the default ttl', async () => {
      const { service, redis } = makeRecipientService();

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'claimed',
      });
      expect(redis.set).toHaveBeenCalledWith(
        KEY,
        expect.stringMatching(/^processing:.+/),
        'EX',
        24 * 60 * 60,
        'NX',
      );
    });

    it('reports a sent recipient with its provider message id', async () => {
      const { service } = makeRecipientService({
        set: jest.fn().mockResolvedValue(null),
        get: jest.fn().mockResolvedValue('sent:msg-a'),
      });

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'sent',
        providerMessageId: 'msg-a',
      });
    });

    it('reports a sent recipient with no provider message id as null', async () => {
      const { service } = makeRecipientService({
        set: jest.fn().mockResolvedValue(null),
        get: jest.fn().mockResolvedValue('sent:'),
      });

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'sent',
        providerMessageId: null,
      });
    });

    it('reports in_progress when this same instance holds the claim', async () => {
      const store = new Map<string, string>();
      const { service } = makeRecipientService({
        set: jest.fn((key: string, value: string, ...rest: unknown[]) => {
          if (rest.includes('NX') && store.has(key)) return Promise.resolve(null);
          store.set(key, value);
          return Promise.resolve('OK');
        }),
        get: jest.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
      });

      await expect(service.claimRecipient(KEY)).resolves.toEqual({ state: 'claimed' });
      await expect(service.claimRecipient(KEY)).resolves.toEqual({ state: 'in_progress' });
    });

    it('takes over a claim left by another instance and overwrites it', async () => {
      const { service, redis } = makeRecipientService({
        set: jest
          .fn()
          .mockResolvedValueOnce(null)
          .mockResolvedValue('OK'),
        get: jest.fn().mockResolvedValue('processing:some-dead-instance'),
      });

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'claimed',
      });
      expect(redis.set).toHaveBeenLastCalledWith(
        KEY,
        expect.stringMatching(/^processing:(?!some-dead-instance$).+/),
        'EX',
        24 * 60 * 60,
      );
    });

    it('claims when Redis throws', async () => {
      const { service } = makeRecipientService({
        set: jest.fn().mockRejectedValue(new Error('redis down')),
      });

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'claimed',
      });
    });

    it('claims when Redis is not configured', async () => {
      const service = new NotificationIdempotencyService(
        makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'true' }),
      );
      service.setRedisClientForTesting(undefined);

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'claimed',
      });
    });

    it('claims when idempotency is disabled', async () => {
      const service = new NotificationIdempotencyService(
        makeConfig({ NOTIFICATION_IDEMPOTENCY_ENABLED: 'false' }),
      );

      await expect(service.claimRecipient(KEY)).resolves.toEqual({
        state: 'claimed',
      });
    });

    it('records a sent recipient with its provider message id', async () => {
      const { service, redis } = makeRecipientService();

      await service.markRecipientSent(KEY, 'msg-a');
      await service.markRecipientSent(KEY, null);

      expect(redis.set).toHaveBeenNthCalledWith(1, KEY, 'sent:msg-a', 'EX', 24 * 60 * 60);
      expect(redis.set).toHaveBeenNthCalledWith(2, KEY, 'sent:', 'EX', 24 * 60 * 60);
    });

    it('swallows a Redis error when recording a sent recipient', async () => {
      const { service } = makeRecipientService({
        set: jest.fn().mockRejectedValue(new Error('redis down')),
      });

      await expect(service.markRecipientSent(KEY, 'msg-a')).resolves.toBeUndefined();
    });
  });
});
