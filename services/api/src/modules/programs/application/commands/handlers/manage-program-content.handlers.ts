import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { Prisma, PricingFeeType, ApplicationCategory, ProgramPricingTier, ProgramRequirement, PricingTierValidityPeriod } from '@prisma/client';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '../../../../../shared/constants/cache-keys';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { snapEarliestPeriodStart } from '@shared/utils/tier-period.util';
import {
    assertValidPeriodRange,
    assertNoDuplicatePeriod,
    findOverlappingPeriods,
    computeCoverageGap,
    ExistingValidityPeriod,
} from '../../validators/pricing-tier-validity-period.validator';
import {
    CreateProgramTimelineCommand, UpdateProgramTimelineCommand, DeleteProgramTimelineCommand,
    CreateProgramScheduleCommand, UpdateProgramScheduleCommand, DeleteProgramScheduleCommand,
    CreateProgramSpeakerCommand, UpdateProgramSpeakerCommand, DeleteProgramSpeakerCommand,
    CreateProgramGalleryCommand, UpdateProgramGalleryCommand, DeleteProgramGalleryCommand,
    CreateProgramTestimonialCommand, UpdateProgramTestimonialCommand, DeleteProgramTestimonialCommand,
    CreateProgramFaqCommand, UpdateProgramFaqCommand, DeleteProgramFaqCommand,
    CreateProgramTeamCommand, UpdateProgramTeamCommand, DeleteProgramTeamCommand,
    CreateProgramPartnerCommand, UpdateProgramPartnerCommand, DeleteProgramPartnerCommand,
    CreateProgramResourceCommand, UpdateProgramResourceCommand, DeleteProgramResourceCommand,
    CreateProgramPricingTierCommand, UpdateProgramPricingTierCommand, DeleteProgramPricingTierCommand,
    CreateValidityPeriodCommand, UpdateValidityPeriodCommand, DeleteValidityPeriodCommand,
    CreateProgramRequirementCommand, UpdateProgramRequirementCommand, DeleteProgramRequirementCommand,
    CreateProgramEssayCommand, UpdateProgramEssayCommand, DeleteProgramEssayCommand, UpdateProgramEssayGuidelinesCommand,
    CreateProgramParticipationCategoryCommand, UpdateProgramParticipationCategoryCommand, DeleteProgramParticipationCategoryCommand,
    CreateProgramSubthemeCommand, UpdateProgramSubthemeCommand, DeleteProgramSubthemeCommand,
    CreateDocumentTemplateCommand, UpdateDocumentTemplateCommand, DeleteDocumentTemplateCommand,
    UpdateProgramPaymentInfoCommand,
    UpdateProgramContactCommand,
    UpdateProgramPartnersCanvaUrlCommand,
    UpdateProgramLandingContentCommand,
} from '../program-content.commands';
import { PROGRAM_LANDING_CONTENT_KEYS, isProgramLandingContentKey } from '../../copy/program-landing-content.constants';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { assertProgramContentAccess } from '../../utils/program-content-access.util';
import { resolveRevenueAccessScope } from '@modules/stats/revenue/utils/revenue-access.util';
import { assertBrandAccess } from '@shared/guards/admin-scope.guard';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

// ─── Shared cache-invalidation helpers ───────────────────────────────────────
// Used by ~9 call sites (gallery, faq, document-template x3 each) plus the
// Group C content handlers below. Routed through the shared service so a
// revalidate hook only needs adding here once, instead of at every call site
// — see landing-cache-invalidation.service.ts for why that copy-paste is how
// gallery's missing snapshot-clear happened in the first place.
export async function invalidateLandingCacheByProgramId(
    programId: string,
    prisma: PrismaService,
    landingCacheInvalidation: LandingCacheInvalidationService,
): Promise<void> {
    try {
        const program = await prisma.program.findUnique({
            where: { id: programId },
            select: { brandId: true },
        });
        if (program?.brandId) {
            await landingCacheInvalidation.invalidate(program.brandId, {
                clearSnapshot: true,
                bustProgramCache: true,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });
        }
    } catch { /* non-critical */ }
}

/**
 * Testimonials are the one family that can be either program-scoped or a
 * general brand testimonial with no program at all (see the ProgramTestimonial
 * schema: both programId and brandId are nullable). Used for update/delete,
 * where the target row - not the request body - decides which check applies.
 */
async function assertProgramOrBrandContentAccess(
    prismaRead: PrismaReadService,
    actor: CurrentUserData,
    programId: string | null,
    brandId: string | null,
): Promise<void> {
    if (programId) {
        await assertProgramContentAccess(prismaRead, actor, programId);
        return;
    }
    if (brandId) {
        const scope = await resolveRevenueAccessScope(prismaRead, actor);
        assertBrandAccess(scope, brandId);
        return;
    }
    const scope = await resolveRevenueAccessScope(prismaRead, actor);
    if (scope.kind !== 'platform') {
        throw new ForbiddenException('You do not have access to this testimonial.');
    }
}

/**
 * Full cache invalidation for pricing tier / validity-period mutations.
 * Clears landing pages (brand-scoped) AND all enrolled-participant portal caches
 * (dashboard, payments, submission-detail) via wildcard to avoid a DB lookup of
 * all enrolled participants — accepted over-invalidation tradeoff.
 *
 * Also fires the Next.js frontend revalidation hook via the shared
 * LandingCacheInvalidationService. clearSnapshot/bustProgramCache are passed
 * false there because the Promise.all above already cleared the Postgres
 * snapshot and busted `program:*` directly — this call exists only to fire
 * `revalidate`, not to redo work already done a few lines up.
 */
async function invalidatePricingTierCachesByProgramId(
    programId: string,
    prisma: PrismaService,
    cacheService: CacheService,
    landingCacheInvalidation: LandingCacheInvalidationService,
): Promise<void> {
    try {
        const program = await prisma.program.findUnique({
            where: { id: programId },
            select: { brandId: true },
        });
        if (program?.brandId) {
            await Promise.all([
                prisma.brandLandingSnapshot.deleteMany({ where: { brandId: program.brandId } }),
                cacheService.invalidateBrandLandingCaches(program.brandId),
                cacheService.invalidateByPattern('program:*'),
                cacheService.invalidateByPattern('portal:dashboard:*'),
                cacheService.invalidateByPattern('portal:payments:*'),
                cacheService.invalidateByPattern('portal:submission-detail:*'),
            ]);
            await landingCacheInvalidation.invalidate(program.brandId, {
                clearSnapshot: false,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });
        }
    } catch { /* non-critical — cache failure must not break the mutation */ }
}

/**
 * Full cache invalidation for validity-period mutations where only a
 * pricingTierId is available (lookup walks tier → program → brandId).
 * See invalidatePricingTierCachesByProgramId above for why
 * clearSnapshot/bustProgramCache are false in the revalidation call.
 */
async function invalidatePricingTierCachesByPricingTierId(
    pricingTierId: string,
    prisma: PrismaService,
    cacheService: CacheService,
    landingCacheInvalidation: LandingCacheInvalidationService,
): Promise<void> {
    try {
        const tier = await prisma.programPricingTier.findUnique({
            where: { id: pricingTierId },
            select: { program: { select: { brandId: true } } },
        });
        if (tier?.program?.brandId) {
            await Promise.all([
                prisma.brandLandingSnapshot.deleteMany({ where: { brandId: tier.program.brandId } }),
                cacheService.invalidateBrandLandingCaches(tier.program.brandId),
                cacheService.invalidateByPattern('program:*'),
                cacheService.invalidateByPattern('portal:dashboard:*'),
                cacheService.invalidateByPattern('portal:payments:*'),
                cacheService.invalidateByPattern('portal:submission-detail:*'),
            ]);
            await landingCacheInvalidation.invalidate(tier.program.brandId, {
                clearSnapshot: false,
                bustProgramCache: false,
                swallowErrors: true,
                revalidate: { kind: 'homeAndSettings' },
            });
        }
    } catch { /* non-critical — cache failure must not break the mutation */ }
}

