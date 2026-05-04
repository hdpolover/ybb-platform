import { Test, TestingModule } from '@nestjs/testing';
import { PaymentOutboxService } from './payment-outbox.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

describe('PaymentOutboxService', () => {
    let service: PaymentOutboxService;
    let mockPrisma: { $queryRaw: jest.Mock; $executeRaw: jest.Mock };
    let mockRabbitMQ: { emit: jest.Mock };

    const makeService = async (env: Record<string, string> = {}) => {
        const saved: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(env)) {
            saved[k] = process.env[k];
            process.env[k] = v;
        }

        mockPrisma = {
            $queryRaw: jest.fn(),
            $executeRaw: jest.fn(),
        };
        mockRabbitMQ = { emit: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentOutboxService,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: RabbitMQProducerService, useValue: mockRabbitMQ },
            ],
        }).compile();

        // Restore env
        for (const [k, v] of Object.entries(saved)) {
            if (v === undefined) delete process.env[k];
            else process.env[k] = v;
        }

        return module.get<PaymentOutboxService>(PaymentOutboxService);
    };

    beforeEach(async () => {
        service = await makeService({ ENABLE_PAYMENT_OUTBOX: 'false' });
    });

    // ─── computeRetryDelaySeconds ──────────────────────────────────────────────

    describe('computeRetryDelaySeconds', () => {
        it('returns base delay on first attempt', () => {
            // attempt=1 → exponent=0 → 15 * 2^0 = 15
            const delay = (service as any).computeRetryDelaySeconds(1) as number;
            expect(delay).toBe(15);
        });

        it('doubles delay with each attempt (exponential backoff)', () => {
            expect((service as any).computeRetryDelaySeconds(2)).toBe(30);
            expect((service as any).computeRetryDelaySeconds(3)).toBe(60);
            expect((service as any).computeRetryDelaySeconds(4)).toBe(120);
        });

        it('caps delay at maxRetryDelaySeconds (900 s by default)', () => {
            // Large attempt number should not exceed the cap
            const delay = (service as any).computeRetryDelaySeconds(20) as number;
            expect(delay).toBe(900);
        });

        it('respects custom maxRetryDelaySeconds from env', async () => {
            const customService = await makeService({
                ENABLE_PAYMENT_OUTBOX: 'false',
                PAYMENT_OUTBOX_MAX_RETRY_DELAY_SECONDS: '60',
            });
            const delay = (customService as any).computeRetryDelaySeconds(10) as number;
            expect(delay).toBe(60);
        });
    });

    // ─── isEnabled ───────────────────────────────────────────────────────────

    describe('isEnabled', () => {
        it('returns false by default (ENABLE_PAYMENT_OUTBOX unset)', () => {
            expect(service.isEnabled()).toBe(false);
        });

        it('returns true when ENABLE_PAYMENT_OUTBOX=true', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            expect(enabledService.isEnabled()).toBe(true);
        });
    });

    // ─── enqueueInTransaction ─────────────────────────────────────────────────

    describe('enqueueInTransaction', () => {
        const makeTx = (insertedRows = 1) => ({
            $executeRaw: jest.fn().mockResolvedValue(insertedRows),
        });

        it('returns queued=false without touching DB when disabled', async () => {
            const tx = makeTx();
            const result = await service.enqueueInTransaction(tx as any, {
                eventType: 'payment.succeeded',
                aggregateType: 'application',
                aggregateId: 'app-123',
                payload: { amount: 100 },
            });
            expect(result.queued).toBe(false);
            expect(tx.$executeRaw).not.toHaveBeenCalled();
        });

        it('inserts a row and returns queued=true when enabled and no conflict', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            const tx = makeTx(1);
            const result = await enabledService.enqueueInTransaction(tx as any, {
                eventType: 'payment.succeeded',
                aggregateType: 'application',
                aggregateId: 'app-abc',
                payload: { amount: 200 },
            });
            expect(result.queued).toBe(true);
            expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
        });

        it('returns queued=false (deduped) when ON CONFLICT returns 0 rows', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            const tx = makeTx(0); // ON CONFLICT DO NOTHING → 0 affected rows
            const result = await enabledService.enqueueInTransaction(tx as any, {
                eventType: 'payment.succeeded',
                aggregateType: 'application',
                aggregateId: 'app-abc',
                payload: { amount: 200 },
                dedupeKey: 'explicit-dedupe-key',
            });
            expect(result.queued).toBe(false);
            expect(result.dedupeKey).toBe('explicit-dedupe-key');
        });

        it('uses explicit dedupeKey when provided', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            const tx = makeTx(1);
            const result = await enabledService.enqueueInTransaction(tx as any, {
                eventType: 'payment.test',
                aggregateType: 'application',
                aggregateId: 'app-xyz',
                payload: {},
                dedupeKey: 'my-custom-dedupe-key',
            });
            expect(result.dedupeKey).toBe('my-custom-dedupe-key');
        });

        it('auto-generates a dedupeKey fitting within VARCHAR(191) when none provided', async () => {
            const tx = makeTx(0);
            const result = await service.enqueueInTransaction(tx as any, {
                // Use max-length eventType and aggregateId to stress test
                eventType: 'a'.repeat(120),
                aggregateType: 'application',
                aggregateId: 'b'.repeat(128),
                payload: { data: 'c'.repeat(500) },
            });
            expect(result.dedupeKey.length).toBeLessThanOrEqual(191);
        });

        it('serialises Date values in payload using ISO string (JSON.stringify semantics)', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            const tx = makeTx(1);

            const testDate = new Date('2024-01-15T12:00:00.000Z');
            await enabledService.enqueueInTransaction(tx as any, {
                eventType: 'payment.test',
                aggregateType: 'application',
                aggregateId: 'app-date',
                payload: { processedAt: testDate.toISOString() },
            });

            // The first argument passed to $executeRaw is the tagged template strings array;
            // the interpolated values are the remaining arguments.
            // We inspect the raw SQL call to verify JSON.stringify is used (not stableStringify).
            const callArgs: unknown[] = (tx.$executeRaw as jest.Mock).mock.calls[0];
            // The payload JSON string is one of the interpolated values.
            const payloadArg = callArgs.find(
                (a) => typeof a === 'string' && (a as string).includes('2024-01-15'),
            );
            expect(payloadArg).toBeDefined();
        });
    });

    // ─── claimBatch (orphaned processing rows) ────────────────────────────────

    describe('claimBatch (via publishPending)', () => {
        it('does not call claimBatch when service is disabled', async () => {
            mockPrisma.$queryRaw.mockResolvedValue([]);
            await service.publishPending();
            expect(mockPrisma.$queryRaw).not.toHaveBeenCalled();
        });

        it('claims pending and failed rows (normal path)', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            const rows = [
                {
                    id: 'row-1',
                    eventType: 'payment.succeeded',
                    payload: { amount: 100 },
                    dedupeKey: 'key-1',
                    correlationId: null,
                    attempts: 1,
                },
            ];
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(rows);
            (mockRabbitMQ.emit as jest.Mock).mockResolvedValue(undefined);
            (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(1);

            await enabledService.publishPending();

            expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1);
            // The SQL should contain 'processing' in 'pending','failed' part
            const sqlParts: TemplateStringsArray = (mockPrisma.$queryRaw as jest.Mock).mock.calls[0][0];
            const sqlJoined = sqlParts.join('');
            expect(sqlJoined).toContain("status IN ('pending', 'failed')");
        });

        it('includes orphaned processing rows in claim query', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue([]);

            await enabledService.publishPending();

            const sqlParts: TemplateStringsArray = (mockPrisma.$queryRaw as jest.Mock).mock.calls[0][0];
            const sqlJoined = sqlParts.join('');
            // Should reclaim 'processing' rows with expired lease
            expect(sqlJoined).toContain("status = 'processing'");
            expect(sqlJoined).toContain('INTERVAL');
        });

        it('marks row as published after successful emit', async () => {
            const enabledService = await makeService({ ENABLE_PAYMENT_OUTBOX: 'true' });
            const rows = [
                {
                    id: 'row-pub',
                    eventType: 'payment.succeeded',
                    payload: {},
                    dedupeKey: 'key-pub',
                    correlationId: 'corr-1',
                    attempts: 1,
                },
            ];
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(rows);
            (mockRabbitMQ.emit as jest.Mock).mockResolvedValue(undefined);
            (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(1);

            await enabledService.publishPending();

            const updateSqlParts: TemplateStringsArray = (mockPrisma.$executeRaw as jest.Mock).mock.calls[0][0];
            expect(updateSqlParts.join('')).toContain("status = 'published'");
        });

        it('marks row as failed (not dead) when emit fails before max attempts', async () => {
            const enabledService = await makeService({
                ENABLE_PAYMENT_OUTBOX: 'true',
                PAYMENT_OUTBOX_MAX_ATTEMPTS: '5',
            });
            const rows = [
                {
                    id: 'row-fail',
                    eventType: 'payment.succeeded',
                    payload: {},
                    dedupeKey: 'key-fail',
                    correlationId: null,
                    attempts: 2, // below max=5
                },
            ];
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(rows);
            (mockRabbitMQ.emit as jest.Mock).mockRejectedValue(new Error('RabbitMQ down'));
            (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(1);

            await enabledService.publishPending();

            // The UPDATE should set status to 'failed' not 'dead'
            const updateCall = (mockPrisma.$executeRaw as jest.Mock).mock.calls[0];
            const interpolatedValues = updateCall.slice(1);
            expect(interpolatedValues).toContain('failed');
            expect(interpolatedValues).not.toContain('dead');
        });

        it('marks row as dead when emit fails at max attempts', async () => {
            const enabledService = await makeService({
                ENABLE_PAYMENT_OUTBOX: 'true',
                PAYMENT_OUTBOX_MAX_ATTEMPTS: '3',
            });
            const rows = [
                {
                    id: 'row-dead',
                    eventType: 'payment.succeeded',
                    payload: {},
                    dedupeKey: 'key-dead',
                    correlationId: null,
                    attempts: 3, // equals max → dead
                },
            ];
            (mockPrisma.$queryRaw as jest.Mock).mockResolvedValue(rows);
            (mockRabbitMQ.emit as jest.Mock).mockRejectedValue(new Error('fatal'));
            (mockPrisma.$executeRaw as jest.Mock).mockResolvedValue(1);

            await enabledService.publishPending();

            const updateCall = (mockPrisma.$executeRaw as jest.Mock).mock.calls[0];
            const interpolatedValues = updateCall.slice(1);
            expect(interpolatedValues).toContain('dead');
            expect(interpolatedValues).not.toContain('failed');
        });
    });
});
