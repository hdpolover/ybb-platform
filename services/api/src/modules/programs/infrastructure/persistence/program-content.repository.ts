import { Injectable } from '@nestjs/common';
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
    ApplicationFormField,
    ProgramEssay,
    ProgramParticipationCategory,
    Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IProgramContentRepository, ProgramPricingTierWithPeriods } from '../../../../core/interfaces/repositories/program-content.repository.interface';

@Injectable()
export class ProgramContentRepository implements IProgramContentRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findTimelineByProgramId(programId: string): Promise<ProgramTimeline[]> {
        return this.prisma.programTimeline.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findSchedulesByProgramId(programId: string): Promise<ProgramSchedule[]> {
        return this.prisma.programSchedule.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findSpeakersByProgramId(programId: string): Promise<ProgramSpeaker[]> {
        return this.prisma.programSpeaker.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findGalleryByProgramId(programId: string): Promise<ProgramGallery[]> {
        return this.prisma.programGallery.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findTestimonialsByProgramId(programId: string, limit?: number): Promise<ProgramTestimonial[]> {
        return this.prisma.programTestimonial.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
            take: limit,
        });
    }

    async findFaqsByProgramId(programId: string): Promise<ProgramFaq[]> {
        return this.prisma.programFaq.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findTeamByProgramId(programId: string): Promise<ProgramTeam[]> {
        return this.prisma.programTeam.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findPartnersByProgramId(programId: string): Promise<ProgramPartner[]> {
        return this.prisma.programPartner.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findResourcesByProgramId(programId: string, limit?: number): Promise<ProgramResource[]> {
        return this.prisma.programResource.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
            take: limit,
        });
    }

    async findPricingTiersByProgramId(programId: string): Promise<ProgramPricingTierWithPeriods[]> {
        return this.prisma.programPricingTier.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
            include: {
                validityPeriods: true
            }
        });
    }

