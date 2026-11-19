import {
  Controller, Get, Post, Put, Delete,
  Param, Body, Query, UseGuards, Request, NotFoundException,
} from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../../auth/infrastructure/guards/optional-jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { Public } from '../../../shared/decorators/public.decorator';
import { isAdminCaller } from './programs.controller';
import { AuditTrail } from '../../../shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { ChangeType } from '@prisma/client';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import {
  AdminScopeGuard,
  ScopedBy,
  assertProgramAccess,
  getRequestAdminScope,
  orNotFound,
} from '@shared/guards/admin-scope.guard';
import {
  AdminPermissionGuard,
  RequiresProgramPermission,
  assertProgramPermission,
} from '@shared/guards/admin-permission.guard';
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
  user: { id: string; userId: string; adminId?: string };
}

// Write-level twins of the dashboard's "announcements" menu rule
// (services/admin-dashboard/lib/admin-access.ts): announcements:read alone
// (Digital Marketing) may open the page but not change what participants see.
const ANNOUNCEMENT_WRITE_PERMISSIONS = ['announcements:write', 'content:write', 'program:write'];

@ApiTags('Program Announcements')
@Controller('programs')
export class ProgramAnnouncementsController {
  constructor(
    private readonly listHandler: ListProgramAnnouncementsHandler,
    private readonly getHandler: GetProgramAnnouncementHandler,
    private readonly createHandler: CreateProgramAnnouncementHandler,
    private readonly updateHandler: UpdateProgramAnnouncementHandler,
    private readonly deleteHandler: DeleteProgramAnnouncementHandler,
    private readonly readPrisma: PrismaReadService,
  ) {}

  /**
   * Announcement-keyed routes carry no programme id, so the owning programme is
   * read back from the row. Missing and out-of-scope raise the same 404.
   */
  private async assertAnnouncementScope(
    req: AuthenticatedRequest,
    itemId: string,
    requiredPermissions?: readonly string[],
  ): Promise<void> {
    const notFound = () => new NotFoundException(`Announcement ${itemId} not found`);
    const row = await this.readPrisma.programAnnouncement.findUnique({
      where: { id: itemId },
      select: { programId: true },
    });
    if (!row) throw notFound();
    const scope = await getRequestAdminScope(this.readPrisma, req);
    await orNotFound(() => assertProgramAccess(this.readPrisma, scope, row.programId), notFound);
    if (requiredPermissions && scope.kind !== 'platform') {
      await assertProgramPermission(this.readPrisma, req.user, row.programId, requiredPermissions);
    }
  }

  /** Admin (draft/scheduled/restricted) view only for a programme in the caller's scope. */
  private async isScopedAdminView(
    req: AuthenticatedRequest,
    user: CurrentUserData | undefined,
    programId: string,
  ): Promise<boolean> {
    if (!isAdminCaller(user)) return false;
    try {
      await assertProgramAccess(this.readPrisma, await getRequestAdminScope(this.readPrisma, req), programId);
      return true;
    } catch {
      // Out of scope (or missing): the caller gets the same public view an
      // anonymous visitor would, not an error.
      return false;
    }
  }

  @Get(':id/announcements')
  @Public()
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOperation({ summary: 'List program announcements' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'targetAudience', required: false })
  @ApiResponse({ status: 200, description: 'Paginated list of announcements' })
  async list(
    @Param('id') programId: string,
    @Query() query: ListProgramAnnouncementsQueryDto,
    @Request() req: AuthenticatedRequest,
    @CurrentUser() user?: CurrentUserData,
  ) {
    const isAdminView = await this.isScopedAdminView(req, user, programId);
    return this.listHandler.execute(
      new ListProgramAnnouncementsCommand(
        programId,
        query.category,
        query.targetAudience,
        query.page ?? 1,
        query.limit ?? 20,
        // Audit M14: OptionalJwtAuthGuard resolves an admin bearer token
        // without rejecting an absent/invalid one, so this route stays
        // @Public() for participants while still letting an admin see
        // draft/scheduled/audience-restricted announcements for management -
        // but only for a programme their scope covers.
        isAdminView,
      ),
    );
  }

  @Get('announcements/:itemId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a single program announcement' })
  @ApiResponse({ status: 200, type: ProgramAnnouncementResponseDto })
  async getOne(@Param('itemId') itemId: string, @Request() req: AuthenticatedRequest) {
    await this.assertAnnouncementScope(req, itemId);
    return this.getHandler.execute(new GetProgramAnnouncementCommand(itemId));
  }

  @Post(':id/announcements')
  @UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard, AdminPermissionGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ScopedBy('program', 'id')
  @RequiresProgramPermission(ANNOUNCEMENT_WRITE_PERMISSIONS, 'id')
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
    await this.assertAnnouncementScope(req, itemId, ANNOUNCEMENT_WRITE_PERMISSIONS);
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
    await this.assertAnnouncementScope(req, itemId, ANNOUNCEMENT_WRITE_PERMISSIONS);
    return this.deleteHandler.execute(
      new DeleteProgramAnnouncementCommand(itemId, req.user.id),
    );
  }
}
