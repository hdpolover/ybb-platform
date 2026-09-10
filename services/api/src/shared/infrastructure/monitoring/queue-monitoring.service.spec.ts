// src/shared/infrastructure/monitoring/queue-monitoring.service.spec.ts
//
// Covers the 404-handling fix: checkQueue's passive declare closes the
// channel on a missing queue (correct AMQP behavior), but that must no
// longer abort the rest of the pass — every queue after the missing one in
// the list still gets checked, on a freshly re-established channel.

jest.mock('amqplib', () => ({
    connect: jest.fn(),
}));

import * as amqp from 'amqplib';
import { ConfigService } from '@nestjs/config';
import { QueueMonitoringService } from './queue-monitoring.service';
import { MetricsService } from './metrics.service';

const amqpConnectMock = amqp.connect as jest.Mock;

function makeChannel(checkQueueImpl: (queue: string) => Promise<{ messageCount: number; consumerCount: number }>) {
    return {
        checkQueue: jest.fn(checkQueueImpl),
        close: jest.fn().mockResolvedValue(undefined),
        purgeQueue: jest.fn(),
        on: jest.fn(),
    };
}

function make404Error(): Error & { code: number } {
    const err = new Error('NOT_FOUND - no queue') as Error & { code: number };
    err.code = 404;
    return err;
}

describe('QueueMonitoringService — checkQueueDepths 404 handling', () => {
    let service: QueueMonitoringService;
    let metricsService: MetricsService;
    let setDepthSpy: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();
        metricsService = new MetricsService();
        setDepthSpy = jest.fn();
        (metricsService as unknown as { jobQueueDepth: unknown }).jobQueueDepth = { set: setDepthSpy };
        (metricsService as unknown as { jobQueueConsumers: unknown }).jobQueueConsumers = { set: jest.fn() };

        const configService = {
            getOrThrow: jest.fn().mockReturnValue('amqp://guest:guest@localhost:5672'),
        } as unknown as ConfigService;
        service = new QueueMonitoringService(configService, metricsService);
    });

    it('checks every later queue in the same pass after an earlier one 404s, on a re-established channel', async () => {
        let channelCreateCount = 0;
        amqpConnectMock.mockResolvedValue({
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
            createChannel: jest.fn().mockImplementation(async () => {
                channelCreateCount += 1;
                const createdAsChannelNumber = channelCreateCount;
                return makeChannel(async (queue: string) => {
                    if (queue === 'queue-a') return { messageCount: 1, consumerCount: 1 };
                    if (queue === 'queue-b') throw make404Error();
                    if (queue === 'queue-c') {
                        // Must run on a channel created AFTER the 404 reset — i.e.
                        // not the same instance queue-a used.
                        expect(createdAsChannelNumber).toBeGreaterThan(1);
                        return { messageCount: 3, consumerCount: 1 };
                    }
                    throw new Error(`unexpected queue ${queue}`);
                });
            }),
        });

        (service as unknown as { queues: string[] }).queues = ['queue-a', 'queue-b', 'queue-c'];

        await (service as unknown as { checkQueueDepths: () => Promise<void> }).checkQueueDepths();

        expect(setDepthSpy).toHaveBeenCalledWith({ queue_name: 'queue-a' }, 1);
        expect(setDepthSpy).toHaveBeenCalledWith({ queue_name: 'queue-c' }, 3);
        expect(setDepthSpy).not.toHaveBeenCalledWith({ queue_name: 'queue-b' }, expect.anything());
        expect(channelCreateCount).toBeGreaterThanOrEqual(2);
    });

    it('skips a known-missing queue until the reprobe window elapses, then checks it again automatically', async () => {
        let checkCount = 0;
        amqpConnectMock.mockResolvedValue({
            on: jest.fn(),
            close: jest.fn().mockResolvedValue(undefined),
            createChannel: jest.fn().mockImplementation(async () =>
                makeChannel(async () => {
                    checkCount += 1;
                    throw make404Error();
                }),
            ),
        });

        (service as unknown as { queues: string[] }).queues = ['queue-missing'];

        const runCheck = () => (service as unknown as { checkQueueDepths: () => Promise<void> }).checkQueueDepths();

        await runCheck();
        expect(checkCount).toBe(1);

        // Still inside the reprobe window on the very next interval — no
        // second broker round trip for the queue already known missing.
        await runCheck();
        expect(checkCount).toBe(1);

        // Fast-forward past the reprobe window and confirm it comes back into
        // rotation without a restart.
        const missingSince = (service as unknown as { missingSince: Map<string, number> }).missingSince;
        missingSince.set('queue-missing', Date.now() - 6 * 60 * 1000);

        await runCheck();
        expect(checkCount).toBe(2);
    });
});
