import { Controller, Get, Query, Param, Put, Post, Delete, Body, UseGuards, Request, UseInterceptors, UploadedFiles } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiConsumes, ApiHeader } from '@nestjs/swagger';
import { ListProgramsDto } from './dto/list-programs.dto';
import { ProgramListResponseDto, ProgramResponseDto } from './dto/program-response.dto';
import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { ListProgramsHandler } from '../application/queries/handlers/list-programs.handler';
import { ProgramDetailResponseDto } from './dto/program-detail-response.dto';
import { GetProgramDetailQuery } from '../application/queries/get-program-detail.query';
import { GetProgramDetailHandler } from '../application/queries/handlers/get-program-detail.handler';
import { CreateProgramDto } from './dto/create-program.dto';
import { CreateProgramCommand } from '../application/commands/create-program.command';
import { CreateProgramHandler } from '../application/commands/handlers/create-program.handler';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpdateProgramCommand } from '../application/commands/update-program.command';
import { UpdateProgramHandler } from '../application/commands/handlers/update-program.handler';
import { DeleteProgramCommand } from '../application/commands/delete-program.command';
import { DeleteProgramHandler } from '../application/commands/handlers/delete-program.handler';
import { UploadProgramBrandingDto } from './dto/upload-content.dto';
import { UpdateProgramBrandingCommand } from '../application/commands/update-program-branding.command';
import { UpdateProgramBrandingHandler } from '../application/commands/handlers/update-program-branding.handler';
import { GetParticipantProgressHandler } from '../application/queries/handlers/get-participant-progress.handler';
import { GetParticipantProgressQuery } from '../application/queries/get-participant-progress.query';
import { ProgressStepDto } from './dto/participant-progress-response.dto';
import { Public } from '../../../shared/decorators/public.decorator';
import { BrandDomain } from '../../../shared/decorators/brand-domain.decorator';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AuditTrail } from '../../../shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '../../../shared/constants/cache-patterns';
import { ChangeType } from '@prisma/client';
import { UpdateProgramPaymentInfoDto } from './dto/create-update-program-content.dto';
import { UpdateProgramPaymentInfoCommand, UpdateProgramContactCommand } from '../application/commands/program-content.commands';
import { UpdateProgramContactDto } from './dto/update-program-contact.dto';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string; email: string; brandId: string };
}

interface ProgramLike {
  id: string;
  brandId: string;
  brandName?: string | null;
  name: string;
  slug: string;
  description?: string | null;
  theme?: string | null;
  year: number;
  startDate: Date;
  endDate: Date;
  applicationDeadline: Date;
  location?: string | null;
  capacity?: number | null;
  registrationOpenDate?: Date | null;
  registrationCloseDate?: Date | null;
  registrationFee?: number | null;
  allowRegistration: boolean;
  requireEmailVerification: boolean;
  usdInIdr?: number | null;
  isPublished: boolean;
  isActive: boolean;
  status: string;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  thumbnailUrl?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

@ApiTags('Programs')
@Controller('programs')
@ApiHeader({
  name: 'x-brand-domain',
  description: 'Domain of the brand/program category (alternative to url query param)',
  required: false,
})
export class ProgramsController {
  constructor(
    private readonly listProgramsHandler: ListProgramsHandler,
    private readonly getProgramDetailHandler: GetProgramDetailHandler,
    private readonly createProgramHandler: CreateProgramHandler,
    private readonly updateProgramHandler: UpdateProgramHandler,
    private readonly updateProgramBrandingHandler: UpdateProgramBrandingHandler,
    private readonly deleteProgramHandler: DeleteProgramHandler,
    private readonly getParticipantProgressHandler: GetParticipantProgressHandler,
    private readonly commandBus: CommandBus,
  ) { }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all programs' })
  @ApiResponse({ status: 200, type: ProgramListResponseDto })
  async findAll(
    @Query() dto: ListProgramsDto,
    @BrandDomain() brandDomain?: string,
  ): Promise<ProgramListResponseDto> {
    if (!dto.url && brandDomain) {
      dto.url = brandDomain;
    }

    const query = new ListProgramsQuery(
      dto.brandId,
      dto.year,
      dto.isPublished,
      dto.page,
      dto.limit,
      dto.isActive,
      dto.isVisibleToUsers,
      dto.status,
      dto.url,
    );
    return this.listProgramsHandler.execute(query);
  }

