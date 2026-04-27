import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';

// Commands
import { CreateApplicationHandler } from '../application/commands/handlers/create-application.handler';
import { UpdateApplicationHandler } from '../application/commands/handlers/update-application.handler';
import { SubmitApplicationHandler } from '../application/commands/handlers/submit-application.handler';
import { ReviewApplicationHandler } from '../application/commands/handlers/review-application.handler';
import { WithdrawApplicationHandler } from '../application/commands/handlers/withdraw-application.handler';
import { SwitchApplicationCategoryHandler } from '../application/commands/handlers/switch-application-category.handler';
import { CreateRegistrationPaymentIntentHandler } from '../application/commands/handlers/create-registration-payment-intent.handler';

import { CreateApplicationCommand } from '../application/commands/create-application.command';
import { UpdateApplicationCommand } from '../application/commands/update-application.command';
import { SubmitApplicationCommand } from '../application/commands/submit-application.command';
import { ReviewApplicationCommand } from '../application/commands/review-application.command';
import { WithdrawApplicationCommand } from '../application/commands/withdraw-application.command';
import { SwitchApplicationCategoryCommand } from '../application/commands/switch-application-category.command';
import { CreateRegistrationPaymentIntentCommand } from '../application/commands/create-registration-payment-intent.command';

// Queries
import { GetApplicationHandler } from '../application/queries/handlers/get-application.handler';
import { ListApplicationsHandler } from '../application/queries/handlers/list-applications.handler';
import { ExportApplicationsHandler } from '../application/queries/handlers/export-applications.handler';
import { GetApplicationQuery } from '../application/queries/get-application.query';
import { ListApplicationsQuery } from '../application/queries/list-applications.query';
import { ExportApplicationsQuery } from '../application/queries/export-applications.query';
import { StreamableFile } from '@nestjs/common';

// DTOs
import { CreateApplicationRequestDto } from './dto/create-application-request.dto';
import { UpdateApplicationRequestDto } from './dto/update-application-request.dto';
import { ReviewApplicationRequestDto } from './dto/review-application-request.dto';
import { SwitchApplicationCategoryRequestDto } from './dto/switch-application-category-request.dto';
import { ApplicationResponseDto, ApplicationListResponseDto } from '../application/dto/application-response.dto';
import { ApplicationStatus } from '@core/entities/participant-application.entity';

/**
 * Applications Controller
 * 
 * Presentation Layer - REST API
 * Handles HTTP requests for application operations
 */
