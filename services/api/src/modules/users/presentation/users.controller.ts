import { Controller, Get, Post, Body, Param, Query, UseGuards, Patch, Ip, Headers } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery, ApiResponse } from '@nestjs/swagger';
import { CreateUserHandler } from '../application/commands/handlers/create-user.handler';
import { GetUserHandler } from '../application/queries/handlers/get-user.handler';
import { GetUsersHandler } from '../application/queries/handlers/get-users.handler';
import { CreateUserDto } from './dto/create-user.dto';
import { UserResponseDto } from './dto/user-response.dto';
import { CreateUserCommand } from '../application/commands/create-user.command';
import { GetUserQuery } from '../application/queries/get-user.query';
import { GetUsersQuery } from '../application/queries/get-users.query';
import { GetUserPreferencesQuery } from '../application/queries/get-user-preferences.query';
import { GetUserPreferencesHandler } from '../application/queries/handlers/get-user-preferences.handler';
import { UpdateUserPreferencesCommand } from '../application/commands/update-user-preferences.command';
import { UpdateUserPreferencesHandler } from '../application/commands/handlers/update-user-preferences.handler';
import { UpdateUserPreferenceDto, UserPreferenceResponseDto } from './dto/user-preference.dto';
import { ListUserNotificationsQuery } from '../application/queries/list-user-notifications.query';
import { ListUserNotificationsHandler } from '../application/queries/handlers/list-user-notifications.handler';
import { MarkNotificationReadCommand } from '../application/commands/mark-notification-read.command';
import { MarkNotificationReadHandler } from '../application/commands/handlers/mark-notification-read.handler';
import { UserNotificationResponseDto } from './dto/user-notification.dto';
import { ListUserActivityLogsQuery, ListUserSecurityLogsQuery } from '../application/queries/list-user-logs.query';
import { ListUserActivityLogsHandler } from '../application/queries/handlers/list-user-activity-logs.handler';
import { ListUserSecurityLogsHandler } from '../application/queries/handlers/list-user-security-logs.handler';
import { UserActivityLogResponseDto, UserSecurityLogResponseDto } from './dto/user-logs.dto';
import { CreateDeletionRequestDto, DeletionRequestResponseDto } from './dto/deletion-request.dto';
import { CreateDeletionRequestCommand } from '../application/commands/create-deletion-request.command';
import { CreateDeletionRequestHandler } from '../application/commands/handlers/create-deletion-request.handler';
import { ActivateUserHandler } from '../application/commands/handlers/activate-user.handler';
import { DeactivateUserHandler } from '../application/commands/handlers/deactivate-user.handler';
import { ActivateUserCommand } from '../application/commands/activate-user.command';
import { DeactivateUserCommand } from '../application/commands/deactivate-user.command';
import { CurrentUser, CurrentUserData } from '../../../shared/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { Roles } from '../../auth/application/decorators/roles.decorator';
import { UserRole } from '../../../core/entities/user.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { AuditTrail } from '../../../shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';

