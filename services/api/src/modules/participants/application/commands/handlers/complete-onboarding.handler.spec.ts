// src/modules/participants/application/commands/handlers/complete-onboarding.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CompleteOnboardingHandler } from './complete-onboarding.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { ReferralFunnelService } from '../../services/referral-funnel.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CompleteOnboardingCommand } from '../complete-onboarding.command';
import { Gender, OnboardingDto } from '../../../presentation/dto/onboarding.dto';

describe('CompleteOnboardingHandler - referral attribution', () => {
    let handler: CompleteOnboardingHandler;

    const mockTx = {
        participant: {
            upsert: jest.fn(),
            update: jest.fn(),
        },
        user: {
            findUnique: jest.fn(),
            update: jest.fn(),
        },
        ambassador: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        participantApplication: {
            findMany: jest.fn(),
        },
        ambassadorReferral: {
            findFirst: jest.fn(),
            create: jest.fn(),
        },
    };

    const mockUnitOfWork = {
        execute: jest.fn((work: (repos: { tx: typeof mockTx }) => unknown) => work({ tx: mockTx })),
    };

    const mockReferralFunnel = {
        advanceToRegistered: jest.fn().mockResolvedValue(undefined),
    };

    const mockCacheService = {
        invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
        invalidateKey: jest.fn().mockResolvedValue(undefined),
    };

    const mockPrisma = {};

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
        mockUnitOfWork.execute.mockImplementation((work: (repos: { tx: typeof mockTx }) => unknown) =>
            work({ tx: mockTx }),
        );

        mockTx.participant.upsert.mockResolvedValue({ id: 'participant-1', referralCode: null });
        mockTx.participant.update.mockResolvedValue({ id: 'participant-1', referralCode: 'REFCODE' });
        mockTx.user.findUnique.mockResolvedValue({ id: 'user-1', brandId: 'brand-1', emailVerifiedAt: null });
        mockTx.user.update.mockResolvedValue({});
        mockTx.ambassadorReferral.findFirst.mockResolvedValue(null);
        mockTx.participantApplication.findMany.mockResolvedValue([]);
    });

    // (d) Ambassador exists, code is real, but belongs to a DIFFERENT brand
    // than the participant onboarding here. Before this change, codes were
    // matched with no brand filter at all (only optionally by
    // ambassador.programId); a brand-wide code makes that gap load-bearing.
    it('(d) refuses a code whose ambassador belongs to a different brand', async () => {
        // The brand-scoped where clause is what actually enforces this - a
        // real Prisma query would return null here because the ambassador's
        // user.brandId does not match. Simulate that directly.
        mockTx.ambassador.findFirst.mockImplementation(({ where }: any) => {
            if (where.user?.brandId === 'brand-1') return Promise.resolve(null);
            return Promise.resolve(ambassador);
        });

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockTx.ambassador.findFirst).toHaveBeenCalledWith({
            where: {
                referralCode: 'REFCODE',
                isActive: true,
                deletedAt: null,
                user: { brandId: 'brand-1' },
            },
        });
        expect(mockTx.ambassadorReferral.create).not.toHaveBeenCalled();
        expect(mockTx.ambassador.update).not.toHaveBeenCalled();
    });

    it('attributes the referral to the participant\'s single application programme when unambiguous', async () => {
        mockTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockTx.participantApplication.findMany.mockResolvedValue([{ programId: 'applied-program' }]);
        mockTx.ambassadorReferral.create.mockResolvedValue({});
        mockTx.ambassador.update.mockResolvedValue({});

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockTx.ambassadorReferral.create).toHaveBeenCalledWith({
            data: {
                ambassadorId: ambassador.id,
                participantId: 'participant-1',
                programId: 'applied-program',
                status: 'referred',
            },
        });
    });

    it('falls back to the ambassador\'s home programme when the participant has no applications yet', async () => {
        mockTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockTx.participantApplication.findMany.mockResolvedValue([]);
        mockTx.ambassadorReferral.create.mockResolvedValue({});
        mockTx.ambassador.update.mockResolvedValue({});

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockTx.ambassadorReferral.create).toHaveBeenCalledWith({
            data: {
                ambassadorId: ambassador.id,
                participantId: 'participant-1',
                programId: ambassador.programId,
                status: 'referred',
            },
        });
    });

    it('does not create a referral when one already exists for the resolved programme (idempotent)', async () => {
        mockTx.ambassador.findFirst.mockResolvedValue(ambassador);
        mockTx.participantApplication.findMany.mockResolvedValue([{ programId: 'applied-program' }]);
        mockTx.ambassadorReferral.findFirst.mockResolvedValue({ id: 'existing-referral' });

        await handler.execute(
            new CompleteOnboardingCommand('user-1', { ...baseDto, referralCode: 'REFCODE' }),
        );

        expect(mockTx.ambassadorReferral.findFirst).toHaveBeenCalledWith({
            where: { participantId: 'participant-1', programId: 'applied-program' },
        });
        expect(mockTx.ambassadorReferral.create).not.toHaveBeenCalled();
    });
});