@ApiTags('Applications')
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
    private readonly switchApplicationCategoryHandler: SwitchApplicationCategoryHandler,
    private readonly createRegistrationPaymentIntentHandler: CreateRegistrationPaymentIntentHandler,
    private readonly getApplicationHandler: GetApplicationHandler,
    private readonly listApplicationsHandler: ListApplicationsHandler,
    private readonly exportApplicationsHandler: ExportApplicationsHandler,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) { }

  private validateDateRange(startDate?: string, endDate?: string): void {
    const isValidDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`));

    if (startDate && !isValidDate(startDate)) {
      throw new BadRequestException('Invalid startDate format. Expected YYYY-MM-DD.');
    }

    if (endDate && !isValidDate(endDate)) {
      throw new BadRequestException('Invalid endDate format. Expected YYYY-MM-DD.');
    }

    if (startDate && endDate && startDate > endDate) {
      throw new BadRequestException('startDate cannot be after endDate.');
    }
  }

  @Post()
  @ApiOperation({ summary: 'Create a new application' })
  @ApiResponse({ status: 201, description: 'Application created successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 409, description: 'Application already exists' })
  @CacheInvalidate(['portal:*:${userId}'])
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.create })
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

  @Get('export')
  @ApiOperation({ summary: 'Export applications to CSV' })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'status', enum: ApplicationStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'Applied from date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Applied until date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'CSV file stream' })
  async export(
    @Query('brandId') brandId: string,
    @Query('programId') programId?: string,
    @Query('status') status?: ApplicationStatus,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ): Promise<StreamableFile> {
    this.logger.log(`Exporting applications: brandId=${brandId}, programId=${programId}`);
    this.validateDateRange(startDate, endDate);

    // We do NOT use query bus for StreamableFile return types usually, 
    // but we can if the handler returns StreamableFile. 
    // However, QueryBus execute return type is generic. 
    // Let's inject the handler directly or use the query bus.
    // QueryBus is cleaner for CQRS but type inference might be tricky.
    // Given the previous pattern uses handlers injected in constructor (which is NOT standard CQRS but practical),
    // I will inject the handler directly.
    const query = new ExportApplicationsQuery(brandId, programId, status, search, startDate, endDate);
    return this.exportApplicationsHandler.execute(query);
  }

  @Get()
  @ApiOperation({ summary: 'List applications with filters' })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'participantId', required: false })
  @ApiQuery({ name: 'status', enum: ApplicationStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'startDate', required: false, description: 'Applied from date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Applied until date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'offset', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Applications retrieved successfully', type: ApplicationListResponseDto })
  async findAll(
    @Query('brandId') brandId?: string,
    @Query('programId') programId?: string,
    @Query('participantId') participantId?: string,
    @Query('status') status?: ApplicationStatus,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ApplicationListResponseDto> {
    this.logger.log(`Listing applications with filters: brandId=${brandId}, programId=${programId}`);
    this.validateDateRange(startDate, endDate);

    const actualLimit = limit ? Number(limit) : 20;
    const actualOffset = offset ? Number(offset) : 0;

    // Cache strategy: Only cache the first 5 pages to avoid cache pollution with deep pagination
    // 5 pages * 20 items = 100 items. Roughly covering "recent" items.
    const shouldCache = actualOffset < (actualLimit * 5);
    let cacheKey = '';

    if (shouldCache) {
      // Create a deterministic cache key based on all filters
      const filterParams = JSON.stringify({ participantId, status, search, startDate, endDate, limit: actualLimit, offset: actualOffset });
      // We hash the params to keep the key length manageable, or just use stringified if short enough. 
      // For simplicity/readability in redis, we'll use a simple string representation if it's not too long, 
      // but here we can just use the stringified JSON.
      cacheKey = CACHE_KEYS.APPLICATION_LIST(brandId, programId, filterParams);

      try {
        const cached = await this.cacheService.get<ApplicationListResponseDto>(cacheKey);
        if (cached) {
          return cached;
        }
      } catch (e) {
        this.logger.error('Cache get error', e);
      }
    }

    const query = new ListApplicationsQuery({
      brandId,
      programId,
      participantId,
      status,
      search,
      startDate,
      endDate,
      limit: actualLimit,
      offset: actualOffset,
    });

    const result = await this.listApplicationsHandler.execute(query);

    // Enrich applications with participant data and payment statuses via single batch lookup
    if (result.applications.length > 0) {
      const appIds = result.applications.map(a => a.id);
      const enriched = await this.prisma.participantApplication.findMany({
        where: { id: { in: appIds } },
        select: {
          id: true,
          registrationPaymentStatus: true,
          programPaymentStatus: true,
          participant: {
            include: { user: { select: { id: true, email: true } } },
          },
        },
      });
      const enrichMap = new Map(enriched.map(e => [e.id, e]));
      result.applications = result.applications.map(app => {
        const e = enrichMap.get(app.id);
        if (!e) return app;
        const p = e.participant;
        return {
          ...app,
          registrationPaymentStatus: e.registrationPaymentStatus,
          programPaymentStatus: e.programPaymentStatus,
          participant: p ? {
            id: p.id,
            fullName: p.fullName,
            nickName: p.nickName,
            email: (p as any).user?.email ?? null,
            phoneCountryCode: p.phoneCountryCode,
            phoneNumber: p.phoneNumber,
            originCountry: p.originCountry,
            originCity: p.originCity,
            nationality: p.nationality,
            gender: p.gender,
            profilePictureUrl: p.profilePictureUrl,
          } : undefined,
        };
      });
    }

    if (shouldCache) {
      try {
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM); // 5 minutes TTL
      } catch (e) {
        this.logger.error('Cache set error', e);
      }
    }

    return result;
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
  @CacheInvalidate(['portal:*:${userId}'])
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.update })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateApplicationRequestDto,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Updating application ${id}`);

    const command = new UpdateApplicationCommand(id, dto);
    return this.updateApplicationHandler.execute(command);
  }

  @Post(':id/switch-category')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Switch application category' })
  @ApiResponse({ status: 200, description: 'Application category switched successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot switch category due to status or payments' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @CacheInvalidate(['portal:*:${userId}'])
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.update })
  async switchCategory(
    @Param('id') id: string,
    @Body() dto: SwitchApplicationCategoryRequestDto,
    @Body('userId') userId: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Switching category for application ${id} to ${dto.targetCategory}`);

    const command = new SwitchApplicationCategoryCommand(id, dto.targetCategory, userId);
    return this.switchApplicationCategoryHandler.execute(command);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit application' })
  @ApiResponse({ status: 200, description: 'Application submitted successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Application cannot be submitted' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @CacheInvalidate(['portal:*:${userId}'])
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.status_change })
  async submit(
    @Param('id') id: string,
    @Body('participantId') participantId: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Submitting application ${id}`);

    const command = new SubmitApplicationCommand(id, participantId);
    return this.submitApplicationHandler.execute(command);
  }

  @Post(':id/payment-intent')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Registration Payment Intent' })
  @ApiResponse({ status: 201, description: 'Payment Intent created' })
  @CacheInvalidate(['portal:*:${userId}'])
  async createPaymentIntent(
    @Param('id') id: string,
    @Body('userId') userId: string
  ) {
    this.logger.log(`Creating payment intent for application ${id}`);
    const command = new CreateRegistrationPaymentIntentCommand(id, userId);
    return this.createRegistrationPaymentIntentHandler.execute(command);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review application (admin only)' })
  @ApiResponse({ status: 200, description: 'Application reviewed successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Application cannot be reviewed' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.status_change })
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
  @CacheInvalidate(['portal:*:${userId}'])
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.status_change })
  async withdraw(
    @Param('id') id: string,
    @Body('userId') userId: string,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Withdrawing application ${id}`);

    const command = new WithdrawApplicationCommand(id, userId);
    return this.withdrawApplicationHandler.execute(command);
  }
}