@ApiTags('Users')
@Controller('users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class UsersController {
  constructor(
    private readonly createUserHandler: CreateUserHandler,
    private readonly getUserHandler: GetUserHandler,
    private readonly getUsersHandler: GetUsersHandler,
    private readonly getUserPreferencesHandler: GetUserPreferencesHandler,
    private readonly updateUserPreferencesHandler: UpdateUserPreferencesHandler,
    private readonly listUserNotificationsHandler: ListUserNotificationsHandler,
    private readonly markNotificationReadHandler: MarkNotificationReadHandler,
    private readonly listUserActivityLogsHandler: ListUserActivityLogsHandler,
    private readonly listUserSecurityLogsHandler: ListUserSecurityLogsHandler,
    private readonly createDeletionRequestHandler: CreateDeletionRequestHandler,
    private readonly activateUserHandler: ActivateUserHandler,
    private readonly deactivateUserHandler: DeactivateUserHandler,
    private readonly cacheService: CacheService,
  ) { }

  @Get('me/preferences')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Current User Preferences' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved user preferences', type: UserPreferenceResponseDto })
  async getMyPreferences(@CurrentUser() user: CurrentUserData): Promise<UserPreferenceResponseDto> {
    const query = new GetUserPreferencesQuery(user.userId);
    return this.getUserPreferencesHandler.execute(query);
  }

  @Post('me/preferences') // Using Post or Put? REST says PUT for update/replace or PATCH. Plan said PUT.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update Current User Preferences' })
  @ApiResponse({ status: 200, description: 'User preferences successfully updated', type: UserPreferenceResponseDto })
  async updateMyPreferences(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: UpdateUserPreferenceDto,
  ): Promise<UserPreferenceResponseDto> {
    const command = new UpdateUserPreferencesCommand(user.userId, dto);
    return this.updateUserPreferencesHandler.execute(command);
  }

  @Get('me/notifications')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Current User Notifications' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved user notifications', type: [UserNotificationResponseDto] })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'type', required: false, type: String })
  @ApiQuery({ name: 'isRead', required: false, type: Boolean })
  async getMyNotifications(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('type') type?: string,
    @Query('isRead') isRead?: boolean,
  ): Promise<{ data: UserNotificationResponseDto[], total: number }> {
    const query = new ListUserNotificationsQuery(user.userId, page ?? 1, limit ?? 10, type, isRead);
    return this.listUserNotificationsHandler.execute(query);
  }

  @Post('me/notifications/:id/read') // PATCH or POST? Convention says PATCH for partial update, but POST for action. Method says Mark as read (action). Let's use PATCH.
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mark Notification as Read' })
  @ApiResponse({ status: 200, description: 'Notification successfully marked as read', type: UserNotificationResponseDto })
  async markNotificationRead(
    @CurrentUser() user: CurrentUserData,
    @Param('id') id: string,
  ): Promise<UserNotificationResponseDto> {
    const command = new MarkNotificationReadCommand(user.userId, id);
    return this.markNotificationReadHandler.execute(command);
  }

  @Get('me/activity-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Current User Activity Logs' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved activity logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMyActivityLogs(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: UserActivityLogResponseDto[], total: number }> {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    const query = new ListUserActivityLogsQuery(user.userId, isNaN(pageNum) ? 1 : pageNum, isNaN(limitNum) ? 20 : limitNum);
    return this.listUserActivityLogsHandler.execute(query);
  }

  @Get('me/security-logs')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get Current User Security Logs' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved security logs' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  async getMySecurityLogs(
    @CurrentUser() user: CurrentUserData,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ): Promise<{ data: UserSecurityLogResponseDto[], total: number }> {
    const pageNum = page ? Number(page) : 1;
    const limitNum = limit ? Number(limit) : 20;
    const query = new ListUserSecurityLogsQuery(user.userId, isNaN(pageNum) ? 1 : pageNum, isNaN(limitNum) ? 20 : limitNum);
    return this.listUserSecurityLogsHandler.execute(query);
  }

  @Post('me/deletion-request')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Request Account Deletion' })
  @ApiResponse({ status: 201, description: 'Deletion request successfully created', type: DeletionRequestResponseDto })
  @AuditTrail({ entityType: 'User', action: ChangeType.delete })
  async requestDeletion(
    @CurrentUser() user: CurrentUserData,
    @Body() dto: CreateDeletionRequestDto,
    @Ip() ipAddress?: string,
    @Headers('user-agent') userAgent?: string,
  ): Promise<DeletionRequestResponseDto> {
    const command = new CreateDeletionRequestCommand(user.userId, dto, ipAddress, userAgent);
    return this.createDeletionRequestHandler.execute(command);
  }

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create New User' })
  @ApiResponse({ status: 201, description: 'User successfully created', type: UserResponseDto })
  @AuditTrail({ entityType: 'User', action: ChangeType.create })
  async create(@Body() dto: CreateUserDto): Promise<UserResponseDto> {
    const command = new CreateUserCommand(
      dto.brandId,
      dto.email,
      dto.password,
    );

    return this.createUserHandler.execute(command);
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get User By ID' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved user details', type: UserResponseDto })
  async findOne(
    @Param('id') id: string,
    @Query('brandId') brandId: string,
  ): Promise<UserResponseDto> {
    const query = new GetUserQuery(id, brandId);
    return this.getUserHandler.execute(query);
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get All Users' })
  @ApiResponse({ status: 200, description: 'Successfully retrieved list of users', type: [UserResponseDto] })
  @ApiQuery({ name: 'brandId', required: true })
  @ApiQuery({ name: 'skip', required: false, type: Number })
  @ApiQuery({ name: 'take', required: false, type: Number })
  @ApiQuery({ name: 'role', required: false, enum: ['admin', 'participant', 'ambassador'], description: 'Filter users by role' })
  async findAll(
    @Query('brandId') brandId: string,
    @Query('skip') skip?: string,
    @Query('take') take?: string,
    @Query('role') role?: string,
  ): Promise<UserResponseDto[]> {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const takeNum = take ? parseInt(take, 10) : 20;

    // Cache key includes role now
    const cacheKey = CACHE_KEYS.USER_LIST(brandId, skipNum, takeNum, role);

    try {
      const cached = await this.cacheService.get<UserResponseDto[]>(cacheKey);
      if (cached) {
        return cached;
      }
    } catch (e) {
      // ignore cache error
    }

    const query = new GetUsersQuery(
      brandId,
      skipNum,
      takeNum,
      role,
    );
    const result = await this.getUsersHandler.execute(query);

    try {
      await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
    } catch (e) {
      // ignore cache error
    }

    return result;
  }

  @Patch(':id/activate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Activate a user account' })
  @ApiResponse({ status: 200, description: 'User successfully activated', type: UserResponseDto })
  @AuditTrail({ entityType: 'User', action: ChangeType.status_change })
  @ApiQuery({ name: 'brandId', required: true, type: String })
  async activateUser(
    @Param('id') id: string,
    @Query('brandId') brandId: string,
  ): Promise<UserResponseDto> {
    return this.activateUserHandler.execute(new ActivateUserCommand(id, brandId));
  }

  @Patch(':id/deactivate')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Deactivate a user account' })
  @ApiResponse({ status: 200, description: 'User successfully deactivated', type: UserResponseDto })
  @AuditTrail({ entityType: 'User', action: ChangeType.status_change })
  @ApiQuery({ name: 'brandId', required: true, type: String })
  async deactivateUser(
    @Param('id') id: string,
    @Query('brandId') brandId: string,
  ): Promise<UserResponseDto> {
    return this.deactivateUserHandler.execute(new DeactivateUserCommand(id, brandId));
  }
}
