import { Controller, Get, Query, Param, Put, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ListProgramsDto } from './dto/list-programs.dto';
import { ProgramListResponseDto } from './dto/program-response.dto';
import { ListProgramsQuery } from '../application/queries/list-programs.query';
import { ListProgramsHandler } from '../application/queries/handlers/list-programs.handler';
import { GetProgramDetailDto } from './dto/get-program-detail.dto';
import { ProgramDetailResponseDto } from './dto/program-detail-response.dto';
import { GetProgramDetailQuery } from '../application/queries/get-program-detail.query';
import { GetProgramDetailHandler } from '../application/queries/handlers/get-program-detail.handler';
import { UpdateProgramDto } from './dto/update-program.dto';
import { UpdateProgramCommand } from '../application/commands/update-program.command';
import { UpdateProgramHandler } from '../application/commands/handlers/update-program.handler';
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

@ApiTags('programs')
@Controller('programs')
export class ProgramsController {
  constructor(
    private readonly listProgramsHandler: ListProgramsHandler,
    private readonly getProgramDetailHandler: GetProgramDetailHandler,
    private readonly updateProgramHandler: UpdateProgramHandler,
    // Content Handlers
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
  ) {
    const command = new UpdateProgramCommand(
      id,
      dto.name,
      dto.description,
      dto.status,
      dto.isVisibleToUsers,
    );
    const program = await this.updateProgramHandler.execute(command);

    return {
      message: 'Program updated successfully',
      data: program,
    };
  }
}