/**
 * Brand-scoped sibling of invalidateLandingCacheByProgramId, for mutations
 * that already know the brand and need no program lookup.
 *
 * This used to clear the snapshot and Redis inline, which is the copy-paste
 * the header comment above warns about: it never fired the revalidate hook,
 * so a testimonial edit busted the API caches but left the participant
 * frontend's Next.js unstable_cache to expire on its own TTL. Delegating to
 * the shared service keeps the third layer wired.
 */
async function invalidateLandingCacheByBrandId(
    brandId: string,
    landingCacheInvalidation: LandingCacheInvalidationService,
): Promise<void> {
    await landingCacheInvalidation.invalidate(brandId, {
        clearSnapshot: true,
        bustProgramCache: true,
        swallowErrors: true,
        revalidate: { kind: 'homeAndSettings' },
    });
}
async function invalidatePortalDocumentCaches(
    cacheService: CacheService,
): Promise<void> {
    try {
        // PORTAL_DOCUMENTS(userId) generates `portal:documents:{userId}`.
        // Wildcard invalidation clears all participants' cached document lists.
        await cacheService.invalidateByPattern('portal:documents:*');
    } catch { /* non-critical */ }
}

function toIsoOrNull(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
}

type ValidityPeriodWarnings = {
    overlappingPeriods: Array<{ id: string; startDate: string | null; endDate: string | null; description: string | null }>;
    coverageGap: { gapStart: string | null; gapEnd: string | null; daysUncovered: number } | null;
};

/**
 * Non-blocking diagnostics surfaced alongside a validity-period write so the
 * admin UI can flag data smells without refusing the save (see the validator
 * module for why overlap in particular must stay a warning, not an error —
 * a prod audit found 84 pre-existing overlapping pairs that a hard block
 * would have made un-editable).
 *
 * `excludePeriodId` is the row just written (create or update) — it already
 * exists in `tier.validityPeriods` by the time this runs, so it must be
 * excluded from the overlap comparison against itself.
 */
async function buildValidityPeriodWarnings(
    pricingTierId: string,
    repository: IProgramContentRepository,
    prisma: PrismaService,
    excludePeriodId: string,
): Promise<ValidityPeriodWarnings> {
    const tier = await repository.findPricingTierById(pricingTierId);
    const periods: ExistingValidityPeriod[] = tier?.validityPeriods ?? [];
    const written = periods.find((p) => p.id === excludePeriodId);

    const overlaps = written
        ? findOverlappingPeriods(written, periods, excludePeriodId)
        : [];

    let registrationCloseDate: Date | null = null;
    if (tier?.programId) {
        const program = await prisma.program.findUnique({
            where: { id: tier.programId },
            select: { registrationCloseDate: true },
        });
        registrationCloseDate = program?.registrationCloseDate ?? null;
    }
    const gap = computeCoverageGap(periods, new Date(), registrationCloseDate);

    return {
        overlappingPeriods: overlaps.map((p) => ({
            id: p.id,
            startDate: toIsoOrNull(p.startDate),
            endDate: toIsoOrNull(p.endDate),
            description: p.description ?? null,
        })),
        coverageGap: gap
            ? { gapStart: toIsoOrNull(gap.gapStart), gapEnd: toIsoOrNull(gap.gapEnd), daysUncovered: gap.daysUncovered }
            : null,
    };
}

async function invalidatePortalEssayCaches(
    programId: string,
    cacheService: CacheService,
): Promise<void> {
    try {
        await cacheService.invalidateByPatterns([
            CACHE_KEYS.PROGRAM_ESSAYS(programId),
            `portal:submission-detail:*:${programId}`,
            'portal:submission-detail:*:latest',
            `portal:submissions:*:${programId}`,
            'portal:submissions:*:latest',
            'portal:dashboard:*',
        ]);
    } catch { /* non-critical */ }
}

function normalizeEssayQuestion(value: string): string {
    return value.trim().replace(/\s+/g, ' ');
}

function isValidEssayQuestion(value: string): boolean {
    const normalized = normalizeEssayQuestion(value);
    if (!normalized) return false;

    const invalidPlaceholders = new Set(['-', '--', 'n/a', 'na', 'tbd', 'coming soon']);
    return !invalidPlaceholders.has(normalized.toLowerCase());
}

function assertValidEssayQuestion(value: string): string {
    if (!isValidEssayQuestion(value)) {
        throw new BadRequestException(
            'Essay question is invalid. Use a meaningful prompt instead of placeholders.',
        );
    }

    return normalizeEssayQuestion(value);
}

/**
 * Cache invalidation for program requirement mutations.
 * Clears landing pages, the specific PROGRAM_REQUIREMENTS HOUR-cached key,
 * and portal submission-detail pages where requirements are shown.
 */
async function invalidateRequirementCaches(
    programId: string,
    prisma: PrismaService,
    cacheService: CacheService,
): Promise<void> {
    try {
        const program = await prisma.program.findUnique({
            where: { id: programId },
            select: { brandId: true },
        });
        if (program?.brandId) {
            await Promise.all([
                cacheService.invalidateBrandLandingCaches(program.brandId),
                cacheService.invalidateByPattern('program:*'),
                cacheService.invalidateKey(CACHE_KEYS.PROGRAM_REQUIREMENTS(programId)),
                cacheService.invalidateByPattern('portal:submission-detail:*'),
            ]);
        }
    } catch { /* non-critical — cache failure must not break the mutation */ }
}

/**
 * Portal-only cache invalidation for program resource mutations (submission-detail
 * pages and the portal documents list, which show resources but aren't part of
 * the landing-page cache layers). ProgramResource IS landing-rendered too
 * (home.strategy.ts / programs.strategy.ts include the `resources` relation and
 * render it as guidelines/guidebooks) — that half is handled by a sibling call
 * to invalidateLandingCacheByProgramId at each call site, which also covers the
 * PROGRAM_RESOURCES HOUR-cached key (`program:resources:{id}`) via its
 * `program:*` wildcard bust, so it isn't duplicated here.
 */
async function invalidatePortalResourceCaches(
    cacheService: CacheService,
): Promise<void> {
    try {
        await cacheService.invalidateByPatterns([
            'portal:submission-detail:*',
            'portal:documents:*',
        ]);
    } catch { /* non-critical — cache failure must not break the mutation */ }
}
// ─────────────────────────────────────────────────────────────────────────────

