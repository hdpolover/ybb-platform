import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, Query, Inject, NotFoundException } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { Public } from '../../../shared/decorators/public.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { PROGRAM_CONTENT_PATTERNS as MUTABLE_CONTENT_CACHE_PATTERNS } from '@shared/constants/cache-patterns';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string };
}

import {
  ProgramPricingTierResponseDto,
  PricingTierAlertsResponseDto,
  PricingTierAlertsSummaryItemDto,
  ProgramRequirementResponseDto,
  ProgramEssayResponseDto,
  ProgramEssayGuidelinesResponseDto,
  ProgramParticipationCategoryResponseDto,
  ApplicationFormFieldResponseDto,
  ProgramSubthemeResponseDto,
} from './dto/program-content.dto';

import {
  ListProgramPricingTiersQuery,
  GetPricingTierByIdQuery,
  GetPricingTierAlertsQuery,
  ListProgramRequirementsQuery,
  ListProgramEssaysQuery,
  ListProgramParticipationCategoriesQuery,
  ListProgramSubthemesQuery,
} from '../application/queries/list-program-content.queries';
import { GetApplicationFormFieldsQuery } from '../application/queries/get-application-form-fields.query';

import {
  ListProgramPricingTiersHandler,
  GetPricingTierByIdHandler,
  GetPricingTierAlertsHandler,
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
  ListProgramSubthemesHandler,
} from '../application/queries/handlers/list-program-content.handlers';
import {
  GetPricingTierAlertsSummaryQuery,
  GetPricingTierAlertsSummaryHandler,
} from '../application/queries/handlers/get-pricing-tier-alerts-summary.handler';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';

import {
  CreateProgramPricingTierDto, UpdateProgramPricingTierDto,
  CreateValidityPeriodDto, UpdateValidityPeriodDto,
  CreateProgramRequirementDto, UpdateProgramRequirementDto,
  CreateProgramEssayDto, UpdateProgramEssayDto, UpdateProgramEssayGuidelinesDto,
  CreateProgramParticipationCategoryDto, UpdateProgramParticipationCategoryDto,
  CreateProgramSubthemeDto, UpdateProgramSubthemeDto,
} from './dto/create-update-program-content.dto';
import { CreateApplicationFormFieldDto } from '../application/dto/application-form-field/create-application-form-field.dto';
import { UpdateApplicationFormFieldDto } from '../application/dto/application-form-field/update-application-form-field.dto';

import {
  CreateProgramPricingTierCommand, UpdateProgramPricingTierCommand, DeleteProgramPricingTierCommand,
  CreateValidityPeriodCommand, UpdateValidityPeriodCommand, DeleteValidityPeriodCommand,
  CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand,
  CreateProgramEssayCommand, UpdateProgramEssayCommand, DeleteProgramEssayCommand, UpdateProgramEssayGuidelinesCommand,
  CreateProgramParticipationCategoryCommand, UpdateProgramParticipationCategoryCommand, DeleteProgramParticipationCategoryCommand,
  CreateProgramSubthemeCommand, UpdateProgramSubthemeCommand, DeleteProgramSubthemeCommand,
} from '../application/commands/program-content.commands';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
  DeleteApplicationFormFieldCommand,
} from '../application/commands/application-form-field.commands';

import {
  CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
  CreateValidityPeriodHandler, UpdateValidityPeriodHandler, DeleteValidityPeriodHandler,
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
  CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler, UpdateProgramEssayGuidelinesHandler,
  CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
  CreateProgramSubthemeHandler, UpdateProgramSubthemeHandler, DeleteProgramSubthemeHandler,
} from '../application/commands/handlers/manage-program-content.handlers';
import {
  CreateApplicationFormFieldHandler,
  UpdateApplicationFormFieldHandler,
  DeleteApplicationFormFieldHandler,
} from '../application/commands/handlers/application-form-field.handler';

