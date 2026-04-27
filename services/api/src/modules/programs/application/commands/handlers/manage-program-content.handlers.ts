import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { IUserActivityLogRepository } from '@core/interfaces/repositories/user-activity-log.repository.interface';
import { Prisma, PricingFeeType, ApplicationCategory, ProgramPricingTier, ProgramRequirement, PricingTierValidityPeriod } from '@prisma/client';
import { StorageService } from '../../../../files/application/storage.service';
import { FileServiceClient } from '../../../../files/infrastructure/clients/file-service.client';
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
    CreateProgramEssayCommand, UpdateProgramEssayCommand, DeleteProgramEssayCommand,
    CreateProgramParticipationCategoryCommand, UpdateProgramParticipationCategoryCommand, DeleteProgramParticipationCategoryCommand,
    CreateProgramSubthemeCommand, UpdateProgramSubthemeCommand, DeleteProgramSubthemeCommand,
    CreateDocumentTemplateCommand, UpdateDocumentTemplateCommand, DeleteDocumentTemplateCommand,
    GenerateLOACommand,
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
            await cacheService.invalidateBrandLandingCaches(program.brandId);
            await cacheService.invalidateByPattern('program:*');
        }
    } catch { /* non-critical */ }
}

async function invalidateLandingCacheByBrandId(
    brandId: string,
    cacheService: CacheService,
): Promise<void> {
    try {
        await cacheService.invalidateBrandLandingCaches(brandId);
        await cacheService.invalidateByPattern('program:*');
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
        private readonly cacheService: CacheService,
    ) {}
    async execute(command: CreateProgramTestimonialCommand) {
        const { brandId, ...rest } = command.dto;
        const dto = {
            ...rest,
            brandId: brandId,
        };
        const result = await this.repository.createTestimonial(dto);
        if (brandId) await invalidateLandingCacheByBrandId(brandId, this.cacheService);
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
            if (testimonial?.brandId) await invalidateLandingCacheByBrandId(testimonial.brandId, this.cacheService);
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
        if (testimonial?.brandId) await invalidateLandingCacheByBrandId(testimonial.brandId, this.cacheService);
        return result;
    }
}

// --- FAQ Handlers ---
@CommandHandler(CreateProgramFaqCommand)
export class CreateProgramFaqHandler implements ICommandHandler<CreateProgramFaqCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramFaqCommand) {
        return this.repository.createFaq(command.dto);
    }
}
@CommandHandler(UpdateProgramFaqCommand)
export class UpdateProgramFaqHandler implements ICommandHandler<UpdateProgramFaqCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramFaqCommand) {
        return this.repository.updateFaq(command.id, command.dto);
    }
}
@CommandHandler(DeleteProgramFaqCommand)
export class DeleteProgramFaqHandler implements ICommandHandler<DeleteProgramFaqCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramFaqCommand) {
        return this.repository.deleteFaq(command.id);
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

