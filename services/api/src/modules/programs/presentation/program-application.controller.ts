import { Controller, Get, Param, Put, Post, Delete, Body, UseGuards, Request, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { Public } from '../../../shared/decorators/public.decorator';

import {
  ProgramPricingTierResponseDto,
  ProgramRequirementResponseDto,
  ProgramEssayResponseDto,
  ProgramParticipationCategoryResponseDto,
  ApplicationFormFieldResponseDto,
} from './dto/program-content.dto';

import {
  ListProgramPricingTiersQuery,
  ListProgramRequirementsQuery,
  ListProgramEssaysQuery,
  ListProgramParticipationCategoriesQuery,
} from '../application/queries/list-program-content.queries';
import { GetApplicationFormFieldsQuery } from '../application/queries/get-application-form-fields.query';

import {
  ListProgramPricingTiersHandler,
  ListProgramRequirementsHandler,
  ListProgramEssaysHandler,
  ListProgramParticipationCategoriesHandler,
} from '../application/queries/handlers/list-program-content.handlers';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';

import {
  CreateProgramPricingTierDto, UpdateProgramPricingTierDto,
  CreateProgramRequirementDto, UpdateProgramRequirementDto,
  CreateProgramEssayDto, UpdateProgramEssayDto,
  CreateProgramParticipationCategoryDto, UpdateProgramParticipationCategoryDto,
} from './dto/create-update-program-content.dto';
import { CreateApplicationFormFieldDto } from '../application/dto/application-form-field/create-application-form-field.dto';
import { UpdateApplicationFormFieldDto } from '../application/dto/application-form-field/update-application-form-field.dto';

import {
  CreateProgramPricingTierCommand, UpdateProgramPricingTierCommand, DeleteProgramPricingTierCommand,
  CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand,
  CreateProgramEssayCommand, UpdateProgramEssayCommand, DeleteProgramEssayCommand,
  CreateProgramParticipationCategoryCommand, UpdateProgramParticipationCategoryCommand, DeleteProgramParticipationCategoryCommand,
} from '../application/commands/program-content.commands';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
  DeleteApplicationFormFieldCommand,
} from '../application/commands/application-form-field.commands';

