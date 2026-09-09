// src/modules/participants/application/services/referral-funnel.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReferralStatus } from '@prisma/client';
import { ReferralFunnelService } from './referral-funnel.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('ReferralFunnelService', () => {
    let service: ReferralFunnelService;

    const mockPrisma = {
        ambassadorReferral: {
            findFirst: jest.fn(),
            update: jest.fn(),
        },
        ambassador: {
            update: jest.fn(),
        },
        participantApplication: {
            findFirst: jest.fn(),
        },
        $transaction: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ReferralFunnelService,
                { provide: PrismaService, useValue: mockPrisma },
            ],
        }).compile();

        service = module.get<ReferralFunnelService>(ReferralFunnelService);
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => unknown) => cb(mockPrisma));
    });

    // (c) A participant referred into two different programmes (via the same
    // brand-wide ambassador code) now has TWO ambassador_referrals rows —
    // one per programme. Before the model change, ambassador.programId was
    // the join key, so it was impossible to have two rows to disambiguate in
    // the first place. Every funnel transition must advance the row for the
    // programme actually being acted on, never an arbitrary/wrong row.
    describe('advances the correct referral row when a participant has referrals on two programmes', () => {
        const participantId = 'participant-1';
        const programA = 'program-A';
        const programB = 'program-B';

        const referralForA = {
            id: 'referral-A',
            ambassadorId: 'amb-1',
            participantId,
            programId: programA,
            status: ReferralStatus.referred,
            referredAt: new Date('2026-01-01T00:00:00Z'),
        };

        const referralForB = {
            id: 'referral-B',
            ambassadorId: 'amb-1',
            participantId,
            programId: programB,
            status: ReferralStatus.referred,
            referredAt: new Date('2026-01-05T00:00:00Z'),
        };

        it('advanceToApplied matches on referral.programId, not ambassador.programId', async () => {
            // Simulates a scoped lookup: Prisma would only return the row whose
            // programId matches the where clause, i.e. referralForB for programB.
            mockPrisma.ambassadorReferral.findFirst.mockImplementation(({ where }: any) => {
                if (where.programId === programB) return Promise.resolve(referralForB);
                return Promise.resolve(null);
            });
            mockPrisma.ambassadorReferral.update.mockResolvedValue({});

            await service.advanceToApplied(participantId, programB);

            expect(mockPrisma.ambassadorReferral.findFirst).toHaveBeenCalledWith({
                where: {
                    participantId,
                    programId: programB,
                    ambassador: { isActive: true },
                },
            });
            // The row updated is referral-B, never referral-A.
            expect(mockPrisma.ambassadorReferral.update).toHaveBeenCalledWith({
                where: { id: 'referral-B' },
                data: expect.objectContaining({ status: ReferralStatus.applied }),
            });
        });

        it('advanceToAccepted updates only the row for the programme the application belongs to', async () => {
            mockPrisma.ambassadorReferral.findFirst.mockImplementation(({ where }: any) => {
                if (where.programId === programA) return Promise.resolve(referralForA);
                return Promise.resolve(null);
            });
            mockPrisma.ambassadorReferral.update.mockResolvedValue({});
            mockPrisma.ambassador.update.mockResolvedValue({ firstSuccessfulReferralAt: new Date() });

            await service.advanceToAccepted(participantId, programA);

            expect(mockPrisma.ambassadorReferral.update).toHaveBeenCalledWith({
                where: { id: 'referral-A' },
                data: expect.objectContaining({ status: ReferralStatus.accepted }),
            });
            // Never touches referral-B.
            expect(mockPrisma.ambassadorReferral.update).not.toHaveBeenCalledWith(
                expect.objectContaining({ where: { id: 'referral-B' } }),
            );
        });

        it('advanceToCompleted only fires for the programme whose application is fully paid', async () => {
            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-A' });
            mockPrisma.ambassadorReferral.findFirst.mockImplementation(({ where }: any) => {
                if (where.programId === programA) return Promise.resolve(referralForA);
                return Promise.resolve(null);
            });
            mockPrisma.ambassadorReferral.update.mockResolvedValue({});

            await service.advanceToCompleted(participantId, programA);

            expect(mockPrisma.ambassadorReferral.update).toHaveBeenCalledWith({
                where: { id: 'referral-A' },
                data: expect.objectContaining({ status: ReferralStatus.completed }),
            });
        });
    });

    describe('advanceToRegistered', () => {
        it('scopes to the given programme when provided, rather than picking an arbitrary referred row', async () => {
            mockPrisma.ambassadorReferral.findFirst.mockResolvedValue(null);

            await service.advanceToRegistered('participant-1', 'program-B');

            expect(mockPrisma.ambassadorReferral.findFirst).toHaveBeenCalledWith({
                where: { participantId: 'participant-1', status: ReferralStatus.referred, programId: 'program-B' },
            });
        });

        it('stays unscoped when no programme is supplied (pre-application-count-known case)', async () => {
            mockPrisma.ambassadorReferral.findFirst.mockResolvedValue(null);

            await service.advanceToRegistered('participant-1');

            expect(mockPrisma.ambassadorReferral.findFirst).toHaveBeenCalledWith({
                where: { participantId: 'participant-1', status: ReferralStatus.referred },
            });
        });
    });
});
