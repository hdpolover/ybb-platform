// src/shared/infrastructure/cache/cache-health.service.spec.ts
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { CacheHealthService } from './cache-health.service';
import { CacheService } from './cache.service';

jest.mock('ioredis', () => ({ __esModule: true, default: jest.fn() }));

describe('CacheHealthService', () => {
    const MockRedis = Redis as unknown as jest.Mock;
    const cacheService = { probe: jest.fn() };
    const configService = {
        get: jest.fn((_key: string, fallback: unknown) => fallback),
        getOrThrow: jest.fn(() => 'pw'),
    };
    let redisInstance: { on: jest.Mock; connect: jest.Mock; ping: jest.Mock; disconnect: jest.Mock };
    let service: CacheHealthService;

    beforeEach(() => {
        jest.clearAllMocks();
        redisInstance = {
            on: jest.fn(),
            connect: jest.fn().mockResolvedValue(undefined),
            ping: jest.fn().mockResolvedValue('PONG'),
            disconnect: jest.fn(),
        };
        MockRedis.mockImplementation(() => redisInstance);
        service = new CacheHealthService(
            cacheService as unknown as CacheService,
            configService as unknown as ConfigService,
        );
    });

    it('reports ok without opening a second connection when the probe passes', async () => {
        cacheService.probe.mockResolvedValue(true);

        await expect(service.check()).resolves.toBe('ok');
        expect(MockRedis).not.toHaveBeenCalled();
    });

    it('reports client-wedged when the probe fails but a fresh connection reaches Redis', async () => {
        cacheService.probe.mockResolvedValue(false);

        await expect(service.check()).resolves.toBe('client-wedged');
        expect(redisInstance.disconnect).toHaveBeenCalled();
    });

    it('reports redis-unreachable when the fresh connection fails too', async () => {
        cacheService.probe.mockResolvedValue(false);
        redisInstance.connect.mockRejectedValue(new Error('getaddrinfo ENOTFOUND redis'));

        await expect(service.check()).resolves.toBe('redis-unreachable');
        expect(redisInstance.disconnect).toHaveBeenCalled();
    });
});
