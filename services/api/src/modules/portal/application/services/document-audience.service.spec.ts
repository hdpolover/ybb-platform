import { Test } from '@nestjs/testing';
import { DocumentAudienceService } from './document-audience.service';

const baseApplication = {
    status: 'draft',
    submittedAt: null,
    registrationPaymentStatus: 'unpaid',
    programPaymentStatus: 'unpaid',
    pricingTierId: null,
    invoices: [] as { pricingTierId: string; status: string }[],
};

describe('DocumentAudienceService', () => {
    let service: DocumentAudienceService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [DocumentAudienceService],
        }).compile();

        service = module.get(DocumentAudienceService);
    });

    describe('all_registered', () => {
        it('is eligible regardless of status or payment', () => {
            const result = service.isEligible(
                { audienceType: 'all_registered', audienceConfig: {} },
                { ...baseApplication },
            );

            expect(result).toBe(true);
        });
    });

    describe('paid_any', () => {
        it('is eligible when registrationPaymentStatus is paid', () => {
            const result = service.isEligible(
                { audienceType: 'paid_any', audienceConfig: {} },
                { ...baseApplication, registrationPaymentStatus: 'paid' },
            );

            expect(result).toBe(true);
        });

        it('is eligible when programPaymentStatus is paid', () => {
            const result = service.isEligible(
                { audienceType: 'paid_any', audienceConfig: {} },
                { ...baseApplication, programPaymentStatus: 'paid' },
            );

            expect(result).toBe(true);
        });

        it('is not eligible when neither payment status is paid', () => {
            const result = service.isEligible(
                { audienceType: 'paid_any', audienceConfig: {} },
                { ...baseApplication },
            );

            expect(result).toBe(false);
        });
    });

    describe('paid_pricing_tier', () => {
        it('is eligible when a paid invoice matches a configured pricing tier', () => {
            const result = service.isEligible(
                { audienceType: 'paid_pricing_tier', audienceConfig: { pricingTierIds: ['tier-1'] } },
                { ...baseApplication, invoices: [{ pricingTierId: 'tier-1', status: 'paid' }] },
            );

            expect(result).toBe(true);
        });

        it('is not eligible when the matching invoice is unpaid', () => {
            const result = service.isEligible(
                { audienceType: 'paid_pricing_tier', audienceConfig: { pricingTierIds: ['tier-1'] } },
                { ...baseApplication, invoices: [{ pricingTierId: 'tier-1', status: 'unpaid' }] },
            );

            expect(result).toBe(false);
        });

        it('is not eligible when no invoice matches a configured tier', () => {
            const result = service.isEligible(
                { audienceType: 'paid_pricing_tier', audienceConfig: { pricingTierIds: ['tier-1'] } },
                { ...baseApplication, invoices: [{ pricingTierId: 'tier-2', status: 'paid' }] },
            );

            expect(result).toBe(false);
        });
    });

    describe('specific_status', () => {
        it('is eligible when application status is in the configured list', () => {
            const result = service.isEligible(
                { audienceType: 'specific_status', audienceConfig: { statuses: ['accepted'] } },
                { ...baseApplication, status: 'accepted' },
            );

            expect(result).toBe(true);
        });

        it('is not eligible when application status is not in the configured list', () => {
            const result = service.isEligible(
                { audienceType: 'specific_status', audienceConfig: { statuses: ['accepted'] } },
                { ...baseApplication, status: 'draft' },
            );

            expect(result).toBe(false);
        });
    });

    describe('submitted_and_paid', () => {
        it('is not eligible for a draft, unpaid application', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                { ...baseApplication, status: 'draft', submittedAt: null },
            );

            expect(result).toBe(false);
        });

        it('is not eligible when submitted but unpaid', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                {
                    ...baseApplication,
                    status: 'submitted',
                    submittedAt: new Date('2026-01-01'),
                    registrationPaymentStatus: 'unpaid',
                    programPaymentStatus: 'unpaid',
                },
            );

            expect(result).toBe(false);
        });

        it('is not eligible when paid but never submitted (draft)', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                {
                    ...baseApplication,
                    status: 'draft',
                    submittedAt: null,
                    registrationPaymentStatus: 'paid',
                },
            );

            expect(result).toBe(false);
        });

        it('is not eligible when status is submitted/accepted but submittedAt is null (data inconsistency)', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                {
                    ...baseApplication,
                    status: 'submitted',
                    submittedAt: null,
                    registrationPaymentStatus: 'paid',
                },
            );

            expect(result).toBe(false);
        });

        it('is eligible when status is submitted, submittedAt is set, and payment is paid', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                {
                    ...baseApplication,
                    status: 'submitted',
                    submittedAt: new Date('2026-01-01'),
                    registrationPaymentStatus: 'paid',
                },
            );

            expect(result).toBe(true);
        });

        it('is eligible when status is accepted, submittedAt is set, and payment is paid', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                {
                    ...baseApplication,
                    status: 'accepted',
                    submittedAt: new Date('2026-01-01'),
                    programPaymentStatus: 'paid',
                },
            );

            expect(result).toBe(true);
        });

        it('is not eligible for other non-submitted statuses (e.g. rejected) even if paid', () => {
            const result = service.isEligible(
                { audienceType: 'submitted_and_paid', audienceConfig: {} },
                {
                    ...baseApplication,
                    status: 'rejected',
                    submittedAt: new Date('2026-01-01'),
                    registrationPaymentStatus: 'paid',
                },
            );

            expect(result).toBe(false);
        });
    });

    describe('unknown audienceType', () => {
        it('fails closed (not eligible) for an unrecognised audienceType', () => {
            const result = service.isEligible(
                { audienceType: 'some_future_value', audienceConfig: {} },
                { ...baseApplication, status: 'accepted', registrationPaymentStatus: 'paid' },
            );

            expect(result).toBe(false);
        });
    });
});
