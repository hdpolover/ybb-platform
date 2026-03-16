import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalSubmissionsQuery } from '../portal-queries';
import {
    buildSubmissionProgressSections,
    calculateSubmissionProgress,
} from '../../services/submission-progress.util';
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
        const { userId, programId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_SUBMISSIONS(userId, programId);
        const cached = await this.cacheService.get<PortalSubmissionResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Cache miss - fetch from database
        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: {
                participantId: participant.id,
                ...(programId ? { programId } : {}),
            },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                status: true,
                applicationCategory: true,
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
                program: {
                    select: {
                        id: true,
                        name: true,
                        formFields: {
                            where: { isActive: true },
                            select: {
                                section: true,
                                name: true,
                                isRequired: true,
                            },
                            orderBy: { order: 'asc' },
                        },
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

        const sections: SubmissionSectionDto[] = buildSubmissionProgressSections(application);
        const progress = calculateSubmissionProgress(application);

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