// --- Timeline Handlers ---
@CommandHandler(CreateProgramTimelineCommand)
export class CreateProgramTimelineHandler implements ICommandHandler<CreateProgramTimelineCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        @Inject(IUserActivityLogRepository) private readonly activityLog: IUserActivityLogRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: CreateProgramTimelineCommand) {
        const dto = {
            ...command.dto,
            date: new Date(command.dto.date),
            endDate: command.dto.endDate ? new Date(command.dto.endDate) : undefined,
        };
        const result = await this.repository.createTimeline(dto);
        // Log activity here if needed
        if (result.programId) {
            await invalidateLandingCacheByProgramId(result.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(UpdateProgramTimelineCommand)
export class UpdateProgramTimelineHandler implements ICommandHandler<UpdateProgramTimelineCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: UpdateProgramTimelineCommand) {
        const dto = {
            ...command.dto,
            date: command.dto.date ? new Date(command.dto.date) : undefined,
            endDate: command.dto.endDate ? new Date(command.dto.endDate) : undefined,
        };
        const result = await this.repository.updateTimeline(command.id, dto);
        if (result.programId) {
            await invalidateLandingCacheByProgramId(result.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramTimelineCommand)
export class DeleteProgramTimelineHandler implements ICommandHandler<DeleteProgramTimelineCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: DeleteProgramTimelineCommand) {
        // deleteTimeline is a hard delete returning void — the row (and its
        // programId) would be unrecoverable after the fact, so read it first.
        const existing = await this.repository.findTimelineById(command.id);
        const result = await this.repository.deleteTimeline(command.id);
        if (existing?.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}

// --- Schedule Handlers ---
@CommandHandler(CreateProgramScheduleCommand)
export class CreateProgramScheduleHandler implements ICommandHandler<CreateProgramScheduleCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: CreateProgramScheduleCommand) {
        const result = await this.repository.createSchedule(command.dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(UpdateProgramScheduleCommand)
export class UpdateProgramScheduleHandler implements ICommandHandler<UpdateProgramScheduleCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: UpdateProgramScheduleCommand) {
        const result = await this.repository.updateSchedule(command.id, command.dto);
        if (result.programId) {
            await invalidateLandingCacheByProgramId(result.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramScheduleCommand)
export class DeleteProgramScheduleHandler implements ICommandHandler<DeleteProgramScheduleCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: DeleteProgramScheduleCommand) {
        // deleteSchedule is a hard delete returning void — read the row first
        // so its programId survives past the delete.
        const existing = await this.repository.findScheduleById(command.id);
        const result = await this.repository.deleteSchedule(command.id);
        if (existing?.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}

// --- Speaker Handlers ---
@CommandHandler(CreateProgramSpeakerCommand)
export class CreateProgramSpeakerHandler implements ICommandHandler<CreateProgramSpeakerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}
    async execute(command: CreateProgramSpeakerCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.brandId, // brandId
                'speakers',
                program.id
            );
            
            photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };
        return this.repository.createSpeaker(dto);
    }
}
@CommandHandler(UpdateProgramSpeakerCommand)
export class UpdateProgramSpeakerHandler implements ICommandHandler<UpdateProgramSpeakerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    async execute(command: UpdateProgramSpeakerCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            const speaker = await this.repository.findSpeakerById(command.id);
            if (!speaker) {
                throw new NotFoundException('Speaker not found');
            }

            const program = await this.prisma.program.findUnique({ where: { id: speaker.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.brandId, 
                'speakers',
                program.id
            );
            photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };

        return this.repository.updateSpeaker(command.id, dto);
    }
}
@CommandHandler(DeleteProgramSpeakerCommand)
export class DeleteProgramSpeakerHandler implements ICommandHandler<DeleteProgramSpeakerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramSpeakerCommand) {
        return this.repository.deleteSpeaker(command.id);
    }
}

// --- Gallery Handlers ---
@CommandHandler(CreateProgramGalleryCommand)
export class CreateProgramGalleryHandler implements ICommandHandler<CreateProgramGalleryCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: CreateProgramGalleryCommand) {
        // Asserted on dto.programId because that is the id createGallery writes.
        // The route also carries a program id, but the handler ignores it, so
        // checking the route param would authorise a different program than the
        // one the row lands on.
        await assertProgramContentAccess(this.prismaRead, command.actor, command.dto.programId);

        let imageUrl = command.dto.imageUrl;

        if (command.image) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.brandId,
                'gallery',
                program.id
            );
            imageUrl = result.url;
        }

        const dto = {
            ...command.dto,
            imageUrl: imageUrl || ''
        };
        const result = await this.repository.createGallery(dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(UpdateProgramGalleryCommand)
export class UpdateProgramGalleryHandler implements ICommandHandler<UpdateProgramGalleryCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: UpdateProgramGalleryCommand) {
        let imageUrl = command.dto.imageUrl;

        const galleryItem = await this.repository.findGalleryById(command.id);
        if (!galleryItem) {
            throw new NotFoundException('Gallery item not found');
        }
        if (!galleryItem.programId) {
            throw new NotFoundException('Program ID missing on gallery item');
        }

        // The parent program is resolved from the target row, so this costs no
        // extra query. The route carries only the item id - there is no program
        // id for a guard to check.
        await assertProgramContentAccess(this.prismaRead, command.actor, galleryItem.programId);

        if (command.image) {
            const program = await this.prisma.program.findUnique({ where: { id: galleryItem.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.brandId,
                'gallery',
                program.id
            );
            imageUrl = result.url;
        }

        const dto = {
            ...command.dto,
            imageUrl
        };
        const result = await this.repository.updateGallery(command.id, dto);
        await invalidateLandingCacheByProgramId(galleryItem.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(DeleteProgramGalleryCommand)
export class DeleteProgramGalleryHandler implements ICommandHandler<DeleteProgramGalleryCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: DeleteProgramGalleryCommand) {
        const existing = await this.repository.findGalleryById(command.id);
        if (!existing) {
            throw new NotFoundException('Gallery item not found');
        }
        if (!existing.programId) {
            throw new NotFoundException('Program ID missing on gallery item');
        }

        // Assert BEFORE deleting. This used to delete first and read programId
        // afterwards only to invalidate the cache, so the row was already gone
        // by the time anything knew which program it belonged to - there was no
        // point at which a check could have refused it.
        await assertProgramContentAccess(this.prismaRead, command.actor, existing.programId);

        const result = await this.repository.deleteGallery(command.id);
        await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}

// --- Testimonial Handlers ---
@CommandHandler(CreateProgramTestimonialCommand)
export class CreateProgramTestimonialHandler implements ICommandHandler<CreateProgramTestimonialCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: CreateProgramTestimonialCommand) {
        const { brandId, ...rest } = command.dto;
        const dto = {
            ...rest,
            brandId: brandId,
        };

        // Testimonials can be program-scoped (dto.programId) or a general
        // brand testimonial with no program at all (dto.brandId only, see
        // ProgramTestimonial.programId being nullable). Assert on whichever id
        // the row is actually going to carry - not assertBrandAccess for the
        // program case, for the same reason gallery avoids it (see
        // program-content-access.util.ts): 'assigned' scope never passes it,
        // which would lock out every program-scoped admin. For the brand-only
        // case there IS no program in play, so a brand-level grant is the
        // correct (and only meaningful) thing to require.
        if (dto.programId) {
            await assertProgramContentAccess(this.prismaRead, command.actor, dto.programId);
        } else if (brandId) {
            const scope = await resolveRevenueAccessScope(this.prismaRead, command.actor);
            assertBrandAccess(scope, brandId);
        } else {
            const scope = await resolveRevenueAccessScope(this.prismaRead, command.actor);
            if (scope.kind !== 'platform') {
                throw new ForbiddenException('You do not have access to create this testimonial.');
            }
        }

        const result = await this.repository.createTestimonial(dto);
        if (brandId) await invalidateLandingCacheByBrandId(brandId, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(UpdateProgramTestimonialCommand)
export class UpdateProgramTestimonialHandler implements ICommandHandler<UpdateProgramTestimonialCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: UpdateProgramTestimonialCommand) {
        // The route param carries no program id at all (PUT testimonials/:itemId),
        // so the target's scope must be resolved from the row BEFORE mutating -
        // asserting on the row read after the write would refuse nothing, since
        // the write already happened.
        const existing = await this.repository.findTestimonialById(command.id);
        if (!existing) {
            throw new NotFoundException('Testimonial not found');
        }
        await assertProgramOrBrandContentAccess(this.prismaRead, command.actor, existing.programId, existing.brandId);

        const result = await this.repository.updateTestimonial(command.id, command.dto);
        try {
            const testimonial = await this.prisma.programTestimonial.findUnique({
                where: { id: command.id },
                select: { brandId: true },
            });
            if (testimonial?.brandId) await invalidateLandingCacheByBrandId(testimonial.brandId, this.landingCacheInvalidation);
        } catch { /* non-critical */ }
        return result;
    }
}
@CommandHandler(DeleteProgramTestimonialCommand)
export class DeleteProgramTestimonialHandler implements ICommandHandler<DeleteProgramTestimonialCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: DeleteProgramTestimonialCommand) {
        const existing = await this.repository.findTestimonialById(command.id);
        if (!existing) {
            throw new NotFoundException('Testimonial not found');
        }
        // Assert BEFORE deleting - see UpdateProgramTestimonialHandler above.
        await assertProgramOrBrandContentAccess(this.prismaRead, command.actor, existing.programId, existing.brandId);

