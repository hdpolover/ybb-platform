import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { Public } from '../../../shared/decorators/public.decorator';
import { AuditTrail } from '../../../shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { ChangeType } from '@prisma/client';
// imports unified PROGRAM_CONTENT_PATTERNS — broader than the previous local list, which was a subset
import { PROGRAM_CONTENT_PATTERNS as MUTABLE_CONTENT_CACHE_PATTERNS } from '@shared/constants/cache-patterns';

import {
  CreateProgramAnnouncementDto,
  UpdateProgramAnnouncementDto,
  ListProgramAnnouncementsQueryDto,
  ProgramAnnouncementResponseDto,
} from './dto/program-announcement.dto';

import {
  ListProgramAnnouncementsCommand,
  GetProgramAnnouncementCommand,
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
  DeleteProgramAnnouncementCommand,
} from '../application/commands/program-announcement.commands';

import {
  ListProgramAnnouncementsHandler,
  GetProgramAnnouncementHandler,
  CreateProgramAnnouncementHandler,
  UpdateProgramAnnouncementHandler,
  DeleteProgramAnnouncementHandler,
} from '../application/commands/handlers/manage-program-announcements.handler';

interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string };
}

@ApiTags('Program Announcements')
@Controller('programs')
export class ProgramAnnouncementsController {
  constructor(
    private readonly listHandler: ListProgramAnnouncementsHandler,
    private readonly getHandler: GetProgramAnnouncementHandler,
    private readonly createHandler: CreateProgramAnnouncementHandler,
    private readonly updateHandler: UpdateProgramAnnouncementHandler,
    private readonly deleteHandler: DeleteProgramAnnouncementHandler,
  ) {}

  @Get(':id/announcements')
  @Public()
  @ApiOperation({ summary: 'List program announcements' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'targetAudience', required: false })
  @ApiResponse({ status: 200, description: 'Paginated list of announcements' })
  async list(
    @Param('id') programId: string,
    @Query() query: ListProgramAnnouncementsQueryDto,
  ) {
    return this.listHandler.execute(
      new ListProgramAnnouncementsCommand(
        programId,
        query.category,
        query.targetAudience,
        query.page ?? 1,
        query.limit ?? 20,
      ),
    );
  }

  @Get('announcements/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single program announcement' })
  @ApiResponse({ status: 200, type: ProgramAnnouncementResponseDto })
  async getOne(@Param('itemId') itemId: string) {
    return this.getHandler.execute(new GetProgramAnnouncementCommand(itemId));
  }

  @Post(':id/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create program announcement' })
  @ApiResponse({ status: 201, type: ProgramAnnouncementResponseDto })
  @AuditTrail({ entityType: 'ProgramAnnouncement', action: ChangeType.create })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async create(
    @Param('id') programId: string,
    @Body() dto: CreateProgramAnnouncementDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.createHandler.execute(
      new CreateProgramAnnouncementCommand(programId, dto, req.user.id),
    );
  }

  @Put('announcements/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update program announcement' })
  @ApiResponse({ status: 200, type: ProgramAnnouncementResponseDto })
  @AuditTrail({ entityType: 'ProgramAnnouncement', action: ChangeType.update })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async update(
    @Param('itemId') itemId: string,
    @Body() dto: UpdateProgramAnnouncementDto,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.updateHandler.execute(
      new UpdateProgramAnnouncementCommand(itemId, dto, req.user.id),
    );
  }

  @Delete('announcements/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete program announcement' })
  @AuditTrail({ entityType: 'ProgramAnnouncement', action: ChangeType.delete })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async delete(
    @Param('itemId') itemId: string,
    @Request() req: AuthenticatedRequest,
  ) {
    return this.deleteHandler.execute(
      new DeleteProgramAnnouncementCommand(itemId, req.user.id),
    );
  }
}
