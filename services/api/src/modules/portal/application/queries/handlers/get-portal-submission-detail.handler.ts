import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalSubmissionDetailQuery } from '../portal-queries';
import {
    PortalSubmissionDetailResponseDto,
    SubmissionSectionDetailDto,
    SubmissionFormFieldDto,
    SubmissionEssayDto,
    SubmissionRequirementDto,
} from '../../../presentation/dto/portal-submission-detail.dto';

/**
 * Get Portal Submission Detail Handler
 *
 * Returns the full submission form data including form fields,
 * essay questions, document requirements, and all saved values.
 */
@Injectable()
@QueryHandler(GetPortalSubmissionDetailQuery)
export class GetPortalSubmissionDetailHandler
    implements IQueryHandler<GetPortalSubmissionDetailQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) { }

    async execute(
        query: GetPortalSubmissionDetailQuery,
    ): Promise<PortalSubmissionDetailResponseDto> {
        const { userId } = query;

        const cacheKey = CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId);
        const cached =
            await this.cacheService.get<PortalSubmissionDetailResponseDto>(cacheKey);
        if (cached) return cached;

        const participant =
            await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.findLatestApplication(participant.id);
        if (!application) throw new NotFoundException('No active application found');

        const sections = this.buildSections(application);
        const essays = this.buildEssays(application);
        const requirements = this.buildRequirements(application);
        const overallProgress = this.calculateProgress(sections, essays, requirements);

        const result: PortalSubmissionDetailResponseDto = {
            applicationId: application.id,
            programId: application.program.id,
            programName: application.program.name,
            status: application.status,
            overallProgress,
            sections,
            essays,
            requirements,
        };

        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);
        return result;
    }

    private async findLatestApplication(participantId: string) {
        return this.prisma.participantApplication.findFirst({
            where: { participantId },
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
                        formFields: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                section: true,
                                label: true,
                                name: true,
                                type: true,
                                placeholder: true,
                                helpText: true,
                                options: true,
                                validationRules: true,
                                isRequired: true,
                                order: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                        essays: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                question: true,
                                isRequired: true,
                                wordLimit: true,
                                order: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                        requirements: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                name: true,
                                description: true,
                                type: true,
                                isRequired: true,
                                order: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                    },
                },
            },
        });
    }

    private buildSections(
        application: any,
    ): SubmissionSectionDetailDto[] {
        const personalData = (application.personalData as Record<string, any>) || {};
        const formFields = application.program.formFields || [];

        // Group form fields by section
        const sectionMap = new Map<string, SubmissionFormFieldDto[]>();
        for (const field of formFields) {
            const section = field.section || 'personal_info';
            if (!sectionMap.has(section)) {
                sectionMap.set(section, []);
            }
            sectionMap.get(section)!.push({
                id: field.id,
                name: field.name,
                label: field.label,
                type: field.type,
                placeholder: field.placeholder || undefined,
                helpText: field.helpText || undefined,
                options: field.options || undefined,
                validationRules: field.validationRules || undefined,
                isRequired: field.isRequired,
                order: field.order,
            });
        }

        const sectionTitles: Record<string, string> = {
            personal_info: 'Personal Information',
            additional_info: 'Additional Information',
        };

        const sections: SubmissionSectionDetailDto[] = [];
        for (const [sectionId, fields] of sectionMap) {
            const values = sectionId === 'personal_info' ? personalData : {};
            const filledCount = Object.keys(values).filter(
                (k) => values[k] !== null && values[k] !== undefined && values[k] !== '',
            ).length;
            const requiredCount = fields.filter((f) => f.isRequired).length;

            let status = 'pending';
            if (filledCount >= requiredCount && requiredCount > 0) status = 'completed';
            else if (filledCount > 0) status = 'in_progress';

            sections.push({
                id: sectionId,
                title: sectionTitles[sectionId] || sectionId,
                description: undefined,
                fields,
                values,
                status,
            });
        }

        // Ensure personal_info exists even without form fields
        if (!sectionMap.has('personal_info')) {
            sections.unshift({
                id: 'personal_info',
                title: 'Personal Information',
                fields: [],
                values: personalData,
                status: Object.keys(personalData).length > 0 ? 'completed' : 'pending',
            });
        }

        return sections;
    }

    private buildEssays(application: any): SubmissionEssayDto[] {
        const essayAnswers = (application.essayAnswers as Record<string, any>) || {};
        const programEssays = application.program.essays || [];

        return programEssays.map((essay: any) => ({
            id: essay.id,
            question: essay.question,
            isRequired: essay.isRequired,
            wordLimit: essay.wordLimit || undefined,
            order: essay.order,
            answer: essayAnswers[essay.id] || undefined,
        }));
    }

    private buildRequirements(application: any): SubmissionRequirementDto[] {
        const uploadedFiles = (application.uploadedFiles as Record<string, any>) || {};
        const programReqs = application.program.requirements || [];

        return programReqs.map((req: any) => ({
            id: req.id,
            name: req.name,
            description: req.description || undefined,
            type: req.type,
            isRequired: req.isRequired,
            order: req.order,
            uploadedFile: uploadedFiles[req.id] || undefined,
        }));
    }

    private calculateProgress(
        sections: SubmissionSectionDetailDto[],
        essays: SubmissionEssayDto[],
        requirements: SubmissionRequirementDto[],
    ): number {
        let totalItems = 0;
        let completedItems = 0;

        // Sections progress
        for (const section of sections) {
            totalItems++;
            if (section.status === 'completed') completedItems++;
        }

        // Essays progress
        const requiredEssays = essays.filter((e) => e.isRequired);
        if (requiredEssays.length > 0) {
            totalItems++;
            const answeredRequired = requiredEssays.filter((e) => e.answer).length;
            if (answeredRequired >= requiredEssays.length) completedItems++;
        }

        // Requirements progress
        const requiredReqs = requirements.filter((r) => r.isRequired);
        if (requiredReqs.length > 0) {
            totalItems++;
            const uploadedRequired = requiredReqs.filter((r) => r.uploadedFile).length;
            if (uploadedRequired >= requiredReqs.length) completedItems++;
        }

        return totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;
    }
}