@ApiTags('Program Application Config')
@Controller('programs')
export class ProgramApplicationConfigController {
  constructor(
    @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
    private readonly listProgramPricingTiersHandler: ListProgramPricingTiersHandler,
    private readonly getPricingTierByIdHandler: GetPricingTierByIdHandler,
    private readonly getPricingTierAlertsHandler: GetPricingTierAlertsHandler,
    private readonly getPricingTierAlertsSummaryHandler: GetPricingTierAlertsSummaryHandler,
    private readonly listProgramRequirementsHandler: ListProgramRequirementsHandler,
    private readonly listProgramEssaysHandler: ListProgramEssaysHandler,
    private readonly listProgramParticipationCategoriesHandler: ListProgramParticipationCategoriesHandler,
    private readonly listProgramSubthemesHandler: ListProgramSubthemesHandler,
    private readonly getApplicationFormFieldsHandler: GetApplicationFormFieldsHandler,
    private readonly createProgramPricingTierHandler: CreateProgramPricingTierHandler,
    private readonly updateProgramPricingTierHandler: UpdateProgramPricingTierHandler,
    private readonly deleteProgramPricingTierHandler: DeleteProgramPricingTierHandler,
    private readonly createValidityPeriodHandler: CreateValidityPeriodHandler,
    private readonly updateValidityPeriodHandler: UpdateValidityPeriodHandler,
    private readonly deleteValidityPeriodHandler: DeleteValidityPeriodHandler,
    private readonly createProgramRequirementHandler: CreateProgramRequirementHandler,
    private readonly updateProgramRequirementHandler: UpdateProgramRequirementHandler,
    private readonly deleteProgramRequirementHandler: DeleteProgramRequirementHandler,
    private readonly createProgramEssayHandler: CreateProgramEssayHandler,
    private readonly updateProgramEssayHandler: UpdateProgramEssayHandler,
    private readonly deleteProgramEssayHandler: DeleteProgramEssayHandler,
    private readonly updateProgramEssayGuidelinesHandler: UpdateProgramEssayGuidelinesHandler,
    private readonly createProgramParticipationCategoryHandler: CreateProgramParticipationCategoryHandler,
    private readonly updateProgramParticipationCategoryHandler: UpdateProgramParticipationCategoryHandler,
    private readonly deleteProgramParticipationCategoryHandler: DeleteProgramParticipationCategoryHandler,
    private readonly createProgramSubthemeHandler: CreateProgramSubthemeHandler,
    private readonly updateProgramSubthemeHandler: UpdateProgramSubthemeHandler,
    private readonly deleteProgramSubthemeHandler: DeleteProgramSubthemeHandler,
    private readonly createApplicationFormFieldHandler: CreateApplicationFormFieldHandler,
    private readonly updateApplicationFormFieldHandler: UpdateApplicationFormFieldHandler,
    private readonly deleteApplicationFormFieldHandler: DeleteApplicationFormFieldHandler,
  ) {}

  // --- Pricing Tier Endpoints ---
  @Get(':id/pricing-tiers')
  @Public()
  @ApiOperation({ summary: 'Get program pricing tiers' })
  @ApiResponse({ status: 200, type: [ProgramPricingTierResponseDto] })
  async getPricingTiers(@Param('id') id: string): Promise<ProgramPricingTierResponseDto[]> {
    return this.listProgramPricingTiersHandler.execute(new ListProgramPricingTiersQuery(id)) as unknown as Promise<ProgramPricingTierResponseDto[]>;
  }

  @Get('pricing-tiers/:tierId')
  @Public()
  @ApiOperation({ summary: 'Get a single pricing tier with its validity periods' })
  async getPricingTierById(@Param('tierId') tierId: string) {
    return this.getPricingTierByIdHandler.execute(new GetPricingTierByIdQuery(tierId));
  }

