
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import { CreateBrandHandler } from './create-brand.handler';
import { CreateBrandCommand } from '../create-brand.command';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { BrandLogoAssetsService } from '../../services/brand-logo-assets.service';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateBrandDto } from '../../../presentation/dto/create-brand.dto';

describe('CreateBrandHandler', () => {
    let handler: CreateBrandHandler;

    const mockBrandRepository = {
        findByName: jest.fn().mockResolvedValue(null),
        findBySlug: jest.fn().mockResolvedValue(null),
        create: jest.fn(),
        update: jest.fn(),
        getMetadata: jest.fn().mockResolvedValue(null),
    };

    const mockActivityLogRepository = {
        create: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    const mockBrandLogoAssetsService = {
        uploadBrandLogoAssets: jest.fn(),
    };

    const mockLandingRevalidationService = {
        revalidateForBrand: jest.fn().mockResolvedValue(undefined),
    };

    const mockPrismaService = {
        brand: {
            update: jest.fn().mockResolvedValue(undefined),
        },
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateBrandHandler,
                { provide: 'IBrandRepository', useValue: mockBrandRepository },
                { provide: IUserActivityLogRepository, useValue: mockActivityLogRepository },
                { provide: StorageService, useValue: mockStorageService },
                { provide: BrandLogoAssetsService, useValue: mockBrandLogoAssetsService },
                { provide: LandingRevalidationService, useValue: mockLandingRevalidationService },
                { provide: PrismaService, useValue: mockPrismaService },
            ],
        }).compile();

        handler = module.get<CreateBrandHandler>(CreateBrandHandler);

        jest.clearAllMocks();
        mockBrandRepository.findByName.mockResolvedValue(null);
        mockBrandRepository.findBySlug.mockResolvedValue(null);
        mockBrandRepository.getMetadata.mockResolvedValue(null);
        mockLandingRevalidationService.revalidateForBrand.mockResolvedValue(undefined);
        mockPrismaService.brand.update.mockResolvedValue(undefined);
    });

    it('should be defined', () => {
        expect(handler).toBeDefined();
    });

    it('should create brand without files', async () => {
        const dto: CreateBrandDto = { name: 'New Brand', slug: 'new-brand' };
        const command = new CreateBrandCommand(dto, 'user-1', {});

        mockBrandRepository.create.mockResolvedValue({ id: 'brand-1', ...dto });
        
        const result = await handler.execute(command);

        expect(mockBrandRepository.create).toHaveBeenCalledWith(dto);
        expect(mockBrandRepository.update).not.toHaveBeenCalled();
        expect(mockActivityLogRepository.create).toHaveBeenCalled();
        expect(result.id).toBe('brand-1');
    });

    it('releases soft-deleted brand name and slug conflicts before creating a replacement', async () => {
        const dto: CreateBrandDto = { name: 'New Brand', slug: 'new-brand' };
        const command = new CreateBrandCommand(dto, 'user-1', {});
        const deletedBrand = {
            id: 'brand-deleted-1',
            name: dto.name,
            slug: dto.slug,
            deletedAt: new Date(),
        };

        mockBrandRepository.findByName.mockResolvedValue(deletedBrand);
        mockBrandRepository.findBySlug.mockResolvedValue(deletedBrand);
        mockBrandRepository.update.mockResolvedValue(deletedBrand);
        mockBrandRepository.create.mockResolvedValue({ id: 'brand-1', ...dto });

        await handler.execute(command);

        expect(mockBrandRepository.update).toHaveBeenCalledWith(
            deletedBrand.id,
            expect.objectContaining({
                name: expect.stringContaining('[deleted'),
                slug: expect.stringContaining('-deleted-'),
            }),
        );
        expect(mockBrandRepository.create).toHaveBeenCalledWith(dto);
    });

    it('throws a conflict when an active brand already uses the requested name', async () => {
        const dto: CreateBrandDto = { name: 'Existing Brand', slug: 'existing-brand-copy' };
        const command = new CreateBrandCommand(dto, 'user-1', {});

        mockBrandRepository.findByName.mockResolvedValue({
            id: 'brand-1',
            name: 'Existing Brand',
            slug: 'existing-brand',
            deletedAt: null,
        });

        await expect(handler.execute(command)).rejects.toBeInstanceOf(ConflictException);
        expect(mockBrandRepository.create).not.toHaveBeenCalled();
    });

    it('should auto-generate slug if missing', async () => {
        const dto: CreateBrandDto = { name: 'My Super Brand' };
        const command = new CreateBrandCommand(dto, 'user-1', {});

        mockBrandRepository.create.mockImplementation((data: any) => Promise.resolve({ id: 'brand-1', ...data }));

        await handler.execute(command);

        expect(mockBrandRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'my-super-brand'
        }));
    });

    it('caps the auto-generated slug at 100 chars (Brand.slug is VarChar(100))', async () => {
        const longName = 'Word '.repeat(40).trim(); // 40 words -> well over 100 chars once hyphenated
        const dto: CreateBrandDto = { name: longName };
        const command = new CreateBrandCommand(dto, 'user-1', {});

        mockBrandRepository.create.mockImplementation((data: any) => Promise.resolve({ id: 'brand-1', ...data }));

        await handler.execute(command);

        const createdSlug = mockBrandRepository.create.mock.calls[0][0].slug as string;
        expect(createdSlug.length).toBeLessThanOrEqual(100);
    });

    it('should upload files and update brand if files are provided', async () => {
        const dto: CreateBrandDto = { name: 'Brand With Files' };
        const files = {
            logo: { originalname: 'logo.png' } as unknown as Express.Multer.File,
            banner: { originalname: 'banner.png' } as unknown as Express.Multer.File
        };
        const command = new CreateBrandCommand(dto, 'user-1', files);

        // 1. Create initial brand
        mockBrandRepository.create.mockResolvedValue({ id: 'brand-1', ...dto, slug: 'brand-with-files' });

        // 2. Logo asset mock (handler delegates logo handling to BrandLogoAssetsService)
        mockBrandLogoAssetsService.uploadBrandLogoAssets.mockResolvedValue({
            logoUrl: 'http://cdn/logo.png',
            logoIconUrl: 'http://cdn/logo-icon.png',
            metadataPatch: { favicon_url: 'http://cdn/logo-icon.png', apple_icon_url: 'http://cdn/logo-icon.png' },
        });

        // 3. Banner upload mock (handler still uses StorageService for banner)
        mockStorageService.uploadFile.mockResolvedValue({ url: 'http://cdn/banner.png' });

        // 4. Update mock
        mockBrandRepository.update.mockResolvedValue({
            id: 'brand-1',
            ...dto,
            slug: 'brand-with-files',
            logoUrl: 'http://cdn/logo.png',
            logoIconUrl: 'http://cdn/logo-icon.png',
            bannerUrl: 'http://cdn/banner.png',
        });

        const result = await handler.execute(command);

        // Verify Upload Calls
        expect(mockBrandLogoAssetsService.uploadBrandLogoAssets).toHaveBeenCalledTimes(1);
        expect(mockStorageService.uploadFile).toHaveBeenCalledTimes(1);

        // Verify Update Call
        expect(mockBrandRepository.update).toHaveBeenCalledWith('brand-1', expect.objectContaining({
            logoUrl: 'http://cdn/logo.png',
            logoIconUrl: 'http://cdn/logo-icon.png',
            bannerUrl: 'http://cdn/banner.png',
        }));

        expect(result.logoUrl).toBe('http://cdn/logo.png');
    });
});