        const testimonial = await this.prisma.programTestimonial.findUnique({
            where: { id: command.id },
            select: { brandId: true },
        });
        const result = await this.repository.deleteTestimonial(command.id);
        if (testimonial?.brandId) await invalidateLandingCacheByBrandId(testimonial.brandId, this.landingCacheInvalidation);
        return result;
    }
}

// --- FAQ Handlers ---
@CommandHandler(CreateProgramFaqCommand)
export class CreateProgramFaqHandler implements ICommandHandler<CreateProgramFaqCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: CreateProgramFaqCommand) {
        // Asserted on dto.programId because that is the id createFaq writes -
        // see addGallery's note in the controller for why the route param is
        // not used instead.
        await assertProgramContentAccess(this.prismaRead, command.actor, command.dto.programId);

        const result = await this.repository.createFaq(command.dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(UpdateProgramFaqCommand)
export class UpdateProgramFaqHandler implements ICommandHandler<UpdateProgramFaqCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: UpdateProgramFaqCommand) {
        const existing = await this.repository.findFaqById(command.id);
        if (!existing) {
            throw new NotFoundException('FAQ not found');
        }
        // The parent program is resolved from the target row, so this costs no
        // extra query. The route carries only the item id (PUT faqs/:itemId).
        await assertProgramContentAccess(this.prismaRead, command.actor, existing.programId);

        const result = await this.repository.updateFaq(command.id, command.dto);
        await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(DeleteProgramFaqCommand)
export class DeleteProgramFaqHandler implements ICommandHandler<DeleteProgramFaqCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: DeleteProgramFaqCommand) {
        const existing = await this.repository.findFaqById(command.id);
        if (!existing) {
            throw new NotFoundException('FAQ not found');
        }
        // Assert BEFORE deleting - same ordering fix as gallery's delete.
        await assertProgramContentAccess(this.prismaRead, command.actor, existing.programId);

        const result = await this.repository.deleteFaq(command.id);
        await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}

// --- Team Handlers ---
@CommandHandler(CreateProgramTeamCommand)
export class CreateProgramTeamHandler implements ICommandHandler<CreateProgramTeamCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}
    async execute(command: CreateProgramTeamCommand) {
        let photoUrl = command.dto.photoUrl;
        const { brandId, ...restDto } = command.dto;

        if (command.image) {
            let activeBrandId;
            if (command.dto.programId) {
                const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
                activeBrandId = program?.brandId;
            } else if (brandId) {
                activeBrandId = brandId;
            }

            if (!activeBrandId) {
                 throw new NotFoundException('Program or Brand ID required');
            }

             const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                activeBrandId, 
                'team',
                command.dto.programId
            );
             photoUrl = result.url;
        }

        const dto = {
            ...restDto,
            brandId: brandId,
            photoUrl
        };
        return this.repository.createTeam(dto);
    }
}
@CommandHandler(UpdateProgramTeamCommand)
export class UpdateProgramTeamHandler implements ICommandHandler<UpdateProgramTeamCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
    ) {}

    async execute(command: UpdateProgramTeamCommand) {
        let photoUrl = command.dto.photoUrl;

        if (command.image) {
            const teamMember = await this.repository.findTeamById(command.id);
            if (!teamMember) {
                throw new NotFoundException('Team member not found');
            }
            
            if (!teamMember.programId) {
                throw new NotFoundException('Program ID missing on team member');
            }

            const program = await this.prisma.program.findUnique({ where: { id: teamMember.programId } });
             if (!program) {
                throw new NotFoundException('Program not found');
            }
            
            const result = await this.storageService.uploadFile(
                command.image,
                command.userId,
                program.brandId, 
                'team',
                program.id
            );
            photoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            photoUrl
        };
        return this.repository.updateTeam(command.id, dto);
    }
}
@CommandHandler(DeleteProgramTeamCommand)
export class DeleteProgramTeamHandler implements ICommandHandler<DeleteProgramTeamCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramTeamCommand) {
        return this.repository.deleteTeam(command.id);
    }
}

// --- Partner Handlers ---
@CommandHandler(CreateProgramPartnerCommand)
export class CreateProgramPartnerHandler implements ICommandHandler<CreateProgramPartnerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: CreateProgramPartnerCommand) {
         let logoUrl = command.dto.logoUrl;

