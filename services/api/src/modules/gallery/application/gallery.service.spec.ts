import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { GalleryService } from './gallery.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../files/application/storage.service';
import { LandingCacheInvalidationService } from '@modules/brands/application/services/landing-cache-invalidation.service';

// ProgramGallery is landing-rendered (see landing/strategies/home.strategy.ts),
// so gallery writes must clear the Postgres snapshot AND nudge the Next.js
// frontend cache, same as every other landing-cache caller. swallowErrors is
// true here too: the DB write has already succeeded by the time this fires,
// so a cache-layer failure must not turn a successful admin save into a 500 —
// the shared service already unit-tests the swallow behaviour itself
// (see landing-cache-invalidation.service.spec.ts); this file only needs to
// pin the options gallery passes in.
const expectedInvalidateOptions = {
    clearSnapshot: true,
    bustProgramCache: true,
    swallowErrors: true,
    revalidate: { kind: 'homeAndSettings' as const },
};

const makePrismaService = () => ({
    program: {
        findUnique: jest.fn(),
    },
    programGallery: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
    },
});

async function buildService(
    prisma: ReturnType<typeof makePrismaService>,
    landingCacheInvalidation: { invalidate: jest.Mock },
): Promise<GalleryService> {
    const module: TestingModule = await Test.createTestingModule({
        providers: [
            GalleryService,
            { provide: PrismaService, useValue: prisma },
            { provide: StorageService, useValue: { uploadFile: jest.fn() } },
            { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
        ],
    }).compile();
    return module.get<GalleryService>(GalleryService);
}

describe('GalleryService', () => {
    describe('create', () => {
        it('invalidates landing caches for the program brand with gallery-specific options', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.program.findUnique.mockResolvedValue({ id: 'prog-1', brandId: 'brand-1' });
            prisma.programGallery.create.mockResolvedValue({ id: 'gal-1' });
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            const service = await buildService(prisma, landingCacheInvalidation);

            // Act
            await service.create({ program_id: 'prog-1', image_url: 'https://x.example/img.png' } as any, undefined, 'user-1');

            // Assert
            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-1', expectedInvalidateOptions);
        });
    });

    describe('update', () => {
        it('invalidates landing caches for the item\'s program brand', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.programGallery.findUnique.mockResolvedValue({ id: 'gal-1', programId: 'prog-1', deletedAt: null });
            prisma.program.findUnique.mockResolvedValue({ brandId: 'brand-2' });
            prisma.programGallery.update.mockResolvedValue({ id: 'gal-1' });
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            const service = await buildService(prisma, landingCacheInvalidation);

            // Act
            await service.update('gal-1', { title: 'New title' } as any);

            // Assert
            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-2', expectedInvalidateOptions);
        });

        it('throws NotFoundException without touching the cache when the item is already deleted', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.programGallery.findUnique.mockResolvedValue({ id: 'gal-1', deletedAt: new Date() });
            const landingCacheInvalidation = { invalidate: jest.fn() };
            const service = await buildService(prisma, landingCacheInvalidation);

            // Act / Assert
            await expect(service.update('gal-1', {} as any)).rejects.toThrow(NotFoundException);
            expect(landingCacheInvalidation.invalidate).not.toHaveBeenCalled();
        });
    });

    describe('remove', () => {
        it('soft-deletes and invalidates landing caches for the item\'s program brand', async () => {
            // Arrange
            const prisma = makePrismaService();
            prisma.programGallery.findUnique.mockResolvedValue({ id: 'gal-1', programId: 'prog-1', deletedAt: null });
            prisma.program.findUnique.mockResolvedValue({ brandId: 'brand-3' });
            prisma.programGallery.update.mockResolvedValue({ id: 'gal-1', deletedAt: new Date() });
            const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
            const service = await buildService(prisma, landingCacheInvalidation);

            // Act
            await service.remove('gal-1');

            // Assert
            expect(prisma.programGallery.update).toHaveBeenCalledWith({
                where: { id: 'gal-1' },
                data: expect.objectContaining({ isActive: false }),
            });
            expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-3', expectedInvalidateOptions);
        });
    });
});
