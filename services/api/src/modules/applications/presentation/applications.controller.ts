import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Param,
  Body,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType, PaymentStatus, ScoringStage } from '@prisma/client';

// Commands
import { CreateApplicationHandler } from '../application/commands/handlers/create-application.handler';
import { UpdateApplicationHandler } from '../application/commands/handlers/update-application.handler';
import { SubmitApplicationHandler } from '../application/commands/handlers/submit-application.handler';
import { ReviewApplicationHandler } from '../application/commands/handlers/review-application.handler';
import { WithdrawApplicationHandler } from '../application/commands/handlers/withdraw-application.handler';
import { SwitchApplicationCategoryHandler } from '../application/commands/handlers/switch-application-category.handler';
import { CreateRegistrationPaymentIntentHandler } from '../application/commands/handlers/create-registration-payment-intent.handler';
import { AdminUpdateSubmissionHandler } from '../application/commands/handlers/admin-update-submission.handler';
import { AdminUpdateSubmissionCommand } from '../application/commands/admin-update-submission.command';

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
import { GetApplicationReviewHandler } from '../application/queries/handlers/get-application-review.handler';
import { GetApplicationQuery } from '../application/queries/get-application.query';
import { GetApplicationReviewQuery } from '../application/queries/get-application-review.query';
import {
  ListApplicationsQuery,
  ListApplicationsSortBy,
  ListApplicationsSortOrder,
} from '../application/queries/list-applications.query';
import { ExportApplicationsQuery } from '../application/queries/export-applications.query';
import { StreamableFile } from '@nestjs/common';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { resolveActingAdminId } from '@shared/utils/resolve-acting-admin-id';

// Scoring review command
import { UpsertApplicationReviewHandler } from '../application/commands/handlers/upsert-application-review.handler';
import { UpsertApplicationReviewCommand } from '../application/commands/upsert-application-review.command';