         if (command.logo) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }

             const result = await this.storageService.uploadFile(
                command.logo,
                command.userId,
                program.brandId,
                'partners',
                program.id
            );
            logoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            logoUrl
        };
        const result = await this.repository.createPartner(dto);
        if (result.programId) {
            await invalidateLandingCacheByProgramId(result.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(UpdateProgramPartnerCommand)
export class UpdateProgramPartnerHandler implements ICommandHandler<UpdateProgramPartnerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramPartnerCommand) {
        let logoUrl = command.dto.logoUrl;

        if (command.logo) {
            const partner = await this.repository.findPartnerById(command.id);
            if (!partner) {
                throw new NotFoundException('Partner not found');
            }

            if (!partner.programId) {
                throw new NotFoundException('Program ID missing on partner');
            }

            const program = await this.prisma.program.findUnique({ where: { id: partner.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }

             const result = await this.storageService.uploadFile(
                command.logo,
                command.userId,
                program.brandId, 
                'partners',
                program.id
            );
            logoUrl = result.url;
        }

        const dto = {
            ...command.dto,
            logoUrl
        };
        const result = await this.repository.updatePartner(command.id, dto);
        if (result.programId) {
            await invalidateLandingCacheByProgramId(result.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramPartnerCommand)
export class DeleteProgramPartnerHandler implements ICommandHandler<DeleteProgramPartnerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: DeleteProgramPartnerCommand) {
        // deletePartner is a hard delete returning void — read the row first
        // so its programId survives past the delete.
        const existing = await this.repository.findPartnerById(command.id);
        const result = await this.repository.deletePartner(command.id);
        if (existing?.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}

// --- Resource Handlers ---
@CommandHandler(CreateProgramResourceCommand)
export class CreateProgramResourceHandler implements ICommandHandler<CreateProgramResourceCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: CreateProgramResourceCommand) {
        // Asserted on dto.programId - the id createResource writes - before any
        // upload happens, same reasoning as addGallery in the controller.
        await assertProgramContentAccess(this.prismaRead, command.actor, command.dto.programId);

        const sourceType = command.dto.sourceType ?? 'upload';
        let fileUrl = command.dto.fileUrl;
        let fileSize: number | undefined = command.dto.fileSize;
        let fileType = command.dto.fileType;

        if (command.file) {
            const program = await this.prisma.program.findUnique({ where: { id: command.dto.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }

            const brandId = program.brandId;

            const result = await this.storageService.uploadFile(
                command.file,
                command.userId,
                brandId,
                'resources',
                program.id
            );

            fileUrl = result.url;
            fileSize = command.file.size;
            fileType = command.file.mimetype;
        }

        if (sourceType === 'link') {
            if (!command.dto.linkUrl) {
                throw new BadRequestException('linkUrl is required when sourceType is "link"');
            }
        } else {
            if (!fileUrl) {
                throw new BadRequestException('fileUrl is required when sourceType is "upload"');
            }
        }

        const dto = {
            ...command.dto,
            sourceType,
            fileUrl: sourceType === 'link' ? null : fileUrl,
            fileSize: sourceType === 'link' ? null : (fileSize ? BigInt(fileSize) : undefined),
            fileType: sourceType === 'link' ? null : fileType,
            linkUrl: sourceType === 'link' ? command.dto.linkUrl : null,
        };
        const result = await this.repository.createResource(dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.landingCacheInvalidation);
        await invalidatePortalResourceCaches(this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramResourceCommand)
export class UpdateProgramResourceHandler implements ICommandHandler<UpdateProgramResourceCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}

    async execute(command: UpdateProgramResourceCommand) {
        const resource = await this.repository.findResourceById(command.id);
        if (!resource) {
            throw new NotFoundException('Resource not found');
        }
        if (!resource.programId) {
            throw new NotFoundException('Program ID missing on resource');
        }
        // Resolved from the target row - the route (PUT resources/:itemId)
        // carries only the item id.
        await assertProgramContentAccess(this.prismaRead, command.actor, resource.programId);

        const sourceType = command.dto.sourceType ?? resource.sourceType ?? 'upload';
        let fileUrl = command.dto.fileUrl;
        let fileSize: number | undefined = command.dto.fileSize;
        let fileType = command.dto.fileType;

        if (command.file) {
            const program = await this.prisma.program.findUnique({ where: { id: resource.programId } });
            if (!program) {
                throw new NotFoundException('Program not found');
            }

            const result = await this.storageService.uploadFile(
                command.file,
                command.userId,
                program.brandId,
                'resources',
                program.id
            );

            fileUrl = result.url;
            fileSize = command.file.size;
            fileType = command.file.mimetype;
        }

        if (sourceType === 'link') {
            const resolvedLinkUrl = command.dto.linkUrl ?? resource.linkUrl;
            if (!resolvedLinkUrl) {
                throw new BadRequestException('linkUrl is required when sourceType is "link"');
            }
            const dto = {
                ...command.dto,
                sourceType,
                linkUrl: resolvedLinkUrl,
                fileUrl: resource.fileUrl,
                fileSize: null,
                fileType: null,
            };
            const result = await this.repository.updateResource(command.id, dto);
            await invalidateLandingCacheByProgramId(resource.programId, this.prisma, this.landingCacheInvalidation);
            await invalidatePortalResourceCaches(this.cacheService);
            return result;
        }

        // upload mode
        const resolvedFileUrl = fileUrl ?? resource.fileUrl;
        if (!resolvedFileUrl) {
            throw new BadRequestException('fileUrl is required when sourceType is "upload"');
        }
        const dto = {
            ...command.dto,
            sourceType,
            fileUrl: resolvedFileUrl,
            fileType: fileType ?? resource.fileType,
            fileSize: fileSize ? BigInt(fileSize) : resource.fileSize,
            linkUrl: resource.linkUrl,
        };
        const result = await this.repository.updateResource(command.id, dto);
        await invalidateLandingCacheByProgramId(resource.programId, this.prisma, this.landingCacheInvalidation);
        await invalidatePortalResourceCaches(this.cacheService);
        return result;
    }
}
@CommandHandler(DeleteProgramResourceCommand)
export class DeleteProgramResourceHandler implements ICommandHandler<DeleteProgramResourceCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}
    async execute(command: DeleteProgramResourceCommand) {
        // deleteResource is a hard delete returning void — the row (and its
        // programId) would be unrecoverable after the fact, so read it first.
        // Also lets the scope check run BEFORE the delete, not after.
        const existing = await this.repository.findResourceById(command.id);
        if (!existing) {
            throw new NotFoundException('Resource not found');
        }
        if (existing.programId) {
            await assertProgramContentAccess(this.prismaRead, command.actor, existing.programId);
        }

        const result = await this.repository.deleteResource(command.id);
        if (existing.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
            await invalidatePortalResourceCaches(this.cacheService);
        }
        return result;
    }
}

// --- Pricing Tier Handlers ---
@CommandHandler(CreateProgramPricingTierCommand)
export class CreateProgramPricingTierHandler implements ICommandHandler<CreateProgramPricingTierCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: CreateProgramPricingTierCommand) {
        // Validation: Ensure uniqueness of active registration fee tier per category
        if (command.dto.feeType === 'registration_fee' && command.dto.allowedCategories && command.dto.allowedCategories.length > 0) {
            const existingTiers = await this.repository.findPricingTiersByProgramId(command.dto.programId);
             for (const category of command.dto.allowedCategories) {
                 const hasConflict = existingTiers.some(tier =>
                     tier.isActive &&
                     !tier.deletedAt &&
                     tier.feeType === 'registration_fee' &&
                     tier.allowedCategories &&
                     (tier.allowedCategories as unknown as string[]).includes(category)
                 );
                 if (hasConflict) {
                     throw new BadRequestException(`Active registration fee tier already exists for category ${category}`);
                 }
             }
        }

        // Defense-in-depth validation on the new canonical price fields
        // (DTO already validates these; keep checks here in case a caller bypasses the DTO layer).
        if (typeof command.dto.usdPrice !== 'number' || command.dto.usdPrice <= 0) {
            throw new BadRequestException('usdPrice must be a positive number');
        }
        if (!Number.isInteger(command.dto.idrPrice) || command.dto.idrPrice <= 0) {
            throw new BadRequestException('idrPrice must be a positive integer');
        }

        const { feeType, allowedCategories, validFrom, validUntil, price: _legacyPrice, currency: _legacyCurrency, usdPrice, idrPrice, ...rest } = command.dto;

        // Derive transitional legacy fields from the new canonical USD price so any
        // code path still reading `price`/`currency` sees a coherent value until the
        // legacy columns are dropped in Phase 5.
        const dto = {
            ...rest,
            usdPrice: new Prisma.Decimal(usdPrice),
            idrPrice: new Prisma.Decimal(idrPrice),
            price: new Prisma.Decimal(usdPrice),
            currency: 'USD',
            feeType: feeType ? feeType as PricingFeeType : undefined,
            allowedCategories: allowedCategories
                ? allowedCategories.map(c => c as ApplicationCategory)
                : undefined,
        };
        const result = await this.repository.createPricingTier(dto as unknown as Partial<ProgramPricingTier>);

        // Auto-create initial validity period from validFrom/validUntil if provided.
        // This is the nested write path: a brand-new tier has no sibling periods yet,
        // so only the range check applies here (duplicate/overlap need >=2 periods).
        let warnings: ValidityPeriodWarnings | null = null;
        if (validFrom && validUntil) {
            // Brand-new tier: this nested period is always the tier's only (and
            // therefore earliest) period, so it always gets pinned to WIB
            // start-of-day — see snapEarliestPeriodStart.
            const startDate = snapEarliestPeriodStart(new Date(validFrom), []);
            const endDate = new Date(validUntil);
            assertValidPeriodRange(startDate, endDate);
            const period = await this.repository.createValidityPeriod({
                pricingTierId: result.id,
                startDate,
                endDate,
                description: 'Default period',
            });
            warnings = await buildValidityPeriodWarnings(result.id, this.repository, this.prisma, period.id);
        }

        await invalidatePricingTierCachesByProgramId(command.dto.programId, this.prisma, this.cacheService, this.landingCacheInvalidation);
        return { ...result, warnings };
    }
}
@CommandHandler(UpdateProgramPricingTierCommand)
export class UpdateProgramPricingTierHandler implements ICommandHandler<UpdateProgramPricingTierCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: UpdateProgramPricingTierCommand) {
        // Fetch existing tier to check validation
        const existingTier = await this.repository.findPricingTierById(command.id);
        if (!existingTier) {
             throw new NotFoundException(`Pricing tier ${command.id} not found`);
        }

        const targetFeeType = command.dto.feeType || existingTier.feeType;
        const targetCategories = command.dto.allowedCategories || (existingTier.allowedCategories as unknown as string[]);
        const targetIsActive = command.dto.isActive !== undefined ? command.dto.isActive : existingTier.isActive;

