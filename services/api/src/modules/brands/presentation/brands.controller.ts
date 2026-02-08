import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Query, ParseUUIDPipe } from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { ListBrandsQuery } from '../application/queries/list-brands.query';
import { GetBrandDetailQuery } from '../application/queries/get-brand-detail.query';
import { ListBrandSponsorsQuery } from '../application/queries/list-brand-sponsors.query';
import { CreateBrandCommand } from '../application/commands/create-brand.command';
import { UpdateBrandCommand } from '../application/commands/update-brand.command';
import { DeleteBrandCommand } from '../application/commands/delete-brand.command';
import { UpdateBrandDetailsCommand } from '../application/commands/update-brand-details.command';
import { UpdateBrandSettingsCommand } from '../application/commands/update-brand-settings.command';
import { BrandResponseDto, SponsorResponseDto } from './dto/brand.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateBrandDetailsDto } from './dto/update-brand-details.dto';
import { UpdateBrandSettingsDto } from './dto/update-brand-settings.dto';
import { ListProgramsQuery } from '../../programs/application/queries/list-programs.query';
import { ProgramListResponseDto } from '../../programs/presentation/dto/program-response.dto';
import { ListProgramsDto } from '../../programs/presentation/dto/list-programs.dto';

@ApiTags('Brands')
@Controller('brands')
export class BrandsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
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

    @Get(':id/programs')
    @ApiOperation({ summary: 'List brand programs' })
    @ApiResponse({ status: 200, description: 'Return list of brand programs', type: ProgramListResponseDto })
    async listBrandPrograms(
        @Param('id', ParseUUIDPipe) id: string,
        @Query() dto: ListProgramsDto,
    ): Promise<ProgramListResponseDto> {
        return this.queryBus.execute(new ListProgramsQuery(
            id,
            dto.year,
            dto.isPublished,
            dto.page,
            dto.limit,
            dto.isActive,
            dto.isVisibleToUsers,
            dto.status
        ));
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
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ]))
    @ApiResponse({ status: 201, description: 'Brand created successfully', type: BrandResponseDto })
    async createBrand(
        @Body() dto: CreateBrandDto,
        @UploadedFiles() files: { logo?: any[], banner?: any[] },
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandResponseDto> {
        const uploadedFiles = {
            logo: files?.logo?.[0],
            banner: files?.banner?.[0],
        };
        return this.commandBus.execute(new CreateBrandCommand(dto, user.userId, uploadedFiles));
    }

    @Put(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update a brand' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ]))
    @ApiResponse({ status: 200, description: 'Brand updated successfully', type: BrandResponseDto })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async updateBrand(
        @Param('id') id: string,
        @Body() dto: UpdateBrandDto,
        @UploadedFiles() files: { logo?: any[], banner?: any[] },
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandResponseDto> {
        const uploadedFiles = {
            logo: files?.logo?.[0],
            banner: files?.banner?.[0],
        };
        return this.commandBus.execute(new UpdateBrandCommand(id, dto, user.userId, uploadedFiles));
    }

    @Put(':id/details')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update brand details' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ]))
    @ApiResponse({ status: 200, description: 'Brand details updated successfully', type: BrandResponseDto })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async updateBrandDetails(
        @Param('id') id: string,
        @Body() dto: UpdateBrandDetailsDto,
        @UploadedFiles() files: { logo?: any[], banner?: any[] },
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandResponseDto> {
        const uploadedFiles = {
            logo: files?.logo?.[0],
            banner: files?.banner?.[0],
        };
        return this.commandBus.execute(new UpdateBrandDetailsCommand(id, dto, user.userId, uploadedFiles));
    }

    @Put(':id/settings')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Update brand settings' })
    @ApiResponse({ status: 200, description: 'Brand settings updated successfully', type: BrandResponseDto })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async updateBrandSettings(
        @Param('id') id: string,
        @Body() dto: UpdateBrandSettingsDto,
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandResponseDto> {
        return this.commandBus.execute(new UpdateBrandSettingsCommand(id, dto, user.userId));
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
