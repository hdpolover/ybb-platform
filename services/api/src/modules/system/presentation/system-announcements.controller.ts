import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { ListSystemAnnouncementsQuery } from '../application/queries/list-system-announcements.query';
import { GetSystemAnnouncementQuery } from '../application/queries/get-system-announcement.query';
import { MarkAnnouncementReadCommand } from '../application/commands/mark-announcement-read.command';
import {
  ListAllSystemAnnouncementsCommand,
  CreateSystemAnnouncementCommand,
  UpdateSystemAnnouncementCommand,
  DeleteSystemAnnouncementCommand,
  TogglePublishSystemAnnouncementCommand,
  GetAdminSystemAnnouncementCommand,
} from '../application/commands/manage-system-announcement.commands';
import {
  SystemAnnouncementResponseDto,
  AdminSystemAnnouncementResponseDto,
  CreateSystemAnnouncementDto,
  UpdateSystemAnnouncementDto,
  ListAllSystemAnnouncementsQueryDto,
} from './dto/system-announcement.dto';

@ApiTags('Announcements')
@Controller('system/announcements')
export class SystemAnnouncementsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) { }

    // ─── Public Endpoints ─────────────────────────────────────────────────────

    @Get()
    @ApiOperation({ summary: 'List public announcements' })
    @ApiResponse({ status: 200, description: 'Return list of announcements', type: [SystemAnnouncementResponseDto] })
    async listAnnouncements(): Promise<SystemAnnouncementResponseDto[]> {
        return this.queryBus.execute(new ListSystemAnnouncementsQuery(true));
    }

    @Get(':id')
    @ApiOperation({ summary: 'Get announcement detail' })
    @ApiResponse({ status: 200, description: 'Return announcement detail', type: SystemAnnouncementResponseDto })
    @ApiResponse({ status: 404, description: 'Announcement not found' })
    async getAnnouncement(@Param('id') id: string): Promise<SystemAnnouncementResponseDto> {
        return this.queryBus.execute(new GetSystemAnnouncementQuery(id));
    }

    @Post(':id/read')
    @UseGuards(JwtAuthGuard)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Mark announcement as read' })
    @ApiQuery({ name: 'dismiss', required: false, type: Boolean })
    @ApiResponse({ status: 201, description: 'Marked as read' })
    async markAsRead(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
        @Query('dismiss') dismiss?: boolean,
    ): Promise<void> {
        return this.commandBus.execute(
            new MarkAnnouncementReadCommand(user.userId, id, dismiss === true)
        );
    }

    // ─── Admin Endpoints ──────────────────────────────────────────────────────

    @Get('admin/all')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: list all announcements (paginated)' })
    @ApiResponse({ status: 200, type: [AdminSystemAnnouncementResponseDto] })
    async adminListAnnouncements(
        @Query() query: ListAllSystemAnnouncementsQueryDto,
    ) {
        return this.commandBus.execute(
            new ListAllSystemAnnouncementsCommand(query.page ?? 1, query.limit ?? 20, query.brandId),
        );
    }

    @Get('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: get a single announcement with all fields' })
    @ApiResponse({ status: 200, type: AdminSystemAnnouncementResponseDto })
    async adminGetById(@Param('id') id: string) {
        return this.commandBus.execute(new GetAdminSystemAnnouncementCommand(id));
    }

    @Post('admin')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: create announcement' })
    @ApiResponse({ status: 201, type: AdminSystemAnnouncementResponseDto })
    async adminCreate(
        @Body() dto: CreateSystemAnnouncementDto,
        @CurrentUser() user: CurrentUserData,
    ) {
        return this.commandBus.execute(
            new CreateSystemAnnouncementCommand(dto, user.userId),
        );
    }

    @Patch('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: update announcement' })
    @ApiResponse({ status: 200, type: AdminSystemAnnouncementResponseDto })
    async adminUpdate(
        @Param('id') id: string,
        @Body() dto: UpdateSystemAnnouncementDto,
        @CurrentUser() user: CurrentUserData,
    ) {
        return this.commandBus.execute(
            new UpdateSystemAnnouncementCommand(id, dto, user.userId),
        );
    }

    @Delete('admin/:id')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: delete announcement' })
    @ApiResponse({ status: 200 })
    async adminDelete(
        @Param('id') id: string,
        @CurrentUser() user: CurrentUserData,
    ) {
        return this.commandBus.execute(
            new DeleteSystemAnnouncementCommand(id, user.userId),
        );
    }

    @Post('admin/:id/publish')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Admin: publish or unpublish announcement' })
    @ApiQuery({ name: 'publish', required: false, type: Boolean, description: 'true to publish, false to unpublish' })
    @ApiResponse({ status: 200, type: AdminSystemAnnouncementResponseDto })
    async adminTogglePublish(
        @Param('id') id: string,
        @Query('publish') publish: string,
        @CurrentUser() user: CurrentUserData,
    ) {
        return this.commandBus.execute(
            new TogglePublishSystemAnnouncementCommand(id, publish !== 'false', user.userId),
        );
    }
}