// DTOs
import { CreateApplicationRequestDto } from './dto/create-application-request.dto';
import { UpdateApplicationRequestDto } from './dto/update-application-request.dto';
import { ReviewApplicationRequestDto } from './dto/review-application-request.dto';
import { SwitchApplicationCategoryRequestDto } from './dto/switch-application-category-request.dto';
import { AdminUpdateSubmissionDto } from './dto/admin-update-submission.dto';
import { UpsertApplicationReviewRequestDto } from './dto/upsert-application-review-request.dto';
import { ApplicationResponseDto, ApplicationListResponseDto } from '../application/dto/application-response.dto';
import { ApplicationReviewResponseDto } from '../application/dto/application-review-response.dto';
import { ApplicationCategory, ApplicationStatus, ScoreStatus } from '@core/entities/participant-application.entity';

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
  private static readonly SORT_BY_VALUES: ReadonlySet<ListApplicationsSortBy> = new Set([
    'updatedAt',
    'createdAt',
    'submittedAt',
    'participantName',
    'country',
    'status',
    'registrationPaymentStatus',
    'programPaymentStatus',
    'scoreTotal',
    'scoreStatus',
  ]);
  private static readonly SORT_ORDER_VALUES: ReadonlySet<ListApplicationsSortOrder> = new Set(['asc', 'desc']);
  private static readonly CATEGORY_VALUES: ReadonlySet<ApplicationCategory> = new Set([
    ApplicationCategory.FULLY_FUNDED,
    ApplicationCategory.SELF_FUNDED,
  ]);
  private static readonly PAYMENT_STATUS_VALUES: ReadonlySet<PaymentStatus> = new Set([
    PaymentStatus.unpaid,
    PaymentStatus.paid,
    PaymentStatus.processing,
    PaymentStatus.failed,
    PaymentStatus.refunded,
  ]);
  private static readonly SCORE_STATUS_VALUES: ReadonlySet<ScoreStatus> = new Set([
    ScoreStatus.PENDING,
    ScoreStatus.SCORED,
    ScoreStatus.GO_TO_INTERVIEW,
    ScoreStatus.REJECTED,
    ScoreStatus.FINALIST,
    ScoreStatus.NOT_SELECTED,
  ]);

  // Pagination bounds for GET /applications (shared by every admin list page
  // that calls this endpoint) — keeps `limit`/`offset` parsing NaN-safe and
  // prevents an unbounded `limit` from turning into a full-table scan.
  private static readonly DEFAULT_PAGE_SIZE = 20;
  private static readonly MIN_PAGE_SIZE = 1;
  private static readonly MAX_PAGE_SIZE = 500;
  private static readonly DEFAULT_OFFSET = 0;
  private static readonly MIN_OFFSET = 0;

  private static parseLimit(raw?: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return ApplicationsController.DEFAULT_PAGE_SIZE;
    return Math.min(
      Math.max(Math.floor(parsed), ApplicationsController.MIN_PAGE_SIZE),
      ApplicationsController.MAX_PAGE_SIZE,
    );
  }

  private static parseOffset(raw?: number): number {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return ApplicationsController.DEFAULT_OFFSET;
    return Math.max(Math.floor(parsed), ApplicationsController.MIN_OFFSET);
  }

  constructor(
    private readonly createApplicationHandler: CreateApplicationHandler,
    private readonly updateApplicationHandler: UpdateApplicationHandler,
    private readonly submitApplicationHandler: SubmitApplicationHandler,
    private readonly reviewApplicationHandler: ReviewApplicationHandler,
    private readonly withdrawApplicationHandler: WithdrawApplicationHandler,
    private readonly switchApplicationCategoryHandler: SwitchApplicationCategoryHandler,
    private readonly createRegistrationPaymentIntentHandler: CreateRegistrationPaymentIntentHandler,
    private readonly adminUpdateSubmissionHandler: AdminUpdateSubmissionHandler,
    private readonly getApplicationHandler: GetApplicationHandler,
    private readonly listApplicationsHandler: ListApplicationsHandler,
    private readonly exportApplicationsHandler: ExportApplicationsHandler,
    private readonly cacheService: CacheService,
    private readonly readPrisma: PrismaReadService,
    private readonly getApplicationReviewHandler: GetApplicationReviewHandler,
    private readonly upsertApplicationReviewHandler: UpsertApplicationReviewHandler,
  ) { }

  // Scoring is a regular-admin job even though editing rubric weights (the
  // PUT programs/:id/scoring-rubrics/:stage route) is SuperAdmin-only. The
  // SuperAdmin-only rule for the interview gate override is enforced inside
  // UpsertApplicationReviewHandler, not by a route decorator here, because a
  // plain ADMIN must still be able to PUT a review normally. RolesGuard has
  // already confirmed the caller is at least ADMIN by the time this runs; this
  // only distinguishes ADMIN from SUPER_ADMIN for the handler's own gate check.
  private static resolveActingAdminRole(user: CurrentUserData): UserRole {
    const roles = Array.isArray(user.role) ? user.role : [user.role];
    return roles.includes(UserRole.SUPER_ADMIN) ? UserRole.SUPER_ADMIN : UserRole.ADMIN;
  }

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

  private validateListFilters(params: {
    sortBy?: string;
    sortOrder?: string;
    category?: string;
    registrationPaymentStatus?: string;
    programPaymentStatus?: string;
    scoreStatus?: string;
  }): void {
    if (params.sortBy && !ApplicationsController.SORT_BY_VALUES.has(params.sortBy as ListApplicationsSortBy)) {
      throw new BadRequestException('Invalid sortBy value.');
    }

    if (params.sortOrder && !ApplicationsController.SORT_ORDER_VALUES.has(params.sortOrder as ListApplicationsSortOrder)) {
      throw new BadRequestException('Invalid sortOrder value.');
    }

    if (params.category && !ApplicationsController.CATEGORY_VALUES.has(params.category as ApplicationCategory)) {
      throw new BadRequestException('Invalid category value.');
    }

    if (
      params.registrationPaymentStatus &&
      !ApplicationsController.PAYMENT_STATUS_VALUES.has(params.registrationPaymentStatus as PaymentStatus)
    ) {
      throw new BadRequestException('Invalid registrationPaymentStatus value.');
    }

    if (
      params.programPaymentStatus &&
      !ApplicationsController.PAYMENT_STATUS_VALUES.has(params.programPaymentStatus as PaymentStatus)
    ) {
      throw new BadRequestException('Invalid programPaymentStatus value.');
    }

    if (
      params.scoreStatus &&
      !ApplicationsController.SCORE_STATUS_VALUES.has(params.scoreStatus as ScoreStatus)
    ) {
      throw new BadRequestException('Invalid scoreStatus value.');
    }
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new application (admin)' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Export applications to CSV (admin)' })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'status', enum: ApplicationStatus, required: false })
  @ApiQuery({ name: 'category', enum: ApplicationCategory, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'country', required: false })
  @ApiQuery({ name: 'registrationPaymentStatus', enum: PaymentStatus, required: false })
  @ApiQuery({ name: 'programPaymentStatus', enum: PaymentStatus, required: false })
  @ApiQuery({ name: 'scoreStatus', enum: ScoreStatus, required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['updatedAt', 'createdAt', 'submittedAt', 'participantName', 'country', 'status', 'registrationPaymentStatus', 'programPaymentStatus'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  @ApiQuery({ name: 'startDate', required: false, description: 'Applied from date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, description: 'Applied until date (YYYY-MM-DD)' })
  @ApiResponse({ status: 200, description: 'CSV file stream' })
  async export(
    @Query('brandId') brandId: string,
    @Query('programId') programId?: string,
    @Query('status') status?: ApplicationStatus,
    @Query('category') category?: ApplicationCategory,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('scoreStatus') scoreStatus?: ScoreStatus,
  ): Promise<StreamableFile> {
    this.logger.log(`Exporting applications: brandId=${brandId}, programId=${programId}`);
    this.validateDateRange(startDate, endDate);
    this.validateListFilters({ scoreStatus });

    // Handler is injected directly (practical CQRS pattern) because QueryBus
    // generic return type doesn't carry StreamableFile cleanly.
    const query = new ExportApplicationsQuery(brandId, programId, status, category, search, startDate, endDate, scoreStatus);
    return this.exportApplicationsHandler.execute(query);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'List applications with filters (admin)' })
  @ApiQuery({ name: 'brandId', required: false })
  @ApiQuery({ name: 'programId', required: false })
  @ApiQuery({ name: 'participantId', required: false })
  @ApiQuery({ name: 'status', enum: ApplicationStatus, required: false })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'registrationPaymentStatus', enum: PaymentStatus, required: false })
  @ApiQuery({ name: 'programPaymentStatus', enum: PaymentStatus, required: false })
  @ApiQuery({ name: 'scoreStatus', enum: ScoreStatus, required: false })
  @ApiQuery({ name: 'sortBy', required: false, enum: ['updatedAt', 'createdAt', 'submittedAt', 'participantName', 'country', 'status', 'registrationPaymentStatus', 'programPaymentStatus', 'scoreTotal', 'scoreStatus'] })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
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
    @Query('category') category?: ApplicationCategory,
    @Query('search') search?: string,
    @Query('country') country?: string,
    @Query('registrationPaymentStatus') registrationPaymentStatus?: PaymentStatus,
    @Query('programPaymentStatus') programPaymentStatus?: PaymentStatus,
    @Query('scoreStatus') scoreStatus?: ScoreStatus,
    @Query('sortBy') sortBy?: ListApplicationsSortBy,
    @Query('sortOrder') sortOrder?: ListApplicationsSortOrder,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('limit') limit?: number,
    @Query('offset') offset?: number,
  ): Promise<ApplicationListResponseDto> {
    this.logger.log(`Listing applications with filters: brandId=${brandId}, programId=${programId}`);
    this.validateDateRange(startDate, endDate);
    this.validateListFilters({
      sortBy,
      sortOrder,
      category,
      registrationPaymentStatus,
      programPaymentStatus,
      scoreStatus,
    });

    const actualLimit = ApplicationsController.parseLimit(limit);
    const actualOffset = ApplicationsController.parseOffset(offset);

    // Cache strategy: Only cache the first 5 pages to avoid cache pollution with deep pagination
    // 5 pages * 20 items = 100 items. Roughly covering "recent" items.
    const shouldCache = actualOffset < (actualLimit * 5);
    let cacheKey = '';

    if (shouldCache) {
      // Create a deterministic cache key based on all filters
      const filterParams = JSON.stringify({
        participantId,
        status,
        category,
        search,
        country,
        registrationPaymentStatus,
        programPaymentStatus,
        scoreStatus,
        sortBy,
        sortOrder,
        startDate,
        endDate,
        limit: actualLimit,
        offset: actualOffset,
      });
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
      category,
      search,
      country,
      registrationPaymentStatus,
      programPaymentStatus,
      scoreStatus,
      sortBy,
      sortOrder,
      startDate,
      endDate,
      limit: actualLimit,
      offset: actualOffset,
    });

    const result = await this.listApplicationsHandler.execute(query);

    // Enrich applications with participant data and payment statuses via single batch lookup
    if (result.applications.length > 0) {
      const appIds = result.applications.map(a => a.id);
      const enriched = await this.readPrisma.participantApplication.findMany({
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get application by ID (admin)' })
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
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update application (draft only, admin)' })
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
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApplicationResponseDto> {
    this.logger.log(`Switching category for application ${id} to ${dto.targetCategory}`);

    const command = new SwitchApplicationCategoryCommand(id, dto.targetCategory, user.userId);
    return this.switchApplicationCategoryHandler.execute(command);
  }

  @Post(':id/submit')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit application (admin; participants use /portal/submissions/submit)' })
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

  /**
   * PATCH /applications/:id/submission-data
   *
   * ADMIN ONLY — edits a participant's submission data after it has been locked
   * (post-submit).  Bypasses the draft-only edit guard intentionally so admins
   * can correct typos (e.g. names) that would otherwise propagate to ID cards,
   * certificates, and LoA documents.
   *
   * Auth: requires an admin/super-admin role (RolesGuard) on top of a valid JWT.
   * This mutation bypasses the submission lock, so it must never be reachable by
   * a participant token.
   *
   * Every edit is recorded in application_edit_history with a required `reason`.
   */
  @Patch(':id/submission-data')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Admin: edit submission data of a locked application' })
  @ApiResponse({
    status: 200,
    description: 'Submission data updated and audit record created',
    schema: {
      properties: {
        success: { type: 'boolean' },
        applicationId: { type: 'string' },
        editHistoryId: { type: 'string' },
      },
    },
  })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({ status: 400, description: 'Validation error in payload' })
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.update })
  async adminUpdateSubmission(
    @Param('id') id: string,
    @Body() dto: AdminUpdateSubmissionDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<{ success: boolean; applicationId: string; editHistoryId: string }> {
    this.logger.log(
      `Admin ${user.userId} editing submission data for application ${id}: ${dto.reason}`,
    );

    const command = new AdminUpdateSubmissionCommand(
      id,
      user.userId,
      dto.reason,
      dto.personalData,
      dto.essayAnswers,
      dto.participant,
      dto.application,
    );

    return this.adminUpdateSubmissionHandler.execute(command);
  }

  @Post(':id/payment-intent')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create Registration Payment Intent (admin; participants use /portal/payments)' })
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

  // GET/PUT :applicationId/review are the scoring-rubric review endpoints
  // (Task 7/8). They intentionally use the param name `:applicationId`
  // instead of the legacy `:id` used by POST :id/review directly below.
  // NestJS routes by HTTP verb + path together, so a differing param NAME
  // at the same path position is legal and does not collide with the
  // legacy POST route, but it is easy to misread as a conflict. The
  // legacy POST :id/review endpoint is scheduled for cleanup in Task 9;
  // until then both coexist on this controller.
  @Get(':applicationId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get an application review (scoring rubric) for a stage (admin)' })
  @ApiQuery({ name: 'stage', enum: ScoringStage, required: true })
  @ApiResponse({ status: 200, description: 'Review retrieved (or an empty draft shape if none exists yet)', type: ApplicationReviewResponseDto })
  @ApiResponse({ status: 400, description: 'Missing or invalid stage query param' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getReview(
    @Param('applicationId') applicationId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage)) stage: ScoringStage,
  ): Promise<ApplicationReviewResponseDto> {
    return this.getApplicationReviewHandler.execute(new GetApplicationReviewQuery(applicationId, stage));
  }

  @Put(':applicationId/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create or update an application review (scoring rubric) for a stage (admin)' })
  @ApiQuery({ name: 'stage', enum: ScoringStage, required: true })
  @ApiResponse({ status: 200, description: 'Review saved', type: ApplicationReviewResponseDto })
  @ApiResponse({ status: 400, description: 'Missing/invalid stage query param, or invalid review items' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @ApiResponse({ status: 409, description: 'No active rubric for this stage, or the interview gate is closed' })
  // Submitting a review writes scoreTotal/scoreStatus onto participantApplication
  // (see UpsertApplicationReviewHandler), and those fields are exposed through
  // ApplicationResponseDto, which findAll() above caches under
  // CACHE_KEYS.APPLICATION_LIST for CACHE_TTL.MEDIUM (5 minutes). Without this,
  // an admin who scores an application keeps seeing the pre-review score/status
  // in the list for up to 5 minutes.
  @CacheInvalidate(['application:list:*'])
  async upsertReview(
    @Param('applicationId') applicationId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage)) stage: ScoringStage,
    @Body() dto: UpsertApplicationReviewRequestDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApplicationReviewResponseDto> {
    // actingAdminId/actingAdminRole MUST come from the authenticated JWT
    // principal, never from the request body or a query param. Same
    // attribution-forgery rule Task 6 applied to createdById.
    // UpsertApplicationReviewRequestDto has no actingAdminId/overrideById/
    // createdById/totalScore/scoreStatus fields, so none of those can flow
    // through dto.* here even before the global whitelist pipe rejects them.
    // actingAdminId must be the admins.id (ApplicationReview.reviewerId and
    // .overrideById are FKs to admins(id), not users(id)); resolveActingAdminId
    // throws rather than silently falling back to user.userId.
    const command = new UpsertApplicationReviewCommand(
      applicationId,
      stage,
      resolveActingAdminId(user),
      ApplicationsController.resolveActingAdminRole(user),
      {
        status: dto.status,
        notes: dto.notes,
        items: dto.items.map((item) => ({
          criterionId: item.criterionId,
          score: item.score,
          notes: item.notes,
        })),
        overrideReason: dto.overrideReason,
      },
    );

    return this.upsertApplicationReviewHandler.execute(command);
  }

  @Post(':id/review')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review application (admin only)' })
  @ApiResponse({ status: 200, description: 'Application reviewed successfully', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Application cannot be reviewed' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  @AuditTrail({ entityType: 'ParticipantApplication', action: ChangeType.status_change })
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewApplicationRequestDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<ApplicationResponseDto> {
    // reviewerId MUST come from the authenticated JWT principal, never from
    // the request body, same attribution-forgery rule Task 6/8b applied to
    // createdById/actingAdminId. ReviewApplicationRequestDto has no
    // reviewerId field, so a body-supplied one cannot flow through dto.*
    // here even before the global whitelist pipe rejects it.
    // ParticipantApplication.reviewedBy is a bare Uuid with no FK, so passing
    // user.userId here would not throw, but it would be a silent semantic
    // change: the dashboard previously sent the admin profile id. Use the
    // admin id for consistency with the FK-backed scoring writes above.
    const actingAdminId = resolveActingAdminId(user);
    this.logger.log(`Reviewing application ${id} by reviewer ${actingAdminId}`);

    const command = new ReviewApplicationCommand(
      id,
      actingAdminId,
      dto.status,
      dto.reviewerNotes,
      dto.approvalMode,
    );

    return this.reviewApplicationHandler.execute(command);
  }

  @Post(':id/withdraw')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Withdraw application (admin)' })
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
