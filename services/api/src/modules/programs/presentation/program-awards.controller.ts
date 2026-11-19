// services/api/src/modules/programs/presentation/program-awards.controller.ts
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { ChangeType, ProgramAward } from '@prisma/client';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { AdminScopeGuard, ScopedBy } from '@shared/guards/admin-scope.guard';
import { AdminPermissionGuard, RequiresProgramPermission } from '@shared/guards/admin-permission.guard';
import { CONTENT_WRITE_PERMISSIONS } from '../application/utils/program-content-access.util';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { CacheInvalidate } from '@shared/decorators/cache-invalidate.decorator';
// Awards render on the landing only (home + program landing); no portal read
// selects them, so the per-user portal:* keys stay intact.
import { PROGRAM_PUBLIC_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';
import { CreateProgramAwardDto, UpdateProgramAwardDto } from './dto/program-award.dto';
import {
  CreateProgramAwardCommand,
  DeleteProgramAwardCommand,
  ListProgramAwardsQuery,
  UpdateProgramAwardCommand,
} from '../application/commands/program-award.commands';
import {
  CreateProgramAwardHandler,
  DeleteProgramAwardHandler,
  ListProgramAwardsHandler,
  UpdateProgramAwardHandler,
} from '../application/commands/handlers/program-award.handlers';

@ApiTags('Program Awards')
@Controller('admin/programs/:programId/awards')
@UseGuards(JwtAuthGuard, RolesGuard, AdminScopeGuard, AdminPermissionGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
// Every route carries the program id in the URL and the handlers only ever
// write to that id, so the route-param scope check covers the whole controller.
@ScopedBy('program', 'programId')
@ApiBearerAuth()
export class ProgramAwardsController {
  constructor(
    private readonly listHandler: ListProgramAwardsHandler,
    private readonly createHandler: CreateProgramAwardHandler,
    private readonly updateHandler: UpdateProgramAwardHandler,
    private readonly deleteHandler: DeleteProgramAwardHandler,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List program awards (active and inactive, excluding deleted)' })
  list(@Param('programId', ParseUUIDPipe) programId: string): Promise<ProgramAward[]> {
    return this.listHandler.execute(new ListProgramAwardsQuery(programId));
  }

  @Post()
  @RequiresProgramPermission([...CONTENT_WRITE_PERMISSIONS.content])
  @AuditTrail({ entityType: 'ProgramAward', action: ChangeType.create })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  @ApiOperation({ summary: 'Create a program award' })
  create(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Body() dto: CreateProgramAwardDto,
  ): Promise<ProgramAward> {
    return this.createHandler.execute(new CreateProgramAwardCommand(programId, dto));
  }

  @Patch(':awardId')
  @RequiresProgramPermission([...CONTENT_WRITE_PERMISSIONS.content])
  @AuditTrail({ entityType: 'ProgramAward', action: ChangeType.update, idParam: 'awardId' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  @ApiOperation({ summary: 'Update a program award' })
  update(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('awardId', ParseUUIDPipe) awardId: string,
    @Body() dto: UpdateProgramAwardDto,
  ): Promise<ProgramAward> {
    return this.updateHandler.execute(new UpdateProgramAwardCommand(programId, awardId, dto));
  }

  @Delete(':awardId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequiresProgramPermission([...CONTENT_WRITE_PERMISSIONS.content])
  @AuditTrail({ entityType: 'ProgramAward', action: ChangeType.delete, idParam: 'awardId' })
  @CacheInvalidate(PROGRAM_PUBLIC_CONTENT_PATTERNS)
  @ApiOperation({ summary: 'Soft-delete a program award' })
  remove(
    @Param('programId', ParseUUIDPipe) programId: string,
    @Param('awardId', ParseUUIDPipe) awardId: string,
  ): Promise<void> {
    return this.deleteHandler.execute(new DeleteProgramAwardCommand(programId, awardId));
  }
}