  @Get(':identifier')
  @Public()
  @ApiOperation({ summary: 'Get program detail by ID or slug' })
  @ApiQuery({ name: 'include', required: false, description: 'Comma-separated relations to include (timeline, schedules, speakers, gallery, testimonials, faqs, partners, resources, pricing-tiers, requirements)' })
  @ApiQuery({ name: 'testimonialsLimit', required: false, type: Number, description: 'Limit the number of testimonials returned' })
  @ApiQuery({ name: 'announcementsLimit', required: false, type: Number, description: 'Limit the number of announcements returned' })
  @ApiQuery({ name: 'resourcesLimit', required: false, type: Number, description: 'Limit the number of resources returned' })
  @ApiResponse({ status: 200, type: ProgramDetailResponseDto })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async findOne(
    @Param('identifier') identifier: string,
    @Query('include') include?: string,
    @Query('testimonialsLimit') testimonialsLimit?: number,
    @Query('announcementsLimit') announcementsLimit?: number,
    @Query('resourcesLimit') resourcesLimit?: number,
  ): Promise<ProgramDetailResponseDto> {
    const query = new GetProgramDetailQuery(
      identifier,
      include,
      testimonialsLimit,
      announcementsLimit,
      resourcesLimit,
    );
    return this.getProgramDetailHandler.execute(query) as Promise<ProgramDetailResponseDto>;
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create program (Admin only)' })
  @ApiResponse({ status: 201, description: 'Program created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @AuditTrail({ entityType: 'Program', action: ChangeType.create })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async create(
    @Body() dto: CreateProgramDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const command = new CreateProgramCommand(dto, req.user.id);
    const program = await this.createProgramHandler.execute(command);

    return {
      message: 'Program created successfully',
      data: this.mapToResponse(program),
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update program (Admin only)' })
  @ApiResponse({ status: 200, description: 'Program updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @AuditTrail({ entityType: 'Program', action: ChangeType.update })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
    @Request() req: AuthenticatedRequest,
  ) {
    const command = new UpdateProgramCommand(id, dto, req.user.id);
    const program = await this.updateProgramHandler.execute(command);

    return {
      message: 'Program updated successfully',
      data: this.mapToResponse(program),
    };
  }

  @Put(':id/payment-info')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Update program payment-info HTML',
    description:
      'Replaces the rich-text payment info shown to participants on the payment page. ' +
      'Send `paymentInfoHtml: "<p>...</p>"` to set, or omit / send `null` to clear.',
  })
  @ApiResponse({ status: 200, description: 'Payment info updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updatePaymentInfo(
    @Param('id') id: string,
    @Body() dto: UpdateProgramPaymentInfoDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.commandBus.execute(
      new UpdateProgramPaymentInfoCommand(id, dto, req.user.id),
    );
    return { message: 'Payment info updated successfully' };
  }

  @Put(':id/contact')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace program contact information' })
  @ApiResponse({ status: 200, description: 'Contact info updated successfully' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateProgramContactDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.commandBus.execute(new UpdateProgramContactCommand(id, dto, req.user.id));
    return { message: 'Contact info updated successfully' };
  }

  private mapToResponse(program: ProgramLike): ProgramResponseDto {
    return {
      id: program.id,
      brandId: program.brandId,
      brandName: program.brandName ?? null,
      name: program.name,
      slug: program.slug,
      description: program.description ?? null,
      theme: program.theme ?? null,
      year: program.year,
      startDate: program.startDate,
      endDate: program.endDate,
      applicationDeadline: program.applicationDeadline,
      location: program.location ?? null,
      capacity: program.capacity ?? null,
      registrationOpenDate: program.registrationOpenDate,
      registrationCloseDate: program.registrationCloseDate,
      registrationFee: program.registrationFee,
      allowRegistration: program.allowRegistration,
      requireEmailVerification: program.requireEmailVerification,
      usdInIdr: program.usdInIdr ?? null,
      isPublished: program.isPublished,
      isActive: program.isActive,
      status: program.status,
      logoUrl: program.logoUrl ?? null,
      bannerUrl: program.bannerUrl ?? null,
      thumbnailUrl: program.thumbnailUrl ?? null,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };
  }

  @Post(':id/branding')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update program branding (logo, banner, thumbnail)' })
  @ApiConsumes('multipart/form-data')
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'logo', maxCount: 1 },
    { name: 'banner', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 },
  ]))
  async updateBranding(
    @Param('id') id: string,
    @Body() dto: UploadProgramBrandingDto,
    @UploadedFiles() files: { logo?: Express.Multer.File[], banner?: Express.Multer.File[], thumbnail?: Express.Multer.File[] },
    @Request() req: AuthenticatedRequest,
  ) {
    const uploadedFiles = {
      logo: files?.logo?.[0],
      banner: files?.banner?.[0],
      thumbnail: files?.thumbnail?.[0],
    };

    const program = await this.updateProgramBrandingHandler.execute(
      new UpdateProgramBrandingCommand(id, dto, req.user.id, uploadedFiles)
    );

    return this.mapToResponse(program as unknown as ProgramLike);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete program (Admin only)' })
  @ApiResponse({ status: 200, description: 'Program deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  @AuditTrail({ entityType: 'Program', action: ChangeType.delete })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async delete(
    @Param('id') id: string,
    @Request() req: AuthenticatedRequest,
  ) {
    const command = new DeleteProgramCommand(id, req.user.id);
    await this.deleteProgramHandler.execute(command);

    return {
      message: 'Program deleted successfully',
    };
  }

  @Get(':id/participant/progress')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get participant progress tracking from timeline' })
  @ApiResponse({ status: 200, type: [ProgressStepDto] })
  async getParticipantProgress(@Param('id') id: string, @Request() req: AuthenticatedRequest): Promise<ProgressStepDto[]> {
    return this.getParticipantProgressHandler.execute(new GetParticipantProgressQuery(id, req.user.id));
  }
}
