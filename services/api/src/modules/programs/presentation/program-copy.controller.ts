// services/api/src/modules/programs/presentation/program-copy.controller.ts
import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../brands/application/services/landing-cache-invalidation.service';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { CopyEntityDto, ApplyTemplateEntityDto } from './dto/copy-entity.dto';
import { CopyPreviewItem, CopyResult, PrismaTx, TemplatePayload } from '../application/copy/program-copier.interface';
import { invalidateLandingCacheByProgramId } from '../application/commands/handlers/manage-program-content.handlers';

@ApiTags('Program Content Copy')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ProgramCopyController {
  constructor(
    private readonly registry: ProgramCopierRegistry,
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
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

    const result = await this.prisma.$transaction((tx: unknown) =>
      copier.copy(tx as PrismaTx, {
        sourceProgramId: dto.sourceProgramId,
        targetProgramId: programId,
        itemIds: dto.itemIds,
        mode,
      }),
    );

    // @CacheInvalidate above only busts Redis-pattern caches; it cannot
    // delete brand_landing_snapshots rows. The public landing pages (e.g.
    // FAQs, via faqs.strategy.ts -> landing-snapshot.service.ts) read
    // through that DB-backed snapshot, so a copy into any content type it
    // covers would otherwise serve stale data until the snapshot's
    // freshness window lapses. Runs after the transaction has committed;
    // the helper swallows its own errors (non-critical), so a cache miss
    // here never fails the copy that already succeeded.
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);

    return result;
  }

  @Post(':programId/copy/:entityKey/apply-template')
  @ApiOperation({ summary: 'Apply a saved content template into this program (append or replace).' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async applyTemplate(
    @Param('programId') programId: string,
    @Param('entityKey') entityKey: string,
    @Body() dto: ApplyTemplateEntityDto,
  ): Promise<CopyResult> {
    const copier = this.registry.get(entityKey);
    const mode = dto.mode ?? 'append';

    const template = await this.prisma.contentTemplate.findFirst({ where: { id: dto.templateId, deletedAt: null } });
    if (!template) {
      throw new NotFoundException({ code: 'template_not_found', message: `Content template ${dto.templateId} not found.` });
    }
    if (template.entityType !== entityKey) {
      throw new BadRequestException({
        code: 'template_entity_mismatch',
        message: `Template ${dto.templateId} is a '${template.entityType}' template and cannot be applied through the '${entityKey}' route.`,
      });
    }
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({ code: 'confirm_required', message: "Replace mode requires 'confirm: true' in the request body." });
    }
    if (mode === 'append' && !copier.supportsAppend) {
      throw new BadRequestException({ code: 'append_not_supported', message: `'${entityKey}' only supports replace mode.` });
    }

    const result = await this.prisma.$transaction((tx: unknown) =>
      copier.applyTemplate(tx as PrismaTx, template.payload as unknown as TemplatePayload, programId, mode),
    );

    // Same reasoning as copy() — see that method's comment on why this runs
    // after commit rather than relying solely on @CacheInvalidate.
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);

    return result;
  }
}
