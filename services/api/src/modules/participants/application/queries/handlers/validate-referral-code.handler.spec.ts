// src/modules/participants/application/queries/handlers/validate-referral-code.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ValidateReferralCodeHandler } from './validate-referral-code.handler';
import { ValidateReferralCodeQuery } from '../validate-referral-code.query';

describe('ValidateReferralCodeHandler', () => {
    let handler: ValidateReferralCodeHandler;

    const mockPrismaService = {
        ambassador: {
            findFirst: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ValidateReferralCodeHandler,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<ValidateReferralCodeHandler>(ValidateReferralCodeHandler);
        jest.clearAllMocks();
    });

    it('validates an active ambassador referral code', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

        const result = await handler.execute(new ValidateReferralCodeQuery('URO19948'));

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith({
            where: {
                referralCode: 'URO19948',
                isActive: true,
                deletedAt: null,
            },
            select: {
                id: true,
            },
        });
        expect(result).toEqual({ valid: true });
    });

    it('normalizes lowercase and padded codes before lookup', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

        await handler.execute(new ValidateReferralCodeQuery('  uro19948 '));

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({ referralCode: 'URO19948' }),
            }),
        );
    });

    it('rejects an empty code', async () => {
        await expect(handler.execute(new ValidateReferralCodeQuery('   '))).rejects.toThrow(BadRequestException);
        expect(mockPrismaService.ambassador.findFirst).not.toHaveBeenCalled();
    });

    it('rejects a code that matches no active ambassador', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

        await expect(handler.execute(new ValidateReferralCodeQuery('NOPE00000'))).rejects.toThrow(NotFoundException);
    });

    it('does not leak ambassador identity in the response', async () => {
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

        const result = await handler.execute(new ValidateReferralCodeQuery('URO19948'));

        expect(result).toEqual({ valid: true });
        expect(JSON.stringify(result)).not.toContain('amb-1');
    });

    describe('program scoping', () => {
        const PROGRAM_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

        it('scopes the lookup to the program when one is supplied', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

            await handler.execute(new ValidateReferralCodeQuery('URO19948', PROGRAM_ID));

            expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        referralCode: 'URO19948',
                        programId: PROGRAM_ID,
                    }),
                }),
            );
        });

        it('rejects a real code that belongs to a different program', async () => {
            // The scoped query finds nothing even though the code exists elsewhere.
            mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

            await expect(
                handler.execute(new ValidateReferralCodeQuery('URO19948', PROGRAM_ID)),
            ).rejects.toThrow(NotFoundException);
        });

        it('stays unscoped when no program is supplied, rather than guessing one', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

            await handler.execute(new ValidateReferralCodeQuery('URO19948'));

            const [[arg]] = mockPrismaService.ambassador.findFirst.mock.calls;
            expect(arg.where.programId).toBeUndefined();
        });

        it('ignores a blank program instead of scoping to an empty string', async () => {
            mockPrismaService.ambassador.findFirst.mockResolvedValue({ id: 'amb-1' });

            await handler.execute(new ValidateReferralCodeQuery('URO19948', '   '));

            const [[arg]] = mockPrismaService.ambassador.findFirst.mock.calls;
            expect(arg.where.programId).toBeUndefined();
        });
    });
});
