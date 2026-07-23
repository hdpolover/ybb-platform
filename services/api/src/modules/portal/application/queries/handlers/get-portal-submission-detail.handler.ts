import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { KNOWLEDGE_SOURCES } from '../../../../metadata/metadata.constants';
import { PortalCacheService } from '../../services/portal-cache.service';
import { buildE164Phone } from '@shared/utils/phone-e164';
import { GetPortalSubmissionDetailQuery } from '../portal-queries';
import {
    PortalSubmissionDetailResponseDto,
    SubmissionSectionDetailDto,
    SubmissionFormFieldDto,
    FieldOption,
    SubmissionEssayDto,
    SubmissionRequirementDto,
    SubmissionPreviewDto,
    SubmissionPreviewChecklistItemDto,
    SubmissionPreviewPrimaryActionDto,
    HelpAsset,
} from '../../../presentation/dto/portal-submission-detail.dto';

const HELP_ASSET_KINDS = new Set(['link', 'video', 'file']);
const INVALID_ESSAY_QUESTION_VALUES = new Set(['-', '--', 'n/a', 'na', 'tbd', 'coming soon']);

function normalizeHelpAssets(raw: unknown): HelpAsset[] | undefined {
    if (!Array.isArray(raw)) return undefined;
    const out: HelpAsset[] = [];
    for (const item of raw) {
        if (!item || typeof item !== 'object') continue;
        const rec = item as Record<string, unknown>;
        if (
            typeof rec.kind !== 'string' ||
            !HELP_ASSET_KINDS.has(rec.kind) ||
            typeof rec.label !== 'string' ||
            typeof rec.url !== 'string'
        ) {
            continue;
        }
        out.push({ kind: rec.kind as HelpAsset['kind'], label: rec.label, url: rec.url });
    }
    return out.length > 0 ? out : undefined;
}

