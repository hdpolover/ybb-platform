import { Injectable, Inject } from '@nestjs/common';
import { IProgramContentRepository } from '../../../../../core/interfaces/repositories/program-content.repository.interface';
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
    ListProgramRequirementsQuery,
} from '../list-program-content.queries';

@Injectable()
export class ListProgramTimelineHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
    ) { }

    async execute(query: ListProgramTimelineQuery) {
        const items = await this.repository.findTimelineByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramSchedulesQuery) {
        const items = await this.repository.findSchedulesByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramSpeakersQuery) {
        const items = await this.repository.findSpeakersByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramGalleryQuery) {
        const items = await this.repository.findGalleryByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramTestimonialsQuery) {
        const items = await this.repository.findTestimonialsByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramFaqsQuery) {
        return this.repository.findFaqsByProgramId(query.programId);
    }
}

@Injectable()
export class ListProgramTeamHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
    ) { }

    async execute(query: ListProgramTeamQuery) {
        const items = await this.repository.findTeamByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramPartnersQuery) {
        const items = await this.repository.findPartnersByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramResourcesQuery) {
        const items = await this.repository.findResourcesByProgramId(query.programId);
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
    ) { }

    async execute(query: ListProgramPricingTiersQuery) {
        const items = await this.repository.findPricingTiersByProgramId(query.programId);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            price: Number(item.price),
            capacity: item.capacity ?? undefined,
            benefits: item.benefits ?? undefined,
        }));
    }
}

@Injectable()
export class ListProgramRequirementsHandler {
    constructor(
        @Inject('IProgramContentRepository')
        private readonly repository: IProgramContentRepository,
    ) { }

    async execute(query: ListProgramRequirementsQuery) {
        const items = await this.repository.findRequirementsByProgramId(query.programId);
        return items.map(item => ({
            ...item,
            description: item.description ?? undefined,
            fileMaxSize: item.fileMaxSize ?? undefined,
            fileAllowedTypes: item.fileAllowedTypes ?? undefined,
        }));
    }
}
