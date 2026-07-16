import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ResolveAmbassadorShareTokenHandler } from './resolve-ambassador-share-token.handler';
import { ResolveAmbassadorShareTokenQuery } from '../resolve-ambassador-share-token.query';
import { createAmbassadorShareToken } from '../../utils/ambassador-share-token.util';

describe('ResolveAmbassadorShareTokenHandler', () => {
    let handler: ResolveAmbassadorShareTokenHandler;

    const previousJwtSecret = process.env.JWT_SECRET;
    const mockPrismaService = {
        ambassador: {
            findFirst: jest.fn(),
        },
    };

    beforeAll(() => {
        process.env.JWT_SECRET = 'test-secret-for-ambassador-share-token';
    });

    afterAll(() => {
        process.env.JWT_SECRET = previousJwtSecret;
    });

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ResolveAmbassadorShareTokenHandler,
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<ResolveAmbassadorShareTokenHandler>(ResolveAmbassadorShareTokenHandler);
        jest.clearAllMocks();
    });

    it('resolves a valid share token to a referral code', async () => {
        const token = createAmbassadorShareToken('11111111-1111-4111-8111-111111111111');
        mockPrismaService.ambassador.findFirst.mockResolvedValue({ referralCode: 'REF123' });

        const result = await handler.execute(new ResolveAmbassadorShareTokenQuery(token));

        expect(mockPrismaService.ambassador.findFirst).toHaveBeenCalledWith({
            where: {
                id: '11111111-1111-4111-8111-111111111111',
                deletedAt: null,
                isActive: true,
            },
            select: {
                referralCode: true,
            },
        });
        expect(result).toEqual({ referralCode: 'REF123' });
    });

    it('rejects an invalid share token', async () => {
        await expect(handler.execute(new ResolveAmbassadorShareTokenQuery('bad-token'))).rejects.toThrow(BadRequestException);
    });

    it('rejects tokens that do not map to an active ambassador', async () => {
        const token = createAmbassadorShareToken('11111111-1111-4111-8111-111111111111');
        mockPrismaService.ambassador.findFirst.mockResolvedValue(null);

        await expect(handler.execute(new ResolveAmbassadorShareTokenQuery(token))).rejects.toThrow(NotFoundException);
    });
});
