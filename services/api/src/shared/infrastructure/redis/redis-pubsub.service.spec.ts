// file: services/api/src/shared/infrastructure/redis/redis-pubsub.service.spec.ts
import { RedisPubSubService } from './redis-pubsub.service';

// All six Nest containers boot in one process and each owns a subscriber, so a
// self-published invalidation used to be applied 7x (once locally, once per
// container). The publisher now stamps a process id and every subscriber drops
// its own process's messages.
describe('RedisPubSubService self-skip', () => {
    const configService = { get: (_key: string, fallback?: unknown) => fallback } as never;

    function build() {
        const cacheService = { invalidateByPattern: jest.fn().mockResolvedValue(undefined) };
        const service = new RedisPubSubService(configService, cacheService as never);
        const published: string[] = [];
        (service as unknown as { publisher: { publish: jest.Mock } }).publisher = {
            publish: jest.fn(async (_channel: string, message: string) => {
                published.push(message);
                return 1;
            }),
        } as never;
        const handle = (message: string) =>
            (service as unknown as { handleInvalidation(m: string): Promise<void> }).handleInvalidation(message);
        return { service, cacheService, published, handle };
    }

    it('ignores a message this process published', async () => {
        const { service, cacheService, published, handle } = build();

        await service.publishInvalidation(['landing:home:*']);
        cacheService.invalidateByPattern.mockClear();

        // Every container's subscriber receives it; none should re-run the patterns.
        await handle(published[0]);
        await handle(published[0]);

        expect(cacheService.invalidateByPattern).not.toHaveBeenCalled();
    });

    it('applies a message from another instance exactly once per process', async () => {
        const { cacheService, handle } = build();
        const foreign = JSON.stringify({
            patterns: ['landing:home:*', 'program:*'],
            timestamp: Date.now(),
            senderId: 'some-other-pod',
            messageId: 'msg-1',
        });

        await handle(foreign);
        await handle(foreign);

        expect(cacheService.invalidateByPattern).toHaveBeenCalledTimes(2);
        expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('landing:home:*');
        expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('program:*');
    });

    it('still applies legacy messages that carry no sender id', async () => {
        const { cacheService, handle } = build();

        await handle(JSON.stringify({ patterns: ['landing:home:*'], timestamp: Date.now() }));

        expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('landing:home:*');
    });
});
