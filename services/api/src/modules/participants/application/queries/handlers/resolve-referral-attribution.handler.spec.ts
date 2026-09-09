// src/modules/participants/application/queries/handlers/resolve-referral-attribution.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ResolveReferralAttributionHandler } from './resolve-referral-attribution.handler';
import { ResolveReferralAttributionQuery } from '../resolve-referral-attribution.query';

describe('ResolveReferralAttributionHandler', () => {
    let handler: ResolveReferralAttributionHandler;

    const mockPrismaService = {
        ambassador: {
            findFirst: jest.fn(),
        },
        program: {
            findUnique: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResolveReferralAttributionHandler,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<ResolveReferralAttributionHandler>(ResolveReferralAttributionHandler);
        jest.clearAllMocks();
    });

    it('resolves an unscoped active code to the ambassador name', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ fullName: 'Jane Ambassador' });

        const result = await handler.execute(new ResolveReferralAttributionQuery('URO19948'));

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith({
            where: {
                referralCode: 'URO19948',
                isActive: true,
                deletedAt: null,
            },
            select: {
                fullName: true,
            },
        });
        expect(result).toEqual({ valid: true, referredByName: 'Jane Ambassador' });
    });

    it('normalizes lowercase and padded codes before lookup', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ fullName: 'Jane Ambassador' });

        await handler.execute(new ResolveReferralAttributionQuery('  uro19948 '));

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referralCode: 'URO19948' }),
            }),
        );
    });

    describe('brand scoping (via programId)', () => {
        const PROGRAM_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
        const BRAND_ID = 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff';

        it('resolves the ambassador name when scoped to the matching brand', async () => {
            mockPrismaService.program.findUnique.mockResolvedValue({ brandId: BRAND_ID });
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ fullName: 'Jane Ambassador' });

            const result = await handler.execute(new ResolveReferralAttributionQuery('URO19948', PROGRAM_ID));

            expect(mockPrismaService.program.findUnique).toHaveBeenCalledWith({
                where: { id: PROGRAM_ID },
                select: { brandId: true },
            });
            expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        referralCode: 'URO19948',
                        user: { brandId: BRAND_ID },
                    }),
                }),
            );
            expect(result).toEqual({ valid: true, referredByName: 'Jane Ambassador' });
        });

        it('returns valid:false when the code belongs to a different brand', async () => {
            mockPrismaService.program.findUnique.mockResolvedValue({ brandId: BRAND_ID });
            // The brand-scoped query finds nothing even though the code exists elsewhere.
            mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

            const result = await handler.execute(new ResolveReferralAttributionQuery('URO19948', PROGRAM_ID));

            expect(result).toEqual({ valid: false, referredByName: null });
        });

        it('returns valid:false when the supplied program does not exist, without calling ambassador.findFirst', async () => {
            mockPrismaService.program.findUnique.mockResolvedValue(null);

            const result = await handler.execute(new ResolveReferralAttributionQuery('URO19948', PROGRAM_ID));

            expect(result).toEqual({ valid: false, referredByName: null });
            expect(mockPrismaService.ambassador.findFirst).not.toHaveBeenCalled();
        });

        it('stays unscoped when no program is supplied, rather than guessing one', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ fullName: 'Jane Ambassador' });

            await handler.execute(new ResolveReferralAttributionQuery('URO19948'));

            expect(mockPrismaService.program.findUnique).not.toHaveBeenCalled();
            const [[arg]] = mockPrismaService.ambassador.findFirst.mock.calls;
            expect(arg.where.user).toBeUndefined();
        });

        it('ignores a blank program instead of scoping to an empty string', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ fullName: 'Jane Ambassador' });

            await handler.execute(new ResolveReferralAttributionQuery('URO19948', '   '));

            expect(mockPrismaService.program.findUnique).not.toHaveBeenCalled();
            const [[arg]] = mockPrismaService.ambassador.findFirst.mock.calls;
            expect(arg.where.user).toBeUndefined();
        });
    });

    it('returns valid:false, referredByName:null for an unknown code (does not throw)', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

        const result = await handler.execute(new ResolveReferralAttributionQuery('NOPE00000'));

        expect(result).toEqual({ valid: false, referredByName: null });
    });

    it('excludes inactive and deleted ambassadors via the where clause (findFirst returns null)', async () => {
        // isActive:true and deletedAt:null are enforced in the query itself; a
        // matching-but-inactive/deleted row simply won't be returned by Prisma.
        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

        const result = await handler.execute(new ResolveReferralAttributionQuery('URO19948'));

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ isActive: true, deletedAt: null }),
            }),
        );
        expect(result).toEqual({ valid: false, referredByName: null });
    });

    it('returns valid:false without querying Prisma for a blank code', async () => {
        const result = await handler.execute(new ResolveReferralAttributionQuery('   '));

        expect(result).toEqual({ valid: false, referredByName: null });
        expect(mockPrismaService.ambassador.findFirst).not.toHaveBeenCalled();
    });
});
