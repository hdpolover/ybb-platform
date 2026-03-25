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

type ApplicationDetail = {
    id: string;
    status: string;
    applicationCategory: string | null;
    personalData: unknown;
    essayAnswers: unknown;
    uploadedFiles: unknown;
    program: {
        id: string;
        name: string;
        formFields: {
            id: string;
            section: string | null;
            label: string;
            name: string;
            type: string;
            placeholder: string | null;
            helpText: string | null;
            mediaUrl: string | null;
            mediaAlt: string | null;
            options: unknown;
            validationRules: unknown;
            isRequired: boolean;
            order: number;
        }[];
        essays: {
            id: string;
            question: string;
            isRequired: boolean;
            wordLimit: number | null;
            order: number;
        }[];
        requirements: {
            id: string;
            name: string;
            description: string | null;
            type: string;
            isRequired: boolean;
            order: number;
        }[];
        subthemes: {
            id: string;
            name: string;
            description: string | null;
        }[];
    };
};

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
        const { userId, programId } = query;

        const cacheKey = CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId, programId);
        const cached =
            await this.cacheService.get<PortalSubmissionDetailResponseDto>(cacheKey);
        if (cached) return cached;

        const participant =
            await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.findApplication(participant.id, programId);
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

    private async findApplication(participantId: string, programId?: string) {
        return this.prisma.participantApplication.findFirst({
            where: {
                participantId,
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
                        subthemes: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                name: true,
                                description: true,
                            },
                            orderBy: { order: 'asc' },
                        },
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
                                mediaUrl: true,
                                mediaAlt: true,
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
        application: ApplicationDetail,
    ): SubmissionSectionDetailDto[] {
        const personalData = (application.personalData as Record<string, unknown>) || {};
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
                mediaUrl: field.mediaUrl || undefined,
                mediaAlt: field.mediaAlt || undefined,
                options: this.resolveFieldOptions(field as unknown as SubmissionFormFieldDto, application),
                validationRules: (field.validationRules || undefined) as import('../../../presentation/dto/portal-submission-detail.dto').FieldValidationRules | undefined,
                isRequired: field.isRequired,
                order: field.order,
            } as import('../../../presentation/dto/portal-submission-detail.dto').SubmissionFormFieldDto);
        }

        const sectionTitles: Record<string, string> = {
            personal_info: 'Personal Information',
            personal_details: 'Personal Details',
            contact_information: 'Contact Information',
            professional_profile: 'Professional Profile',
            entry_information: 'Entry Information',
            miscellaneous: 'Miscellaneous',
            additional_info: 'Additional Information',
        };

        const sectionDescriptions: Record<string, string> = {
            personal_details: 'Basic personal and background information about the participant.',
            contact_information: 'Participant and emergency contact details.',
            professional_profile: 'Education, experience, and supporting profile information.',
            entry_information: 'Application category, subtheme selection, and essay context.',
            miscellaneous: 'Referral, campaign, and social proof details.',
            personal_info: 'Basic participant information.',
            additional_info: 'Additional participant information.',
        };

        const sectionOrder: Record<string, number> = {
            personal_details: 1,
            contact_information: 2,
            professional_profile: 3,
            entry_information: 4,
            miscellaneous: 5,
            personal_info: 6,
            additional_info: 7,
        };

        const sections: SubmissionSectionDetailDto[] = [];
        for (const [sectionId, fields] of sectionMap) {
            const values = this.buildSectionValues(sectionId, fields, application, personalData);
            const filledCount = fields.filter(field => this.hasValue(values[field.name])).length;
            const requiredCount = fields.filter((f) => f.isRequired).length;

            let status = 'pending';
            if (filledCount >= requiredCount && requiredCount > 0) status = 'completed';
            else if (filledCount > 0) status = 'in_progress';

            sections.push({
                id: sectionId,
                title: sectionTitles[sectionId] || sectionId,
                description: sectionDescriptions[sectionId],
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
                description: sectionDescriptions.personal_info,
                fields: [],
                values: personalData,
                status: Object.keys(personalData).length > 0 ? 'completed' : 'pending',
            });
        }

        return sections.sort(
            (left, right) => (sectionOrder[left.id] || Number.MAX_SAFE_INTEGER) - (sectionOrder[right.id] || Number.MAX_SAFE_INTEGER),
        );
    }

    private buildSectionValues(
        sectionId: string,
        fields: SubmissionFormFieldDto[],
        application: ApplicationDetail,
        personalData: Record<string, unknown>,
    ): Record<string, unknown> {
        const values: Record<string, unknown> = {};

        for (const field of fields) {
            if (field.name === 'category') {
                values[field.name] = personalData[field.name] ?? application.applicationCategory ?? undefined;
                continue;
            }

            if (field.name === 'program_id') {
                values[field.name] = application.program.id;
                continue;
            }

            values[field.name] = personalData[field.name] ?? undefined;
        }

        if (sectionId === 'personal_info' && fields.length === 0) {
            return personalData;
        }

        return values;
    }

    private resolveFieldOptions(field: SubmissionFormFieldDto, application: ApplicationDetail): SubmissionFormFieldDto['options'] {
        if (field.name === 'program_subtheme_id') {
            return (application.program.subthemes || []).map((subtheme) => ({
                label: subtheme.name,
                value: subtheme.id,
            }));
        }

        return field.options || undefined;
    }

    private hasValue(value: unknown): boolean {
        if (value === null || value === undefined) return false;
        if (typeof value === 'string') return value.trim().length > 0;
        if (Array.isArray(value)) return value.length > 0;
        if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
        return true;
    }

    private buildEssays(application: ApplicationDetail): SubmissionEssayDto[] {
        const essayAnswers = (application.essayAnswers as Record<string, unknown>) || {};
        const programEssays = application.program.essays || [];

        return programEssays.map((essay) => ({
            id: essay.id,
            question: essay.question,
            isRequired: essay.isRequired,
            wordLimit: essay.wordLimit || undefined,
            order: essay.order,
            answer: (essayAnswers[essay.id] || undefined) as string | undefined,
        }));
    }

    private buildRequirements(application: ApplicationDetail): SubmissionRequirementDto[] {
        const uploadedFiles = (application.uploadedFiles as Record<string, unknown>) || {};
        const programReqs = application.program.requirements || [];

        return programReqs.map((req) => ({
            id: req.id,
            name: req.name,
            description: req.description || undefined,
            type: req.type,
            isRequired: req.isRequired,
            order: req.order,
            uploadedFile: (uploadedFiles[req.id] || undefined) as import('@core/entities/participant-application.entity').DocumentFile | undefined,
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