type ApplicationDetail = {
    id: string;
    status: string;
    applicationCategory: string | null;
    registrationPaymentStatus: string;
    invoices: { id: string; status: string }[];
    participationCategoryId: string | null;
    participationCategory: {
        name: string;
    } | null;
    personalData: unknown;
    essayAnswers: unknown;
    uploadedFiles: unknown;
    program: {
        id: string;
        name: string;
        termsAndConditions: string | null;
        essayGuidelineText: string | null;
        essayGuidelineUrl: string | null;
        previewChecklistItems: string[];
        pricingTiers: { id: string; allowedCategories: string[] }[];
        participationCategories: {
            id: string;
            name: string;
            description: string | null;
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
            helpAssets: unknown;
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
        const preview = this.buildPreview(application, sections, essays, requirements);
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
            preview,
            essayGuidelineText: application.program.essayGuidelineText || undefined,
            essayGuidelineUrl: application.program.essayGuidelineUrl || undefined,
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
                registrationPaymentStatus: true,
                participationCategoryId: true,
                participationCategory: {
                    select: {
                        name: true,
                    },
                },
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
                invoices: {
                    where: {
                        pricingTier: { feeType: 'registration_fee' },
                        // Only pre-fetch PAID invoices so invoices[0] is always a
                        // paid invoice or absent — eliminates cancelled/failed invoices
                        // from incorrectly driving paymentPaid to true via the
                        // regInvoice?.status === 'paid' fallback path.
                        status: 'paid',
                    },
                    select: {
                        id: true,
                        status: true,
                    },
                    take: 1,
                },
                program: {
                    select: {
                        id: true,
                        name: true,
                        termsAndConditions: true,
                        essayGuidelineText: true,
                        essayGuidelineUrl: true,
                        previewChecklistItems: true,
                        pricingTiers: {
                            where: { isActive: true, deletedAt: null, feeType: 'registration_fee' },
                            select: { id: true, allowedCategories: true },
                        },
                        participationCategories: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                name: true,
                                description: true,
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
                                helpAssets: true,
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
            if (section === 'entry_information' && this.isLegacyEssayFormField(field)) {
                continue;
            }
            if (!sectionMap.has(section)) {
                sectionMap.set(section, []);
            }
            sectionMap.get(section)!.push({
                id: field.id,
                name: field.name,
                label: field.label,
                type: this.isCategoryFieldName(field.name) || this.isKnowledgeSourceFieldName(field.name)
                    ? 'select'
                    : field.type,
                placeholder: field.placeholder || undefined,
                helpText: this.resolveFieldHelpText(field, application),
                mediaUrl: field.mediaUrl || undefined,
                mediaAlt: field.mediaAlt || undefined,
                helpAssets: normalizeHelpAssets(field.helpAssets),
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
                values[field.name] = this.resolveCategoryFieldValue(application, personalData, field.name);
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
                values[field.name] = this.resolveCategoryFieldValue(application, personalData, field.name);
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
                // Onboarding only asks for a birth year, so participant.birthdate
                // is stored as Jan 1 of that year. Prefilling that placeholder
                // lets applicants submit it unchanged, which is how thousands of
                // "January 1st" birthdates ended up in personal_data. Skip the
                // prefill so the form forces a real date instead.
                return participant.birthdate && !this.isYearOnlyBirthdate(participant.birthdate)
                    ? this.toDateInputValue(participant.birthdate)
                    : undefined;
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

    private isYearOnlyBirthdate(value: Date | string | number): boolean {
        // Cached participants arrive JSON-serialized, so birthdate may be an
        // ISO string rather than a Date.
        const date = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(date.getTime())) return false;
        return date.getUTCMonth() === 0 && date.getUTCDate() === 1;
    }

    private toDateInputValue(value: Date | string | number): string | undefined {
        const dateValue = value instanceof Date ? value : new Date(value);
        if (Number.isNaN(dateValue.getTime())) return undefined;
        return dateValue.toISOString().slice(0, 10);
    }

    private buildE164Phone(countryCode: string | null, phoneNumber: string | null): string | undefined {
        return buildE164Phone(countryCode, phoneNumber);
    }

    private resolveFieldOptions(field: SubmissionFormFieldDto, application: ApplicationDetail): SubmissionFormFieldDto['options'] {
        if (this.isCategoryFieldName(field.name)) {
            return this.resolveCategoryOptions(field, application);
        }

        if (this.isKnowledgeSourceFieldName(field.name)) {
            return this.resolveKnowledgeSourceOptions(field);
        }

        if (this.isProgramSubthemeFieldName(field.name)) {
            return (application.program.subthemes || []).map((subtheme) => ({
                label: subtheme.name,
                value: subtheme.id,
                description: subtheme.description || undefined,
            }));
        }

        return this.normalizeConfiguredOptions(field.options);
    }

    private resolveFieldHelpText(
        field: {
            name: string;
            helpText: string | null;
        },
        application: ApplicationDetail,
    ): string | undefined {
        const helpText = field.helpText?.trim();
        if (!helpText) return undefined;
        if (!this.isCategoryFieldName(field.name)) return helpText;

        const normalizedHelpText = helpText.toLowerCase().replace(/\s+/g, ' ');
        const hasLegacyFundingHint = normalizedHelpText.includes('fully funded')
            || normalizedHelpText.includes('self-funded')
            || normalizedHelpText.includes('self funded');
        if (!hasLegacyFundingHint) return helpText;

        const participationCategories = application.program.participationCategories || [];
        if (participationCategories.length === 0) return helpText;

        // ProgramParticipationCategory has no funding-type enum field — only a free-text
        // name. We previously inferred funding type from the name, but that inference has
        // been removed to make the payment gate fail-closed. Suppress legacy funding hints
        // whenever the program has any participation categories defined, since the actual
        // funding type is now determined exclusively from applicationCategory on the
        // application record, not from category names.
        return undefined;
    }

    private resolveCategoryOptions(
        field: SubmissionFormFieldDto,
        application: ApplicationDetail,
    ): SubmissionFormFieldDto['options'] {
        const dedupeOptions = (options: Array<{ label: string; value: string; description?: string }>) => {
            const deduped: Array<{ label: string; value: string; description?: string }> = [];
            const seen = new Set<string>();

            for (const item of options) {
                if (!item.value || seen.has(item.value)) continue;
                seen.add(item.value);
                deduped.push(item);
            }

            return deduped;
        };

        const fromParticipationCategories = (application.program.participationCategories || []).map((category) => ({
            label: category.name,
            value: category.id,
            description: category.description || undefined,
        }));

        const dedupedParticipation = dedupeOptions(fromParticipationCategories);
        if (dedupedParticipation.length > 0) {
            return dedupedParticipation;
        }

        const normalizedConfigured = this.normalizeConfiguredOptions(field.options) || [];
        const fromFieldConfig = normalizedConfigured.map((option) => {
            if (typeof option === 'string') {
                return {
                    label: option,
                    value: option,
                };
            }

            return {
                label: option.label,
                value: String(option.value),
                description:
                    typeof option.description === 'string' && option.description.trim().length > 0
                        ? option.description
                        : undefined,
            };
        });

        return dedupeOptions(fromFieldConfig);
    }

    private resolveKnowledgeSourceOptions(field: SubmissionFormFieldDto): SubmissionFormFieldDto['options'] {
        const normalizedConfigured = this.normalizeConfiguredOptions(field.options) || [];
        const configuredOptions = normalizedConfigured.map((option) => {
            if (typeof option === 'string') {
                return {
                    label: option,
                    value: option,
                };
            }

            return {
                label: option.label,
                value: String(option.value),
                description:
                    typeof option.description === 'string' && option.description.trim().length > 0
                        ? option.description
                        : undefined,
            };
        });

        const metadataOptions = KNOWLEDGE_SOURCES.map((source) => ({
            label: source,
            value: source,
        }));

        const mergedOptions = [...configuredOptions, ...metadataOptions];
        const deduped: Array<{ label: string; value: string; description?: string }> = [];
        const seen = new Set<string>();

        for (const option of mergedOptions) {
            const value = option.value.trim();
            if (!value) continue;

            const fingerprint = value.toLowerCase();
            if (seen.has(fingerprint)) continue;

            seen.add(fingerprint);
            deduped.push({
                ...option,
                value,
            });
        }

        return deduped;
    }

    private normalizeConfiguredOptions(raw: unknown): SubmissionFormFieldDto['options'] {
        const normalizeItem = (
            item: unknown,
            fallbackValue?: string,
        ): FieldOption | undefined => {
            if (typeof item === 'string') {
                const value = item.trim();
                if (!value) return undefined;
                return { label: value, value };
            }

            if (Array.isArray(item)) {
                const first = typeof item[0] === 'string' ? item[0].trim() : '';
                const second = typeof item[1] === 'string' ? item[1].trim() : '';
                const label = second || first;
                const value = first || second || fallbackValue || '';
                if (!label && !value) return undefined;
                return { label: label || value, value: value || label };
            }

            if (!item || typeof item !== 'object') {
                return undefined;
            }

            const rec = item as Record<string, unknown>;
            const label =
                (typeof rec.label === 'string' && rec.label.trim()) ||
                (typeof rec.text === 'string' && rec.text.trim()) ||
                (typeof rec.name === 'string' && rec.name.trim()) ||
                (typeof rec.value === 'string' && rec.value.trim()) ||
                (typeof rec.id === 'string' && rec.id.trim()) ||
                '';
            const value =
                (typeof rec.value === 'string' && rec.value.trim()) ||
                (typeof rec.id === 'string' && rec.id.trim()) ||
                (typeof rec.label === 'string' && rec.label.trim()) ||
                (typeof rec.text === 'string' && rec.text.trim()) ||
                (typeof rec.name === 'string' && rec.name.trim()) ||
                (fallbackValue ? fallbackValue.trim() : '') ||
                '';

            if (!label && !value) {
                return undefined;
            }

            const description = typeof rec.description === 'string' && rec.description.trim().length > 0
                ? rec.description
                : undefined;

            return {
                label: label || value,
                value: value || label,
                description,
            };
        };

        let source = raw;
        if (typeof source === 'string') {
            const trimmed = source.trim();
            if (!trimmed) return undefined;

            if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
                try {
                    source = JSON.parse(trimmed);
                } catch {
                    const split = trimmed
                        .split(',')
                        .map((value) => value.trim())
                        .filter((value) => value.length > 0);
                    return split.length > 0
                        ? split.map((value) => ({ label: value, value }))
                        : undefined;
                }
            } else {
                const split = trimmed
                    .split(',')
                    .map((value) => value.trim())
                    .filter((value) => value.length > 0);
                return split.length > 0
                    ? split.map((value) => ({ label: value, value }))
                    : undefined;
            }
        }

        if (Array.isArray(source)) {
            const normalized = source
                .map((item) => normalizeItem(item))
                .filter((item): item is FieldOption => Boolean(item));
            return normalized.length > 0 ? normalized : undefined;
        }

        if (!source || typeof source !== 'object') {
            return undefined;
        }

        const rec = source as Record<string, unknown>;
        if (Array.isArray(rec.options)) {
            return this.normalizeConfiguredOptions(rec.options);
        }

        const normalized = Object.entries(rec)
            .map(([value, item]) => normalizeItem(item, value))
            .filter((item): item is FieldOption => Boolean(item));
        return normalized.length > 0 ? normalized : undefined;
    }

    private isCategoryFieldName(name: string): boolean {
        const normalized = this.normalizeFieldName(name);
        return normalized === 'category'
            || normalized === 'applicationcategory'
            || normalized === 'participationcategory'
            || normalized === 'participationcategoryid';
    }

    private isKnowledgeSourceFieldName(name: string): boolean {
        const normalized = this.normalizeFieldName(name);

        return normalized === 'knowledgesource'
            || normalized === 'miscknowledgesource'
            || normalized === 'sourceofinformation'
            || normalized === 'programsource'
            || normalized === 'howdidyouhearaboutus';
    }

    private isProgramIdFieldName(name: string): boolean {
        return this.normalizeFieldName(name) === 'programid';
    }

    private isProgramSubthemeFieldName(name: string): boolean {
        const normalized = this.normalizeFieldName(name);
        return normalized === 'programsubthemeid' || normalized === 'subthemeid';
    }

    private isLegacyEssayFormField(field: {
        name: string;
        label: string;
        type: string;
        placeholder: string | null;
        validationRules: unknown;
    }): boolean {
        const normalizedName = this.normalizeFieldName(field.name);
        if (
            normalizedName.includes('essay')
            || normalizedName.includes('keyword')
            || normalizedName.includes('reference')
        ) {
            return true;
        }

        if (field.type !== 'textarea') return false;

        const normalizedLabel = field.label.trim().toLowerCase().replace(/\s+/g, ' ');
        const normalizedPlaceholder = (field.placeholder || '').trim().toLowerCase();
        const rules = field.validationRules;
        const hasWordLimitRule = Boolean(
            rules
            && typeof rules === 'object'
            && ['wordLimit', 'maxWords', 'minWords'].some((key) =>
                Object.prototype.hasOwnProperty.call(rules, key),
            ),
        );
        const looksLikeEssayPrompt = normalizedLabel.endsWith('?')
            || normalizedLabel.includes('word limit')
            || normalizedPlaceholder.includes('word limit');

        return hasWordLimitRule || looksLikeEssayPrompt;
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

    private resolveCategoryFieldValue(
        application: ApplicationDetail,
        personalData: Record<string, unknown>,
        fieldName: string,
    ): unknown {
        const fromPersonalData = this.readCategoryValueFromPersonalData(personalData, fieldName);
        const participationCategories = application.program.participationCategories || [];

        if (participationCategories.length > 0) {
            const allowedIds = new Set(participationCategories.map((category) => category.id));
            const normalizedPersonalDataValue =
                typeof fromPersonalData === 'string' && allowedIds.has(fromPersonalData)
                    ? fromPersonalData
                    : undefined;

            return this.preferValue(application.participationCategoryId ?? undefined, normalizedPersonalDataValue);
        }

        return this.preferValue(fromPersonalData, application.applicationCategory ?? undefined);
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

        return programEssays
            .filter((essay) => this.isRenderableEssayQuestion(essay.question))
            .map((essay) => ({
                id: essay.id,
                question: essay.question.trim().replace(/\s+/g, ' '),
                isRequired: essay.isRequired,
                wordLimit: essay.wordLimit || undefined,
                order: essay.order,
                answer: (essayAnswers[essay.id] || undefined) as string | undefined,
            }));
    }

    private isRenderableEssayQuestion(question: string): boolean {
        const normalized = question.trim().replace(/\s+/g, ' ');
        if (!normalized) return false;
        return !INVALID_ESSAY_QUESTION_VALUES.has(normalized.toLowerCase());
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

    private buildPreview(
        application: ApplicationDetail,
        sections: SubmissionSectionDetailDto[],
        essays: SubmissionEssayDto[],
        requirements: SubmissionRequirementDto[],
    ): SubmissionPreviewDto {
        const personalData = (application.personalData as Record<string, unknown>) || {};
        const checklists = this.buildPreviewChecklists(personalData, application.program.previewChecklistItems ?? []);
        // paymentRequired is derived from the PROGRAM's pricing-tier configuration,
        // not from the existence of a participant-initiated invoice. This is fail-closed:
        // a participant who has never started payment has no invoice but is still
        // shown a payment requirement when the program has an active registration_fee tier.
        // Scope to the participant's funding category: a tier with no allowedCategories
        // applies to everyone; otherwise it must include the current category. This avoids
        // requiring a payment the participant has no tier to satisfy (e.g. an off-category
        // tier), matching the category-aware logic used by the payments handler.
        const currentCategory = application.applicationCategory;
        const paymentRequired = application.program.pricingTiers.some(
            (tier) =>
                tier.allowedCategories.length === 0
                || currentCategory == null
                || tier.allowedCategories.includes(currentCategory),
        );
        // paymentPaid: registrationPaymentStatus is the canonical signal; fall back to
        // a paid invoice as a race-condition guard when the status hasn't propagated yet.
        const regInvoice = application.invoices[0] ?? null;
        const paymentPaid = application.registrationPaymentStatus === 'paid' || regInvoice?.status === 'paid';

        const pendingItems: string[] = [];

        const incompleteSections = sections.filter(
            (section) => section.fields.some((field) => field.isRequired) && section.status !== 'completed',
        );
        pendingItems.push(...incompleteSections.map((section) => `Complete ${section.title}`));

        const missingRequiredEssays = essays.filter(
            (essay) => essay.isRequired && !this.hasValue(essay.answer),
        ).length;
        if (missingRequiredEssays > 0) {
            pendingItems.push(
                `Complete ${missingRequiredEssays} required essay${missingRequiredEssays > 1 ? 's' : ''}`,
            );
        }

        const missingRequiredDocuments = requirements.filter(
            (requirement) => requirement.isRequired && !requirement.uploadedFile,
        ).length;
        if (missingRequiredDocuments > 0) {
            pendingItems.push(
                `Upload ${missingRequiredDocuments} required document${missingRequiredDocuments > 1 ? 's' : ''}`,
            );
        }

        // NOTE: Preview checklist acknowledgements are a CLIENT-SIDE confirmation only.
        // The submit POST is bodyless and we never persist the ticked state (the client
        // tracks it in local component state and gates its own submit button on it), so
        // the server has no way to observe whether the user checked the boxes. Gating
        // `canSubmit` on `item.checked` here was unsatisfiable from the server's point of
        // view: the custom-checklist branch hardcodes `checked:false` and the fallback
        // branch reads flags that are never written. That regression silently disabled the
        // submit button for every draft application platform-wide. The checklist is still
        // returned in `checklists` for display, and the client enforces the confirmation.
        // Do NOT add checklist items back into `pendingItems` without first persisting the
        // ticked state from the client and reading it back here.

        if (paymentRequired && !paymentPaid) {
            pendingItems.push('Complete registration payment');
        }

        const canSubmit = application.status === 'draft' && pendingItems.length === 0;
        const primaryAction = this.buildPreviewPrimaryAction(
            application,
            paymentRequired,
            paymentPaid,
            canSubmit,
            pendingItems,
        );

        return {
            title: 'Preview & Confirmation',
            description: 'Review your submission details before finalizing your application.',
            termsAndConditionsHtml: application.program.termsAndConditions || undefined,
            checklists,
            primaryAction,
            payment: {
                required: paymentRequired,
                paid: paymentPaid,
                status: application.registrationPaymentStatus,
            },
            canSubmit,
            pendingItems,
        };
    }

    private buildPreviewChecklists(
        personalData: Record<string, unknown>,
        programChecklistItems: string[],
    ): SubmissionPreviewChecklistItemDto[] {
        if (programChecklistItems.length > 0) {
            return programChecklistItems.map((label, index) => ({
                key: `checklist_item_${index}`,
                label,
                required: true,
                checked: false,
            }));
        }

        const readyToJoin = this.readBooleanFlag(personalData, [
            'preview_ready_to_join',
            'previewReadyToJoin',
            'ready_to_join',
            'readyToJoin',
        ]);

        const understandTerms = this.readBooleanFlag(personalData, [
            'preview_understand_terms_and_conditions',
            'previewUnderstandTermsAndConditions',
            'understand_terms_and_conditions',
            'understandTermsAndConditions',
        ]);

        return [
            {
                key: 'ready_to_join',
                label: 'I am ready to join this program.',
                required: true,
                checked: readyToJoin,
            },
            {
                key: 'understand_terms_and_conditions',
                label: 'I understand and agree to the Terms & Conditions.',
                required: true,
                checked: understandTerms,
            },
        ];
    }

    private buildPreviewPrimaryAction(
        application: ApplicationDetail,
        paymentRequired: boolean,
        paymentPaid: boolean,
        canSubmit: boolean,
        pendingItems: string[],
    ): SubmissionPreviewPrimaryActionDto {
        if (application.status !== 'draft') {
            return {
                type: 'submit_application',
                label: 'Submit Application',
                enabled: false,
                reason: `Application is already in "${application.status}" status.`,
            };
        }

        if (paymentRequired && !paymentPaid) {
            return {
                type: 'complete_payment',
                label: 'Make Payment',
                enabled: true,
                reason: 'Registration payment is required before final submission.',
            };
        }

        if (canSubmit) {
            return {
                type: 'submit_application',
                label: 'Submit Application',
                enabled: true,
            };
        }

        return {
            type: 'submit_application',
            label: 'Submit Application',
            enabled: false,
            reason: pendingItems[0] || 'Complete all required steps before submitting.',
        };
    }

    private readBooleanFlag(record: Record<string, unknown>, keys: string[]): boolean {
        for (const key of keys) {
            const value = record[key];

            if (typeof value === 'boolean') return value;

            if (typeof value === 'number') {
                if (value === 1) return true;
                if (value === 0) return false;
            }

            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                    return true;
                }
                if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                    return false;
                }
            }
        }

        return false;
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
