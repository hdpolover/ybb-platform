
import { Test, TestingModule } from '@nestjs/testing';
import { CreateBrandHandler } from './create-brand.handler';
import { CreateBrandCommand } from '../create-brand.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { StorageService } from '../../../../files/application/storage.service';
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
    };

    const mockActivityLogRepository = {
        create: jest.fn(),
    };

    const mockStorageService = {
        uploadFile: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CreateBrandHandler,
                { provide: 'IBrandRepository', useValue: mockBrandRepository },
                { provide: IUserActivityLogRepository, useValue: mockActivityLogRepository },
                { provide: StorageService, useValue: mockStorageService },
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
            logo: { originalname: 'logo.png' },
            banner: { originalname: 'banner.png' }
        };
        const command = new CreateBrandCommand(dto, 'user-1', files);

        // 1. Create initial brand
        mockBrandRepository.create.mockResolvedValue({ id: 'brand-1', ...dto, slug: 'brand-with-files' });

        // 2. Upload mocks
        mockStorageService.uploadFile.mockImplementation((file: any) => {
            if (file === files.logo) return Promise.resolve({ url: 'http://cdn/logo.png' });
            if (file === files.banner) return Promise.resolve({ url: 'http://cdn/banner.png' });
            return Promise.resolve({ url: '' });
        });

        // 3. Update mock
        mockBrandRepository.update.mockResolvedValue({ 
            id: 'brand-1', 
            ...dto,
            slug: 'brand-with-files',
            logoUrl: 'http://cdn/logo.png',
            bannerUrl: 'http://cdn/banner.png'
        });

        const result = await handler.execute(command);

        // Verify Upload Calls
        expect(mockStorageService.uploadFile).toHaveBeenCalledTimes(2);
        
        // Verify Update Call
        expect(mockBrandRepository.update).toHaveBeenCalledWith('brand-1', {
            logoUrl: 'http://cdn/logo.png',
            bannerUrl: 'http://cdn/banner.png'
        });

        expect(result.logoUrl).toBe('http://cdn/logo.png');
    });
});
