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
} from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import { IProgramContentRepository } from '../../../../core/interfaces/repositories/program-content.repository.interface';

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

    async findPricingTiersByProgramId(programId: string): Promise<ProgramPricingTier[]> {
        return this.prisma.programPricingTier.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    async findRequirementsByProgramId(programId: string): Promise<ProgramRequirement[]> {
        return this.prisma.programRequirement.findMany({
            where: { programId, isActive: true },
            orderBy: { order: 'asc' },
        });
    }

    // CRUD for Timeline
    async createTimeline(data: any): Promise<ProgramTimeline> {
        return this.prisma.programTimeline.create({ data });
    }
    async updateTimeline(id: string, data: any): Promise<ProgramTimeline> {
        return this.prisma.programTimeline.update({ where: { id }, data });
    }
    async deleteTimeline(id: string): Promise<void> {
        await this.prisma.programTimeline.delete({ where: { id } });
    }
    async findTimelineById(id: string): Promise<ProgramTimeline | null> {
        return this.prisma.programTimeline.findUnique({ where: { id } });
    }

    // CRUD for Schedules
    async createSchedule(data: any): Promise<ProgramSchedule> {
        return this.prisma.programSchedule.create({ data });
    }
    async updateSchedule(id: string, data: any): Promise<ProgramSchedule> {
        return this.prisma.programSchedule.update({ where: { id }, data });
    }
    async deleteSchedule(id: string): Promise<void> {
        await this.prisma.programSchedule.delete({ where: { id } });
    }
    async findScheduleById(id: string): Promise<ProgramSchedule | null> {
        return this.prisma.programSchedule.findUnique({ where: { id } });
    }

    // CRUD for Speakers
    async createSpeaker(data: any): Promise<ProgramSpeaker> {
        return this.prisma.programSpeaker.create({ data });
    }
    async updateSpeaker(id: string, data: any): Promise<ProgramSpeaker> {
        return this.prisma.programSpeaker.update({ where: { id }, data });
    }
    async deleteSpeaker(id: string): Promise<void> {
        await this.prisma.programSpeaker.delete({ where: { id } });
    }
    async findSpeakerById(id: string): Promise<ProgramSpeaker | null> {
        return this.prisma.programSpeaker.findUnique({ where: { id } });
    }

    // CRUD for Gallery
    async createGallery(data: any): Promise<ProgramGallery> {
        return this.prisma.programGallery.create({ data });
    }
    async updateGallery(id: string, data: any): Promise<ProgramGallery> {
        return this.prisma.programGallery.update({ where: { id }, data });
    }
    async deleteGallery(id: string): Promise<void> {
        await this.prisma.programGallery.delete({ where: { id } });
    }
    async findGalleryById(id: string): Promise<ProgramGallery | null> {
        return this.prisma.programGallery.findUnique({ where: { id } });
    }

    // CRUD for Testimonials
    async createTestimonial(data: any): Promise<ProgramTestimonial> {
        return this.prisma.programTestimonial.create({ data });
    }
    async updateTestimonial(id: string, data: any): Promise<ProgramTestimonial> {
        return this.prisma.programTestimonial.update({ where: { id }, data });
    }
    async deleteTestimonial(id: string): Promise<void> {
        await this.prisma.programTestimonial.delete({ where: { id } });
    }
    async findTestimonialById(id: string): Promise<ProgramTestimonial | null> {
        return this.prisma.programTestimonial.findUnique({ where: { id } });
    }

    // CRUD for FAQs
    async createFaq(data: any): Promise<ProgramFaq> {
        return this.prisma.programFaq.create({ data });
    }
    async updateFaq(id: string, data: any): Promise<ProgramFaq> {
        return this.prisma.programFaq.update({ where: { id }, data });
    }
    async deleteFaq(id: string): Promise<void> {
        await this.prisma.programFaq.delete({ where: { id } });
    }
    async findFaqById(id: string): Promise<ProgramFaq | null> {
        return this.prisma.programFaq.findUnique({ where: { id } });
    }

    // CRUD for Team
    async createTeam(data: any): Promise<ProgramTeam> {
        return this.prisma.programTeam.create({ data });
    }
    async updateTeam(id: string, data: any): Promise<ProgramTeam> {
        return this.prisma.programTeam.update({ where: { id }, data });
    }
    async deleteTeam(id: string): Promise<void> {
        await this.prisma.programTeam.delete({ where: { id } });
    }
    async findTeamById(id: string): Promise<ProgramTeam | null> {
        return this.prisma.programTeam.findUnique({ where: { id } });
    }

    // CRUD for Partners
    async createPartner(data: any): Promise<ProgramPartner> {
        return this.prisma.programPartner.create({ data });
    }
    async updatePartner(id: string, data: any): Promise<ProgramPartner> {
        return this.prisma.programPartner.update({ where: { id }, data });
    }
    async deletePartner(id: string): Promise<void> {
        await this.prisma.programPartner.delete({ where: { id } });
    }
    async findPartnerById(id: string): Promise<ProgramPartner | null> {
        return this.prisma.programPartner.findUnique({ where: { id } });
    }

    // CRUD for Resources
    async createResource(data: any): Promise<ProgramResource> {
        return this.prisma.programResource.create({ data });
    }
    async updateResource(id: string, data: any): Promise<ProgramResource> {
        return this.prisma.programResource.update({ where: { id }, data });
    }
    async deleteResource(id: string): Promise<void> {
        await this.prisma.programResource.delete({ where: { id } });
    }
    async findResourceById(id: string): Promise<ProgramResource | null> {
        return this.prisma.programResource.findUnique({ where: { id } });
    }

    // CRUD for Pricing Tiers
    async createPricingTier(data: any): Promise<ProgramPricingTier> {
        return this.prisma.programPricingTier.create({ data });
    }
    async updatePricingTier(id: string, data: any): Promise<ProgramPricingTier> {
        return this.prisma.programPricingTier.update({ where: { id }, data });
    }
    async deletePricingTier(id: string): Promise<void> {
        await this.prisma.programPricingTier.delete({ where: { id } });
    }
    async findPricingTierById(id: string): Promise<ProgramPricingTier | null> {
        return this.prisma.programPricingTier.findUnique({ where: { id } });
    }

    // CRUD for Requirements
    async createRequirement(data: any): Promise<ProgramRequirement> {
        return this.prisma.programRequirement.create({ data });
    }
    async updateRequirement(id: string, data: any): Promise<ProgramRequirement> {
        return this.prisma.programRequirement.update({ where: { id }, data });
    }
    async deleteRequirement(id: string): Promise<void> {
        await this.prisma.programRequirement.delete({ where: { id } });
    }
    async findRequirementById(id: string): Promise<ProgramRequirement | null> {
        return this.prisma.programRequirement.findUnique({ where: { id } });
    }
}
