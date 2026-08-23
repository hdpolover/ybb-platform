import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { UpdateBrandHandler } from './update-brand.handler';
import { UpdateBrandCommand } from '../update-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { BrandLogoAssetsService } from '../../services/brand-logo-assets.service';
import { LandingCacheInvalidationService } from '../../services/landing-cache-invalidation.service';

const makeBrand = (overrides: Record<string, unknown> = {}) => ({
    id: 'brand-1',
    name: 'Test Brand',
    slug: 'test-brand',
    landingUrl: 'https://landing.example.com',
    websiteUrl: 'https://www.example.com',
    deletedAt: null,
    ...overrides,
});

describe('UpdateBrandHandler', () => {
    let handler: UpdateBrandHandler;
    let brandRepository: jest.Mocked<IBrandRepository>;
    let storageService: jest.Mocked<Partial<StorageService>>;
    let prismaService: jest.Mocked<Partial<PrismaService>>;
    let brandLogoAssetsService: jest.Mocked<Partial<BrandLogoAssetsService>>;
    let landingCacheInvalidation: jest.Mocked<Partial<LandingCacheInvalidationService>>;

    beforeEach(async () => {
        brandRepository = {
            findById: jest.fn(),
            findByName: jest.fn().mockResolvedValue(null),
            findBySlug: jest.fn().mockResolvedValue(null),
            update: jest.fn(),
            getMetadata: jest.fn().mockResolvedValue(null),
        } as any;

        storageService = {
            uploadFile: jest.fn(),
        };

        prismaService = {
            brand: {
                update: jest.fn().mockResolvedValue({}),
            } as any,
        };

        brandLogoAssetsService = {
            uploadBrandLogoAssets: jest.fn(),
        };

        landingCacheInvalidation = {
            invalidate: jest.fn().mockResolvedValue(undefined),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                UpdateBrandHandler,
                { provide: 'IBrandRepository', useValue: brandRepository },
                { provide: StorageService, useValue: storageService },
                { provide: PrismaService, useValue: prismaService },
                { provide: BrandLogoAssetsService, useValue: brandLogoAssetsService },
                { provide: LandingCacheInvalidationService, useValue: landingCacheInvalidation },
            ],
        }).compile();

        handler = module.get<UpdateBrandHandler>(UpdateBrandHandler);
    });

    it('should throw NotFoundException when brand does not exist', async () => {
        brandRepository.findById.mockResolvedValue(null);
        const command = new UpdateBrandCommand('nonexistent', { name: 'Updated' } as any, 'user-1');

        await expect(handler.execute(command)).rejects.toThrow(NotFoundException);
    });

    it('should update the brand and return the result', async () => {
        const brand = makeBrand();
        brandRepository.findById.mockResolvedValue(brand as any);
        brandRepository.update.mockResolvedValue({ ...brand, name: 'Updated' } as any);

        const command = new UpdateBrandCommand('brand-1', { name: 'Updated' } as any, 'user-1');
        const result = await handler.execute(command);

        expect(brandRepository.update).toHaveBeenCalledWith('brand-1', expect.objectContaining({ name: 'Updated' }));
        expect(result.name).toBe('Updated');
    });

    it('invalidates landing caches with the brand revalidate hook and no program:* bust', async () => {
        // Arrange — brand-detail edits don't touch program-scoped landing data, so
        // bustProgramCache must stay false, and the fresh landingUrl/websiteUrl must
        // be passed through so the revalidate hook doesn't need to re-read the DB.
        const brand = makeBrand();
        brandRepository.findById.mockResolvedValue(brand as any);
        brandRepository.update.mockResolvedValue({
            ...brand,
            landingUrl: 'https://fresh-landing.example.com',
            websiteUrl: 'https://fresh-website.example.com',
        } as any);

        const command = new UpdateBrandCommand('brand-1', { name: 'Updated' } as any, 'user-1');
        await handler.execute(command);

        expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-1', {
            clearSnapshot: true,
            bustProgramCache: false,
            swallowErrors: true,
            revalidate: {
                kind: 'brand',
                urls: {
                    landingUrl: 'https://fresh-landing.example.com',
                    websiteUrl: 'https://fresh-website.example.com',
                },
            },
        });
    });

    it('uploads logo assets and patches metadata + logoIconUrl when a logo file is provided', async () => {
        const brand = makeBrand();
        brandRepository.findById.mockResolvedValue(brand as any);
        brandRepository.update.mockResolvedValue(brand as any);
        (brandLogoAssetsService.uploadBrandLogoAssets as jest.Mock).mockResolvedValue({
            logoUrl: 'https://cdn.example.com/logo.png',
            logoIconUrl: 'https://cdn.example.com/logo-icon.png',
            metadataPatch: { favicon_url: 'https://cdn.example.com/favicon.png' },
        });

        const command = new UpdateBrandCommand(
            'brand-1',
            {} as any,
            'user-1',
            { logo: { originalname: 'logo.png' } as any },
        );
        await handler.execute(command);

        expect(brandLogoAssetsService.uploadBrandLogoAssets).toHaveBeenCalledWith(
            command.files!.logo,
            'brand-1',
        );
        expect(prismaService.brand!.update).toHaveBeenCalledWith({
            where: { id: 'brand-1' },
            data: { logoIconUrl: 'https://cdn.example.com/logo-icon.png' },
        });
    });
});
