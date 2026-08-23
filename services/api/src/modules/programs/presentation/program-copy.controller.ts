// services/api/src/modules/programs/presentation/program-copy.controller.ts
import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { CopyEntityDto } from './dto/copy-entity.dto';
import { CopyPreviewItem, CopyResult, PrismaTx } from '../application/copy/program-copier.interface';

@ApiTags('Program Content Copy')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ProgramCopyController {
  constructor(
    private readonly registry: ProgramCopierRegistry,
    private readonly prisma: PrismaService,
  ) {}

  @Get('copy/:entityKey/counts')
  @ApiOperation({ summary: 'Count how many items of one entity type each candidate source program has.' })
  async getCounts(
    @Param('entityKey') entityKey: string,
    @Query('programIds') programIds?: string,
  ): Promise<Array<{ programId: string; count: number }>> {
    const ids = (programIds ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return [];
    const copier = this.registry.get(entityKey);
    const counts = await Promise.all(ids.map((id) => copier.countFor(id)));
    return ids.map((programId, index) => ({ programId, count: counts[index] }));
  }

  @Get(':programId/copy/:entityKey/preview')
  @ApiOperation({ summary: 'Preview the copyable items of one entity type for a program.' })
  async preview(
    @Param('programId') programId: string,
    @Param('entityKey') entityKey: string,
  ): Promise<CopyPreviewItem[]> {
    const copier = this.registry.get(entityKey);
    return copier.preview(programId);
  }

  @Post(':programId/copy/:entityKey')
  @ApiOperation({ summary: 'Copy one entity type from another program into this program (append or replace).' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async copy(
    @Param('programId') programId: string,
    @Param('entityKey') entityKey: string,
    @Body() dto: CopyEntityDto,
  ): Promise<CopyResult> {
    const copier = this.registry.get(entityKey);
    const mode = dto.mode ?? 'append';

    if (dto.sourceProgramId === programId) {
      throw new BadRequestException({
        code: 'invalid_source',
        message: 'Source program must differ from the target program.',
      });
    }
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({
        code: 'confirm_required',
        message: "Replace mode requires 'confirm: true' in the request body.",
      });
    }
    if (mode === 'append' && !copier.supportsAppend) {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: `'${entityKey}' only supports replace mode.`,
      });
    }

    return this.prisma.$transaction((tx: unknown) =>
      copier.copy(tx as PrismaTx, {
        sourceProgramId: dto.sourceProgramId,
        targetProgramId: programId,
        itemIds: dto.itemIds,
        mode,
      }),
    );
  }
}
