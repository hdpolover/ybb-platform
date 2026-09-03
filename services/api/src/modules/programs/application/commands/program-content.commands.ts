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
    CreateValidityPeriodDto, UpdateValidityPeriodDto,
    CreateProgramRequirementDto, UpdateProgramRequirementDto,
    CreateProgramEssayDto, UpdateProgramEssayDto, UpdateProgramEssayGuidelinesDto,
    CreateProgramParticipationCategoryDto, UpdateProgramParticipationCategoryDto,
    CreateProgramSubthemeDto, UpdateProgramSubthemeDto,
    CreateDocumentTemplateDto, UpdateDocumentTemplateDto,
    UpdateProgramPaymentInfoDto,
    UpdateProgramPartnersCanvaUrlDto,
} from '../../presentation/dto/create-update-program-content.dto';
import { UpdateProgramContactDto } from '../../presentation/dto/update-program-contact.dto';
import { UpdateProgramLandingContentDto } from '../../presentation/dto/update-program-landing-content.dto';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

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
    constructor(
        public readonly dto: CreateProgramSpeakerDto, 
        public readonly userId: string,
        public readonly image?: Express.Multer.File
    ) { }
}
export class UpdateProgramSpeakerCommand {
    constructor(
        public readonly id: string, 
        public readonly dto: UpdateProgramSpeakerDto, 
        public readonly userId: string,
        public readonly image?: Express.Multer.File
    ) { }
}
export class DeleteProgramSpeakerCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Gallery
export class CreateProgramGalleryCommand {
    constructor(
        public readonly dto: CreateProgramGalleryDto, 
        public readonly userId: string,
        // The caller, so the handler can refuse a program their scope does not
        // cover. userId alone is not enough: the scope lives on the Admin row.
        public readonly actor: CurrentUserData,
        public readonly image?: Express.Multer.File
    ) { }
}
export class UpdateProgramGalleryCommand {
    constructor(
        public readonly id: string, 
        public readonly dto: UpdateProgramGalleryDto, 
        public readonly userId: string,
        public readonly actor: CurrentUserData,
        public readonly image?: Express.Multer.File
    ) { }
}
export class DeleteProgramGalleryCommand {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
}

// Testimonial
export class CreateProgramTestimonialCommand {
    constructor(
        public readonly dto: CreateProgramTestimonialDto,
        public readonly userId: string,
        // See program-content-access.util.ts. Testimonials can be program- or
        // brand-scoped (both dto.programId and dto.brandId are optional), so the
        // handler picks which check applies rather than a single fixed id.
        public readonly actor: CurrentUserData,
    ) { }
}
export class UpdateProgramTestimonialCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateProgramTestimonialDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
}
export class DeleteProgramTestimonialCommand {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
}

// FAQ
export class CreateProgramFaqCommand {
    constructor(
        public readonly dto: CreateProgramFaqDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
}
export class UpdateProgramFaqCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateProgramFaqDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
}
export class DeleteProgramFaqCommand {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
}

// Team
export class CreateProgramTeamCommand {
    constructor(
        public readonly dto: CreateProgramTeamDto, 
        public readonly userId: string,
        public readonly image?: Express.Multer.File
    ) { }
}
export class UpdateProgramTeamCommand {
    constructor(
        public readonly id: string, 
        public readonly dto: UpdateProgramTeamDto, 
        public readonly userId: string,
        public readonly image?: Express.Multer.File
    ) { }
}
export class DeleteProgramTeamCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Partner
export class CreateProgramPartnerCommand {
    constructor(
        public readonly dto: CreateProgramPartnerDto, 
        public readonly userId: string,
        public readonly logo?: Express.Multer.File
    ) { }
}
export class UpdateProgramPartnerCommand {
    constructor(
        public readonly id: string, 
        public readonly dto: UpdateProgramPartnerDto, 
        public readonly userId: string,
        public readonly logo?: Express.Multer.File
    ) { }
}
export class DeleteProgramPartnerCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Resource
export class CreateProgramResourceCommand {
    constructor(
        public readonly dto: CreateProgramResourceDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
        public readonly file?: Express.Multer.File
    ) { }
}
export class UpdateProgramResourceCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateProgramResourceDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
        public readonly file?: Express.Multer.File
    ) { }
}
export class DeleteProgramResourceCommand {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) { }
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

// Validity Period
export class CreateValidityPeriodCommand {
    constructor(public readonly dto: CreateValidityPeriodDto, public readonly userId: string) { }
}
export class UpdateValidityPeriodCommand {
    constructor(public readonly id: string, public readonly dto: UpdateValidityPeriodDto, public readonly userId: string) { }
}
export class DeleteValidityPeriodCommand {
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

// Essay
export class CreateProgramEssayCommand {
    constructor(public readonly dto: CreateProgramEssayDto, public readonly userId: string) { }
}
export class UpdateProgramEssayCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramEssayDto, public readonly userId: string) { }
}
export class DeleteProgramEssayCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}
export class UpdateProgramEssayGuidelinesCommand {
    constructor(public readonly programId: string, public readonly dto: UpdateProgramEssayGuidelinesDto, public readonly userId: string) { }
}

// Participation Category Commands
export class CreateProgramParticipationCategoryCommand {
    constructor(
        public readonly dto: CreateProgramParticipationCategoryDto,
        public readonly userId: string,
    ) { }
}

export class UpdateProgramParticipationCategoryCommand {
    constructor(
        public readonly categoryId: string,
        public readonly dto: UpdateProgramParticipationCategoryDto,
        public readonly userId: string,
    ) { }
}

export class DeleteProgramParticipationCategoryCommand {
    constructor(
        public readonly categoryId: string,
        public readonly userId: string,
    ) { }
}

// Subtheme
export class CreateProgramSubthemeCommand {
    constructor(public readonly dto: CreateProgramSubthemeDto, public readonly userId: string) { }
}
export class UpdateProgramSubthemeCommand {
    constructor(public readonly id: string, public readonly dto: UpdateProgramSubthemeDto, public readonly userId: string) { }
}
export class DeleteProgramSubthemeCommand {
    constructor(public readonly id: string, public readonly userId: string) { }
}

// Document Template
export class CreateDocumentTemplateCommand {
    constructor(
        public readonly dto: CreateDocumentTemplateDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
        public readonly file?: Express.Multer.File,
    ) {}
}
export class UpdateDocumentTemplateCommand {
    constructor(
        public readonly id: string,
        public readonly dto: UpdateDocumentTemplateDto,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
        public readonly file?: Express.Multer.File,
    ) {}
}
export class DeleteDocumentTemplateCommand {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly actor: CurrentUserData,
    ) {}
}
// Program-level payment info
export class UpdateProgramPaymentInfoCommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UpdateProgramPaymentInfoDto,
        public readonly userId: string,
    ) { }
}

// Program-level contact info
export class UpdateProgramContactCommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UpdateProgramContactDto,
        public readonly userId: string,
    ) { }
}

// Program-level Partners-page Canva embed URL
export class UpdateProgramPartnersCanvaUrlCommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UpdateProgramPartnersCanvaUrlDto,
        public readonly userId: string,
    ) { }
}

// Program-owned landing content (allow-listed partial merge)
export class UpdateProgramLandingContentCommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UpdateProgramLandingContentDto,
        public readonly userId: string,
    ) { }
}
