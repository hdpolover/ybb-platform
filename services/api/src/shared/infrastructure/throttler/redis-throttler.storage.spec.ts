// src/shared/infrastructure/throttler/redis-throttler.storage.spec.ts
import { Logger } from '@nestjs/common';

/**
 * One fake ioredis instance per test, so a spec can decide exactly how Redis
 * misbehaves. The constructor options are captured because half this finding
 * is about the CLIENT settings, not about the try/catch — a catch around a
 * command that queues instead of rejecting buys nothing.
 */
const constructorOptions: Array<Record<string, unknown>> = [];
const fakeRedis = {
  ttl: jest.fn(),
  multi: jest.fn(),
  pexpire: jest.fn(),
  setex: jest.fn(),
  quit: jest.fn(),
  disconnect: jest.fn(),
  on: jest.fn(),
};

jest.mock('ioredis', () => ({
  __esModule: true,
  default: jest.fn((options: Record<string, unknown>) => {
    constructorOptions.push(options);
    return fakeRedis;
  }),
}));

import { RedisThrottlerStorage } from './redis-throttler.storage';

const healthyMulti = () => ({
  incr: jest.fn().mockReturnThis(),
  pttl: jest.fn().mockReturnThis(),
  exec: jest.fn().mockResolvedValue([
    [null, 1],
    [null, 5000],
  ]),
});