    async findRequirementsByProgramId(programId: string): Promise<ProgramRequirement[]> {
        return this.prisma.programRequirement.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    // CRUD for Timeline
    async createTimeline(data: Record<string, unknown>): Promise<ProgramTimeline> {
        return this.prisma.programTimeline.create({ data: data as Prisma.ProgramTimelineUncheckedCreateInput });
    }
    async updateTimeline(id: string, data: Record<string, unknown>): Promise<ProgramTimeline> {
        return this.prisma.programTimeline.update({ where: { id }, data: data as Prisma.ProgramTimelineUncheckedUpdateInput });
    }
    async deleteTimeline(id: string): Promise<void> {
        await this.prisma.programTimeline.delete({ where: { id } });
    }
    async findTimelineById(id: string): Promise<ProgramTimeline | null> {
        return this.prisma.programTimeline.findUnique({ where: { id } });
    }

    // CRUD for Schedules
    async createSchedule(data: Record<string, unknown>): Promise<ProgramSchedule> {
        return this.prisma.programSchedule.create({ data: data as Prisma.ProgramScheduleUncheckedCreateInput });
    }
    async updateSchedule(id: string, data: Record<string, unknown>): Promise<ProgramSchedule> {
        return this.prisma.programSchedule.update({ where: { id }, data: data as Prisma.ProgramScheduleUncheckedUpdateInput });
    }
    async deleteSchedule(id: string): Promise<void> {
        await this.prisma.programSchedule.delete({ where: { id } });
    }
    async findScheduleById(id: string): Promise<ProgramSchedule | null> {
        return this.prisma.programSchedule.findUnique({ where: { id } });
    }

    // CRUD for Speakers
    async createSpeaker(data: Record<string, unknown>): Promise<ProgramSpeaker> {
        return this.prisma.programSpeaker.create({ data: data as Prisma.ProgramSpeakerUncheckedCreateInput });
    }
    async updateSpeaker(id: string, data: Record<string, unknown>): Promise<ProgramSpeaker> {
        return this.prisma.programSpeaker.update({ where: { id }, data: data as Prisma.ProgramSpeakerUncheckedUpdateInput });
    }
    async deleteSpeaker(id: string): Promise<void> {
        await this.prisma.programSpeaker.delete({ where: { id } });
    }
    async findSpeakerById(id: string): Promise<ProgramSpeaker | null> {
        return this.prisma.programSpeaker.findUnique({ where: { id } });
    }

    // CRUD for Gallery
    async createGallery(data: Record<string, unknown>): Promise<ProgramGallery> {
        return this.prisma.programGallery.create({ data: data as Prisma.ProgramGalleryUncheckedCreateInput });
    }
    async updateGallery(id: string, data: Record<string, unknown>): Promise<ProgramGallery> {
        return this.prisma.programGallery.update({ where: { id }, data: data as Prisma.ProgramGalleryUncheckedUpdateInput });
    }
    async deleteGallery(id: string): Promise<void> {
        await this.prisma.programGallery.delete({ where: { id } });
    }
    async findGalleryById(id: string): Promise<ProgramGallery | null> {
        return this.prisma.programGallery.findUnique({ where: { id } });
    }

    // CRUD for Testimonials
    async createTestimonial(data: Record<string, unknown>): Promise<ProgramTestimonial> {
        return this.prisma.programTestimonial.create({ data: data as Prisma.ProgramTestimonialUncheckedCreateInput });
    }
    async updateTestimonial(id: string, data: Record<string, unknown>): Promise<ProgramTestimonial> {
        return this.prisma.programTestimonial.update({ where: { id }, data: data as Prisma.ProgramTestimonialUncheckedUpdateInput });
    }
    async deleteTestimonial(id: string): Promise<void> {
        await this.prisma.programTestimonial.delete({ where: { id } });
    }
    async findTestimonialById(id: string): Promise<ProgramTestimonial | null> {
        return this.prisma.programTestimonial.findUnique({ where: { id } });
    }

    // CRUD for FAQs
    async createFaq(data: Record<string, unknown>): Promise<ProgramFaq> {
        return this.prisma.programFaq.create({ data: data as Prisma.ProgramFaqUncheckedCreateInput });
    }
    async updateFaq(id: string, data: Record<string, unknown>): Promise<ProgramFaq> {
        return this.prisma.programFaq.update({ where: { id }, data: data as Prisma.ProgramFaqUncheckedUpdateInput });
    }
    async deleteFaq(id: string): Promise<void> {
        await this.prisma.programFaq.delete({ where: { id } });
    }
    async findFaqById(id: string): Promise<ProgramFaq | null> {
        return this.prisma.programFaq.findUnique({ where: { id } });
    }

    // CRUD for Team
    async createTeam(data: Record<string, unknown>): Promise<ProgramTeam> {
        return this.prisma.programTeam.create({ data: data as Prisma.ProgramTeamUncheckedCreateInput });
    }
    async updateTeam(id: string, data: Record<string, unknown>): Promise<ProgramTeam> {
        return this.prisma.programTeam.update({ where: { id }, data: data as Prisma.ProgramTeamUncheckedUpdateInput });
    }
    async deleteTeam(id: string): Promise<void> {
        await this.prisma.programTeam.delete({ where: { id } });
    }
    async findTeamById(id: string): Promise<ProgramTeam | null> {
        return this.prisma.programTeam.findUnique({ where: { id } });
    }

    // CRUD for Partners
    async createPartner(data: Record<string, unknown>): Promise<ProgramPartner> {
        return this.prisma.programPartner.create({ data: data as Prisma.ProgramPartnerUncheckedCreateInput });
    }
    async updatePartner(id: string, data: Record<string, unknown>): Promise<ProgramPartner> {
        return this.prisma.programPartner.update({ where: { id }, data: data as Prisma.ProgramPartnerUncheckedUpdateInput });
    }
    async deletePartner(id: string): Promise<void> {
        await this.prisma.programPartner.delete({ where: { id } });
    }
    async findPartnerById(id: string): Promise<ProgramPartner | null> {
        return this.prisma.programPartner.findUnique({ where: { id } });
    }

    // CRUD for Resources
    async createResource(data: Record<string, unknown>): Promise<ProgramResource> {
        return this.prisma.programResource.create({ data: data as Prisma.ProgramResourceUncheckedCreateInput });
    }
    async updateResource(id: string, data: Record<string, unknown>): Promise<ProgramResource> {
        return this.prisma.programResource.update({ where: { id }, data: data as Prisma.ProgramResourceUncheckedUpdateInput });
    }
    async deleteResource(id: string): Promise<void> {
        await this.prisma.programResource.delete({ where: { id } });
    }
    async findResourceById(id: string): Promise<ProgramResource | null> {
        return this.prisma.programResource.findUnique({ where: { id } });
    }

    // CRUD for Pricing Tiers
    async createPricingTier(data: Record<string, unknown>): Promise<ProgramPricingTier> {
        return this.prisma.programPricingTier.create({ data: data as Prisma.ProgramPricingTierUncheckedCreateInput });
    }
    async updatePricingTier(id: string, data: Record<string, unknown>): Promise<ProgramPricingTier> {
        return this.prisma.programPricingTier.update({ where: { id }, data: data as Prisma.ProgramPricingTierUncheckedUpdateInput });
    }
    async deletePricingTier(id: string): Promise<void> {
        await this.prisma.programPricingTier.delete({ where: { id } });
    }
    async findPricingTierById(id: string): Promise<ProgramPricingTier | null> {
        return this.prisma.programPricingTier.findUnique({ where: { id } });
    }

    // CRUD for Requirements
    async createRequirement(data: Record<string, unknown>): Promise<ProgramRequirement> {
        return this.prisma.programRequirement.create({ data: data as Prisma.ProgramRequirementUncheckedCreateInput });
    }
    async updateRequirement(id: string, data: Record<string, unknown>): Promise<ProgramRequirement> {
        return this.prisma.programRequirement.update({ where: { id }, data: data as Prisma.ProgramRequirementUncheckedUpdateInput });
    }
    async deleteRequirement(id: string): Promise<void> {
        await this.prisma.programRequirement.delete({ where: { id } });
    }
    async findRequirementById(id: string): Promise<ProgramRequirement | null> {
        return this.prisma.programRequirement.findUnique({ where: { id } });
    }

    async findFormFieldsByProgramId(programId: string): Promise<ApplicationFormField[]> {
        return this.prisma.applicationFormField.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    // CRUD for Application Form Fields
    async createFormField(data: Record<string, unknown>): Promise<ApplicationFormField> {
        return this.prisma.applicationFormField.create({ data: data as Prisma.ApplicationFormFieldUncheckedCreateInput });
    }
    async updateFormField(id: string, data: Record<string, unknown>): Promise<ApplicationFormField> {
        return this.prisma.applicationFormField.update({ where: { id }, data: data as Prisma.ApplicationFormFieldUncheckedUpdateInput });
    }
    async deleteFormField(id: string): Promise<void> {
        await this.prisma.applicationFormField.delete({ where: { id } });
    }
    async findFormFieldById(id: string): Promise<ApplicationFormField | null> {
        return this.prisma.applicationFormField.findUnique({ where: { id } });
    }

    async findEssaysByProgramId(programId: string, includeInactive = false): Promise<ProgramEssay[]> {
        return this.prisma.programEssay.findMany({
            where: includeInactive ? { programId } : { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findParticipationCategoriesByProgramId(programId: string, includeInactive = false): Promise<ProgramParticipationCategory[]> {
        return this.prisma.programParticipationCategory.findMany({
            where: includeInactive ? { programId } : { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    // CRUD for Essays
    async createEssay(data: Record<string, unknown>): Promise<ProgramEssay> {
        return this.prisma.programEssay.create({ data: data as Prisma.ProgramEssayUncheckedCreateInput });
    }
    async updateEssay(id: string, data: Record<string, unknown>): Promise<ProgramEssay> {
        return this.prisma.programEssay.update({ where: { id }, data: data as Prisma.ProgramEssayUncheckedUpdateInput });
    }
    async deleteEssay(id: string): Promise<void> {
        await this.prisma.programEssay.delete({ where: { id } });
    }
    async findEssayById(id: string): Promise<ProgramEssay | null> {
        return this.prisma.programEssay.findUnique({ where: { id } });
    }

    // CRUD for Participation Categories
    async createParticipationCategory(data: Record<string, unknown>): Promise<ProgramParticipationCategory> {
        return this.prisma.programParticipationCategory.create({ data: data as Prisma.ProgramParticipationCategoryUncheckedCreateInput });
    }
    async updateParticipationCategory(id: string, data: Record<string, unknown>): Promise<ProgramParticipationCategory> {
        return this.prisma.programParticipationCategory.update({ where: { id }, data: data as Prisma.ProgramParticipationCategoryUncheckedUpdateInput });
    }
    async deleteParticipationCategory(id: string): Promise<void> {
        await this.prisma.programParticipationCategory.delete({ where: { id } });
    }
    async findParticipationCategoryById(id: string): Promise<ProgramParticipationCategory | null> {
        return this.prisma.programParticipationCategory.findUnique({ where: { id } });
    }
} // Re-closing the class
