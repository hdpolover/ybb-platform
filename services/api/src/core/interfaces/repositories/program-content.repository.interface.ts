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
} from '@prisma/client';

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
    findPricingTiersByProgramId(programId: string): Promise<ProgramPricingTier[]>;
    findRequirementsByProgramId(programId: string): Promise<ProgramRequirement[]>;
}
