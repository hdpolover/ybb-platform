import {
    ProgramTimeline,
    ProgramSchedule,
    ProgramSpeaker,
    ProgramGallery,
    ProgramTestimonial,
    ProgramFaq,
    ProgramTeam,
    ProgramPartner,
    ProgramResource,
    ProgramPricingTier,
    ProgramRequirement,
    PricingTierValidityPeriod,
    ApplicationFormField,
} from '@prisma/client';

export type ProgramPricingTierWithPeriods = ProgramPricingTier & { validityPeriods: PricingTierValidityPeriod[] };

export interface IProgramContentRepository {
    findTimelineByProgramId(programId: string): Promise<ProgramTimeline[]>;
    findSchedulesByProgramId(programId: string): Promise<ProgramSchedule[]>;
    findSpeakersByProgramId(programId: string): Promise<ProgramSpeaker[]>;
    findGalleryByProgramId(programId: string): Promise<ProgramGallery[]>;
    findTestimonialsByProgramId(programId: string, limit?: number): Promise<ProgramTestimonial[]>;
    findFaqsByProgramId(programId: string): Promise<ProgramFaq[]>;
    findTeamByProgramId(programId: string): Promise<ProgramTeam[]>;
    findPartnersByProgramId(programId: string): Promise<ProgramPartner[]>;
    findResourcesByProgramId(programId: string, limit?: number): Promise<ProgramResource[]>;
    findPricingTiersByProgramId(programId: string): Promise<ProgramPricingTierWithPeriods[]>;
    findRequirementsByProgramId(programId: string): Promise<ProgramRequirement[]>;
    findFormFieldsByProgramId(programId: string): Promise<ApplicationFormField[]>;

    // CRUD for Timeline
    createTimeline(data: Partial<ProgramTimeline>): Promise<ProgramTimeline>;
    updateTimeline(id: string, data: Partial<ProgramTimeline>): Promise<ProgramTimeline>;
    deleteTimeline(id: string): Promise<void>;
    findTimelineById(id: string): Promise<ProgramTimeline | null>;

    // CRUD for Schedules
    createSchedule(data: Partial<ProgramSchedule>): Promise<ProgramSchedule>;
    updateSchedule(id: string, data: Partial<ProgramSchedule>): Promise<ProgramSchedule>;
    deleteSchedule(id: string): Promise<void>;
    findScheduleById(id: string): Promise<ProgramSchedule | null>;

    // CRUD for Speakers
    createSpeaker(data: Partial<ProgramSpeaker>): Promise<ProgramSpeaker>;
    updateSpeaker(id: string, data: Partial<ProgramSpeaker>): Promise<ProgramSpeaker>;
    deleteSpeaker(id: string): Promise<void>;
    findSpeakerById(id: string): Promise<ProgramSpeaker | null>;

    // CRUD for Gallery
    createGallery(data: Partial<ProgramGallery>): Promise<ProgramGallery>;
    updateGallery(id: string, data: Partial<ProgramGallery>): Promise<ProgramGallery>;
    deleteGallery(id: string): Promise<void>;
    findGalleryById(id: string): Promise<ProgramGallery | null>;

    // CRUD for Testimonials
    createTestimonial(data: Partial<ProgramTestimonial>): Promise<ProgramTestimonial>;
    updateTestimonial(id: string, data: Partial<ProgramTestimonial>): Promise<ProgramTestimonial>;
    deleteTestimonial(id: string): Promise<void>;
    findTestimonialById(id: string): Promise<ProgramTestimonial | null>;

    // CRUD for FAQs
    createFaq(data: Partial<ProgramFaq>): Promise<ProgramFaq>;
    updateFaq(id: string, data: Partial<ProgramFaq>): Promise<ProgramFaq>;
    deleteFaq(id: string): Promise<void>;
    findFaqById(id: string): Promise<ProgramFaq | null>;

    // CRUD for Team
    createTeam(data: Partial<ProgramTeam>): Promise<ProgramTeam>;
    updateTeam(id: string, data: Partial<ProgramTeam>): Promise<ProgramTeam>;
    deleteTeam(id: string): Promise<void>;
    findTeamById(id: string): Promise<ProgramTeam | null>;

    // CRUD for Partners
    createPartner(data: Partial<ProgramPartner>): Promise<ProgramPartner>;
    updatePartner(id: string, data: Partial<ProgramPartner>): Promise<ProgramPartner>;
    deletePartner(id: string): Promise<void>;
    findPartnerById(id: string): Promise<ProgramPartner | null>;

    // CRUD for Resources
    createResource(data: Partial<ProgramResource>): Promise<ProgramResource>;
    updateResource(id: string, data: Partial<ProgramResource>): Promise<ProgramResource>;
    deleteResource(id: string): Promise<void>;
    findResourceById(id: string): Promise<ProgramResource | null>;

    // CRUD for Pricing Tiers
    createPricingTier(data: Partial<ProgramPricingTier>): Promise<ProgramPricingTier>;
    updatePricingTier(id: string, data: Partial<ProgramPricingTier>): Promise<ProgramPricingTier>;
    deletePricingTier(id: string): Promise<void>;
    findPricingTierById(id: string): Promise<ProgramPricingTier | null>;

    // CRUD for Requirements
    createRequirement(data: Partial<ProgramRequirement>): Promise<ProgramRequirement>;
    updateRequirement(id: string, data: Partial<ProgramRequirement>): Promise<ProgramRequirement>;
    deleteRequirement(id: string): Promise<void>;
    findRequirementById(id: string): Promise<ProgramRequirement | null>;

    // CRUD for Application Form Fields
    createFormField(data: Partial<ApplicationFormField>): Promise<ApplicationFormField>;
    updateFormField(id: string, data: Partial<ApplicationFormField>): Promise<ApplicationFormField>;
    deleteFormField(id: string): Promise<void>;
    findFormFieldById(id: string): Promise<ApplicationFormField | null>;
}