        // Validation: Ensure uniqueness of active registration fee tier per category
        if (targetIsActive && targetFeeType === 'registration_fee' && targetCategories && targetCategories.length > 0) {
             const existingTiers = await this.repository.findPricingTiersByProgramId(existingTier.programId);
             
             for (const category of targetCategories) {
                 const hasConflict = existingTiers.some(tier => 
                     tier.id !== command.id && // Exclude self
                     tier.isActive && 
                     !tier.deletedAt && 
                     tier.feeType === 'registration_fee' &&
                     tier.allowedCategories &&
                     (tier.allowedCategories as unknown as string[]).includes(category)
                 );
                 if (hasConflict) {
                     throw new BadRequestException(`Active registration fee tier already exists for category ${category}`);
                 }
             }
        }

        // Defense-in-depth validation on the new canonical price fields when present
        if (command.dto.usdPrice !== undefined) {
            if (typeof command.dto.usdPrice !== 'number' || command.dto.usdPrice <= 0) {
                throw new BadRequestException('usdPrice must be a positive number');
            }
        }
        if (command.dto.idrPrice !== undefined) {
            if (!Number.isInteger(command.dto.idrPrice) || command.dto.idrPrice <= 0) {
                throw new BadRequestException('idrPrice must be a positive integer');
            }
        }

        // validFrom/validUntil are not fields on ProgramPricingTier — managed via PricingTierValidityPeriod
        // Drop legacy `price`/`currency` from rest — they are derived from usdPrice when usdPrice changes.
        const {
            feeType,
            allowedCategories,
            validFrom: _vf,
            validUntil: _vu,
            price: _legacyPrice,
            currency: _legacyCurrency,
            usdPrice,
            idrPrice,
            ...rest
        } = command.dto;

        const dto: Record<string, unknown> = {
            ...rest,
            feeType: feeType ? feeType as PricingFeeType : undefined,
            allowedCategories: allowedCategories
                ? allowedCategories.map(c => c as ApplicationCategory)
                : undefined,
        };

        // When usdPrice is provided, also sync the legacy `price`/`currency` columns so
        // any code path still reading them stays consistent until they are dropped.
        if (usdPrice !== undefined) {
            dto.usdPrice = new Prisma.Decimal(usdPrice);
            dto.price = new Prisma.Decimal(usdPrice);
            dto.currency = 'USD';
        }
        if (idrPrice !== undefined) {
            dto.idrPrice = new Prisma.Decimal(idrPrice);
        }

        const result = await this.repository.updatePricingTier(command.id, dto as unknown as Partial<ProgramPricingTier>);
        await invalidatePricingTierCachesByProgramId(existingTier.programId, this.prisma, this.cacheService, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(DeleteProgramPricingTierCommand)
export class DeleteProgramPricingTierHandler implements ICommandHandler<DeleteProgramPricingTierCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: DeleteProgramPricingTierCommand) {
        const existing = await this.repository.findPricingTierById(command.id);
        const result = await this.repository.deletePricingTier(command.id);
        if (existing?.programId) {
            await invalidatePricingTierCachesByProgramId(existing.programId, this.prisma, this.cacheService, this.landingCacheInvalidation);
        }
        return result;
    }
}

// --- Validity Period Handlers ---
@CommandHandler(CreateValidityPeriodCommand)
export class CreateValidityPeriodHandler implements ICommandHandler<CreateValidityPeriodCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: CreateValidityPeriodCommand) {
        const pricingTierId = command.dto.pricingTierId!;
        const rawStartDate = new Date(command.dto.startDate);
        const endDate = new Date(command.dto.endDate);

        // Hard errors — see pricing-tier-validity-period.validator.ts for the
        // prod incidents each one closes off. Checked against exactly what was
        // typed, before any start-of-day snapping below, so a genuinely
        // zero-length/inverted or byte-identical-retry submission still gets
        // caught even when it would otherwise be "fixed" into a valid range by
        // widening its start.
        assertValidPeriodRange(rawStartDate, endDate);
        const existingTier = await this.repository.findPricingTierById(pricingTierId);
        const siblings = existingTier?.validityPeriods ?? [];
        assertNoDuplicatePeriod({ startDate: rawStartDate, endDate }, siblings);

        // If nothing else on the tier starts earlier, this new period becomes
        // the earliest — pin it to WIB start-of-day. Otherwise it is a chained
        // continuation and its start is left exactly as entered.
        const startDate = snapEarliestPeriodStart(rawStartDate, siblings.map((p) => p.startDate));

        const dto = {
            pricingTierId,
            startDate,
            endDate,
            description: command.dto.description,
        };
        const result = await this.repository.createValidityPeriod(dto as Partial<PricingTierValidityPeriod>);
        await invalidatePricingTierCachesByPricingTierId(pricingTierId, this.prisma, this.cacheService, this.landingCacheInvalidation);
        const warnings = await buildValidityPeriodWarnings(pricingTierId, this.repository, this.prisma, result.id);
        return {
            ...result,
            startDate: toIsoOrNull(result.startDate),
            endDate: toIsoOrNull(result.endDate),
            createdAt: toIsoOrNull((result as { createdAt?: unknown }).createdAt),
            updatedAt: toIsoOrNull((result as { updatedAt?: unknown }).updatedAt),
            warnings,
        };
    }
}
@CommandHandler(UpdateValidityPeriodCommand)
export class UpdateValidityPeriodHandler implements ICommandHandler<UpdateValidityPeriodCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: UpdateValidityPeriodCommand) {
        const existing = await this.repository.findValidityPeriodById(command.id);
        if (!existing) throw new NotFoundException(`Validity period ${command.id} not found`);

        const rawStartDate = command.dto.startDate ? new Date(command.dto.startDate) : existing.startDate;
        const endDate = command.dto.endDate ? new Date(command.dto.endDate) : existing.endDate;

        // Hard errors — see pricing-tier-validity-period.validator.ts for the
        // prod incidents each one closes off. Checked against exactly what was
        // typed (before any start-of-day snapping below) and excludes this row
        // from its own duplicate check so e.g. an unrelated description-only
        // edit doesn't trip over comparing the row against itself.
        assertValidPeriodRange(rawStartDate, endDate);
        const existingTier = await this.repository.findPricingTierById(existing.pricingTierId);
        const siblings = (existingTier?.validityPeriods ?? []).filter((p) => p.id !== command.id);
        assertNoDuplicatePeriod({ startDate: rawStartDate, endDate }, siblings);

        // Only re-pin the start when it's actually being changed — and only if
        // that still leaves this as the tier's earliest period (see
        // snapEarliestPeriodStart). A description-only edit, or an edit to a
        // chained continuation, leaves the stored start untouched.
        const startDate = command.dto.startDate
            ? snapEarliestPeriodStart(rawStartDate, siblings.map((p) => p.startDate))
            : existing.startDate;

