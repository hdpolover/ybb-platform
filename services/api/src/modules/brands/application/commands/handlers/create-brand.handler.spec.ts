
import { Test, TestingModule } from '@nestjs/testing';
import { CreateBrandHandler } from './create-brand.handler';
import { CreateBrandCommand } from '../create-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
import { BrandLogoAssetsService } from '../../services/brand-logo-assets.service';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateBrandDto } from '../../../presentation/dto/create-brand.dto';
import { Brand } from '@core/entities/brand.entity';

describe('CreateBrandHandler', () => {
    let handler: CreateBrandHandler;
    let brandRepository: any;
    let activityLogRepository: any;
    let storageService: any;

    const mockBrandRepository = {
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
        brandRepository = module.get('IBrandRepository');
        activityLogRepository = module.get(IUserActivityLogRepository);
        storageService = module.get<StorageService>(StorageService);
        
        jest.clearAllMocks();
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

    it('should auto-generate slug if missing', async () => {
        const dto: CreateBrandDto = { name: 'My Super Brand' };
        const command = new CreateBrandCommand(dto, 'user-1', {});

        mockBrandRepository.create.mockImplementation((data: any) => Promise.resolve({ id: 'brand-1', ...data }));

        await handler.execute(command);

        expect(mockBrandRepository.create).toHaveBeenCalledWith(expect.objectContaining({
            slug: 'my-super-brand'
        }));
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
