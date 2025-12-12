import { Controller, Get, Param, Post, UseGuards, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser } from '@shared/decorators/current-user.decorator';
import { ListSystemAnnouncementsQuery } from '../application/queries/list-system-announcements.query';
import { GetSystemAnnouncementQuery } from '../application/queries/get-system-announcement.query';
import { MarkAnnouncementReadCommand } from '../application/commands/mark-announcement-read.command';
import { SystemAnnouncementResponseDto } from './dto/system-announcement.dto';

@ApiTags('System')
@Controller('system/announcements')
export class SystemAnnouncementsController {
    constructor(
        private readonly queryBus: QueryBus,
        private readonly commandBus: CommandBus,
    ) { }

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
        @CurrentUser() user: any,
        @Query('dismiss') dismiss?: boolean,
    ): Promise<void> {
        return this.commandBus.execute(
            new MarkAnnouncementReadCommand(user.id, id, dismiss === true)
        );
    }
}
