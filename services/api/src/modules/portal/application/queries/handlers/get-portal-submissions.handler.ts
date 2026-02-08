import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalSubmissionsQuery } from '../portal-queries';
import { 
    PortalSubmissionResponseDto, 
    SubmissionSectionDto 
} from '../../../presentation/dto/portal-submission.dto';

@Injectable()
@QueryHandler(GetPortalSubmissionsQuery)
export class GetPortalSubmissionsHandler implements IQueryHandler<GetPortalSubmissionsQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(query: GetPortalSubmissionsQuery): Promise<PortalSubmissionResponseDto> {
        const { userId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_SUBMISSIONS(userId);
        const cached = await this.cacheService.get<PortalSubmissionResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Cache miss - fetch from database
        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                status: true,
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
                program: {
                    select: {
                        id: true,
                        name: true,
                        essays: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                isRequired: true
                            }
                        },
                        requirements: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                isRequired: true
                            }
                        }
                    }
                }
            }
        });

        if (!application) throw new NotFoundException('No active application found');

        // Build Sections
        const sections: SubmissionSectionDto[] = [];

        // 1. Personal Info
        const personalInfoFilled = application.personalData && Object.keys(application.personalData as any).length > 0;
        sections.push({
            id: 'personal_info',
            title: 'Personal Information',
            description: 'Basic details and contact information',
            status: personalInfoFilled ? 'completed' : 'pending',
            isRequired: true
        });

        // 2. Essays
        const requiredEssaysCount = application.program.essays.filter(e => e.isRequired).length;
        const currentEssays = (application.essayAnswers as any) || {};
        const filledEssaysCount = Object.keys(currentEssays).length;
        
        let essayStatus = 'pending';
        if (filledEssaysCount >= requiredEssaysCount) essayStatus = 'completed';
        else if (filledEssaysCount > 0) essayStatus = 'in_progress';

        sections.push({
            id: 'essays',
            title: 'Essays',
            description: 'Motivation and program-specific questions',
            status: essayStatus,
            isRequired: requiredEssaysCount > 0
        });

        // 3. Documents
        const requiredDocsCount = application.program.requirements.filter(r => r.isRequired).length;
        // Check uploadedFiles JSON for user uploads
        const currentDocs = (application.uploadedFiles as any) || {};
        const filledDocsCount = Object.keys(currentDocs).length;

        let docStatus = 'pending';
        if (filledDocsCount >= requiredDocsCount) docStatus = 'completed';
        else if (filledDocsCount > 0) docStatus = 'in_progress';

        sections.push({
            id: 'documents',
            title: 'Documents',
            description: 'Required uploads like Passport, Photo, etc.',
            status: docStatus,
            isRequired: requiredDocsCount > 0
        });

        // Calculate Overall Progress
        const totalSections = sections.length;
        const completedSections = sections.filter(s => s.status === 'completed').length;
        const progress = totalSections > 0 ? Math.round((completedSections / totalSections) * 100) : 0;

        const result = {
            applicationId: application.id,
            programName: application.program.name,
            status: application.status,
            overallProgress: progress,
            sections
        };

        // Cache the result for 5 minutes
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);

        return result;
    }
}
