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
}
