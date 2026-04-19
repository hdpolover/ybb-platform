import { Controller, Get, Post, Put, Delete, Param, Body, UseGuards, UseInterceptors, UploadedFile, UploadedFiles, Query, ParseUUIDPipe, HttpCode, HttpStatus } from '@nestjs/common';
import { FileInterceptor, FileFieldsInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import { QueryBus, CommandBus } from '@nestjs/cqrs';
import { ChangeType } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { ListBrandsQuery } from '../application/queries/list-brands.query';
import { GetBrandDetailQuery } from '../application/queries/get-brand-detail.query';
import { ListBrandSponsorsQuery } from '../application/queries/list-brand-sponsors.query';
import { ListBrandAdminsQuery } from '../application/queries/list-brand-admins.query';
import { CreateBrandCommand } from '../application/commands/create-brand.command';
import { UpdateBrandCommand } from '../application/commands/update-brand.command';
import { DeleteBrandCommand } from '../application/commands/delete-brand.command';
import { UpdateBrandDetailsCommand } from '../application/commands/update-brand-details.command';
import { UpdateBrandSettingsCommand } from '../application/commands/update-brand-settings.command';
import { UpdateBrandMetadataCommand } from '../application/commands/update-brand-metadata.command';
import { AssignBrandAdminCommand } from '../application/commands/assign-brand-admin.command';
import { RemoveBrandAdminCommand } from '../application/commands/remove-brand-admin.command';
import { CreateSponsorCommand } from '../application/commands/create-sponsor.command';
import { UpdateSponsorCommand } from '../application/commands/update-sponsor.command';
import { DeleteSponsorCommand } from '../application/commands/delete-sponsor.command';
import { GetBrandMetadataQuery } from '../application/queries/get-brand-metadata.query';
import { BrandResponseDto, SponsorResponseDto } from './dto/brand.dto';
import { CreateSponsorDto, UpdateSponsorDto } from './dto/sponsor.dto';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { UpdateBrandDetailsDto } from './dto/update-brand-details.dto';
import { UpdateBrandSettingsDto } from './dto/update-brand-settings.dto';
import { UpdateBrandMetadataDto } from './dto/update-brand-metadata.dto';
import { AssignBrandAdminDto, BrandAdminResponseDto } from './dto/brand-admin.dto';
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

    @Post(':id/sponsors')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'Sponsor', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a brand sponsor' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('logo'))
    @ApiResponse({ status: 201, description: 'Sponsor created', type: SponsorResponseDto })
    async createSponsor(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: CreateSponsorDto,
        @UploadedFile() logo: Express.Multer.File | undefined,
        @CurrentUser() user: CurrentUserData,
    ): Promise<SponsorResponseDto> {
        return this.commandBus.execute(new CreateSponsorCommand(id, dto, user.userId, logo));
    }

    @Put(':id/sponsors/:sponsorId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'Sponsor', action: ChangeType.update })
    @ApiOperation({ summary: 'Update a brand sponsor' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileInterceptor('logo'))
    @ApiResponse({ status: 200, description: 'Sponsor updated', type: SponsorResponseDto })
    @ApiResponse({ status: 404, description: 'Sponsor not found' })
    async updateSponsor(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('sponsorId', ParseUUIDPipe) sponsorId: string,
        @Body() dto: UpdateSponsorDto,
        @UploadedFile() logo: Express.Multer.File | undefined,
        @CurrentUser() user: CurrentUserData,
    ): Promise<SponsorResponseDto> {
        return this.commandBus.execute(new UpdateSponsorCommand(id, sponsorId, dto, user.userId, logo));
    }

    @Delete(':id/sponsors/:sponsorId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.NO_CONTENT)
    @AuditTrail({ entityType: 'Sponsor', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete a brand sponsor' })
    @ApiResponse({ status: 204, description: 'Sponsor deleted' })
    @ApiResponse({ status: 404, description: 'Sponsor not found' })
    async deleteSponsor(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('sponsorId', ParseUUIDPipe) sponsorId: string,
    ): Promise<void> {
        return this.commandBus.execute(new DeleteSponsorCommand(id, sponsorId));
    }

    @Post()
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'Brand', action: ChangeType.create })
    @ApiOperation({ summary: 'Create a new brand' })
    @ApiConsumes('multipart/form-data')
    @UseInterceptors(FileFieldsInterceptor([
        { name: 'logo', maxCount: 1 },
        { name: 'banner', maxCount: 1 },
    ]))
    @ApiResponse({ status: 201, description: 'Brand created successfully', type: BrandResponseDto })
    async createBrand(
        @Body() dto: CreateBrandDto,
        @UploadedFiles() files: { logo?: Express.Multer.File[], banner?: Express.Multer.File[] },
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
    @AuditTrail({ entityType: 'Brand', action: ChangeType.update })
    @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'landing:settings:*'])
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
        @UploadedFiles() files: { logo?: Express.Multer.File[], banner?: Express.Multer.File[] },
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
    @AuditTrail({ entityType: 'Brand', action: ChangeType.update })
    @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'landing:settings:*'])
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
        @UploadedFiles() files: { logo?: Express.Multer.File[], banner?: Express.Multer.File[] },
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
    @AuditTrail({ entityType: 'Brand', action: ChangeType.update })
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

    @Get(':id/metadata')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get brand landing page metadata' })
    @ApiResponse({ status: 200, description: 'Brand metadata object' })
    async getBrandMetadata(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<Record<string, unknown>> {
        return this.queryBus.execute(new GetBrandMetadataQuery(id));
    }

    @Put(':id/metadata')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'Brand', action: ChangeType.update })
    @ApiOperation({ summary: 'Update brand landing page metadata (partial merge)' })
    @ApiResponse({ status: 200, description: 'Updated metadata object' })
    async updateBrandMetadata(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateBrandMetadataDto,
        @CurrentUser() user: CurrentUserData,
    ): Promise<Record<string, unknown>> {
        return this.commandBus.execute(new UpdateBrandMetadataCommand(id, dto.patch, user.userId));
    }

    @Delete(':id')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'Brand', action: ChangeType.delete })
    @ApiOperation({ summary: 'Delete a brand' })
    @ApiResponse({ status: 200, description: 'Brand deleted successfully' })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async deleteBrand(@Param('id') id: string): Promise<void> {
        return this.commandBus.execute(new DeleteBrandCommand(id));
    }

    // -------------------------------------------------------------------------
    // Brand Admin Management
    // -------------------------------------------------------------------------

    @Get(':id/admins')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'List admins with access to a brand' })
    @ApiResponse({ status: 200, description: 'List of brand admins', type: [BrandAdminResponseDto] })
    @ApiResponse({ status: 404, description: 'Brand not found' })
    async listBrandAdmins(
        @Param('id', ParseUUIDPipe) id: string,
    ): Promise<BrandAdminResponseDto[]> {
        return this.queryBus.execute(new ListBrandAdminsQuery(id));
    }

    @Post(':id/admins')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @AuditTrail({ entityType: 'AdminBrand', action: ChangeType.create })
    @ApiOperation({ summary: 'Assign an admin to a brand' })
    @ApiResponse({ status: 201, description: 'Admin assigned to brand', type: BrandAdminResponseDto })
    @ApiResponse({ status: 404, description: 'Brand or admin not found' })
    @ApiResponse({ status: 409, description: 'Admin already assigned to this brand' })
    async assignBrandAdmin(
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: AssignBrandAdminDto,
        @CurrentUser() user: CurrentUserData,
    ): Promise<BrandAdminResponseDto> {
        return this.commandBus.execute(
            new AssignBrandAdminCommand(id, dto.adminId, dto.roleInBrand, dto.permissions, user.userId),
        );
    }

    @Delete(':id/admins/:adminId')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @HttpCode(HttpStatus.OK)
    @AuditTrail({ entityType: 'AdminBrand', action: ChangeType.delete })
    @ApiOperation({ summary: 'Remove an admin from a brand' })
    @ApiResponse({ status: 200, description: 'Admin removed from brand' })
    @ApiResponse({ status: 404, description: 'Assignment not found' })
    async removeBrandAdmin(
        @Param('id', ParseUUIDPipe) id: string,
        @Param('adminId', ParseUUIDPipe) adminId: string,
    ): Promise<{ message: string }> {
        return this.commandBus.execute(new RemoveBrandAdminCommand(id, adminId));
    }
}
