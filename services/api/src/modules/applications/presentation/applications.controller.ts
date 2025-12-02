import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';

// Commands
import { CreateApplicationHandler } from '../application/commands/handlers/create-application.handler';
import { UpdateApplicationHandler } from '../application/commands/handlers/update-application.handler';
import { SubmitApplicationHandler } from '../application/commands/handlers/submit-application.handler';
import { ReviewApplicationHandler } from '../application/commands/handlers/review-application.handler';
import { WithdrawApplicationHandler } from '../application/commands/handlers/withdraw-application.handler';

import { CreateApplicationCommand } from '../application/commands/create-application.command';
import { UpdateApplicationCommand } from '../application/commands/update-application.command';
import { SubmitApplicationCommand } from '../application/commands/submit-application.command';
import { ReviewApplicationCommand } from '../application/commands/review-application.command';
import { WithdrawApplicationCommand } from '../application/commands/withdraw-application.command';

// Queries
import { GetApplicationHandler } from '../application/queries/handlers/get-application.handler';
import { ListApplicationsHandler } from '../application/queries/handlers/list-applications.handler';
import { GetApplicationQuery } from '../application/queries/get-application.query';
import { ListApplicationsQuery } from '../application/queries/list-applications.query';

// DTOs
import { CreateApplicationRequestDto } from './dto/create-application-request.dto';
import { UpdateApplicationRequestDto } from './dto/update-application-request.dto';
import { ReviewApplicationRequestDto } from './dto/review-application-request.dto';
import { ApplicationResponseDto, ApplicationListResponseDto } from '../application/dto/application-response.dto';
import { ApplicationStatus } from '@core/entities/participant-application.entity';

/**
 * Applications Controller
 * 
 * Presentation Layer - REST API
 * Handles HTTP requests for application operations
 */
@ApiTags('applications')
@Controller('applications')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ApplicationsController {
  private readonly logger = new Logger(ApplicationsController.name);

  constructor(
    private readonly createApplicationHandler: CreateApplicationHandler,
    private readonly updateApplicationHandler: UpdateApplicationHandler,
    private readonly submitApplicationHandler: SubmitApplicationHandler,
    private readonly reviewApplicationHandler: ReviewApplicationHandler,
    private readonly withdrawApplicationHandler: WithdrawApplicationHandler,
    private readonly getApplicationHandler: GetApplicationHandler,
    private readonly listApplicationsHandler: ListApplicationsHandler,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Create a new application' })
  @ApiResponse({ status: 201, description: 'Application created successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 409, description: 'Application already exists' })
  async create(@Body() dto: CreateApplicationRequestDto): Promise<ApplicationResponseDto> {
    this.logger.log(`Creating application for participant ${dto.participantId} in program ${dto.programId}`);

    const command = new CreateApplicationCommand(
      dto.participantId,
      dto.programId,
      dto.applicationCategory,
      dto.motivationLetter,
      dto.achievements,
      dto.experiences,
      dto.documents,
      dto.requirementFiles,
      dto.twibbonLink,
      dto.pricingTierId,
    );

    return this.createApplicationHandler.execute(command);
  }

  @Get()
  @ApiOperation({ summary: 'List applications with filters' })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'participantId', required: false })
  @ApiQuery({ name: 'status', enum: ApplicationStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Applications retrieved successfully', type: ApplicationListResponseDto })
  async findAll(
    @Query('brandId') brandId?: string,
    @Query('programId') programId?: string,
    @Query('participantId') participantId?: string,
    @Query('status') status?: ApplicationStatus,
    @Query('search') search?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ApplicationListResponseDto> {
    this.logger.log(`Listing applications with filters: brandId=${brandId}, programId=${programId}`);

    const query = new ListApplicationsQuery({
      brandId,
      programId,
      participantId,
      status,
      search,
      limit: limit ? Number(limit) : 20,
      offset: offset ? Number(offset) : 0,
    });

    return this.listApplicationsHandler.execute(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get application by ID' })
  @ApiResponse({ status: 200, description: 'Application retrieved successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async findOne(
    @Param('id') id: string,
    @Query('includeRelations') includeRelations?: boolean,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Getting application ${id}`);

    const query = new GetApplicationQuery(id, includeRelations);
    return this.getApplicationHandler.execute(query);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update application (draft only)' })
  @ApiResponse({ status: 200, description: 'Application updated successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot edit non-draft application' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationRequestDto,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating application ${id}`);

    const command = new UpdateApplicationCommand(id, dto);
    return this.updateApplicationHandler.execute(command);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit application' })
  @ApiResponse({ status: 200, description: 'Application submitted successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Application cannot be submitted' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async submit(
    @Param('id') id: string,
    @Body('participantId') participantId: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Submitting application ${id}`);

    const command = new SubmitApplicationCommand(id, participantId);
    return this.submitApplicationHandler.execute(command);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review application (admin only)' })
  @ApiResponse({ status: 200, description: 'Application reviewed successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Application cannot be reviewed' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationRequestDto,
    @Body('reviewerId') reviewerId: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Reviewing application ${id} by reviewer ${reviewerId}`);

    const command = new ReviewApplicationCommand(
      id,
      reviewerId,
      dto.status,
      dto.reviewerNotes,
      dto.scoreTotal,
      dto.scoreBreakdown,
      dto.scoreStatus,
    );

    return this.reviewApplicationHandler.execute(command);
  }

  @Post(':id/withdraw')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw application' })
  @ApiResponse({ status: 200, description: 'Application withdrawn successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Application cannot be withdrawn' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async withdraw(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Withdrawing application ${id}`);

    const command = new WithdrawApplicationCommand(id, userId);
    return this.withdrawApplicationHandler.execute(command);
  }
}
