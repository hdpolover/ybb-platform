// src/modules/participants/application/commands/handlers/complete-onboarding.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompleteOnboardingHandler } from './complete-onboarding.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { ReferralFunnelService } from '../../services/referral-funnel.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CompleteOnboardingCommand } from '../complete-onboarding.command';
import { Gender, OnboardingDto } from '../../../presentation/dto/onboarding.dto';
import { makePrismaTxMock, expectNoOuterWrites } from '../../../../../../test/utils/prisma-tx-mock';

describe('CompleteOnboardingHandler - referral attribution', () => {
    let handler: CompleteOnboardingHandler;

    // The onboarding upsert transaction (unitOfWork.execute) — participant +
    // user.isOnboardingCompleted only, since audit M202.
    const mockOnboardingTx = {
        participant: {
            upsert: jest.fn(),
            update: jest.fn(),
        },
        user: {
            update: jest.fn(),
        },
    };

    const mockUnitOfWork = {
        execute: jest.fn((work: (repos: { tx: typeof mockOnboardingTx }) => unknown) =>
            work({ tx: mockOnboardingTx }),
        ),
    };

    // The separate referral-linking transaction (this.prisma.$transaction),
    // deliberately disjoint from `mockPrisma.user.findUnique` (the hoisted
    // read) so a write that escapes the referral tx is independently
    // observable — see prisma-tx-mock.ts's docstring.
    const { prisma: mockPrisma, tx: mockReferralTx } = makePrismaTxMock(
        {
            user: { findUnique: jest.fn() },
        },
        {
            ambassador: { findFirst: jest.fn(), update: jest.fn() },
            participantApplication: { findMany: jest.fn() },
            ambassadorReferral: { findFirst: jest.fn(), create: jest.fn() },
            participant: { findUnique: jest.fn(), update: jest.fn() },
        },
    );

    const mockReferralFunnel = {
        advanceToRegistered: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
        invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const baseDto: OnboardingDto = {
        fullName: 'Jane Doe',
        gender: Gender.female,
        originCountry: 'ID',
        originCity: 'Jakarta',
        birthDate: '2000-01-01',
        knowledgeSource: 'Instagram',
    };

    const ambassador = {
        id: 'amb-1',
        referralCode: 'REFCODE',
        isActive: true,
        programId: 'ambassador-home-program',
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CompleteOnboardingHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UnitOfWork, useValue: mockUnitOfWork },
                { provide: ReferralFunnelService, useValue: mockReferralFunnel },
                { provide: CacheService, useValue: mockCacheService },
            ],
        }).compile();

        handler = module.get<CompleteOnboardingHandler>(CompleteOnboardingHandler);

        jest.clearAllMocks();
        mockUnitOfWork.execute.mockImplementation((work: (repos: { tx: typeof mockOnboardingTx }) => unknown) =>
            work({ tx: mockOnboardingTx }),
        );
        mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockReferralTx) => unknown) => cb(mockReferralTx));

        mockOnboardingTx.participant.upsert.mockResolvedValue({ id: 'participant-1', referralCode: null });
        mockOnboardingTx.participant.update.mockResolvedValue({ id: 'participant-1', referralCode: 'REFCODE' });
        mockOnboardingTx.user.update.mockResolvedValue({});
        mockPrisma.user.findUnique.mockResolvedValue({ brandId: 'brand-1', emailVerifiedAt: null });
        mockReferralTx.ambassadorReferral.findFirst.mockResolvedValue(null);
        mockReferralTx.participantApplication.findMany.mockResolvedValue([]);
        mockReferralTx.participant.findUnique.mockResolvedValue({ referralCode: null });
    });

    // audit M202: the emailVerifiedAt/brandId read must happen via the outer
    // (non-transactional) prisma client, BEFORE unitOfWork.execute is
    // invoked — not via tx.user.findUnique inside the transaction.
    it('reads the user outside the onboarding transaction, before unitOfWork.execute runs', async () => {
        const callOrder: string[] = [];
        mockPrisma.user.findUnique.mockImplementation(() => {
            callOrder.push('user.findUnique');
            return Promise.resolve({ brandId: 'brand-1', emailVerifiedAt: null });
        });
        mockUnitOfWork.execute.mockImplementation(async (work: (repos: { tx: typeof mockOnboardingTx }) => unknown) => {
            callOrder.push('unitOfWork.execute');
            return work({ tx: mockOnboardingTx });
        });

        await handler.execute(new CompleteOnboardingCommand('user-1', baseDto));

        expect(callOrder).toEqual(['user.findUnique', 'unitOfWork.execute']);
        expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            select: { emailVerifiedAt: true, brandId: true },
        });
        // No tx.user.findUnique on the onboarding tx mock at all — it has no such method any more.
        expect((mockOnboardingTx as Record<string, unknown>).user).not.toHaveProperty('findUnique');
    });

    // audit M202: a duplicate-referral race (P2002) must not fail the whole
    // onboarding request — the referral link now runs in its own transaction
    // wrapped in a non-blocking catch, matching the sibling in
    // portal-submit-application.handler.ts.
    it('does not fail onboarding when referral linking throws (non-blocking)', async () => {
        mockReferralTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockReferralTx.participantApplication.findMany.mockResolvedValue([{ programId: 'applied-program' }]);
        mockReferralTx.ambassadorReferral.create.mockRejectedValue(
            Object.assign(new Error('Unique constraint failed'), { code: 'P2002' }),
        );

        const result = await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(result).toEqual({ id: 'participant-1', referralCode: null });
        // The onboarding tx's own writes still went through — the referral
        // failure did not poison the already-committed onboarding tx.
        expect(mockOnboardingTx.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { isOnboardingCompleted: true },
        });
        expect(mockReferralFunnel.advanceToRegistered).toHaveBeenCalledWith('participant-1');
    });

    // (d) Ambassador exists, code is real, but belongs to a DIFFERENT brand
    // than the participant onboarding here. Before this change, codes were
    // matched with no brand filter at all (only optionally by
    // ambassador.programId); a brand-wide code makes that gap load-bearing.
    it('(d) refuses a code whose ambassador belongs to a different brand', async () => {
        // The brand-scoped where clause is what actually enforces this - a
        // real Prisma query would return null here because the ambassador's
        // user.brandId does not match. Simulate that directly.
        mockReferralTx.ambassador.findFirst.mockImplementation(({ where }: any) => {
            if (where.user?.brandId === 'brand-1') return Promise.resolve(null);
            return Promise.resolve(ambassador);
        });

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockReferralTx.ambassador.findFirst).toHaveBeenCalledWith({
            where: {
                referralCode: 'REFCODE',
                isActive: true,
                deletedAt: null,
                user: { brandId: 'brand-1' },
            },
        });
        expect(mockReferralTx.ambassadorReferral.create).not.toHaveBeenCalled();
        expect(mockReferralTx.ambassador.update).not.toHaveBeenCalled();
    });

    it('attributes the referral to the participant\'s single application programme when unambiguous', async () => {
        mockReferralTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockReferralTx.participantApplication.findMany.mockResolvedValue([{ programId: 'applied-program' }]);
        mockReferralTx.ambassadorReferral.create.mockResolvedValue({});
        mockReferralTx.ambassador.update.mockResolvedValue({});

        const result = await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockReferralTx.ambassadorReferral.create).toHaveBeenCalledWith({
            data: {
                ambassadorId: ambassador.id,
                participantId: 'participant-1',
                programId: 'applied-program',
                status: 'referred',
            },
        });
        expectNoOuterWrites(mockPrisma);
        // Regression pin: linkReferral runs AFTER unitOfWork.execute has
        // already returned `result` (id: 'participant-1', referralCode:
        // null from the upsert mock above). The handler must merge the code
        // linkReferral actually persisted back into the response, not
        // return the stale pre-link value.
        expect(result.referralCode).toBe('REFCODE');
    });

    // Regression pin (post-review of the M202 commit): the onboarding
    // transaction returns `result` BEFORE linkReferral runs, so `result`
    // itself never carries the just-persisted referralCode. The handler must
    // merge linkReferral's own report of what it wrote back into the
    // response — re-reading the participant just for this would be
    // redundant, since linkReferral already knows the value.
    it('returns a participant whose referralCode matches a referral code that resolves to a live ambassador', async () => {
        mockReferralTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockReferralTx.participantApplication.findMany.mockResolvedValue([{ programId: 'applied-program' }]);
        mockReferralTx.ambassadorReferral.create.mockResolvedValue({});
        mockReferralTx.ambassador.update.mockResolvedValue({});
        // Existing participant row, re-onboarding: no referralCode on file
        // yet, so this exercises the tx.participant.update branch of step 6,
        // not the create() path where referralCode is seeded up front.
        mockOnboardingTx.participant.upsert.mockResolvedValue({ id: 'participant-1', referralCode: null });
        mockReferralTx.participant.findUnique.mockResolvedValue({ referralCode: null });
        mockReferralTx.participant.update.mockResolvedValue({ id: 'participant-1', referralCode: 'REFCODE' });

        const result = await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(result.referralCode).toBe('REFCODE');
    });

    it('does not overwrite referralCode when linkReferral wrote nothing (no matching ambassador)', async () => {
        mockReferralTx.ambassador.findFirst.mockResolvedValue(null);
        mockOnboardingTx.participant.upsert.mockResolvedValue({ id: 'participant-1', referralCode: null });

        const result = await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'BOGUS' }),
        );

        expect(result.referralCode).toBeNull();
        expect(mockReferralTx.ambassadorReferral.create).not.toHaveBeenCalled();
    });

    it('falls back to the ambassador\'s home programme when the participant has no applications yet', async () => {
        mockReferralTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockReferralTx.participantApplication.findMany.mockResolvedValue([]);
        mockReferralTx.ambassadorReferral.create.mockResolvedValue({});
        mockReferralTx.ambassador.update.mockResolvedValue({});

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockReferralTx.ambassadorReferral.create).toHaveBeenCalledWith({
            data: {
                ambassadorId: ambassador.id,
                participantId: 'participant-1',
                programId: ambassador.programId,
                status: 'referred',
            },
        });
    });

    it('does not create a referral when one already exists for the resolved programme (idempotent)', async () => {
        mockReferralTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockReferralTx.participantApplication.findMany.mockResolvedValue([{ programId: 'applied-program' }]);
        mockReferralTx.ambassadorReferral.findFirst.mockResolvedValue({ id: 'existing-referral' });

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockReferralTx.ambassadorReferral.findFirst).toHaveBeenCalledWith({
            where: { participantId: 'participant-1', programId: 'applied-program' },
        });
        expect(mockReferralTx.ambassadorReferral.create).not.toHaveBeenCalled();
    });
});
