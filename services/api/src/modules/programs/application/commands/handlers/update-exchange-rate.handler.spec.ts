import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateExchangeRateHandler } from './update-exchange-rate.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';

describe('UpdateExchangeRateHandler', () => {
    let handler: UpdateExchangeRateHandler;
    let prisma: any;
    let cacheService: jest.Mocked<Partial<CacheService>>;
    let landingCacheInvalidation: jest.Mocked<Partial<LandingCacheInvalidationService>>;

    // Fixed clock for program.update's derived `updatedAt`, so tests can assert
    // on it without depending on wall-clock time.
    const FIXED_DATE = new Date('2026-08-21T00:00:00.000Z');

    beforeEach(async () => {
        prisma = {
            program: { findUnique: jest.fn(), update: jest.fn() },
            $transaction: jest.fn(),
            programExchangeRateHistory: { create: jest.fn(), count: jest.fn(), findMany: jest.fn() },
        };
        // `this.prisma.$transaction([a(), b()])` is array-form: a() and b() are
        // evaluated eagerly, before $transaction is ever called, so a mock cannot
        // make this genuinely atomic. What we CAN do is derive $transaction's
        // resolved value from the same write calls the handler made (via
        // Promise.all over the already-mocked program.update/history.create
        // return values), instead of a literal typed into the fixture that is
        // completely decoupled from what the code actually wrote. That keeps
        // `result.usdInIdr` load-bearing on the write, not on the mock.
        prisma.$transaction.mockImplementation((ops: unknown[]) => Promise.all(ops));
        prisma.program.update.mockImplementation(
            ({ data }: { data: { usdInIdr: number } }) => ({
                id: 'prog-1',
                usdInIdr: data.usdInIdr,
                updatedAt: FIXED_DATE,
            }),
        );
        cacheService = {
            invalidateBrandLandingCaches: jest.fn().mockResolvedValue(undefined),
            invalidateByPattern: jest.fn().mockResolvedValue(undefined),
        };
        landingCacheInvalidation = {
            invalidate: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateExchangeRateHandler,
                { provide: PrismaService, useValue: prisma },
                { provide: CacheService, useValue: cacheService },
                { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
            ],
        }).compile();

        handler = module.get<UpdateExchangeRateHandler>(UpdateExchangeRateHandler);
    });

    describe('updateExchangeRate', () => {
        it('throws NotFoundException when the program does not exist', async () => {
            prisma.program.findUnique.mockResolvedValue(null);

            await expect(
                handler.updateExchangeRate('prog-missing', 16500, 'admin-1'),
            ).rejects.toThrow(NotFoundException);
        });

        it('updates the rate and records history', async () => {
            prisma.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-1', usdInIdr: 16000 });

            const result = await handler.updateExchangeRate('prog-1', 16500, 'admin-1', 'BI rate change');

            expect(prisma.$transaction).toHaveBeenCalled();
            // Assert on what the code actually wrote, not on a fixture literal --
            // this is the only thing that catches a variable-swap bug like writing
            // `data: { usdInIdr: oldRate }`.
            expect(prisma.program.update).toHaveBeenCalledWith(
                expect.objectContaining({ data: { usdInIdr: 16500 } }),
            );
            expect(prisma.programExchangeRateHistory.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    data: expect.objectContaining({ oldRate: 16000, newRate: 16500, changedBy: 'admin-1' }),
                }),
            );
            // Only meaningful because it is now DERIVED from prisma.program.update's
            // mocked return, not a literal decoupled from the write above.
            expect(result.usdInIdr).toBe(16500);
        });

        // Audit: the pricing tiers / registration CTA on the program landing
        // page render off usdInIdr. The old code cleared Redis brand keys and a
        // narrow program:detail:* pattern but never the Postgres snapshot and
        // never fired the Next.js revalidate hook, so a rate change could stay
        // publicly stale for up to the cache TTL.
        it('invalidates landing caches via the shared service with the home+settings revalidate hook', async () => {
            prisma.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-55', usdInIdr: 16000 });

            await handler.updateExchangeRate('prog-1', 16500, 'admin-1');

            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-55', {
                clearSnapshot: true,
                bustProgramCache: true,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });
        });

        // Portal payment/dashboard views for enrolled participants also read
        // the exchange rate and are outside the landing-page cache scope the
        // shared service owns, so they still need their own explicit clear.
        it('still clears the enrolled-participant portal caches alongside the shared landing invalidation', async () => {
            prisma.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-55', usdInIdr: 16000 });

            await handler.updateExchangeRate('prog-1', 16500, 'admin-1');

            expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('portal:payments:*');
            expect(cacheService.invalidateByPattern).toHaveBeenCalledWith('portal:dashboard:*');
        });
    });
});
