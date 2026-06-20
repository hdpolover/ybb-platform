import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { IProgramRepository } from '@core/interfaces/repositories/program.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { Prisma, PricingFeeType, ApplicationCategory, ProgramPricingTier, ProgramRequirement, PricingTierValidityPeriod } from '@prisma/client';
import { StorageService } from '../../../../files/application/storage.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '../../../../../shared/constants/cache-keys';
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
} from '../program-content.commands';

// ─── Shared cache-invalidation helpers ───────────────────────────────────────
async function invalidateLandingCacheByProgramId(
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
                prisma.brandLandingSnapshot.deleteMany({ where: { brandId: program.brandId } }),
                cacheService.invalidateBrandLandingCaches(program.brandId),
                cacheService.invalidateByPattern('program:*'),
            ]);
        }
    } catch { /* non-critical */ }
}

/**
 * Full cache invalidation for pricing tier / validity-period mutations.
 * Clears landing pages (brand-scoped) AND all enrolled-participant portal caches
 * (dashboard, payments, submission-detail) via wildcard to avoid a DB lookup of
 * all enrolled participants — accepted over-invalidation tradeoff.
 */
async function invalidatePricingTierCachesByProgramId(
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
                prisma.brandLandingSnapshot.deleteMany({ where: { brandId: program.brandId } }),
                cacheService.invalidateBrandLandingCaches(program.brandId),
                cacheService.invalidateByPattern('program:*'),
                cacheService.invalidateByPattern('portal:dashboard:*'),
                cacheService.invalidateByPattern('portal:payments:*'),
                cacheService.invalidateByPattern('portal:submission-detail:*'),
            ]);
        }
    } catch { /* non-critical — cache failure must not break the mutation */ }
}

/**
 * Full cache invalidation for validity-period mutations where only a
 * pricingTierId is available (lookup walks tier → program → brandId).
 */
async function invalidatePricingTierCachesByPricingTierId(
    pricingTierId: string,
    prisma: PrismaService,
    cacheService: CacheService,
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
        }
    } catch { /* non-critical — cache failure must not break the mutation */ }
}

async function invalidateLandingCacheByBrandId(
    brandId: string,
    prisma: PrismaService,
    cacheService: CacheService,
): Promise<void> {
    try {
        await Promise.all([
            prisma.brandLandingSnapshot.deleteMany({ where: { brandId } }),
            cacheService.invalidateBrandLandingCaches(brandId),
            cacheService.invalidateByPattern('program:*'),
        ]);
    } catch { /* non-critical */ }
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
 * Cache invalidation for program resource mutations.
 * Clears landing pages, the specific PROGRAM_RESOURCES HOUR-cached key,
 * portal submission-detail pages, and the portal documents page.
 */
async function invalidateResourceCaches(
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
                cacheService.invalidateKey(CACHE_KEYS.PROGRAM_RESOURCES(programId)),
                cacheService.invalidateByPattern('portal:submission-detail:*'),
                cacheService.invalidateByPattern('portal:documents:*'),
            ]);
        }
    } catch { /* non-critical — cache failure must not break the mutation */ }
}
// ─────────────────────────────────────────────────────────────────────────────

// --- Timeline Handlers ---
@CommandHandler(CreateProgramTimelineCommand)
export class CreateProgramTimelineHandler implements ICommandHandler<CreateProgramTimelineCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        @Inject(IUserActivityLogRepository) private readonly activityLog: IUserActivityLogRepository
    ) {}
    async execute(command: CreateProgramTimelineCommand) {
        const dto = {
            ...command.dto,
            date: new Date(command.dto.date),
            endDate: command.dto.endDate ? new Date(command.dto.endDate) : undefined,
        };
        const result = await this.repository.createTimeline(dto);
        // Log activity here if needed
        return result;
    }
}
@CommandHandler(UpdateProgramTimelineCommand)
export class UpdateProgramTimelineHandler implements ICommandHandler<UpdateProgramTimelineCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramTimelineCommand) {
        const dto = {
            ...command.dto,
            date: command.dto.date ? new Date(command.dto.date) : undefined,
            endDate: command.dto.endDate ? new Date(command.dto.endDate) : undefined,
        };
        return this.repository.updateTimeline(command.id, dto);
    }
}
@CommandHandler(DeleteProgramTimelineCommand)
export class DeleteProgramTimelineHandler implements ICommandHandler<DeleteProgramTimelineCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramTimelineCommand) {
        return this.repository.deleteTimeline(command.id);
    }
}

