import {
    CreateProgramTimelineDto, UpdateProgramTimelineDto,
    CreateProgramScheduleDto, UpdateProgramScheduleDto,
    CreateProgramSpeakerDto, UpdateProgramSpeakerDto,
    CreateProgramGalleryDto, UpdateProgramGalleryDto,
    CreateProgramTestimonialDto, UpdateProgramTestimonialDto,
    CreateProgramFaqDto, UpdateProgramFaqDto,
    CreateProgramTeamDto, UpdateProgramTeamDto,
    CreateProgramPartnerDto, UpdateProgramPartnerDto,
    CreateProgramResourceDto, UpdateProgramResourceDto,
    CreateProgramPricingTierDto, UpdateProgramPricingTierDto,
    CreateProgramRequirementDto, UpdateProgramRequirementDto
} from '../../presentation/dto/create-update-program-content.dto';

// Timeline
export class CreateProgramTimelineCommand {
    constructor(public readonly dto: CreateProgramTimelineDto, public readonly userId: string) { }
}
export class UpdateProgramTimelineCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramTimelineDto, public readonly userId: string) { }
}
export class DeleteProgramTimelineCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Schedule
export class CreateProgramScheduleCommand {
    constructor(public readonly dto: CreateProgramScheduleDto, public readonly userId: string) { }
}
export class UpdateProgramScheduleCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramScheduleDto, public readonly userId: string) { }
}
export class DeleteProgramScheduleCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Speaker
export class CreateProgramSpeakerCommand {
    constructor(public readonly dto: CreateProgramSpeakerDto, public readonly userId: string) { }
}
export class UpdateProgramSpeakerCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramSpeakerDto, public readonly userId: string) { }
}
export class DeleteProgramSpeakerCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Gallery
export class CreateProgramGalleryCommand {
    constructor(public readonly dto: CreateProgramGalleryDto, public readonly userId: string) { }
}
export class UpdateProgramGalleryCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramGalleryDto, public readonly userId: string) { }
}
export class DeleteProgramGalleryCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Testimonial
export class CreateProgramTestimonialCommand {
    constructor(public readonly dto: CreateProgramTestimonialDto, public readonly userId: string) { }
}
export class UpdateProgramTestimonialCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramTestimonialDto, public readonly userId: string) { }
}
export class DeleteProgramTestimonialCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// FAQ
export class CreateProgramFaqCommand {
    constructor(public readonly dto: CreateProgramFaqDto, public readonly userId: string) { }
}
export class UpdateProgramFaqCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramFaqDto, public readonly userId: string) { }
}
export class DeleteProgramFaqCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Team
export class CreateProgramTeamCommand {
    constructor(public readonly dto: CreateProgramTeamDto, public readonly userId: string) { }
}
export class UpdateProgramTeamCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramTeamDto, public readonly userId: string) { }
}
export class DeleteProgramTeamCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Partner
export class CreateProgramPartnerCommand {
    constructor(public readonly dto: CreateProgramPartnerDto, public readonly userId: string) { }
}
export class UpdateProgramPartnerCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramPartnerDto, public readonly userId: string) { }
}
export class DeleteProgramPartnerCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Resource
export class CreateProgramResourceCommand {
    constructor(public readonly dto: CreateProgramResourceDto, public readonly userId: string) { }
}
export class UpdateProgramResourceCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramResourceDto, public readonly userId: string) { }
}
export class DeleteProgramResourceCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Pricing Tier
export class CreateProgramPricingTierCommand {
    constructor(public readonly dto: CreateProgramPricingTierDto, public readonly userId: string) { }
}
export class UpdateProgramPricingTierCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramPricingTierDto, public readonly userId: string) { }
}
export class DeleteProgramPricingTierCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Requirement
export class CreateProgramRequirementCommand {
    constructor(public readonly dto: CreateProgramRequirementDto, public readonly userId: string) { }
}
export class UpdateProgramRequirementCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramRequirementDto, public readonly userId: string) { }
}
export class DeleteProgramRequirementCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}