describe('RedisThrottlerStorage', () => {
  let storage: RedisThrottlerStorage;

  beforeEach(() => {
    jest.clearAllMocks();
    constructorOptions.length = 0;
    fakeRedis.ttl.mockResolvedValue(-2);
    fakeRedis.multi.mockImplementation(healthyMulti);
    fakeRedis.pexpire.mockResolvedValue(1);
    fakeRedis.setex.mockResolvedValue('OK');
    storage = new RedisThrottlerStorage('localhost', 6379, '');
  });

  describe('the client cannot be allowed to queue', () => {
    // This is the half that is easy to skip and does all the work. On ioredis
    // defaults (5.9.2: enableOfflineQueue true, maxRetriesPerRequest 20,
    // connectTimeout 10s) a command issued while the connection is down is
    // QUEUED and retried rather than rejected, so a try/catch around it never
    // runs and the request simply hangs. Failing open requires failing FAST
    // first.
    it('refuses to queue commands while disconnected', () => {
      expect(constructorOptions[0].enableOfflineQueue).toBe(false);
    });

    it('does not retry a command twenty times before giving up', () => {
      expect(constructorOptions[0].maxRetriesPerRequest).toBe(1);
    });

    it('bounds a connected-but-wedged server with a command timeout', () => {
      // The connection settings cannot cover the case where Redis accepted
      // the socket and is simply answering slowly.
      expect(constructorOptions[0].commandTimeout).toBeGreaterThan(0);
      expect(constructorOptions[0].commandTimeout).toBeLessThanOrEqual(1000);
    });

    it('registers an error listener, because an unhandled one kills the process', () => {
      // ioredis emits 'error' per failed connection attempt, and an
      // EventEmitter with no 'error' listener throws — which would take the
      // API down on a Redis blip, the exact opposite of this class's job.
      expect(fakeRedis.on).toHaveBeenCalledWith('error', expect.any(Function));
    });
  });

  describe('failing open', () => {
    it('allows the request through when the block lookup rejects', async () => {
      fakeRedis.ttl.mockRejectedValue(new Error('ECONNREFUSED'));

      const record = await storage.increment('k', 60_000, 5, 0, 'default');

      // totalHits 0 is what makes it permissive: the guard refuses on
      // `totalHits > limit`, and 0 never exceeds a limit.
      expect(record).toEqual({
        totalHits: 0,
        timeToExpire: 60_000,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('allows the request through when the increment transaction rejects', async () => {
      fakeRedis.multi.mockImplementation(() => ({
        incr: jest.fn().mockReturnThis(),
        pttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockRejectedValue(new Error('Command timed out')),
      }));

      const record = await storage.increment('k', 60_000, 5, 0, 'default');

      expect(record.isBlocked).toBe(false);
      expect(record.totalHits).toBe(0);
    });

    it('never rejects, whatever Redis does', async () => {
      fakeRedis.ttl.mockRejectedValue(new Error('Stream isn\'t writeable'));

      // The whole point: this method is awaited by the app's only APP_GUARD,
      // so a rejection here is a 500 on every route in the API.
      await expect(storage.increment('k', 1000, 1, 0, 'default')).resolves.toBeDefined();
    });
  });

  describe('logging an outage', () => {
    it('logs once across many failing requests, not once per request', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      fakeRedis.ttl.mockRejectedValue(new Error('ECONNREFUSED'));

      await storage.increment('a', 1000, 1, 0, 'default');
      await storage.increment('b', 1000, 1, 0, 'default');
      await storage.increment('c', 1000, 1, 0, 'default');

      // Unlatched, a production-rate outage turns into a disk-space incident
      // on top of the original problem.
      expect(error).toHaveBeenCalledTimes(1);
      expect(error.mock.calls[0][0]).toContain('FAILING OPEN');
    });

    it('says the ceilings are unenforced, and that account lockout is not', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      fakeRedis.ttl.mockRejectedValue(new Error('ECONNREFUSED'));

      await storage.increment('a', 1000, 1, 0, 'default');

      // Whoever reads this at 3am needs to know what is and is not protected.
      const message = String(error.mock.calls[0][0]);
      expect(message).toMatch(/account lockout/i);
    });

    it('reports recovery, and re-arms so a later outage is logged again', async () => {
      const error = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      const log = jest.spyOn(Logger.prototype, 'log').mockImplementation();

      fakeRedis.ttl.mockRejectedValue(new Error('ECONNREFUSED'));
      await storage.increment('a', 1000, 1, 0, 'default');

      fakeRedis.ttl.mockResolvedValue(-2);
      await storage.increment('a', 1000, 1, 0, 'default');
      expect(log).toHaveBeenCalledTimes(1);

      fakeRedis.ttl.mockRejectedValue(new Error('ECONNREFUSED again'));
      await storage.increment('a', 1000, 1, 0, 'default');
      expect(error).toHaveBeenCalledTimes(2);
    });
  });

  describe('behaviour when Redis is healthy is unchanged', () => {
    it('counts a hit and reports the window', async () => {
      const record = await storage.increment('k', 60_000, 5, 0, 'default');

      expect(record).toEqual({
        totalHits: 1,
        timeToExpire: 5000,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('reports a live block without incrementing', async () => {
      fakeRedis.ttl.mockResolvedValue(30);

      const record = await storage.increment('k', 60_000, 5, 900_000, 'default');

      expect(record.isBlocked).toBe(true);
      expect(record.timeToBlockExpire).toBe(30_000);
      expect(fakeRedis.multi).not.toHaveBeenCalled();
    });

    it('arms a block once the limit is exceeded', async () => {
      fakeRedis.multi.mockImplementation(() => ({
        incr: jest.fn().mockReturnThis(),
        pttl: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue([
          [null, 6],
          [null, 5000],
        ]),
      }));

      const record = await storage.increment('k', 60_000, 5, 900_000, 'default');

      expect(record.isBlocked).toBe(true);
      expect(fakeRedis.setex).toHaveBeenCalledWith('default:k:blocked', 900, '1');
    });
  });

  describe('shutdown', () => {
    it('does not reject when the connection is already gone', async () => {
      fakeRedis.quit.mockRejectedValue(new Error('Connection is closed'));

      await expect(storage.onModuleDestroy()).resolves.toBeUndefined();
      expect(fakeRedis.disconnect).toHaveBeenCalled();
    });
  });
});
