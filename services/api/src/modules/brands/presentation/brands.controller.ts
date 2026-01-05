import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { ListBrandsQuery } from '../application/queries/list-brands.query';
import { GetBrandDetailQuery } from '../application/queries/get-brand-detail.query';
import { ListBrandSponsorsQuery } from '../application/queries/list-brand-sponsors.query';
import { CreateBrandCommand } from '../application/commands/create-brand.command';
import { UpdateBrandCommand } from '../application/commands/update-brand.command';
import { DeleteBrandCommand } from '../application/commands/delete-brand.command';
import { BrandResponseDto, SponsorResponseDto } from './dto/brand.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('brands')
@Controller('brands')
export class BrandsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
        private readonly fileServiceClient: FileServiceClient,
        private readonly configService: ConfigService,
    ) { }

    @Get()
    @ApiOperation({ summary: 'List all brands' })
    @ApiResponse({ status: 200, description: 'Return list of brands', type: [BrandResponseDto] })
    async listBrands(): Promise<BrandResponseDto[]> {
        return this.queryBus.execute(new ListBrandsQuery());
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get brand detail' })
    @ApiResponse({ status: 200, description: 'Return brand detail', type: BrandResponseDto })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async getBrand(@Param('id') id: string): Promise<BrandResponseDto> {
        return this.queryBus.execute(new GetBrandDetailQuery(id));
    }

    @Get(':id/sponsors')
    @ApiOperation({ summary: 'List brand sponsors' })
    @ApiResponse({ status: 200, description: 'Return list of sponsors', type: [SponsorResponseDto] })
    async listSponsors(@Param('id') id: string): Promise<SponsorResponseDto[]> {
        return this.queryBus.execute(new ListBrandSponsorsQuery(id));
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Create a new brand' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('logo'))
    @ApiResponse({ status: 201, description: 'Brand created successfully', type: BrandResponseDto })
    async createBrand(
        @Body() dto: CreateBrandDto,
        @UploadedFile() logo: Express.Multer.File,
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandResponseDto> {
        if (logo) {
            const uploadResult = await this.fileServiceClient.uploadFile(
                logo,
                user.userId,
                user.programCategoryId,
                'brands'
            );
            
            // Store only the relative path in the database
            // Format: bucket/path/to/file.ext
            const storagePath = uploadResult.file.storage_path.startsWith('/') 
                ? uploadResult.file.storage_path.substring(1) 
                : uploadResult.file.storage_path;
            
            dto.logoUrl = `${uploadResult.file.bucket}/${storagePath}`;
        }
        const brand = await this.commandBus.execute(new CreateBrandCommand(dto, user.userId));
        
        if (brand.logoUrl) {
            const storageUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
            brand.logoUrl = `${storageUrl}/${brand.logoUrl}`;
        }
        
        return brand;
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a brand' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('logo'))
    @ApiResponse({ status: 200, description: 'Brand updated successfully', type: BrandResponseDto })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async updateBrand(
        @Param('id') id: string,
        @Body() dto: UpdateBrandDto,
        @UploadedFile() logo: Express.Multer.File,
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandResponseDto> {
        if (logo) {
            const uploadResult = await this.fileServiceClient.uploadFile(
                logo,
                user.userId,
                user.programCategoryId,
                'brands'
            );
            
            // Store only the relative path in the database
            const storagePath = uploadResult.file.storage_path.startsWith('/') 
                ? uploadResult.file.storage_path.substring(1) 
                : uploadResult.file.storage_path;
            
            dto.logoUrl = `${uploadResult.file.bucket}/${storagePath}`;
        }
        const brand = await this.commandBus.execute(new UpdateBrandCommand(id, dto));

        if (brand.logoUrl) {
            const storageUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
            brand.logoUrl = `${storageUrl}/${brand.logoUrl}`;
        }

        return brand;
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Delete a brand' })
    @ApiResponse({ status: 200, description: 'Brand deleted successfully' })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async deleteBrand(@Param('id') id: string): Promise<void> {
        return this.commandBus.execute(new DeleteBrandCommand(id));
    }
}
