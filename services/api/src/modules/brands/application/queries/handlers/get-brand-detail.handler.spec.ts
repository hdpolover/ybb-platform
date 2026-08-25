import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetBrandDetailHandler } from './get-brand-detail.handler';
import { GetBrandDetailQuery } from '../get-brand-detail.query';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

describe('GetBrandDetailHandler', () => {
    let handler: GetBrandDetailHandler;

    const baseBrand = {
        id: 'brand-1',
        name: 'Istanbul Youth Summit',
        slug: 'istanbul-youth-summit',
        logoUrl: 'http://cdn/brand-logo.png',
        isActive: true,
        programCount: 1,
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: null,
    };

    const mockBrandRepository = {
        findById: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn().mockReturnValue('http://localhost:9000'),
    };

    const mockPrismaService = {
        program: {
            findFirst: jest.fn(),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                GetBrandDetailHandler,
                { provide: 'IBrandRepository', useValue: mockBrandRepository },
                { provide: ConfigService, useValue: mockConfigService },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<GetBrandDetailHandler>(GetBrandDetailHandler);
        jest.clearAllMocks();
    });

    it('throws NotFoundException when the brand does not exist', async () => {
        mockBrandRepository.findById.mockResolvedValue(null);

        await expect(handler.execute(new GetBrandDetailQuery('missing'))).rejects.toBeInstanceOf(
            NotFoundException,
        );
    });

    it('returns activeProgram: null when the brand has no program (rule 3)', async () => {
        mockBrandRepository.findById.mockResolvedValue(baseBrand);
        mockPrismaService.program.findFirst.mockResolvedValue(null);

        const result = await handler.execute(new GetBrandDetailQuery('brand-1'));

        expect(result.activeProgram).toBeNull();
    });

    it('surfaces the active program logoUrl so the admin UI can warn about shadowing', async () => {
        mockBrandRepository.findById.mockResolvedValue(baseBrand);
        mockPrismaService.program.findFirst.mockResolvedValueOnce({
            id: 'program-1',
            slug: 'istanbul-youth-summit-2026',
            logoUrl: 'http://cdn/program-logo.png',
        });

        const result = await handler.execute(new GetBrandDetailQuery('brand-1'));

        expect(result.activeProgram).toEqual({
            id: 'program-1',
            slug: 'istanbul-youth-summit-2026',
            logoUrl: 'http://cdn/program-logo.png',
        });
    });

    it('falls back to rule 2 (any non-deleted program) when no published+active program matches', async () => {
        mockBrandRepository.findById.mockResolvedValue(baseBrand);
        mockPrismaService.program.findFirst
            .mockResolvedValueOnce(null) // rule 1: none published+active
            .mockResolvedValueOnce({ id: 'program-2', slug: 'fallback-program', logoUrl: null });

        const result = await handler.execute(new GetBrandDetailQuery('brand-1'));

        expect(mockPrismaService.program.findFirst).toHaveBeenCalledTimes(2);
        expect(result.activeProgram).toEqual({ id: 'program-2', slug: 'fallback-program', logoUrl: null });
    });
});