// --- Schedule Handlers ---
@CommandHandler(CreateProgramScheduleCommand)
export class CreateProgramScheduleHandler implements ICommandHandler<CreateProgramScheduleCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramScheduleCommand) {
        return this.repository.createSchedule(command.dto);
    }
}
@CommandHandler(UpdateProgramScheduleCommand)
export class UpdateProgramScheduleHandler implements ICommandHandler<UpdateProgramScheduleCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramScheduleCommand) {
        return this.repository.updateSchedule(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramScheduleCommand)
export class DeleteProgramScheduleHandler implements ICommandHandler<DeleteProgramScheduleCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramScheduleCommand) {
        return this.repository.deleteSchedule(command.id);
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
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: CreateProgramGalleryCommand) {
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
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramGalleryCommand)
export class UpdateProgramGalleryHandler implements ICommandHandler<UpdateProgramGalleryCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
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
        await invalidateLandingCacheByProgramId(galleryItem.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(DeleteProgramGalleryCommand)
export class DeleteProgramGalleryHandler implements ICommandHandler<DeleteProgramGalleryCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramGalleryCommand) {
        const existing = await this.repository.findGalleryById(command.id);
        const result = await this.repository.deleteGallery(command.id);
        if (existing?.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.cacheService);
        }
        return result;
    }
}

// --- Testimonial Handlers ---
@CommandHandler(CreateProgramTestimonialCommand)
export class CreateProgramTestimonialHandler implements ICommandHandler<CreateProgramTestimonialCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: CreateProgramTestimonialCommand) {
        const { brandId, ...rest } = command.dto;
        const dto = {
            ...rest,
            brandId: brandId,
        };
        const result = await this.repository.createTestimonial(dto);
        if (brandId) await invalidateLandingCacheByBrandId(brandId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramTestimonialCommand)
export class UpdateProgramTestimonialHandler implements ICommandHandler<UpdateProgramTestimonialCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: UpdateProgramTestimonialCommand) {
        const result = await this.repository.updateTestimonial(command.id, command.dto);
        try {
            const testimonial = await this.prisma.programTestimonial.findUnique({
                where: { id: command.id },
                select: { brandId: true },
            });
            if (testimonial?.brandId) await invalidateLandingCacheByBrandId(testimonial.brandId, this.prisma, this.cacheService);
        } catch { /* non-critical */ }
        return result;
    }
}
@CommandHandler(DeleteProgramTestimonialCommand)
export class DeleteProgramTestimonialHandler implements ICommandHandler<DeleteProgramTestimonialCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramTestimonialCommand) {
        const testimonial = await this.prisma.programTestimonial.findUnique({
            where: { id: command.id },
            select: { brandId: true },
        });
        const result = await this.repository.deleteTestimonial(command.id);
        if (testimonial?.brandId) await invalidateLandingCacheByBrandId(testimonial.brandId, this.prisma, this.cacheService);
        return result;
    }
}

