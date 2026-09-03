import { CurrentUserData } from '@shared/decorators/current-user.decorator';

export class ListProgramTimelineQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramSchedulesQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramSpeakersQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramGalleryQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramTestimonialsQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramFaqsQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramTeamQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramPartnersQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramResourcesQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramPricingTiersQuery {
    constructor(public readonly programId: string) { }
}

export class GetPricingTierByIdQuery {
    constructor(public readonly tierId: string) { }
}

export class GetPricingTierAlertsQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramRequirementsQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramEssaysQuery {
    constructor(
        public readonly programId: string,
        public readonly includeInactive = false,
    ) { }
}

export class ListProgramSubthemesQuery {
    constructor(
        public readonly programId: string,
        public readonly includeInactive = false,
    ) { }
}

export class ListProgramParticipationCategoriesQuery {
    constructor(
        public readonly programId: string,
        public readonly includeInactive = false,
    ) { }
}

export class ListDocumentTemplatesQuery {
    constructor(
        public readonly programId: string,
        // Admin-only route (@Roles), unscoped otherwise: any admin could list any
        // programme's document templates by id. actor lets the handler assert
        // the caller's programme scope once programId is resolved.
        public readonly actor: CurrentUserData,
        public readonly type?: string,
    ) {}
}
