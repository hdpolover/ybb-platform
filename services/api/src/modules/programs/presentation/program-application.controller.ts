import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, Query } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string };
}

import {
  ProgramPricingTierResponseDto,
  ProgramRequirementResponseDto,
  ProgramEssayResponseDto,
  ProgramParticipationCategoryResponseDto,
  ApplicationFormFieldResponseDto,
  ProgramSubthemeResponseDto,
} from './dto/program-content.dto';

import {
  ListProgramPricingTiersQuery,
  GetPricingTierByIdQuery,
  ListProgramRequirementsQuery,
  ListProgramEssaysQuery,
  ListProgramParticipationCategoriesQuery,
  ListProgramSubthemesQuery,
} from '../application/queries/list-program-content.queries';
import { GetApplicationFormFieldsQuery } from '../application/queries/get-application-form-fields.query';

import {
  ListProgramPricingTiersHandler,
  GetPricingTierByIdHandler,
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
  ListProgramSubthemesHandler,
} from '../application/queries/handlers/list-program-content.handlers';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';

import {
  CreateProgramPricingTierDto, UpdateProgramPricingTierDto,
  CreateValidityPeriodDto, UpdateValidityPeriodDto,
  CreateProgramRequirementDto, UpdateProgramRequirementDto,
  CreateProgramEssayDto, UpdateProgramEssayDto,
  CreateProgramParticipationCategoryDto, UpdateProgramParticipationCategoryDto,
  CreateProgramSubthemeDto, UpdateProgramSubthemeDto,
} from './dto/create-update-program-content.dto';
import { CreateApplicationFormFieldDto } from '../application/dto/application-form-field/create-application-form-field.dto';
import { UpdateApplicationFormFieldDto } from '../application/dto/application-form-field/update-application-form-field.dto';