// --- FAQ Handlers ---
@CommandHandler(CreateProgramFaqCommand)
export class CreateProgramFaqHandler implements ICommandHandler<CreateProgramFaqCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: CreateProgramFaqCommand) {
        const result = await this.repository.createFaq(command.dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramFaqCommand)
export class UpdateProgramFaqHandler implements ICommandHandler<UpdateProgramFaqCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: UpdateProgramFaqCommand) {
        const existing = await this.repository.findFaqById(command.id);
        const result = await this.repository.updateFaq(command.id, command.dto);
        const programId = existing?.programId ?? result.programId;
        if (programId) {
            await invalidateLandingCacheByProgramId(programId, this.prisma, this.cacheService);
        }
        return result;
    }
}
@CommandHandler(DeleteProgramFaqCommand)
export class DeleteProgramFaqHandler implements ICommandHandler<DeleteProgramFaqCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramFaqCommand) {
        const existing = await this.repository.findFaqById(command.id);
        const result = await this.repository.deleteFaq(command.id);
        if (existing?.programId) {
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.cacheService);
        }
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
        return this.repository.createPartner(dto);
    }
}
@CommandHandler(UpdateProgramPartnerCommand)
export class UpdateProgramPartnerHandler implements ICommandHandler<UpdateProgramPartnerCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly storageService: StorageService,
        private readonly prisma: PrismaService,
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
        return this.repository.updatePartner(command.id, dto);
    }
}
@CommandHandler(DeleteProgramPartnerCommand)
export class DeleteProgramPartnerHandler implements ICommandHandler<DeleteProgramPartnerCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramPartnerCommand) {
        return this.repository.deletePartner(command.id);
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
    ) {}
    async execute(command: CreateProgramResourceCommand) {
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
        await invalidateResourceCaches(command.dto.programId, this.prisma, this.cacheService);
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
    ) {}

    async execute(command: UpdateProgramResourceCommand) {
        const resource = await this.repository.findResourceById(command.id);
        if (!resource) {
            throw new NotFoundException('Resource not found');
        }
        if (!resource.programId) {
            throw new NotFoundException('Program ID missing on resource');
        }

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
            await invalidateResourceCaches(resource.programId, this.prisma, this.cacheService);
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
        await invalidateResourceCaches(resource.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(DeleteProgramResourceCommand)
export class DeleteProgramResourceHandler implements ICommandHandler<DeleteProgramResourceCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramResourceCommand) {
        const existing = await this.repository.findResourceById(command.id);
        const result = await this.repository.deleteResource(command.id);
        if (existing?.programId) {
            await invalidateResourceCaches(existing.programId, this.prisma, this.cacheService);
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

        // Auto-create initial validity period from validFrom/validUntil if provided
        if (validFrom && validUntil) {
            await this.repository.createValidityPeriod({
                pricingTierId: result.id,
                startDate: new Date(validFrom),
                endDate: new Date(validUntil),
                description: 'Default period',
            });
        }

        await invalidatePricingTierCachesByProgramId(command.dto.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(UpdateProgramPricingTierCommand)
export class UpdateProgramPricingTierHandler implements ICommandHandler<UpdateProgramPricingTierCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
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
        await invalidatePricingTierCachesByProgramId(existingTier.programId, this.prisma, this.cacheService);
        return result;
    }
}
@CommandHandler(DeleteProgramPricingTierCommand)
export class DeleteProgramPricingTierHandler implements ICommandHandler<DeleteProgramPricingTierCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteProgramPricingTierCommand) {
        const existing = await this.repository.findPricingTierById(command.id);
        const result = await this.repository.deletePricingTier(command.id);
        if (existing?.programId) {
            await invalidatePricingTierCachesByProgramId(existing.programId, this.prisma, this.cacheService);
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
    ) {}
    async execute(command: CreateValidityPeriodCommand) {
        const dto = {
            pricingTierId: command.dto.pricingTierId,
            startDate: new Date(command.dto.startDate),
            endDate: new Date(command.dto.endDate),
            description: command.dto.description,
        };
        const result = await this.repository.createValidityPeriod(dto as Partial<PricingTierValidityPeriod>);
        await invalidatePricingTierCachesByPricingTierId(command.dto.pricingTierId!, this.prisma, this.cacheService);
        return {
            ...result,
            startDate: toIsoOrNull(result.startDate),
            endDate: toIsoOrNull(result.endDate),
            createdAt: toIsoOrNull((result as { createdAt?: unknown }).createdAt),
            updatedAt: toIsoOrNull((result as { updatedAt?: unknown }).updatedAt),
        };
    }
}
@CommandHandler(UpdateValidityPeriodCommand)
export class UpdateValidityPeriodHandler implements ICommandHandler<UpdateValidityPeriodCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: UpdateValidityPeriodCommand) {
        const existing = await this.repository.findValidityPeriodById(command.id);
        if (!existing) throw new NotFoundException(`Validity period ${command.id} not found`);
        const dto = {
            startDate: command.dto.startDate ? new Date(command.dto.startDate) : undefined,
            endDate: command.dto.endDate ? new Date(command.dto.endDate) : undefined,
            description: command.dto.description,
        };
        const result = await this.repository.updateValidityPeriod(command.id, dto as Partial<PricingTierValidityPeriod>);
        await invalidatePricingTierCachesByPricingTierId(existing.pricingTierId, this.prisma, this.cacheService);
        return {
            ...result,
            startDate: toIsoOrNull(result.startDate),
            endDate: toIsoOrNull(result.endDate),
            createdAt: toIsoOrNull((result as { createdAt?: unknown }).createdAt),
            updatedAt: toIsoOrNull((result as { updatedAt?: unknown }).updatedAt),
        };
    }
}
@CommandHandler(DeleteValidityPeriodCommand)
export class DeleteValidityPeriodHandler implements ICommandHandler<DeleteValidityPeriodCommand> {
    constructor(
        @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: DeleteValidityPeriodCommand) {
        const existing = await this.repository.findValidityPeriodById(command.id);
        const result = await this.repository.deleteValidityPeriod(command.id);
        if (existing?.pricingTierId) {
            await invalidatePricingTierCachesByPricingTierId(existing.pricingTierId, this.prisma, this.cacheService);
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
        const result = await this.repository.updateEssay(command.id, {
            ...command.dto,
            ...(typeof command.dto.question === 'string'
                ? { question: assertValidEssayQuestion(command.dto.question) }
                : {}),
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
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramSubthemeCommand) {
        return this.repository.createSubtheme(command.dto);
    }
}
@CommandHandler(UpdateProgramSubthemeCommand)
export class UpdateProgramSubthemeHandler implements ICommandHandler<UpdateProgramSubthemeCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramSubthemeCommand) {
        return this.repository.updateSubtheme(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramSubthemeCommand)
export class DeleteProgramSubthemeHandler implements ICommandHandler<DeleteProgramSubthemeCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramSubthemeCommand) {
        return this.repository.deleteSubtheme(command.id);
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
    ) {}

    async execute(command: CreateDocumentTemplateCommand) {
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

        const data = {
            programId: command.dto.programId,
            name: command.dto.name,
            type: command.dto.type,
            description: command.dto.description,
            templateUrl,
            htmlContent: command.dto.htmlContent,
            placeholders: command.dto.placeholders,
            // Explicit layoutConfig from DTO takes precedence; fall back to file metadata for file-based templates
            layoutConfig: command.dto.layoutConfig ?? (fileSize !== undefined || fileType !== undefined ? { fileSize, fileType } : undefined),
            audienceType: command.dto.audienceType ?? 'all_registered',
            audienceConfig: command.dto.audienceConfig ?? {},
            order: command.dto.order ?? 0,
        };

        const result = await this.repository.createDocumentTemplate(data);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.cacheService);
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
    ) {}

