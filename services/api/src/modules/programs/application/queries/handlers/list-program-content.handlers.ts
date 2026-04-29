import { Injectable, Inject } from '@nestjs/common';
import { IProgramContentRepository } from '../../../../../core/interfaces/repositories/program-content.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import {
    ListProgramTimelineQuery,
    ListProgramSchedulesQuery,
    ListProgramSpeakersQuery,
    ListProgramGalleryQuery,
    ListProgramTestimonialsQuery,
    ListProgramFaqsQuery,
    ListProgramTeamQuery,
    ListProgramPartnersQuery,
    ListProgramResourcesQuery,
    ListProgramPricingTiersQuery,
    GetPricingTierByIdQuery,
    ListProgramRequirementsQuery,
    ListProgramEssaysQuery,
    ListProgramParticipationCategoriesQuery,
    ListProgramSubthemesQuery,
    ListDocumentTemplatesQuery,
} from '../list-program-content.queries';

async function resolveProgramId(
    repo: IProgramRepository, 
    identifier: string
): Promise<string | null> {
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    if (isUUID) return identifier;
    
    const program = await repo.findBySlug(identifier);
    return program ? program.id : null;
}

function toIsoOrNull(value: unknown): string | null {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string') return value;
    return null;
}

@Injectable()
export class ListProgramTimelineHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramTimelineQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findTimelineByProgramId(programId);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            icon: item.icon ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramSchedulesHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramSchedulesQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findSchedulesByProgramId(programId);
        return items.map(item => ({
            ...item,
            startTime: item.startTime ?? undefined,
            endTime: item.endTime ?? undefined,
            description: item.description ?? undefined,
            location: item.location ?? undefined,
            speaker: item.speaker ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramSpeakersHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramSpeakersQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findSpeakersByProgramId(programId);
        return items.map(item => ({
            ...item,
            title: item.title ?? undefined,
            organization: item.organization ?? undefined,
            bio: item.bio ?? undefined,
            photoUrl: item.photoUrl ?? undefined,
            email: item.email ?? undefined,
            linkedinUrl: item.linkedinUrl ?? undefined,
            twitterUrl: item.twitterUrl ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramGalleryHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramGalleryQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findGalleryByProgramId(programId);
        return items.map(item => ({
            ...item,
            title: item.title ?? undefined,
            description: item.description ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramTestimonialsHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramTestimonialsQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findTestimonialsByProgramId(programId);
        return items.map(item => ({
            ...item,
            role: item.role ?? undefined,
            company: item.company ?? undefined,
            avatarUrl: item.avatarUrl ?? undefined,
            rating: item.rating ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramFaqsHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramFaqsQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        return this.repository.findFaqsByProgramId(programId);
    }
}

@Injectable()
export class ListProgramTeamHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramTeamQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findTeamByProgramId(programId);
        return items.map(item => ({
            ...item,
            bio: item.bio ?? undefined,
            photoUrl: item.photoUrl ?? undefined,
            linkedinUrl: item.linkedinUrl ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramPartnersHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramPartnersQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findPartnersByProgramId(programId);
        return items.map(item => ({
            ...item,
            role: item.role ?? undefined,
            logoUrl: item.logoUrl ?? undefined,
            websiteUrl: item.websiteUrl ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramResourcesHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramResourcesQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findResourcesByProgramId(programId);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            fileSize: item.fileSize ? Number(item.fileSize) : undefined,
            fileType: item.fileType ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramPricingTiersHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramPricingTiersQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findPricingTiersByProgramId(programId);
        return items.map(item => ({
            ...item,
            createdAt: toIsoOrNull(item.createdAt),
            updatedAt: toIsoOrNull(item.updatedAt),
            deletedAt: toIsoOrNull((item as { deletedAt?: unknown }).deletedAt),
            description: item.description ?? undefined,
            price: Number(item.price),
            capacity: item.capacity ?? undefined,
            benefits: item.benefits ?? undefined,
            feeType: item.feeType ?? undefined,
            allowedCategories: item.allowedCategories ?? undefined,
            icon: item.icon ?? undefined,
            requirements: item.requirements ?? undefined,
            validityPeriods: item.validityPeriods.map(vp => ({
                id: vp.id,
                pricingTierId: vp.pricingTierId,
                startDate: toIsoOrNull(vp.startDate),
                endDate: toIsoOrNull(vp.endDate),
                description: vp.description ?? undefined,
                createdAt: toIsoOrNull((vp as { createdAt?: unknown }).createdAt),
                updatedAt: toIsoOrNull((vp as { updatedAt?: unknown }).updatedAt),
            })),
            // Explicitly remove old fields if they still exist in the spread but not in type
            validFrom: undefined,
            validUntil: undefined
        }));
    }
}

@Injectable()
export class GetPricingTierByIdHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
    ) { }

    async execute(query: GetPricingTierByIdQuery) {
        const tier = await this.repository.findPricingTierById(query.tierId);
        if (!tier) return null;
        return {
            ...tier,
            createdAt: toIsoOrNull(tier.createdAt),
            updatedAt: toIsoOrNull(tier.updatedAt),
            deletedAt: toIsoOrNull((tier as { deletedAt?: unknown }).deletedAt),
            price: Number(tier.price),
            description: tier.description ?? undefined,
            capacity: tier.capacity ?? undefined,
            benefits: tier.benefits ?? undefined,
            feeType: tier.feeType ?? undefined,
            allowedCategories: tier.allowedCategories ?? undefined,
            icon: tier.icon ?? undefined,
            requirements: tier.requirements ?? undefined,
            validityPeriods: tier.validityPeriods.map(vp => ({
                id: vp.id,
                pricingTierId: vp.pricingTierId,
                startDate: toIsoOrNull(vp.startDate),
                endDate: toIsoOrNull(vp.endDate),
                description: vp.description ?? undefined,
                createdAt: toIsoOrNull((vp as { createdAt?: unknown }).createdAt),
                updatedAt: toIsoOrNull((vp as { updatedAt?: unknown }).updatedAt),
            })),
        };
    }
}

@Injectable()
export class ListProgramRequirementsHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramRequirementsQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findRequirementsByProgramId(programId);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            fileMaxSize: item.fileMaxSize ?? undefined,
            fileAllowedTypes: item.fileAllowedTypes ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramEssaysHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramEssaysQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findEssaysByProgramId(programId, query.includeInactive);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            wordLimit: item.wordLimit ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramParticipationCategoriesHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramParticipationCategoriesQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findParticipationCategoriesByProgramId(programId, query.includeInactive);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            benefits: item.benefits ?? undefined,
            eligibility: item.eligibility ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramSubthemesHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListProgramSubthemesQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        const items = await this.repository.findSubthemesByProgramId(programId, query.includeInactive);
        return items.map(item => ({
            id: item.id,
            programId: item.programId,
            name: item.name,
            description: item.description ?? undefined,
            order: item.order,
            isActive: item.isActive,
        }));
    }
}

@Injectable()
export class ListDocumentTemplatesHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
        @Inject('IProgramRepository')
        private readonly programRepository: IProgramRepository,
    ) { }

    async execute(query: ListDocumentTemplatesQuery) {
        const programId = await resolveProgramId(this.programRepository, query.programId);
        if (!programId) return [];

        return this.repository.findDocumentTemplatesByProgramId(programId, query.type);
    }
}
