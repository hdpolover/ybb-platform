import { Controller, Get, Query, Param, Put, Post, Delete, Body, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { ListProgramsDto } from './dto/list-programs.dto';
import { ProgramListResponseDto } from './dto/program-response.dto';
import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { ListProgramsHandler } from '../application/queries/handlers/list-programs.handler';
import { GetProgramDetailDto } from './dto/get-program-detail.dto';
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
import {
  ProgramTimelineResponseDto,
  ProgramScheduleResponseDto,
  ProgramSpeakerResponseDto,
  ProgramGalleryResponseDto,
  ProgramTestimonialResponseDto,
  ProgramFaqResponseDto,
  ProgramTeamResponseDto,
  ProgramPartnerResponseDto,
  ProgramResourceResponseDto,
  ProgramPricingTierResponseDto,
  ProgramRequirementResponseDto,
  ApplicationFormFieldResponseDto,
} from './dto/program-content.dto';
import {
  ListProgramTimelineQuery,
  ListProgramSchedulesQuery,
  ListProgramSpeakersQuery,
  ListProgramGalleryQuery,
  ListProgramTestimonialsQuery,
  ListProgramFaqsQuery,
  ListProgramTeamQuery,
  ListProgramPartnersQuery,
  ListProgramResourcesQuery,
  ListProgramPricingTiersQuery,
  ListProgramRequirementsQuery,
} from '../application/queries/list-program-content.queries';
import {
  ListProgramTimelineHandler,
  ListProgramSchedulesHandler,
  ListProgramSpeakersHandler,
  ListProgramGalleryHandler,
  ListProgramTestimonialsHandler,
  ListProgramFaqsHandler,
  ListProgramTeamHandler,
  ListProgramPartnersHandler,
  ListProgramResourcesHandler,
  ListProgramPricingTiersHandler,
  ListProgramRequirementsHandler,
} from '../application/queries/handlers/list-program-content.handlers';
import { Public } from '../../../shared/decorators/public.decorator';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';

// Import DTOs for Content Management
import {
  CreateProgramTimelineDto, UpdateProgramTimelineDto,
  CreateProgramScheduleDto, UpdateProgramScheduleDto,
  CreateProgramSpeakerDto, UpdateProgramSpeakerDto,
  CreateProgramGalleryDto, UpdateProgramGalleryDto,
  CreateProgramTestimonialDto, UpdateProgramTestimonialDto,
  CreateProgramFaqDto, UpdateProgramFaqDto,
  CreateProgramTeamDto, UpdateProgramTeamDto,
  CreateProgramPartnerDto, UpdateProgramPartnerDto,
  CreateProgramResourceDto, UpdateProgramResourceDto,
  CreateProgramPricingTierDto, UpdateProgramPricingTierDto,
  CreateProgramRequirementDto, UpdateProgramRequirementDto,
} from './dto/create-update-program-content.dto';
import { CreateApplicationFormFieldDto } from '../application/dto/application-form-field/create-application-form-field.dto';
import { UpdateApplicationFormFieldDto } from '../application/dto/application-form-field/update-application-form-field.dto';

// Import Commands for Content Management
import {
  CreateProgramTimelineCommand, UpdateProgramTimelineCommand, DeleteProgramTimelineCommand,
  CreateProgramScheduleCommand, UpdateProgramScheduleCommand, DeleteProgramScheduleCommand,
  CreateProgramSpeakerCommand, UpdateProgramSpeakerCommand, DeleteProgramSpeakerCommand,
  CreateProgramGalleryCommand, UpdateProgramGalleryCommand, DeleteProgramGalleryCommand,
  CreateProgramTestimonialCommand, UpdateProgramTestimonialCommand, DeleteProgramTestimonialCommand,
  CreateProgramFaqCommand, UpdateProgramFaqCommand, DeleteProgramFaqCommand,
  CreateProgramTeamCommand, UpdateProgramTeamCommand, DeleteProgramTeamCommand,
  CreateProgramPartnerCommand, UpdateProgramPartnerCommand, DeleteProgramPartnerCommand,
  CreateProgramResourceCommand, UpdateProgramResourceCommand, DeleteProgramResourceCommand,
  CreateProgramPricingTierCommand, UpdateProgramPricingTierCommand, DeleteProgramPricingTierCommand,
  CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand,
} from '../application/commands/program-content.commands';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
  DeleteApplicationFormFieldCommand,
} from '../application/commands/application-form-field.commands';
import { GetApplicationFormFieldsQuery } from '../application/queries/get-application-form-fields.query';

