import { Controller, Get, Post, Delete, Body, Param, UseGuards, NotFoundException, Req } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiParam } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { ApplicationCategory } from '@prisma/client';
import { CreateParticipationInfoDto, ParticipationInfoResponseDto } from './dto/participation-info.dto';
import { UpsertParticipationInfoCommand, DeleteParticipationInfoCommand } from '../application/commands/participation-info.commands';
import { GetParticipationInfoQuery, ListParticipationInfoQuery } from '../application/queries/participation-info.queries';
import { Public } from '@shared/decorators/public.decorator';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS as MUTABLE_CONTENT_CACHE_PATTERNS } from '@shared/constants/cache-patterns';
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
import { CONTENT_WRITE_PERMISSIONS } from '../application/utils/program-content-access.util';

@ApiTags('Programs')
@Controller('programs/:programId/participation-info')
export class ProgramParticipationController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
    private readonly readPrisma: PrismaReadService,
  ) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard, AdminPermissionGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ScopedBy('program', 'programId')
  @RequiresProgramPermission([...CONTENT_WRITE_PERMISSIONS.programConfig])
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert participation info for a category' })
  @ApiResponse({ status: 201, type: ParticipationInfoResponseDto })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async upsert(
    @Param('programId') programId: string,
    @Body() dto: CreateParticipationInfoDto,
  ) {
    return this.commandBus.execute(new UpsertParticipationInfoCommand(programId, dto));
  }

  @Get()
  @Public()
  @ApiOperation({ summary: 'List all defined participation infos for a program' })
  @ApiResponse({ status: 200, type: [ParticipationInfoResponseDto] })
  async list(@Param('programId') programId: string) {
    return this.queryBus.execute(new ListParticipationInfoQuery(programId));
  }

  @Get(':category')
  @Public()
  @ApiOperation({ summary: 'Get specific participation info by category' })
  @ApiParam({ name: 'category', enum: ApplicationCategory })
  @ApiResponse({ status: 200, type: ParticipationInfoResponseDto })
  async get(
    @Param('programId') programId: string,
    @Param('category') category: ApplicationCategory,
  ) {
    const result = await this.queryBus.execute(new GetParticipationInfoQuery(programId, category));
    if (!result) throw new NotFoundException('Participation Info not found for this category');
    return result;
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Delete participation info' })
  @CacheInvalidate(MUTABLE_CONTENT_CACHE_PATTERNS)
  async delete(
    @Param('programId') programId: string,
    @Param('id') id: string,
    @Req() req: { user?: { adminId?: string } },
  ) {
    // The handler deletes by row id alone, so the scope check runs on the
    // row's own programme, not the route's.
    const notFound = () => new NotFoundException('Participation Info not found');
    const row = await this.readPrisma.programParticipationInfo.findUnique({
      where: { id },
      select: { programId: true },
    });
    if (!row) throw notFound();
    const scope = await getRequestAdminScope(this.readPrisma, req);
    await orNotFound(() => assertProgramAccess(this.readPrisma, scope, row.programId), notFound);
    if (scope.kind !== 'platform') {
      await assertProgramPermission(this.readPrisma, req.user, row.programId, CONTENT_WRITE_PERMISSIONS.programConfig);
    }

    return this.commandBus.execute(new DeleteParticipationInfoCommand(programId, id));
  }
}