  @Get(':id/pricing-tiers/alerts')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Get pricing tiers that are unpurchasable now (lapsed) or about to run out of coverage before registration closes (expiring)',
  })
  @ApiResponse({ status: 200, type: PricingTierAlertsResponseDto })
  async getPricingTierAlerts(@Param('id') id: string): Promise<PricingTierAlertsResponseDto> {
    return this.getPricingTierAlertsHandler.execute(new GetPricingTierAlertsQuery(id)) as unknown as Promise<PricingTierAlertsResponseDto>;
  }

  @Get('pricing-tiers/alerts/summary')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Bulk pricing-tier alert counts across every program the caller can access, for the dashboard-home coverage-gap badge. Programs with no alerts are omitted.',
  })
  @ApiResponse({ status: 200, type: [PricingTierAlertsSummaryItemDto] })
  async getPricingTierAlertsSummary(@CurrentUser() user: CurrentUserData): Promise<PricingTierAlertsSummaryItemDto[]> {
    return this.getPricingTierAlertsSummaryHandler.execute(
      new GetPricingTierAlertsSummaryQuery(user),
    ) as unknown as Promise<PricingTierAlertsSummaryItemDto[]>;
  }

  @Post(':id/pricing-tiers')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add pricing tier' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addPricingTier(@Param('id') programId: string, @Body() dto: CreateProgramPricingTierDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramPricingTierHandler.execute(new CreateProgramPricingTierCommand(dto, req.user.id));
  }

  @Put('pricing-tiers/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update pricing tier' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updatePricingTier(@Param('itemId') itemId: string, @Body() dto: UpdateProgramPricingTierDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramPricingTierHandler.execute(new UpdateProgramPricingTierCommand(itemId, dto, req.user.id));
  }

  @Delete('pricing-tiers/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete pricing tier' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deletePricingTier(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramPricingTierHandler.execute(new DeleteProgramPricingTierCommand(itemId, req.user.id));
  }

  // --- Validity Period Endpoints ---
  @Post('pricing-tiers/:tierId/periods')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add validity period to a pricing tier' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addValidityPeriod(@Param('tierId') tierId: string, @Body() dto: CreateValidityPeriodDto, @Request() req: AuthenticatedRequest) {
    return this.createValidityPeriodHandler.execute(new CreateValidityPeriodCommand({ ...dto, pricingTierId: tierId }, req.user.id));
  }

  @Put('validity-periods/:periodId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a validity period' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateValidityPeriod(@Param('periodId') periodId: string, @Body() dto: UpdateValidityPeriodDto, @Request() req: AuthenticatedRequest) {
    return this.updateValidityPeriodHandler.execute(new UpdateValidityPeriodCommand(periodId, dto, req.user.id));
  }

  @Delete('validity-periods/:periodId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a validity period' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteValidityPeriod(@Param('periodId') periodId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteValidityPeriodHandler.execute(new DeleteValidityPeriodCommand(periodId, req.user.id));
  }

  // --- Requirement Endpoints ---
  @Get(':id/requirements')
  @Public()
  @ApiOperation({ summary: 'Get program requirements' })
  @ApiResponse({ status: 200, type: [ProgramRequirementResponseDto] })
  async getRequirements(@Param('id') id: string): Promise<ProgramRequirementResponseDto[]> {
    return this.listProgramRequirementsHandler.execute(new ListProgramRequirementsQuery(id));
  }

  @Post(':id/requirements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add requirement' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addRequirement(@Param('id') programId: string, @Body() dto: CreateProgramRequirementDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramRequirementHandler.execute(new CreateProgramRequirementCommand(dto, req.user.id));
  }

  @Put('requirements/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update requirement' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateRequirement(@Param('itemId') itemId: string, @Body() dto: UpdateProgramRequirementDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramRequirementHandler.execute(new UpdateProgramRequirementCommand(itemId, dto, req.user.id));
  }

  @Delete('requirements/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete requirement' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteRequirement(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramRequirementHandler.execute(new DeleteProgramRequirementCommand(itemId, req.user.id));
  }

  // --- Essay Endpoints ---
  @Get(':id/essays')
  @Public()
  @ApiOperation({ summary: 'Get program essays' })
  @ApiResponse({ status: 200, type: [ProgramEssayResponseDto] })
  async getEssays(
    @Param('id') id: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.listProgramEssaysHandler.execute(
      new ListProgramEssaysQuery(id, includeInactive === 'true'),
    );
  }

  @Get(':id/essay-guidelines')
  @Public()
  @ApiOperation({ summary: 'Get shared essay guidelines for a program' })
  @ApiResponse({ status: 200, type: ProgramEssayGuidelinesResponseDto })
  async getEssayGuidelines(@Param('id') programId: string): Promise<ProgramEssayGuidelinesResponseDto> {
    const byId = await this.programRepository.findById(programId);
    const program = byId ?? await this.programRepository.findBySlug(programId);
    if (!program) {
      throw new NotFoundException(`Program with identifier ${programId} not found`);
    }

    return {
      guidelineText: program.essayGuidelineText ?? undefined,
      guidelineUrl: program.essayGuidelineUrl ?? undefined,
    };
  }

  @Post(':id/essays')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add essay' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addEssay(@Param('id') programId: string, @Body() dto: CreateProgramEssayDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramEssayHandler.execute(new CreateProgramEssayCommand(dto, req.user.id));
  }

  @Put('essays/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update essay' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateEssay(@Param('itemId') itemId: string, @Body() dto: UpdateProgramEssayDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramEssayHandler.execute(new UpdateProgramEssayCommand(itemId, dto, req.user.id));
  }

  @Delete('essays/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete essay' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteEssay(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramEssayHandler.execute(new DeleteProgramEssayCommand(itemId, req.user.id));
  }

  @Put(':id/essay-guidelines')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update shared essay guidelines for a program' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateEssayGuidelines(
    @Param('id') programId: string,
    @Body() dto: UpdateProgramEssayGuidelinesDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.updateProgramEssayGuidelinesHandler.execute(
      new UpdateProgramEssayGuidelinesCommand(programId, dto, req.user.id),
    );
  }

  // --- Participation Category Endpoints ---
  @Get(':id/participation-categories')
  @Public()
  @ApiOperation({ summary: 'Get program participation categories' })
  @ApiResponse({ status: 200, type: [ProgramParticipationCategoryResponseDto] })
  async getParticipationCategories(
    @Param('id') id: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.listProgramParticipationCategoriesHandler.execute(
      new ListProgramParticipationCategoriesQuery(id, includeInactive === 'true'),
    );
  }

  @Post(':id/participation-categories')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add participation category' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addParticipationCategory(@Param('id') programId: string, @Body() dto: CreateProgramParticipationCategoryDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramParticipationCategoryHandler.execute(new CreateProgramParticipationCategoryCommand(dto, req.user.id));
  }

  @Put('participation-categories/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update participation category' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateParticipationCategory(@Param('itemId') itemId: string, @Body() dto: UpdateProgramParticipationCategoryDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramParticipationCategoryHandler.execute(new UpdateProgramParticipationCategoryCommand(itemId, dto, req.user.id));
  }

  @Delete('participation-categories/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete participation category' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteParticipationCategory(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramParticipationCategoryHandler.execute(new DeleteProgramParticipationCategoryCommand(itemId, req.user.id));
  }

  // --- Subtheme Endpoints ---
  @Get(':id/subthemes')
  @Public()
  @ApiOperation({ summary: 'Get program subthemes' })
  @ApiResponse({ status: 200, type: [ProgramSubthemeResponseDto] })
  async getSubthemes(
    @Param('id') id: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.listProgramSubthemesHandler.execute(
      new ListProgramSubthemesQuery(id, includeInactive === 'true'),
    );
  }

  @Post(':id/subthemes')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add subtheme' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addSubtheme(@Param('id') programId: string, @Body() dto: CreateProgramSubthemeDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramSubthemeHandler.execute(new CreateProgramSubthemeCommand(dto, req.user.id));
  }

  @Put('subthemes/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update subtheme' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateSubtheme(@Param('itemId') itemId: string, @Body() dto: UpdateProgramSubthemeDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramSubthemeHandler.execute(new UpdateProgramSubthemeCommand(itemId, dto, req.user.id));
  }

  @Delete('subthemes/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete subtheme (soft)' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteSubtheme(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramSubthemeHandler.execute(new DeleteProgramSubthemeCommand(itemId, req.user.id));
  }

  // --- Form Field Endpoints ---
  @Get(':id/form-fields')
  @Public()
  @ApiOperation({ summary: 'Get application form fields' })
  @ApiResponse({ status: 200, type: [ApplicationFormFieldResponseDto] })
  async getFormFields(@Param('id') id: string) {
    return this.getApplicationFormFieldsHandler.execute(new GetApplicationFormFieldsQuery(id));
  }

  @Post(':id/form-fields')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add application form field' })
  @ApiResponse({ status: 201, type: ApplicationFormFieldResponseDto })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async addFormField(@Param('id') programId: string, @Body() dto: CreateApplicationFormFieldDto, @Request() req: AuthenticatedRequest) {
    return this.createApplicationFormFieldHandler.execute(new CreateApplicationFormFieldCommand(programId, dto, req.user.id));
  }

  @Put('form-fields/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application form field' })
  @ApiResponse({ status: 200, type: ApplicationFormFieldResponseDto })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async updateFormField(@Param('itemId') itemId: string, @Body() dto: UpdateApplicationFormFieldDto, @Request() req: AuthenticatedRequest) {
    return this.updateApplicationFormFieldHandler.execute(new UpdateApplicationFormFieldCommand(itemId, dto, req.user.id));
  }

  @Delete('form-fields/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete application form field' })
  @ApiResponse({ status: 200, description: 'Application form field deleted successfully' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async deleteFormField(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteApplicationFormFieldHandler.execute(new DeleteApplicationFormFieldCommand(itemId, req.user.id));
  }
}
