// services/api/src/shared/infrastructure/prisma/prisma.service.spec.ts
//
// Audit M73. The soft-delete and monitoring extensions were applied to a
// client built by $extends, but only the per-model getters were repointed at
// it, so `prisma.$transaction(async (tx) => ...)` handed its callback the raw,
// unextended client. Inside a transaction, deletes were hard and reads saw
// soft-deleted rows.
//
// What these tests can and cannot prove, stated plainly: this suite has no
// database, so they do NOT prove that Prisma propagates extensions into the
// interactive-transaction client. That rests on the v7.3 runtime, where
// _createItxClient builds the tx client from its receiver (`Io(this)`), so the
// receiver's _extensions ride along - which is exactly why the receiver has to
// be the extended client.
//
// What they DO pin is the half that is easy to get wrong and impossible to see
// in a type check: the delegation must never dispatch $transaction ON the
// extended client, or it recurses until the stack dies. $extends builds the
// extended client as Object.create(this._originalClient, ...) and the generated
// client sets _originalClient = this, so the extended client's prototype IS the
// PrismaService instance. Anything named $transaction that is reachable from
// that instance is reachable from the extended client too.
import { PrismaClient } from '@prisma/client';
import { PrismaService } from './prisma.service';
import { MetricsService } from '../monitoring/metrics.service';

const metricsStub = {
    recordPrismaQuery: jest.fn(),
    updatePrismaPoolStats: jest.fn(),
} as unknown as MetricsService;

describe('PrismaService $transaction delegation (audit M73)', () => {
    it('never puts $transaction on the prototype, or the extended client inherits it and recurses', () => {
        // The recursion guard, asserted structurally so it survives a refactor.
        // A future "simplification" to a class method
        //     $transaction(...a) { return this.extendedClient.$transaction(...a) }
        // reads as obviously correct, type-checks, and takes every transaction
        // in the API down with a stack overflow. Two independent design reviews
        // proposed exactly that. This is the cheapest possible tripwire.
        expect(Object.getOwnPropertyNames(PrismaService.prototype)).not.toContain('$transaction');
    });

    describe('once the module has initialised', () => {
        let service: PrismaService;
        let baseSpy: jest.SpyInstance;
        let receiver: unknown;

        beforeAll(async () => {
            // Spied BEFORE onModuleInit, because the delegate captures the base
            // implementation at init time.
            baseSpy = jest
                .spyOn(PrismaClient.prototype as unknown as Record<string, () => unknown>, '$transaction')
                .mockImplementation(function (this: unknown) {
                    receiver = this;
                    return Promise.resolve('ran');
                });

            service = new PrismaService(metricsStub, {
                // Never dialled: $connect is stubbed and pg's Pool is lazy.
                connectionString: 'postgresql://u:p@127.0.0.1:1/unused',
                enablePoolMetrics: false,
            });
            jest.spyOn(service, '$connect').mockResolvedValue(undefined);

            await service.onModuleInit();
        });

        afterAll(async () => {
            baseSpy.mockRestore();
            await service.onModuleDestroy?.();
        });

        it('installs $transaction as an own property of the instance, not on the class', () => {
            expect(Object.getOwnPropertyNames(service)).toContain('$transaction');
        });

        it('runs the base implementation against the EXTENDED client, not the service', async () => {
            const result = await service.$transaction(async () => undefined);

            expect(result).toBe('ran');
            expect(baseSpy).toHaveBeenCalledTimes(1);

            // The extended client's identity is not exported, so pin it by the
            // property that actually matters: the receiver resolves the SAME
            // model proxies the patched per-model getters resolve. Those
            // getters are what already carry the soft-delete extension outside
            // a transaction, so this says the transaction now runs on the same
            // extended client the rest of the service uses. `$parent` is an
            // $extends marker a plain client does not carry.
            const asRecord = receiver as Record<string, unknown>;
            expect(receiver).not.toBe(service);
            expect(asRecord.user).toBe((service as unknown as Record<string, unknown>).user);
            expect('$parent' in asRecord).toBe(true);
        });

        it('completes rather than recursing when the delegate is reached through the extended client', async () => {
            // Reaching $transaction the way the prototype chain exposes it is
            // the exact path that used to loop. If this ever regresses it fails
            // as a RangeError, not a wrong value.
            const viaPrototypeChain = (service as unknown as Record<string, unknown>).$transaction as (
                cb: unknown,
            ) => Promise<unknown>;

            await expect(viaPrototypeChain(async () => undefined)).resolves.toBe('ran');
        });
    });
});
