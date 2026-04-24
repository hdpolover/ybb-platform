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
    participationCategoryId: string | null;
    personalData: unknown;
    essayAnswers: unknown;
    uploadedFiles: unknown;
    program: {
        id: string;
        name: string;
        participationCategories: {
            id: string;
            name: string;
            order: number;
            isActive: boolean;
        }[];
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

type PortalParticipantProfile = NonNullable<Awaited<ReturnType<PortalCacheService['getParticipantProfile']>>>;

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

        const sections = this.buildSections(application, participant);
        const essays = this.buildEssays(application);
        const requirements = this.buildRequirements(application);
        const overallProgress = this.calculateProgress(sections, essays, requirements);

        const participantLocation = [participant.originCity, participant.originCountry]
            .filter((value): value is string => Boolean(value && value.trim().length > 0))
            .join(', ');

        const result: PortalSubmissionDetailResponseDto = {
            applicationId: application.id,
            programId: application.program.id,
            programName: application.program.name,
            status: application.status,
            overallProgress,
            sections,
            essays,
            requirements,
            participantName: participant.displayName || participant.fullName,
            participantId: participant.id,
            participantAccountId: participant.user.id,
            participantLocation: participantLocation || undefined,
            participantAvatarUrl: participant.profilePictureUrl || undefined,
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
                participationCategoryId: true,
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
                program: {
                    select: {
                        id: true,
                        name: true,
                        participationCategories: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                name: true,
                                order: true,
                                isActive: true,
                            },
                            orderBy: { order: 'asc' },
                        },
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
        participant: PortalParticipantProfile,
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
                type: this.isCategoryFieldName(field.name) ? 'select' : field.type,
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
            const values = this.buildSectionValues(sectionId, fields, application, personalData, participant);
            const persistedValues = this.buildPersistedSectionValues(fields, application, personalData);
            const filledCount = fields.filter(field => this.hasValue(persistedValues[field.name])).length;
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

        return sections.sort(
            (left, right) => (sectionOrder[left.id] || Number.MAX_SAFE_INTEGER) - (sectionOrder[right.id] || Number.MAX_SAFE_INTEGER),
        );
    }

    private buildSectionValues(
        sectionId: string,
        fields: SubmissionFormFieldDto[],
        application: ApplicationDetail,
        personalData: Record<string, unknown>,
        participant: PortalParticipantProfile,
    ): Record<string, unknown> {
        const values: Record<string, unknown> = {};

        for (const field of fields) {
            if (this.isCategoryFieldName(field.name)) {
                values[field.name] = this.preferValue(
                    this.readCategoryValueFromPersonalData(personalData, field.name),
                    application.participationCategoryId ?? application.applicationCategory ?? undefined,
                );
                continue;
            }

            if (this.isProgramIdFieldName(field.name)) {
                values[field.name] = application.program.id;
                continue;
            }

            const profileValue = this.resolveParticipantFieldValue(field, participant);
            values[field.name] = this.preferValue(personalData[field.name], profileValue);
        }

        if (sectionId === 'personal_info' && fields.length === 0) {
            return personalData;
        }

        return values;
    }

    private buildPersistedSectionValues(
        fields: SubmissionFormFieldDto[],
        application: ApplicationDetail,
        personalData: Record<string, unknown>,
    ): Record<string, unknown> {
        const values: Record<string, unknown> = {};

        for (const field of fields) {
            if (this.isCategoryFieldName(field.name)) {
                values[field.name] = this.preferValue(
                    this.readCategoryValueFromPersonalData(personalData, field.name),
                    application.participationCategoryId ?? application.applicationCategory ?? undefined,
                );
                continue;
            }

            if (this.isProgramIdFieldName(field.name)) {
                values[field.name] = application.program.id;
                continue;
            }

            values[field.name] = personalData[field.name] ?? undefined;
        }

        return values;
    }

    private preferValue(primary: unknown, fallback: unknown): unknown {
        if (this.hasValue(primary)) return primary;
        if (this.hasValue(fallback)) return fallback;
        return undefined;
    }

    private resolveParticipantFieldValue(
        field: SubmissionFormFieldDto,
        participant: PortalParticipantProfile,
    ): unknown {
        const normalized = this.normalizeFieldName(field.name);
        const normalizedPhone = this.buildE164Phone(participant.phoneCountryCode, participant.phoneNumber);
        const normalizedEmergencyPhone = this.buildE164Phone(
            participant.emergencyContactCountryCode,
            participant.emergencyContactPhone,
        );
        const nationality = field.type === 'country'
            ? (participant.nationalityCode || participant.nationality)
            : (participant.nationality || participant.nationalityCode);
        const originCountry = participant.originCountry;
        const currentCountry = participant.currentCountry;

        switch (normalized) {
            case 'fullname':
            case 'participantfullname':
                return participant.fullName;
            case 'nickname':
            case 'preferredname':
            case 'displayname':
                return participant.displayName || participant.nickName;
            case 'email':
            case 'emailaddress':
                return participant.user.email;
            case 'phone':
            case 'phonenumber':
            case 'whatsapp':
            case 'whatsappnumber':
            case 'mobilenumber':
                return normalizedPhone;
            case 'dateofbirth':
            case 'birthdate':
            case 'dob':
                return participant.birthdate ? this.toDateInputValue(participant.birthdate) : undefined;
            case 'gender':
            case 'sex':
                return participant.gender;
            case 'nationality':
            case 'nationalitycode':
                return nationality;
            case 'origincountry':
            case 'origincountrycode':
                return originCountry;
            case 'origincity':
            case 'hometown':
                return participant.originCity;
            case 'originaddress':
            case 'hometownaddress':
            case 'permanentaddress':
                return participant.originAddress;
            case 'currentcountry':
            case 'currentcountrycode':
                return currentCountry;
            case 'currentcity':
            case 'currentstate':
                return participant.currentCity;
            case 'currentaddress':
            case 'domicileaddress':
                return participant.currentAddress;
            case 'educationlevel':
                return participant.educationLevel;
            case 'institution':
                return participant.institution;
            case 'major':
                return participant.major;
            case 'occupation':
                return participant.occupation;
            case 'organization':
            case 'organizations':
                return participant.organizations;
            case 'instagram':
            case 'instagramaccount':
            case 'instagramhandle':
            case 'instagramusername':
                return participant.instagramUsername;
            case 'tshirtsize':
                return participant.tshirtSize;
            case 'diseasehistory':
            case 'medicalconditions':
                return participant.medicalConditions;
            case 'emergencyrelationship':
            case 'emergencycontactrelation':
                return participant.emergencyContactRelation;
            case 'emergencyphonenumber':
            case 'emergencycontactphone':
                return normalizedEmergencyPhone;
            case 'profilepicture':
            case 'profilepictureurl':
            case 'avatar':
                return participant.profilePictureUrl;
            case 'resume':
            case 'resumename':
            case 'resumeurl':
                return participant.resumeUrl;
            case 'knowledgesource':
            case 'sourceofinformation':
                return participant.knowledgeSource;
            case 'ambassadorreferralcode':
            case 'referralcode':
                return participant.referralCode;
            default:
                return undefined;
        }
    }

    private normalizeFieldName(name: string): string {
        return name.toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    private toDateInputValue(value: Date | string | number): string | undefined {
        const dateValue = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(dateValue.getTime())) return undefined;
        return dateValue.toISOString().slice(0, 10);
    }

    private buildE164Phone(countryCode: string | null, phoneNumber: string | null): string | undefined {
        if (!phoneNumber) return undefined;

        const digits = String(phoneNumber).trim();
        if (!digits) return undefined;
        if (digits.startsWith('+')) return digits;

        if (!countryCode) return digits;

        const normalizedCode = countryCode.startsWith('+') ? countryCode : `+${countryCode}`;
        const normalizedNumber = digits.replace(/^0+/, '') || digits;
        return `${normalizedCode}${normalizedNumber}`;
    }

    private resolveFieldOptions(field: SubmissionFormFieldDto, application: ApplicationDetail): SubmissionFormFieldDto['options'] {
        if (this.isCategoryFieldName(field.name)) {
            return this.resolveCategoryOptions(field, application);
        }

        if (this.isProgramSubthemeFieldName(field.name)) {
            return (application.program.subthemes || []).map((subtheme) => ({
                label: subtheme.name,
                value: subtheme.id,
            }));
        }

        return field.options || undefined;
    }

    private resolveCategoryOptions(
        field: SubmissionFormFieldDto,
        application: ApplicationDetail,
    ): SubmissionFormFieldDto['options'] {
        const fromParticipationCategories = (application.program.participationCategories || []).map((category) => {
            const mapped = this.mapCategoryNameToApplicationCategory(category.name);
            return {
                label: category.name,
                value: mapped ?? category.id,
            };
        });

        const fromFieldConfig = (field.options || []).map((option) => {
            if (typeof option === 'string') {
                return {
                    label: option,
                    value: option,
                };
            }

            return {
                label: option.label,
                value: String(option.value),
            };
        });

        const fundingFallback = [
            { label: 'Fully Funded', value: 'fully_funded' },
            { label: 'Self-Funded', value: 'self_funded' },
        ];

        const merged = [...fromParticipationCategories, ...fromFieldConfig, ...fundingFallback];
        const deduped: { label: string; value: string }[] = [];
        const seen = new Set<string>();

        for (const item of merged) {
            if (!item.value || seen.has(item.value)) continue;
            seen.add(item.value);
            deduped.push(item);
        }

        return deduped;
    }

    private mapCategoryNameToApplicationCategory(value: string): 'fully_funded' | 'self_funded' | null {
        const normalized = value.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (normalized === 'fullyfunded' || normalized === 'fullyfund') {
            return 'fully_funded';
        }

        if (normalized === 'selffunded' || normalized === 'selffund') {
            return 'self_funded';
        }

        return null;
    }

    private isCategoryFieldName(name: string): boolean {
        const normalized = this.normalizeFieldName(name);
        return normalized === 'category'
            || normalized === 'applicationcategory'
            || normalized === 'participationcategory'
            || normalized === 'participationcategoryid';
    }

    private isProgramIdFieldName(name: string): boolean {
        return this.normalizeFieldName(name) === 'programid';
    }

    private isProgramSubthemeFieldName(name: string): boolean {
        const normalized = this.normalizeFieldName(name);
        return normalized === 'programsubthemeid' || normalized === 'subthemeid';
    }

    private readCategoryValueFromPersonalData(
        personalData: Record<string, unknown>,
        fieldName: string,
    ): unknown {
        const candidates = [
            fieldName,
            'category',
            'application_category',
            'applicationCategory',
            'participation_category',
            'participationCategory',
            'participation_category_id',
            'participationCategoryId',
        ];

        for (const key of candidates) {
            if (this.hasValue(personalData[key])) {
                return personalData[key];
            }
        }

        return undefined;
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