import {
  CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
  CreateProgramEssayHandler, UpdateProgramEssayHandler, DeleteProgramEssayHandler,
  CreateProgramParticipationCategoryHandler, UpdateProgramParticipationCategoryHandler, DeleteProgramParticipationCategoryHandler,
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
    private readonly listProgramRequirementsHandler: ListProgramRequirementsHandler,
    private readonly listProgramEssaysHandler: ListProgramEssaysHandler,
    private readonly listProgramParticipationCategoriesHandler: ListProgramParticipationCategoriesHandler,
    private readonly getApplicationFormFieldsHandler: GetApplicationFormFieldsHandler,
    private readonly createProgramPricingTierHandler: CreateProgramPricingTierHandler,
    private readonly updateProgramPricingTierHandler: UpdateProgramPricingTierHandler,
    private readonly deleteProgramPricingTierHandler: DeleteProgramPricingTierHandler,
    private readonly createProgramRequirementHandler: CreateProgramRequirementHandler,
    private readonly updateProgramRequirementHandler: UpdateProgramRequirementHandler,
    private readonly deleteProgramRequirementHandler: DeleteProgramRequirementHandler,
    private readonly createProgramEssayHandler: CreateProgramEssayHandler,
    private readonly updateProgramEssayHandler: UpdateProgramEssayHandler,
    private readonly deleteProgramEssayHandler: DeleteProgramEssayHandler,
    private readonly createProgramParticipationCategoryHandler: CreateProgramParticipationCategoryHandler,
    private readonly updateProgramParticipationCategoryHandler: UpdateProgramParticipationCategoryHandler,
    private readonly deleteProgramParticipationCategoryHandler: DeleteProgramParticipationCategoryHandler,
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
    return this.listProgramPricingTiersHandler.execute(new ListProgramPricingTiersQuery(id));
  }

  @Post(':id/pricing-tiers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add pricing tier' })
  async addPricingTier(@Param('id') programId: string, @Body() dto: CreateProgramPricingTierDto, @Request() req: any) {
    return this.createProgramPricingTierHandler.execute(new CreateProgramPricingTierCommand(dto, req.user.id));
  }

  @Put('pricing-tiers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update pricing tier' })
  async updatePricingTier(@Param('itemId') itemId: string, @Body() dto: UpdateProgramPricingTierDto, @Request() req: any) {
    return this.updateProgramPricingTierHandler.execute(new UpdateProgramPricingTierCommand(itemId, dto, req.user.id));
  }

  @Delete('pricing-tiers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete pricing tier' })
  async deletePricingTier(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramPricingTierHandler.execute(new DeleteProgramPricingTierCommand(itemId, req.user.id));
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
  async addRequirement(@Param('id') programId: string, @Body() dto: CreateProgramRequirementDto, @Request() req: any) {
    return this.createProgramRequirementHandler.execute(new CreateProgramRequirementCommand(dto, req.user.id));
  }

  @Put('requirements/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update requirement' })
  async updateRequirement(@Param('itemId') itemId: string, @Body() dto: UpdateProgramRequirementDto, @Request() req: any) {
    return this.updateProgramRequirementHandler.execute(new UpdateProgramRequirementCommand(itemId, dto, req.user.id));
  }

  @Delete('requirements/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete requirement' })
  async deleteRequirement(@Param('itemId') itemId: string, @Request() req: any) {
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
  async addEssay(@Param('id') programId: string, @Body() dto: CreateProgramEssayDto, @Request() req: any) {
    return this.createProgramEssayHandler.execute(new CreateProgramEssayCommand(dto, req.user.id));
  }

  @Put('essays/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update essay' })
  async updateEssay(@Param('itemId') itemId: string, @Body() dto: UpdateProgramEssayDto, @Request() req: any) {
    return this.updateProgramEssayHandler.execute(new UpdateProgramEssayCommand(itemId, dto, req.user.id));
  }

  @Delete('essays/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete essay' })
  async deleteEssay(@Param('itemId') itemId: string, @Request() req: any) {
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
  async addParticipationCategory(@Param('id') programId: string, @Body() dto: CreateProgramParticipationCategoryDto, @Request() req: any) {
    return this.createProgramParticipationCategoryHandler.execute(new CreateProgramParticipationCategoryCommand(dto, req.user.id));
  }

  @Put('participation-categories/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update participation category' })
  async updateParticipationCategory(@Param('itemId') itemId: string, @Body() dto: UpdateProgramParticipationCategoryDto, @Request() req: any) {
    return this.updateProgramParticipationCategoryHandler.execute(new UpdateProgramParticipationCategoryCommand(itemId, dto, req.user.id));
  }

  @Delete('participation-categories/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete participation category' })
  async deleteParticipationCategory(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramParticipationCategoryHandler.execute(new DeleteProgramParticipationCategoryCommand(itemId, req.user.id));
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
  async addFormField(@Param('id') programId: string, @Body() dto: CreateApplicationFormFieldDto, @Request() req: any) {
    return this.createApplicationFormFieldHandler.execute(new CreateApplicationFormFieldCommand(programId, dto, req.user.id));
  }

  @Put('form-fields/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update application form field' })
  @ApiResponse({ status: 200, type: ApplicationFormFieldResponseDto })
  async updateFormField(@Param('itemId') itemId: string, @Body() dto: UpdateApplicationFormFieldDto, @Request() req: any) {
    return this.updateApplicationFormFieldHandler.execute(new UpdateApplicationFormFieldCommand(itemId, dto, req.user.id));
  }

  @Delete('form-fields/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete application form field' })
  @ApiResponse({ status: 200, description: 'Application form field deleted successfully' })
  async deleteFormField(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteApplicationFormFieldHandler.execute(new DeleteApplicationFormFieldCommand(itemId, req.user.id));
  }
}
