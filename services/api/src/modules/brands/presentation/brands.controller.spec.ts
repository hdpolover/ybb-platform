
import { Test, TestingModule } from '@nestjs/testing';
import { BrandsController } from './brands.controller';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { CreateBrandCommand } from '../application/commands/create-brand.command';
import { CreateBrandDto } from './dto/create-brand.dto';
import { BrandResponseDto } from './dto/brand.dto';
import { ListBrandsQuery } from '../application/queries/list-brands.query';
import { GetBrandDetailQuery } from '../application/queries/get-brand-detail.query';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

describe('BrandsController', () => {
    let controller: BrandsController;
    let commandBus: CommandBus;
    let queryBus: QueryBus;

    const mockCommandBus = {
        execute: jest.fn(),
    };

    const mockQueryBus = {
        execute: jest.fn(),
    };

    const mockConfigService = {
        get: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [BrandsController],
            providers: [
                { provide: CommandBus, useValue: mockCommandBus },
                { provide: QueryBus, useValue: mockQueryBus },
                { provide: ConfigService, useValue: mockConfigService },
            ],
        })
        .overrideGuard(JwtAuthGuard)
        .useValue({ canActivate: () => true })
        .compile();

        controller = module.get<BrandsController>(BrandsController);
        commandBus = module.get<CommandBus>(CommandBus);
        queryBus = module.get<QueryBus>(QueryBus);
        
        jest.clearAllMocks();
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('listBrands', () => {
        it('should execute ListBrandsQuery', async () => {
            const expectedResult: BrandResponseDto[] = [];
            mockQueryBus.execute.mockResolvedValue(expectedResult);

            const result = await controller.listBrands();

            expect(mockQueryBus.execute).toHaveBeenCalledWith(expect.any(ListBrandsQuery));
            expect(result).toBe(expectedResult);
        });
    });

    describe('getBrand', () => {
        it('should execute GetBrandDetailQuery', async () => {
            const id = 'brand-1';
            const expectedResult: BrandResponseDto = {
                id,
                name: 'Brand 1',
                slug: 'brand-1',
                description: 'Description',
                logoUrl: null,
                bannerUrl: null,
                websiteUrl: null,
                primaryColor: null,
                about: null,
                vision: null,
                mission: null,
                contactEmail: null,
                contactPhone: null,
                contactWhatsapp: null,
                contactAddress: null,
                socialMediaLinks: null,
                defaultLocation: null,
                defaultCountry: 'Test Country',
                defaultTimezone: null,
                requireEmailVerification: true,
                defaultCurrency: 'USD',
                enableMultiCurrency: false,
                metaTitle: null,
                metaDescription: null,
                metaKeywords: null,
                settings: null,
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockQueryBus.execute.mockResolvedValue(expectedResult);

            const result = await controller.getBrand(id);

            expect(mockQueryBus.execute).toHaveBeenCalledWith(expect.any(GetBrandDetailQuery));
            const query = mockQueryBus.execute.mock.calls[0][0];
            expect(query.id).toBe(id);
            expect(result).toBe(expectedResult);
        });
    });

    describe('createBrand', () => {
        it('should execute CreateBrandCommand', async () => {
            const dto: CreateBrandDto = { name: 'Brand 1', slug: 'brand-1' };
            const files = { logo: [{}], banner: [{}] };
            const user = { userId: 'user-1' } as any;
            const expectedResult: BrandResponseDto = { 
                id: 'brand-1', 
                name: dto.name, 
                slug: 'brand-1',
                description: 'Description',
                logoUrl: null,
                bannerUrl: null,
                websiteUrl: null,
                primaryColor: null,
                about: null,
                vision: null,
                mission: null,
                contactEmail: null,
                contactPhone: null,
                contactWhatsapp: null,
                contactAddress: null,
                socialMediaLinks: null,
                defaultLocation: null,
                defaultCountry: 'Test Country',
                defaultTimezone: null,
                requireEmailVerification: true,
                defaultCurrency: 'USD',
                enableMultiCurrency: false,
                metaTitle: null,
                metaDescription: null,
                metaKeywords: null,
                settings: null,
                createdAt: new Date(), 
                updatedAt: new Date() 
            };

            mockCommandBus.execute.mockResolvedValue(expectedResult);

            const result = await controller.createBrand(dto, files, user);

            expect(mockCommandBus.execute).toHaveBeenCalledWith(expect.any(CreateBrandCommand));
            const command = mockCommandBus.execute.mock.calls[0][0];
            expect(command.dto).toBe(dto);
            expect(command.userId).toBe(user.userId);
            expect(command.files).toEqual({ logo: files.logo[0], banner: files.banner[0] });
            expect(result).toBe(expectedResult);
        });
    });
});