        const dto = {
            startDate: command.dto.startDate ? startDate : undefined,
            endDate: command.dto.endDate ? endDate : undefined,
            description: command.dto.description,
        };
        const result = await this.repository.updateValidityPeriod(command.id, dto as Partial<PricingTierValidityPeriod>);
        await invalidatePricingTierCachesByPricingTierId(existing.pricingTierId, this.prisma, this.cacheService, this.landingCacheInvalidation);
        const warnings = await buildValidityPeriodWarnings(existing.pricingTierId, this.repository, this.prisma, command.id);
        return {
            ...result,
            startDate: toIsoOrNull(result.startDate),
            endDate: toIsoOrNull(result.endDate),
            createdAt: toIsoOrNull((result as { createdAt?: unknown }).createdAt),
            updatedAt: toIsoOrNull((result as { updatedAt?: unknown }).updatedAt),
            warnings,
        };
    }
}
@CommandHandler(DeleteValidityPeriodCommand)
export class DeleteValidityPeriodHandler implements ICommandHandler<DeleteValidityPeriodCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: DeleteValidityPeriodCommand) {
        const existing = await this.repository.findValidityPeriodById(command.id);
        const result = await this.repository.deleteValidityPeriod(command.id);
        if (existing?.pricingTierId) {
            await invalidatePricingTierCachesByPricingTierId(existing.pricingTierId, this.prisma, this.cacheService, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(CreateProgramRequirementCommand)
export class CreateProgramRequirementHandler implements ICommandHandler<CreateProgramRequirementCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: CreateProgramRequirementCommand) {
        const result = await this.repository.createRequirement(command.dto as Partial<ProgramRequirement>);
        await invalidateRequirementCaches(command.dto.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramRequirementCommand)
export class UpdateProgramRequirementHandler implements ICommandHandler<UpdateProgramRequirementCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: UpdateProgramRequirementCommand) {
        const existing = await this.repository.findRequirementById(command.id);
        const result = await this.repository.updateRequirement(command.id, command.dto as Partial<ProgramRequirement>);
        const programId = existing?.programId ?? result.programId;
        if (programId) {
            await invalidateRequirementCaches(programId, this.prisma, this.cacheService);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramRequirementCommand)
export class DeleteProgramRequirementHandler implements ICommandHandler<DeleteProgramRequirementCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramRequirementCommand) {
        const existing = await this.repository.findRequirementById(command.id);
        await this.repository.deleteRequirement(command.id);
        if (existing?.programId) {
            await invalidateRequirementCaches(existing.programId, this.prisma, this.cacheService);
        }
    }
}

// --- Essay Handlers ---
@CommandHandler(CreateProgramEssayCommand)
export class CreateProgramEssayHandler implements ICommandHandler<CreateProgramEssayCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: CreateProgramEssayCommand) {
        const result = await this.repository.createEssay({
            ...command.dto,
            question: assertValidEssayQuestion(command.dto.question),
            allowedCategories: command.dto.allowedCategories?.map((c) => c as ApplicationCategory),
        });
        await invalidatePortalEssayCaches(command.dto.programId, this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramEssayCommand)
export class UpdateProgramEssayHandler implements ICommandHandler<UpdateProgramEssayCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: UpdateProgramEssayCommand) {
        const existingEssay = await this.repository.findEssayById(command.id);
        const { allowedCategories, ...restDto } = command.dto;
        const result = await this.repository.updateEssay(command.id, {
            ...restDto,
            ...(typeof command.dto.question === 'string'
                ? { question: assertValidEssayQuestion(command.dto.question) }
                : {}),
            ...(allowedCategories ? { allowedCategories: allowedCategories.map((c) => c as ApplicationCategory) } : {}),
        });
        const programId = existingEssay?.programId ?? result.programId;
        if (programId) {
            await invalidatePortalEssayCaches(programId, this.cacheService);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramEssayCommand)
export class DeleteProgramEssayHandler implements ICommandHandler<DeleteProgramEssayCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramEssayCommand) {
        const existingEssay = await this.repository.findEssayById(command.id);
        await this.repository.deleteEssay(command.id);
        if (existingEssay?.programId) {
            await invalidatePortalEssayCaches(existingEssay.programId, this.cacheService);
        }
    }
}
@CommandHandler(UpdateProgramEssayGuidelinesCommand)
export class UpdateProgramEssayGuidelinesHandler implements ICommandHandler<UpdateProgramEssayGuidelinesCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: UpdateProgramEssayGuidelinesCommand) {
        const byId = await this.programRepository.findById(command.programId);
        const program = byId ?? await this.programRepository.findBySlug(command.programId);
        if (!program) {
            throw new NotFoundException(`Program with identifier ${command.programId} not found`);
        }

        await this.programRepository.update(program.id, {
            essayGuidelineText: command.dto.guidelineText?.trim() || null,
            essayGuidelineUrl: command.dto.guidelineUrl?.trim() || null,
        });
        await invalidatePortalEssayCaches(program.id, this.cacheService);

        return {
            guidelineText: command.dto.guidelineText?.trim() || undefined,
            guidelineUrl: command.dto.guidelineUrl?.trim() || undefined,
        };
    }
}

// --- Participation Category Handlers ---
@CommandHandler(CreateProgramParticipationCategoryCommand)
export class CreateProgramParticipationCategoryHandler implements ICommandHandler<CreateProgramParticipationCategoryCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramParticipationCategoryCommand) {
        return this.repository.createParticipationCategory(command.dto);
    }
}
@CommandHandler(UpdateProgramParticipationCategoryCommand)
export class UpdateProgramParticipationCategoryHandler implements ICommandHandler<UpdateProgramParticipationCategoryCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramParticipationCategoryCommand) {
        return this.repository.updateParticipationCategory(command.categoryId, command.dto);
    }
}
@CommandHandler(DeleteProgramParticipationCategoryCommand)
export class DeleteProgramParticipationCategoryHandler implements ICommandHandler<DeleteProgramParticipationCategoryCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramParticipationCategoryCommand) {
        return this.repository.deleteParticipationCategory(command.categoryId);
    }
}

// --- Subtheme Handlers ---
@CommandHandler(CreateProgramSubthemeCommand)
export class CreateProgramSubthemeHandler implements ICommandHandler<CreateProgramSubthemeCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: CreateProgramSubthemeCommand) {
        const result = await this.repository.createSubtheme(command.dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.landingCacheInvalidation);
        return result;
    }
}
@CommandHandler(UpdateProgramSubthemeCommand)
export class UpdateProgramSubthemeHandler implements ICommandHandler<UpdateProgramSubthemeCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: UpdateProgramSubthemeCommand) {
        const result = await this.repository.updateSubtheme(command.id, command.dto);
        if (result.programId) {
            await invalidateLandingCacheByProgramId(result.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramSubthemeCommand)
export class DeleteProgramSubthemeHandler implements ICommandHandler<DeleteProgramSubthemeCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}
    async execute(command: DeleteProgramSubthemeCommand) {
        // deleteSubtheme is a soft-delete (isActive:false) but its interface
        // signature returns void, so read the row first to get programId.
        const existing = await this.repository.findSubthemeById(command.id);
        const result = await this.repository.deleteSubtheme(command.id);
        if (existing?.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
        }
        return result;
    }
}

// ─── Document Template Handlers ───────────────────────────────────────────────

@CommandHandler(CreateDocumentTemplateCommand)
export class CreateDocumentTemplateHandler implements ICommandHandler<CreateDocumentTemplateCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}

    async execute(command: CreateDocumentTemplateCommand) {
        // Asserted on dto.programId - the controller stamps this from the route
        // param before building the command (dto.programId = programId), so the
        // two never diverge here, but the assert still belongs on the id the
        // handler actually writes, per the gallery pattern.
        await assertProgramContentAccess(this.prismaRead, command.actor, command.dto.programId);

        const sourceType = command.dto.sourceType ?? 'upload';
        let templateUrl = command.dto.templateUrl;
        let fileSize: number | undefined = command.dto.fileSize;
        let fileType = command.dto.fileType;

        if (command.file) {
            const program = await this.prisma.program.findUnique({
                where: { id: command.dto.programId },
            });
            if (!program) throw new NotFoundException('Program not found');

            const result = await this.storageService.uploadFile(
                command.file,
                command.userId,
                program.brandId,
                'documents',
                program.id,
            );
            templateUrl = result.url;
            fileSize = command.file.size;
            fileType = command.file.mimetype;
        }

        if (sourceType === 'link' && !command.dto.linkUrl) {
            throw new BadRequestException('linkUrl is required when sourceType is "link"');
        }

        const data = {
            programId: command.dto.programId,
            name: command.dto.name,
            type: command.dto.type,
            description: command.dto.description,
            sourceType,
            templateUrl: sourceType === 'link' ? null : templateUrl,
            linkUrl: sourceType === 'link' ? command.dto.linkUrl : null,
            htmlContent: command.dto.htmlContent,
            placeholders: command.dto.placeholders,
            // Explicit layoutConfig from DTO takes precedence; fall back to file metadata for file-based templates
            layoutConfig: command.dto.layoutConfig ?? (fileSize !== undefined || fileType !== undefined ? { fileSize, fileType } : undefined),
            // Fail closed by default: an admin who doesn't pick a visibility rule gets the
            // locked-down default, mirroring DocumentTemplate.audienceType's schema default.
            audienceType: command.dto.audienceType ?? 'submitted_and_paid',
            audienceConfig: command.dto.audienceConfig ?? {},
            order: command.dto.order ?? 0,
        };

        const result = await this.repository.createDocumentTemplate(data);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.landingCacheInvalidation);
        await invalidatePortalDocumentCaches(this.cacheService);
        return result;
    }
}

