import { Test, TestingModule } from '@nestjs/testing';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { CacheService } from './cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

describe('CacheService', () => {
    let service: CacheService;

    const mockCacheManager = {
        del: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
        set: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CacheService,
                { provide: CACHE_MANAGER, useValue: mockCacheManager },
            ],
        }).compile();

        service = module.get<CacheService>(CacheService);
    });

    describe('invalidateInvoiceCache', () => {
        const userId = 'user-123';
        const invoiceId = 'invoice-456';

        it('busts the submission-detail cache so a settled fee unblocks the submit gate', async () => {
            // The submit button reads preview.payment.paid from portal:submission-detail.
            // Regression guard: if this pattern stops being busted, a paid registration fee
            // stays invisible to the gate and the participant cannot submit.
            const patternSpy = jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidateInvoiceCache(invoiceId, userId);

            expect(patternSpy).toHaveBeenCalledWith(`portal:submission-detail:${userId}:*`);
        });

        it('also busts the payments list and dashboard caches', async () => {
            const patternSpy = jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidateInvoiceCache(invoiceId, userId);

            expect(patternSpy).toHaveBeenCalledWith(`portal:payments:${userId}:*`);
            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.PORTAL_DASHBOARD(userId));
            expect(mockCacheManager.del).toHaveBeenCalledWith(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId));
        });

        it('skips the payment-detail key when no invoiceId is known', async () => {
            jest.spyOn(service, 'invalidateByPattern').mockResolvedValue();

            await service.invalidateInvoiceCache(undefined, userId);

            expect(mockCacheManager.del).not.toHaveBeenCalledWith(
                CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, expect.any(String)),
            );
        });
    });
});
