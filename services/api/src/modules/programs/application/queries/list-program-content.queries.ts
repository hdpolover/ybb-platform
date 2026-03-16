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

export class ListProgramRequirementsQuery {
    constructor(public readonly programId: string) { }
}

export class ListProgramEssaysQuery {
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