@CommandHandler(UpdateDocumentTemplateCommand)
export class UpdateDocumentTemplateHandler implements ICommandHandler<UpdateDocumentTemplateCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}

    async execute(command: UpdateDocumentTemplateCommand) {
        const template = await this.repository.findDocumentTemplateById(command.id);
        if (!template) throw new NotFoundException('Document template not found');
        // Resolved from the target row - the route (PUT document-templates/:itemId)
        // carries only the item id.
        await assertProgramContentAccess(this.prismaRead, command.actor, template.programId);

        const sourceType = command.dto.sourceType ?? template.sourceType ?? 'upload';
        let templateUrl = command.dto.templateUrl;
        let fileSize = command.dto.fileSize;
        let fileType = command.dto.fileType;

        if (command.file) {
            const program = await this.prisma.program.findUnique({
                where: { id: template.programId },
            });
            if (!program) throw new NotFoundException('Program not found');

            const result = await this.storageService.uploadFile(
                command.file,
                command.userId,
                program.brandId,
                'documents',
                program.id,
            );
            templateUrl = result.url;
            fileSize = command.file.size;
            fileType = command.file.mimetype;
        }

        if (sourceType === 'link' && !command.dto.linkUrl && !template.linkUrl) {
            throw new BadRequestException('linkUrl is required when sourceType is "link"');
        }

        const data: Record<string, unknown> = {
            ...command.dto,
            sourceType,
            ...(sourceType === 'link'
                ? { templateUrl: null, linkUrl: command.dto.linkUrl ?? template.linkUrl }
                : { linkUrl: null, ...(templateUrl ? { templateUrl } : {}) }),
            // Only derive layoutConfig from file metadata when no explicit layoutConfig provided (LOA templates pass their own)
            ...((fileSize !== undefined || fileType !== undefined) && !command.dto.layoutConfig
                ? { layoutConfig: { fileSize, fileType } }
                : {}),
        };
        // Remove file-specific helper fields from DTO spread
        delete data.fileSize;
        delete data.fileType;

        const result = await this.repository.updateDocumentTemplate(command.id, data);
        await invalidateLandingCacheByProgramId(template.programId, this.prisma, this.landingCacheInvalidation);
        await invalidatePortalDocumentCaches(this.cacheService);
        return result;
    }
}

@CommandHandler(DeleteDocumentTemplateCommand)
export class DeleteDocumentTemplateHandler implements ICommandHandler<DeleteDocumentTemplateCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
        private readonly prismaRead: PrismaReadService,
    ) {}

    async execute(command: DeleteDocumentTemplateCommand) {
        const template = await this.repository.findDocumentTemplateById(command.id);
        if (!template) throw new NotFoundException('Document template not found');
        // Assert BEFORE deleting.
        await assertProgramContentAccess(this.prismaRead, command.actor, template.programId);

        await this.repository.deleteDocumentTemplate(command.id);
        await invalidateLandingCacheByProgramId(template.programId, this.prisma, this.landingCacheInvalidation);
        await invalidatePortalDocumentCaches(this.cacheService);
    }
}

// --- Program Payment Info Handler ---
@CommandHandler(UpdateProgramPaymentInfoCommand)
export class UpdateProgramPaymentInfoHandler implements ICommandHandler<UpdateProgramPaymentInfoCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramPaymentInfoCommand): Promise<void> {
        const program = await this.programRepository.findById(command.programId);
        if (!program) {
            throw new NotFoundException(`Program ${command.programId} not found`);
        }

        // This endpoint replaces the field: undefined or null in the DTO clears the value,
        // a string sets it. (See controller for the resolution at the API surface.)
        await this.programRepository.update(command.programId, {
            paymentInfoHtml: command.dto.paymentInfoHtml ?? null,
        });

        await invalidatePricingTierCachesByProgramId(command.programId, this.prisma, this.cacheService, this.landingCacheInvalidation);
    }
}

// --- Program Contact Handler ---
@CommandHandler(UpdateProgramContactCommand)
export class UpdateProgramContactHandler implements ICommandHandler<UpdateProgramContactCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramContactCommand): Promise<void> {
        const program = await this.programRepository.findById(command.programId);
        if (!program) {
            throw new NotFoundException(`Program ${command.programId} not found`);
        }

        // Replaces the whole block, like updatePaymentInfo — omitted fields
        // clear to null rather than being left as a stale partial patch.
        await this.programRepository.update(command.programId, {
            contactEmail: command.dto.contactEmail ?? null,
            contactPhone: command.dto.contactPhone ?? null,
            contactWhatsapp: command.dto.contactWhatsapp ?? null,
            contactAddress: command.dto.contactAddress ?? null,
        });

        await invalidateLandingCacheByProgramId(command.programId, this.prisma, this.landingCacheInvalidation);
    }
}

// --- Program Partners-Page Canva URL Handler ---
@CommandHandler(UpdateProgramPartnersCanvaUrlCommand)
export class UpdateProgramPartnersCanvaUrlHandler implements ICommandHandler<UpdateProgramPartnersCanvaUrlCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramPartnersCanvaUrlCommand): Promise<void> {
        const program = await this.programRepository.findById(command.programId);
        if (!program) {
            throw new NotFoundException(`Program ${command.programId} not found`);
        }

        // Replaces the field, like updatePaymentInfo — omitted/null clears it.
        await this.programRepository.update(command.programId, {
            partnersCanvaUrl: command.dto.partnersCanvaUrl ?? null,
        });

        // Partners-page data is snapshotted (LandingSnapshotService), so a
        // plain Redis bust is not enough — this also needs clearSnapshot,
        // which invalidateLandingCacheByProgramId already sets.
        await invalidateLandingCacheByProgramId(command.programId, this.prisma, this.landingCacheInvalidation);
    }
}

// --- Program Landing Content Handler ---
// Allow-listed partial merge — the untyped index signature this replaces
// let any client persist arbitrary keys into Brand.metadata forever. Unknown
// keys are REJECTED, not silently stripped: a value the admin entered
// vanishing with no signal is this project's recurring defect class.
@CommandHandler(UpdateProgramLandingContentCommand)
export class UpdateProgramLandingContentHandler implements ICommandHandler<UpdateProgramLandingContentCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramLandingContentCommand): Promise<void> {
        const program = await this.programRepository.findById(command.programId);
        if (!program) {
            throw new NotFoundException(`Program ${command.programId} not found`);
        }

        const unknownKeys = Object.keys(command.dto.patch).filter((key) => !isProgramLandingContentKey(key));
        if (unknownKeys.length > 0) {
            throw new BadRequestException({
                code: 'unknown_landing_content_key',
                message: `Unknown landingContent key(s): ${unknownKeys.join(', ')}. Legal keys: ${PROGRAM_LANDING_CONTENT_KEYS.join(', ')}.`,
            });
        }

        const existing = (program.landingContent as Record<string, unknown>) ?? {};
        const merged = { ...existing, ...command.dto.patch };

        await this.programRepository.update(command.programId, { landingContent: merged });
        await invalidateLandingCacheByProgramId(command.programId, this.prisma, this.landingCacheInvalidation);
    }
}