import {
  CreateProgramPricingTierCommand, UpdateProgramPricingTierCommand, DeleteProgramPricingTierCommand,
  CreateValidityPeriodCommand, UpdateValidityPeriodCommand, DeleteValidityPeriodCommand,
  CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand,
  CreateProgramEssayCommand, UpdateProgramEssayCommand, DeleteProgramEssayCommand,
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
  CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler,
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
    private readonly listProgramPricingTiersHandler: ListProgramPricingTiersHandler,
    private readonly getPricingTierByIdHandler: GetPricingTierByIdHandler,
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

  @Post(':id/pricing-tiers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add pricing tier' })
  @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'program:detail:*'])
  async addPricingTier(@Param('id') programId: string, @Body() dto: CreateProgramPricingTierDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramPricingTierHandler.execute(new CreateProgramPricingTierCommand(dto, req.user.id));
  }

  @Put('pricing-tiers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update pricing tier' })
  @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'program:detail:*'])
  async updatePricingTier(@Param('itemId') itemId: string, @Body() dto: UpdateProgramPricingTierDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramPricingTierHandler.execute(new UpdateProgramPricingTierCommand(itemId, dto, req.user.id));
  }

  @Delete('pricing-tiers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete pricing tier' })
  @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'program:detail:*'])
  async deletePricingTier(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramPricingTierHandler.execute(new DeleteProgramPricingTierCommand(itemId, req.user.id));
  }

  // --- Validity Period Endpoints ---
  @Post('pricing-tiers/:tierId/periods')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add validity period to a pricing tier' })
  @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'program:detail:*'])
  async addValidityPeriod(@Param('tierId') tierId: string, @Body() dto: CreateValidityPeriodDto, @Request() req: AuthenticatedRequest) {
    return this.createValidityPeriodHandler.execute(new CreateValidityPeriodCommand({ ...dto, pricingTierId: tierId }, req.user.id));
  }

  @Put('validity-periods/:periodId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update a validity period' })
  @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'program:detail:*'])
  async updateValidityPeriod(@Param('periodId') periodId: string, @Body() dto: UpdateValidityPeriodDto, @Request() req: AuthenticatedRequest) {
    return this.updateValidityPeriodHandler.execute(new UpdateValidityPeriodCommand(periodId, dto, req.user.id));
  }

  @Delete('validity-periods/:periodId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete a validity period' })
  @CacheInvalidate(['landing:home:*', 'landing:programs:*', 'landing:program:*', 'program:detail:*'])
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add requirement' })
  async addRequirement(@Param('id') programId: string, @Body() dto: CreateProgramRequirementDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramRequirementHandler.execute(new CreateProgramRequirementCommand(dto, req.user.id));
  }

  @Put('requirements/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update requirement' })
  async updateRequirement(@Param('itemId') itemId: string, @Body() dto: UpdateProgramRequirementDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramRequirementHandler.execute(new UpdateProgramRequirementCommand(itemId, dto, req.user.id));
  }

  @Delete('requirements/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete requirement' })
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

  @Post(':id/essays')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add essay' })
  async addEssay(@Param('id') programId: string, @Body() dto: CreateProgramEssayDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramEssayHandler.execute(new CreateProgramEssayCommand(dto, req.user.id));
  }

  @Put('essays/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update essay' })
  async updateEssay(@Param('itemId') itemId: string, @Body() dto: UpdateProgramEssayDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramEssayHandler.execute(new UpdateProgramEssayCommand(itemId, dto, req.user.id));
  }

  @Delete('essays/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete essay' })
  async deleteEssay(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteProgramEssayHandler.execute(new DeleteProgramEssayCommand(itemId, req.user.id));
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add participation category' })
  async addParticipationCategory(@Param('id') programId: string, @Body() dto: CreateProgramParticipationCategoryDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramParticipationCategoryHandler.execute(new CreateProgramParticipationCategoryCommand(dto, req.user.id));
  }

  @Put('participation-categories/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update participation category' })
  async updateParticipationCategory(@Param('itemId') itemId: string, @Body() dto: UpdateProgramParticipationCategoryDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramParticipationCategoryHandler.execute(new UpdateProgramParticipationCategoryCommand(itemId, dto, req.user.id));
  }

  @Delete('participation-categories/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete participation category' })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add subtheme' })
  async addSubtheme(@Param('id') programId: string, @Body() dto: CreateProgramSubthemeDto, @Request() req: AuthenticatedRequest) {
    return this.createProgramSubthemeHandler.execute(new CreateProgramSubthemeCommand(dto, req.user.id));
  }

  @Put('subthemes/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update subtheme' })
  async updateSubtheme(@Param('itemId') itemId: string, @Body() dto: UpdateProgramSubthemeDto, @Request() req: AuthenticatedRequest) {
    return this.updateProgramSubthemeHandler.execute(new UpdateProgramSubthemeCommand(itemId, dto, req.user.id));
  }

  @Delete('subthemes/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete subtheme (soft)' })
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
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add application form field' })
  @ApiResponse({ status: 201, type: ApplicationFormFieldResponseDto })
  async addFormField(@Param('id') programId: string, @Body() dto: CreateApplicationFormFieldDto, @Request() req: AuthenticatedRequest) {
    return this.createApplicationFormFieldHandler.execute(new CreateApplicationFormFieldCommand(programId, dto, req.user.id));
  }

  @Put('form-fields/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application form field' })
  @ApiResponse({ status: 200, type: ApplicationFormFieldResponseDto })
  async updateFormField(@Param('itemId') itemId: string, @Body() dto: UpdateApplicationFormFieldDto, @Request() req: AuthenticatedRequest) {
    return this.updateApplicationFormFieldHandler.execute(new UpdateApplicationFormFieldCommand(itemId, dto, req.user.id));
  }

  @Delete('form-fields/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete application form field' })
  @ApiResponse({ status: 200, description: 'Application form field deleted successfully' })
  async deleteFormField(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    return this.deleteApplicationFormFieldHandler.execute(new DeleteApplicationFormFieldCommand(itemId, req.user.id));
  }
}