    async execute(command: UpdateDocumentTemplateCommand) {
        const template = await this.repository.findDocumentTemplateById(command.id);
        if (!template) throw new NotFoundException('Document template not found');

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

        const data: Record<string, unknown> = {
            ...command.dto,
            ...(templateUrl ? { templateUrl } : {}),
            // Only derive layoutConfig from file metadata when no explicit layoutConfig provided (LOA templates pass their own)
            ...((fileSize !== undefined || fileType !== undefined) && !command.dto.layoutConfig
                ? { layoutConfig: { fileSize, fileType } }
                : {}),
        };
        // Remove file-specific helper fields from DTO spread
        delete data.fileSize;
        delete data.fileType;

        const result = await this.repository.updateDocumentTemplate(command.id, data);
        await invalidateLandingCacheByProgramId(template.programId, this.prisma, this.cacheService);
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
    ) {}

    async execute(command: DeleteDocumentTemplateCommand) {
        const template = await this.repository.findDocumentTemplateById(command.id);
        if (!template) throw new NotFoundException('Document template not found');
        await this.repository.deleteDocumentTemplate(command.id);
        await invalidateLandingCacheByProgramId(template.programId, this.prisma, this.cacheService);
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

        await invalidatePricingTierCachesByProgramId(command.programId, this.prisma, this.cacheService);
    }
}