// Import Handlers for Content Management
import {
  CreateProgramTimelineHandler, UpdateProgramTimelineHandler, DeleteProgramTimelineHandler,
  CreateProgramScheduleHandler, UpdateProgramScheduleHandler, DeleteProgramScheduleHandler,
  CreateProgramSpeakerHandler, UpdateProgramSpeakerHandler, DeleteProgramSpeakerHandler,
  CreateProgramGalleryHandler, UpdateProgramGalleryHandler, DeleteProgramGalleryHandler,
  CreateProgramTestimonialHandler, UpdateProgramTestimonialHandler, DeleteProgramTestimonialHandler,
  CreateProgramFaqHandler, UpdateProgramFaqHandler, DeleteProgramFaqHandler,
  CreateProgramTeamHandler, UpdateProgramTeamHandler, DeleteProgramTeamHandler,
  CreateProgramPartnerHandler, UpdateProgramPartnerHandler, DeleteProgramPartnerHandler,
  CreateProgramResourceHandler, UpdateProgramResourceHandler, DeleteProgramResourceHandler,
  CreateProgramPricingTierHandler, UpdateProgramPricingTierHandler, DeleteProgramPricingTierHandler,
  CreateProgramRequirementHandler, UpdateProgramRequirementHandler, DeleteProgramRequirementHandler,
} from '../application/commands/handlers/manage-program-content.handlers';
import {
  CreateApplicationFormFieldHandler,
  UpdateApplicationFormFieldHandler,
  DeleteApplicationFormFieldHandler,
} from '../application/commands/handlers/application-form-field.handler';
import { GetApplicationFormFieldsHandler } from '../application/queries/handlers/get-application-form-fields.handler';

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly listProgramsHandler: ListProgramsHandler,
    private readonly getProgramDetailHandler: GetProgramDetailHandler,
    private readonly createProgramHandler: CreateProgramHandler,
    private readonly updateProgramHandler: UpdateProgramHandler,
    private readonly deleteProgramHandler: DeleteProgramHandler,
    // Content List Handlers
    private readonly listProgramTimelineHandler: ListProgramTimelineHandler,
    private readonly listProgramSchedulesHandler: ListProgramSchedulesHandler,
    private readonly listProgramSpeakersHandler: ListProgramSpeakersHandler,
    private readonly listProgramGalleryHandler: ListProgramGalleryHandler,
    private readonly listProgramTestimonialsHandler: ListProgramTestimonialsHandler,
    private readonly listProgramFaqsHandler: ListProgramFaqsHandler,
    private readonly listProgramTeamHandler: ListProgramTeamHandler,
    private readonly listProgramPartnersHandler: ListProgramPartnersHandler,
    private readonly listProgramResourcesHandler: ListProgramResourcesHandler,
    private readonly listProgramPricingTiersHandler: ListProgramPricingTiersHandler,
    private readonly listProgramRequirementsHandler: ListProgramRequirementsHandler,
    // Content Management Handlers
    // Timeline
    private readonly createProgramTimelineHandler: CreateProgramTimelineHandler,
    private readonly updateProgramTimelineHandler: UpdateProgramTimelineHandler,
    private readonly deleteProgramTimelineHandler: DeleteProgramTimelineHandler,
    // Schedule
    private readonly createProgramScheduleHandler: CreateProgramScheduleHandler,
    private readonly updateProgramScheduleHandler: UpdateProgramScheduleHandler,
    private readonly deleteProgramScheduleHandler: DeleteProgramScheduleHandler,
    // Speaker
    private readonly createProgramSpeakerHandler: CreateProgramSpeakerHandler,
    private readonly updateProgramSpeakerHandler: UpdateProgramSpeakerHandler,
    private readonly deleteProgramSpeakerHandler: DeleteProgramSpeakerHandler,
    // Gallery
    private readonly createProgramGalleryHandler: CreateProgramGalleryHandler,
    private readonly updateProgramGalleryHandler: UpdateProgramGalleryHandler,
    private readonly deleteProgramGalleryHandler: DeleteProgramGalleryHandler,
    // Testimonial
    private readonly createProgramTestimonialHandler: CreateProgramTestimonialHandler,
    private readonly updateProgramTestimonialHandler: UpdateProgramTestimonialHandler,
    private readonly deleteProgramTestimonialHandler: DeleteProgramTestimonialHandler,
    // Faq
    private readonly createProgramFaqHandler: CreateProgramFaqHandler,
    private readonly updateProgramFaqHandler: UpdateProgramFaqHandler,
    private readonly deleteProgramFaqHandler: DeleteProgramFaqHandler,
    // Team
    private readonly createProgramTeamHandler: CreateProgramTeamHandler,
    private readonly updateProgramTeamHandler: UpdateProgramTeamHandler,
    private readonly deleteProgramTeamHandler: DeleteProgramTeamHandler,
    // Partner
    private readonly createProgramPartnerHandler: CreateProgramPartnerHandler,
    private readonly updateProgramPartnerHandler: UpdateProgramPartnerHandler,
    private readonly deleteProgramPartnerHandler: DeleteProgramPartnerHandler,
    // Resource
    private readonly createProgramResourceHandler: CreateProgramResourceHandler,
    private readonly updateProgramResourceHandler: UpdateProgramResourceHandler,
    private readonly deleteProgramResourceHandler: DeleteProgramResourceHandler,
    // PricingTier
    private readonly createProgramPricingTierHandler: CreateProgramPricingTierHandler,
    private readonly updateProgramPricingTierHandler: UpdateProgramPricingTierHandler,
    private readonly deleteProgramPricingTierHandler: DeleteProgramPricingTierHandler,
    // Requirement
    private readonly createProgramRequirementHandler: CreateProgramRequirementHandler,
    private readonly updateProgramRequirementHandler: UpdateProgramRequirementHandler,
    private readonly deleteProgramRequirementHandler: DeleteProgramRequirementHandler,
    // Content Management Handlers
    private readonly createApplicationFormFieldHandler: CreateApplicationFormFieldHandler,
    private readonly updateApplicationFormFieldHandler: UpdateApplicationFormFieldHandler,
    private readonly deleteApplicationFormFieldHandler: DeleteApplicationFormFieldHandler,
    private readonly getApplicationFormFieldsHandler: GetApplicationFormFieldsHandler,
  ) { }

  @Get()
  @Public()
  @ApiOperation({ summary: 'Get all programs' })
  @ApiResponse({ status: 200, type: ProgramListResponseDto })
  async findAll(@Query() dto: ListProgramsDto): Promise<ProgramListResponseDto> {
    const query = new ListProgramsQuery(
      dto.programCategoryId,
      dto.year,
      dto.isPublished,
      dto.page,
      dto.limit,
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
    return this.getProgramDetailHandler.execute(query);
  }

  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create program (Admin only)' })
  @ApiResponse({ status: 201, description: 'Program created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async create(
    @Body() dto: CreateProgramDto,
    @Request() req: any,
  ) {
    const command = new CreateProgramCommand(dto, req.user.id);
    const program = await this.createProgramHandler.execute(command);

    return {
      message: 'Program created successfully',
      data: program,
    };
  }

  @Put(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update program (Admin only)' })
  @ApiResponse({ status: 200, description: 'Program updated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateProgramDto,
    @Request() req: any,
  ) {
    const command = new UpdateProgramCommand(id, dto, req.user.id);
    const program = await this.updateProgramHandler.execute(command);

    return {
      message: 'Program updated successfully',
      data: program,
    };
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete program (Admin only)' })
  @ApiResponse({ status: 200, description: 'Program deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Program not found' })
  async delete(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    const command = new DeleteProgramCommand(id, req.user.id);
    await this.deleteProgramHandler.execute(command);

    return {
      message: 'Program deleted successfully',
    };
  }

  @Get(':id/timeline')
  @Public()
  @ApiOperation({ summary: 'Get program timeline' })
  @ApiResponse({ status: 200, type: [ProgramTimelineResponseDto] })
  async getTimeline(@Param('id') id: string): Promise<ProgramTimelineResponseDto[]> {
    return this.listProgramTimelineHandler.execute(new ListProgramTimelineQuery(id));
  }

  @Get(':id/schedules')
  @Public()
  @ApiOperation({ summary: 'Get program schedules' })
  @ApiResponse({ status: 200, type: [ProgramScheduleResponseDto] })
  async getSchedules(@Param('id') id: string): Promise<ProgramScheduleResponseDto[]> {
    return this.listProgramSchedulesHandler.execute(new ListProgramSchedulesQuery(id));
  }

  @Get(':id/speakers')
  @Public()
  @ApiOperation({ summary: 'Get program speakers' })
  @ApiResponse({ status: 200, type: [ProgramSpeakerResponseDto] })
  async getSpeakers(@Param('id') id: string): Promise<ProgramSpeakerResponseDto[]> {
    return this.listProgramSpeakersHandler.execute(new ListProgramSpeakersQuery(id));
  }

  @Get(':id/gallery')
  @Public()
  @ApiOperation({ summary: 'Get program gallery' })
  @ApiResponse({ status: 200, type: [ProgramGalleryResponseDto] })
  async getGallery(@Param('id') id: string): Promise<ProgramGalleryResponseDto[]> {
    return this.listProgramGalleryHandler.execute(new ListProgramGalleryQuery(id));
  }

  @Get(':id/testimonials')
  @Public()
  @ApiOperation({ summary: 'Get program testimonials' })
  @ApiResponse({ status: 200, type: [ProgramTestimonialResponseDto] })
  async getTestimonials(@Param('id') id: string): Promise<ProgramTestimonialResponseDto[]> {
    return this.listProgramTestimonialsHandler.execute(new ListProgramTestimonialsQuery(id));
  }

  @Get(':id/faqs')
  @Public()
  @ApiOperation({ summary: 'Get program FAQs' })
  @ApiResponse({ status: 200, type: [ProgramFaqResponseDto] })
  async getFaqs(@Param('id') id: string): Promise<ProgramFaqResponseDto[]> {
    return this.listProgramFaqsHandler.execute(new ListProgramFaqsQuery(id));
  }

  @Get(':id/team')
  @Public()
  @ApiOperation({ summary: 'Get program team' })
  @ApiResponse({ status: 200, type: [ProgramTeamResponseDto] })
  async getTeam(@Param('id') id: string): Promise<ProgramTeamResponseDto[]> {
    return this.listProgramTeamHandler.execute(new ListProgramTeamQuery(id));
  }

  @Get(':id/partners')
  @Public()
  @ApiOperation({ summary: 'Get program partners' })
  @ApiResponse({ status: 200, type: [ProgramPartnerResponseDto] })
  async getPartners(@Param('id') id: string): Promise<ProgramPartnerResponseDto[]> {
    return this.listProgramPartnersHandler.execute(new ListProgramPartnersQuery(id));
  }

  @Get(':id/resources')
  @Public()
  @ApiOperation({ summary: 'Get program resources' })
  @ApiResponse({ status: 200, type: [ProgramResourceResponseDto] })
  async getResources(@Param('id') id: string): Promise<ProgramResourceResponseDto[]> {
    return this.listProgramResourcesHandler.execute(new ListProgramResourcesQuery(id));
  }

  @Get(':id/pricing-tiers')
  @Public()
  @ApiOperation({ summary: 'Get program pricing tiers' })
  @ApiResponse({ status: 200, type: [ProgramPricingTierResponseDto] })
  async getPricingTiers(@Param('id') id: string): Promise<ProgramPricingTierResponseDto[]> {
    return this.listProgramPricingTiersHandler.execute(new ListProgramPricingTiersQuery(id));
  }

  @Get(':id/requirements')
  @Public()
  @ApiOperation({ summary: 'Get program requirements' })
  @ApiResponse({ status: 200, type: [ProgramRequirementResponseDto] })
  async getRequirements(@Param('id') id: string): Promise<ProgramRequirementResponseDto[]> {
    return this.listProgramRequirementsHandler.execute(new ListProgramRequirementsQuery(id));
  }

  // --- Timeline Endpoints ---
  @Post(':id/timeline')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add timeline item' })
  async addTimeline(@Param('id') programId: string, @Body() dto: CreateProgramTimelineDto, @Request() req: any) {
    return this.createProgramTimelineHandler.execute(new CreateProgramTimelineCommand(dto, req.user.id));
  }

  @Put('timeline/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update timeline item' })
  async updateTimeline(@Param('itemId') itemId: string, @Body() dto: UpdateProgramTimelineDto, @Request() req: any) {
    return this.updateProgramTimelineHandler.execute(new UpdateProgramTimelineCommand(itemId, dto, req.user.id));
  }

  @Delete('timeline/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete timeline item' })
  async deleteTimeline(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramTimelineHandler.execute(new DeleteProgramTimelineCommand(itemId, req.user.id));
  }

  // --- Schedule Endpoints ---
  @Post(':id/schedules')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add schedule item' })
  async addSchedule(@Param('id') programId: string, @Body() dto: CreateProgramScheduleDto, @Request() req: any) {
    return this.createProgramScheduleHandler.execute(new CreateProgramScheduleCommand(dto, req.user.id));
  }

  @Put('schedules/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update schedule item' })
  async updateSchedule(@Param('itemId') itemId: string, @Body() dto: UpdateProgramScheduleDto, @Request() req: any) {
    return this.updateProgramScheduleHandler.execute(new UpdateProgramScheduleCommand(itemId, dto, req.user.id));
  }

  @Delete('schedules/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete schedule item' })
  async deleteSchedule(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramScheduleHandler.execute(new DeleteProgramScheduleCommand(itemId, req.user.id));
  }

  // --- Speaker Endpoints ---
  @Post(':id/speakers')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add speaker' })
  async addSpeaker(@Param('id') programId: string, @Body() dto: CreateProgramSpeakerDto, @Request() req: any) {
    return this.createProgramSpeakerHandler.execute(new CreateProgramSpeakerCommand(dto, req.user.id));
  }

  @Put('speakers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update speaker' })
  async updateSpeaker(@Param('itemId') itemId: string, @Body() dto: UpdateProgramSpeakerDto, @Request() req: any) {
    return this.updateProgramSpeakerHandler.execute(new UpdateProgramSpeakerCommand(itemId, dto, req.user.id));
  }

  @Delete('speakers/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete speaker' })
  async deleteSpeaker(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramSpeakerHandler.execute(new DeleteProgramSpeakerCommand(itemId, req.user.id));
  }

  // --- Gallery Endpoints ---
  @Post(':id/gallery')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add gallery item' })
  async addGallery(@Param('id') programId: string, @Body() dto: CreateProgramGalleryDto, @Request() req: any) {
    return this.createProgramGalleryHandler.execute(new CreateProgramGalleryCommand(dto, req.user.id));
  }

  @Put('gallery/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update gallery item' })
  async updateGallery(@Param('itemId') itemId: string, @Body() dto: UpdateProgramGalleryDto, @Request() req: any) {
    return this.updateProgramGalleryHandler.execute(new UpdateProgramGalleryCommand(itemId, dto, req.user.id));
  }

  @Delete('gallery/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete gallery item' })
  async deleteGallery(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramGalleryHandler.execute(new DeleteProgramGalleryCommand(itemId, req.user.id));
  }

  // --- Testimonial Endpoints ---
  @Post(':id/testimonials')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add testimonial' })
  async addTestimonial(@Param('id') programId: string, @Body() dto: CreateProgramTestimonialDto, @Request() req: any) {
    return this.createProgramTestimonialHandler.execute(new CreateProgramTestimonialCommand(dto, req.user.id));
  }

  @Put('testimonials/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update testimonial' })
  async updateTestimonial(@Param('itemId') itemId: string, @Body() dto: UpdateProgramTestimonialDto, @Request() req: any) {
    return this.updateProgramTestimonialHandler.execute(new UpdateProgramTestimonialCommand(itemId, dto, req.user.id));
  }

  @Delete('testimonials/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete testimonial' })
  async deleteTestimonial(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramTestimonialHandler.execute(new DeleteProgramTestimonialCommand(itemId, req.user.id));
  }

  // --- FAQ Endpoints ---
  @Post(':id/faqs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add FAQ' })
  async addFaq(@Param('id') programId: string, @Body() dto: CreateProgramFaqDto, @Request() req: any) {
    return this.createProgramFaqHandler.execute(new CreateProgramFaqCommand(dto, req.user.id));
  }

  @Put('faqs/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update FAQ' })
  async updateFaq(@Param('itemId') itemId: string, @Body() dto: UpdateProgramFaqDto, @Request() req: any) {
    return this.updateProgramFaqHandler.execute(new UpdateProgramFaqCommand(itemId, dto, req.user.id));
  }

  @Delete('faqs/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete FAQ' })
  async deleteFaq(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramFaqHandler.execute(new DeleteProgramFaqCommand(itemId, req.user.id));
  }

  // --- Team Endpoints ---
  @Post(':id/team')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add team member' })
  async addTeam(@Param('id') programId: string, @Body() dto: CreateProgramTeamDto, @Request() req: any) {
    return this.createProgramTeamHandler.execute(new CreateProgramTeamCommand(dto, req.user.id));
  }

  @Put('team/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update team member' })
  async updateTeam(@Param('itemId') itemId: string, @Body() dto: UpdateProgramTeamDto, @Request() req: any) {
    return this.updateProgramTeamHandler.execute(new UpdateProgramTeamCommand(itemId, dto, req.user.id));
  }

  @Delete('team/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete team member' })
  async deleteTeam(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramTeamHandler.execute(new DeleteProgramTeamCommand(itemId, req.user.id));
  }

  // --- Partner Endpoints ---
  @Post(':id/partners')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add partner' })
  async addPartner(@Param('id') programId: string, @Body() dto: CreateProgramPartnerDto, @Request() req: any) {
    return this.createProgramPartnerHandler.execute(new CreateProgramPartnerCommand(dto, req.user.id));
  }

  @Put('partners/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update partner' })
  async updatePartner(@Param('itemId') itemId: string, @Body() dto: UpdateProgramPartnerDto, @Request() req: any) {
    return this.updateProgramPartnerHandler.execute(new UpdateProgramPartnerCommand(itemId, dto, req.user.id));
  }

  @Delete('partners/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete partner' })
  async deletePartner(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramPartnerHandler.execute(new DeleteProgramPartnerCommand(itemId, req.user.id));
  }

  // --- Resource Endpoints ---
  @Post(':id/resources')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Add resource' })
  async addResource(@Param('id') programId: string, @Body() dto: CreateProgramResourceDto, @Request() req: any) {
    return this.createProgramResourceHandler.execute(new CreateProgramResourceCommand(dto, req.user.id));
  }

  @Put('resources/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update resource' })
  async updateResource(@Param('itemId') itemId: string, @Body() dto: UpdateProgramResourceDto, @Request() req: any) {
    return this.updateProgramResourceHandler.execute(new UpdateProgramResourceCommand(itemId, dto, req.user.id));
  }

  @Delete('resources/:itemId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete resource' })
  async deleteResource(@Param('itemId') itemId: string, @Request() req: any) {
    return this.deleteProgramResourceHandler.execute(new DeleteProgramResourceCommand(itemId, req.user.id));
  }

  // --- Pricing Tier Endpoints ---
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