        const dto = {
            ...command.dto,
            fileUrl: fileUrl,
            fileSize: fileSize ? BigInt(fileSize) : undefined,
            fileType: fileType
        };
        const result = await this.repository.createResource(dto);
        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.cacheService);
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
        let fileUrl = command.dto.fileUrl;
        let fileSize: number | undefined = command.dto.fileSize;
        let fileType = command.dto.fileType;

        const resource = await this.repository.findResourceById(command.id);
        if (!resource) {
            throw new NotFoundException('Resource not found');
        }
        if (!resource.programId) {
            throw new NotFoundException('Program ID missing on resource');
        }

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

        const dto = {
            ...command.dto,
            fileUrl: fileUrl,
            fileType: fileType,
            fileSize: fileSize ? BigInt(fileSize) : undefined
        };
        const result = await this.repository.updateResource(command.id, dto);
        await invalidateLandingCacheByProgramId(resource.programId, this.prisma, this.cacheService);
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
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.cacheService);
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

        const { feeType, allowedCategories, validFrom, validUntil, ...rest } = command.dto;
        const dto = {
            ...rest,
            price: new Prisma.Decimal(command.dto.price),
            feeType: command.dto.feeType ? command.dto.feeType as PricingFeeType : undefined,
            allowedCategories: command.dto.allowedCategories
                ? command.dto.allowedCategories.map(c => c as ApplicationCategory)
                : undefined
        };
        const result = await this.repository.createPricingTier(dto as Partial<ProgramPricingTier>);

        // Auto-create initial validity period from validFrom/validUntil if provided
        if (validFrom && validUntil) {
            await this.repository.createValidityPeriod({
                pricingTierId: result.id,
                startDate: new Date(validFrom),
                endDate: new Date(validUntil),
                description: 'Default period',
            });
        }

        await invalidateLandingCacheByProgramId(command.dto.programId, this.prisma, this.cacheService);
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

        // validFrom/validUntil are not fields on ProgramPricingTier — managed via PricingTierValidityPeriod
        const { feeType, allowedCategories, validFrom: _vf, validUntil: _vu, ...rest } = command.dto;
        const dto = {
            ...rest,
            price: command.dto.price ? new Prisma.Decimal(command.dto.price) : undefined,
            feeType: command.dto.feeType ? command.dto.feeType as PricingFeeType : undefined,
            allowedCategories: command.dto.allowedCategories
                ? command.dto.allowedCategories.map(c => c as ApplicationCategory)
                : undefined
        };
        const result = await this.repository.updatePricingTier(command.id, dto as Partial<ProgramPricingTier>);
        await invalidateLandingCacheByProgramId(existingTier.programId, this.prisma, this.cacheService);
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
            await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.cacheService);
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
        await this.invalidateLandingCache(command.dto.pricingTierId!);
        return result;
    }
    private async invalidateLandingCache(pricingTierId: string): Promise<void> {
        try {
            const tier = await this.prisma.programPricingTier.findUnique({
                where: { id: pricingTierId },
                select: { program: { select: { brandId: true } } },
            });
            if (tier?.program?.brandId) {
                await this.cacheService.invalidateBrandLandingCaches(tier.program.brandId);
                await this.cacheService.invalidateByPattern('program:*');
            }
        } catch { /* non-critical */ }
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
        await this.invalidateLandingCache(existing.pricingTierId);
        return result;
    }
    private async invalidateLandingCache(pricingTierId: string): Promise<void> {
        try {
            const tier = await this.prisma.programPricingTier.findUnique({
                where: { id: pricingTierId },
                select: { program: { select: { brandId: true } } },
            });
            if (tier?.program?.brandId) {
                await this.cacheService.invalidateBrandLandingCaches(tier.program.brandId);
                await this.cacheService.invalidateByPattern('program:*');
            }
        } catch { /* non-critical */ }
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
            await this.invalidateLandingCache(existing.pricingTierId);
        }
        return result;
    }
    private async invalidateLandingCache(pricingTierId: string): Promise<void> {
        try {
            const tier = await this.prisma.programPricingTier.findUnique({
                where: { id: pricingTierId },
                select: { program: { select: { brandId: true } } },
            });
            if (tier?.program?.brandId) {
                await this.cacheService.invalidateBrandLandingCaches(tier.program.brandId);
                await this.cacheService.invalidateByPattern('program:*');
            }
        } catch { /* non-critical */ }
    }
}
@CommandHandler(CreateProgramRequirementCommand)
export class CreateProgramRequirementHandler implements ICommandHandler<CreateProgramRequirementCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: CreateProgramRequirementCommand) {
        return this.repository.createRequirement(command.dto as Partial<ProgramRequirement>);
    }
}
@CommandHandler(UpdateProgramRequirementCommand)
export class UpdateProgramRequirementHandler implements ICommandHandler<UpdateProgramRequirementCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: UpdateProgramRequirementCommand) {
        return this.repository.updateRequirement(command.id, command.dto as Partial<ProgramRequirement>);
    }
}
@CommandHandler(DeleteProgramRequirementCommand)
export class DeleteProgramRequirementHandler implements ICommandHandler<DeleteProgramRequirementCommand> {
    constructor(@Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository) {}
    async execute(command: DeleteProgramRequirementCommand) {
        return this.repository.deleteRequirement(command.id);
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
        const result = await this.repository.createEssay(command.dto);
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
        const result = await this.repository.updateEssay(command.id, command.dto);
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

@CommandHandler(GenerateLOACommand)
export class GenerateLOAHandler implements ICommandHandler<GenerateLOACommand> {
    private readonly logger = new Logger(GenerateLOAHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly fileServiceClient: FileServiceClient,
        private readonly cacheService: CacheService,
    ) {}

    async execute(command: GenerateLOACommand): Promise<{ generated: number; failed: number }> {
        const template = await this.prisma.documentTemplate.findFirst({
            where: { id: command.templateId, deletedAt: null },
        });
        if (!template) throw new NotFoundException('Document template not found');
        if (template.type !== 'letter_of_acceptance') {
            throw new BadRequestException('Template must be of type letter_of_acceptance');
        }
        if (!template.htmlContent) {
            throw new BadRequestException('Template has no HTML content');
        }

        const program = await this.prisma.program.findUnique({ where: { id: command.programId } });
        if (!program) throw new NotFoundException('Program not found');

        // Resolve applications to generate for
        const whereClause: Record<string, unknown> = { programId: command.programId, deletedAt: null };
        if (command.participantId) {
            whereClause.participantId = command.participantId;
        } else if (command.bulk) {
            whereClause.status = 'accepted';
        } else {
            throw new BadRequestException('Provide participantId or bulk: true');
        }

        const applications = await this.prisma.participantApplication.findMany({
            where: whereClause as Prisma.ParticipantApplicationWhereInput,
            include: {
                participant: true,
                participationCategory: true,
            },
        });

        if (applications.length === 0) return { generated: 0, failed: 0 };

        const layoutConfig = (template.layoutConfig ?? {}) as Record<string, unknown>;
        const placeholders = (template.placeholders ?? []) as Array<{ key: string; source: string }>;
        const year = new Date().getFullYear();

        let generated = 0;
        let failed = 0;

        for (const app of applications) {
            try {
                // Sequential count for document number (MVP — safe enough for typical LOA volumes)
                const existingCount = await this.prisma.participantDocument.count({
                    where: { templateId: template.id },
                });
                const seq = String(existingCount + 1).padStart(6, '0');
                const documentNumber = `LOA-${year}-${seq}`;

                // Build placeholder substitution map
                const generatedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
                const sourceMap: Record<string, string> = {
                    'participant.fullName': app.participant.fullName,
                    'program.name': program.name,
                    'program.batch': String(program.year),
                    'generated_at': generatedAt,
                    'participant_document.documentNumber': documentNumber,
                    'application.participationCategory.name': app.participationCategory?.name ?? '',
                };
                const placeholderData: Record<string, string> = {};
                for (const p of placeholders) {
                    placeholderData[p.key] = sourceMap[p.source] ?? '';
                }
                // Always include document number token even if not in placeholders definition
                placeholderData['{{document_number}}'] = documentNumber;

                const pdfBuffer = await this.fileServiceClient.generateLoa({
                    html_content: template.htmlContent,
                    header_html: (layoutConfig.headerHtml as string) ?? '',
                    footer_html: (layoutConfig.footerHtml as string) ?? '',
                    page_size: (layoutConfig.pageSize as string) ?? 'A4',
                    margins: (layoutConfig.margins as { top: number; right: number; bottom: number; left: number }) ?? { top: 40, right: 40, bottom: 40, left: 40 },
                    placeholder_data: placeholderData,
                    document_number: documentNumber,
                });

                const multerFile: Express.Multer.File = {
                    buffer: pdfBuffer,
                    originalname: `${documentNumber}.pdf`,
                    mimetype: 'application/pdf',
                    size: pdfBuffer.length,
                    fieldname: 'file',
                    encoding: '7bit',
                    destination: '',
                    filename: `${documentNumber}.pdf`,
                    path: '',
                    stream: null as never,
                };

                const uploadResult = await this.storageService.uploadFile(
                    multerFile,
                    command.userId,
                    program.brandId,
                    'documents',
                    program.id,
                );

                const existingDoc = await this.prisma.participantDocument.findFirst({
                    where: { applicationId: app.id, templateId: template.id },
                });

                if (existingDoc) {
                    await this.prisma.participantDocument.update({
                        where: { id: existingDoc.id },
                        data: {
                            fileUrl: uploadResult.url,
                            documentNumber,
                            generatedAt: new Date(),
                            isPublic: false,
                        },
                    });
                } else {
                    await this.prisma.participantDocument.create({
                        data: {
                            applicationId: app.id,
                            templateId: template.id,
                            name: `Letter of Acceptance – ${program.name}`,
                            type: 'letter_of_acceptance',
                            fileUrl: uploadResult.url,
                            fileType: 'pdf',
                            documentNumber,
                            generatedAt: new Date(),
                            isPublic: false,
                        },
                    });
                }

                generated++;
            } catch (err) {
                this.logger.error(`Failed to generate LOA for application ${app.id}: ${err instanceof Error ? err.message : String(err)}`);
                failed++;
            }
        }

        await invalidatePortalDocumentCaches(this.cacheService);
        return { generated, failed };
    }
}
