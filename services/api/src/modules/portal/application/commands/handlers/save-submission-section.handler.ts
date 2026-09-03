import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { normalizePhoneCountryCode } from '@shared/utils/phone-country-code';
import { extractAndSanitizePhone } from '@shared/utils/phone-e164';
import { PortalCacheService } from '../../services/portal-cache.service';
import { SaveSubmissionSectionCommand } from '../../queries/portal-queries';
import { SubmissionSection } from '../../../presentation/dto/save-submission-section.dto';
import { currentApplicationWhere, currentApplicationOrderBy } from '../../utils/current-application.query';

/**
 * Save Submission Section Handler
 *
 * Merges section data into the appropriate JSON field on ParticipantApplication.
 * Supports personal_info, essays, and documents sections.
 */
@Injectable()
export class SaveSubmissionSectionHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) { }

    async execute(command: SaveSubmissionSectionCommand): Promise<{ success: boolean; section: string }> {
        const { userId, section, data, programId } = command;

        this.validateSection(section);

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id, programId),
            orderBy: currentApplicationOrderBy,
            select: {
                id: true,
                programId: true,
                status: true,
                applicationCategory: true,
                participationCategoryId: true,
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
            },
        });

        if (!application) throw new NotFoundException('No active application found');

        if (application.status !== 'draft') {
            throw new BadRequestException(
                `Cannot edit application in "${application.status}" status. Only drafts can be edited.`,
            );
        }

        const updateData = this.buildUpdatePayload(section, application, data);
        await this.applyCategorySelection(updateData, application.programId, data);

        await this.prisma.participantApplication.update({
            where: { id: application.id },
            data: updateData,
        });

        await this.invalidateCaches(userId);

        return { success: true, section };
    }

    private validateSection(section: string): void {
        const validSections = Object.values(SubmissionSection) as string[];
        if (!validSections.includes(section)) {
            throw new BadRequestException(
                `Invalid section "${section}". Valid sections: ${validSections.join(', ')}`,
            );
        }
    }

    private buildUpdatePayload(
        section: string,
        application: { personalData: unknown; essayAnswers: unknown; uploadedFiles: unknown },
        data: Record<string, unknown>,
    ): Record<string, unknown> {
        const normalizedData = this.normalizePersonalDataPayload(data);

        switch (section) {
            case SubmissionSection.PERSONAL_INFO: {
                const existing = (application.personalData as Record<string, unknown>) || {};
                return { personalData: this.applyPhoneNormalization(existing, normalizedData) };
            }
            case SubmissionSection.PERSONAL_DETAILS:
            case SubmissionSection.CONTACT_INFORMATION:
            case SubmissionSection.PROFESSIONAL_PROFILE:
            case SubmissionSection.ENTRY_INFORMATION:
            case SubmissionSection.MISCELLANEOUS:
            case SubmissionSection.ADDITIONAL_INFO: {
                const existing = (application.personalData as Record<string, unknown>) || {};
                return {
                    personalData: this.applyPhoneNormalization(existing, normalizedData),
                };
            }
            case SubmissionSection.PREVIEW: {
                const existing = (application.personalData as Record<string, unknown>) || {};
                return {
                    personalData: this.applyPhoneNormalization(existing, normalizedData),
                };
            }
            case SubmissionSection.ESSAYS: {
                const existing = (application.essayAnswers as Record<string, unknown>) || {};
                return { essayAnswers: { ...existing, ...data } };
            }
            case SubmissionSection.DOCUMENTS: {
                const existing = (application.uploadedFiles as Record<string, unknown>) || {};
                return { uploadedFiles: { ...existing, ...data } };
            }
            default:
                throw new BadRequestException(`Unsupported section: ${section}`);
        }
    }

    private normalizePersonalDataPayload(data: Record<string, unknown>): Record<string, unknown> {
        const normalized = { ...data };

        if (normalized.program_id !== undefined) {
            delete normalized.program_id;
        }

        if (normalized.programId !== undefined) {
            delete normalized.programId;
        }

        const phoneCountryCodeKeys = [
            'phone_country_code',
            'phoneCountryCode',
            'emergency_country_code',
            'emergencyCountryCode',
            'emergency_contact_country_code',
            'emergencyContactCountryCode',
        ];

        for (const key of phoneCountryCodeKeys) {
            if (typeof normalized[key] === 'string') {
                normalized[key] = normalizePhoneCountryCode(normalized[key]);
            }
        }

        this.normalizePreviewAcknowledgements(normalized);

        return normalized;
    }

    /**
     * Merge `incoming` (this save's section payload) over `existing` personal_data,
     * then — ONLY when this save actually touched a phone key — normalize that key
     * to E.164 using `nationality` (on the merged object) as the region hint.
     *
     * Non-blocking by design: an unparseable/invalid phone is left exactly as the
     * participant entered it (never fabricated, never rejected). Other fields on
     * the merged object are untouched either way.
     */
    private applyPhoneNormalization(
        existing: Record<string, unknown>,
        incoming: Record<string, unknown>,
    ): Record<string, unknown> {
        const merged = { ...existing, ...incoming };

        const hasPhoneKey = typeof incoming.phone === 'string';
        const hasPhoneNumberKey = typeof incoming.phone_number === 'string';
        if (!hasPhoneKey && !hasPhoneNumberKey) return merged;

        const { value, isValid } = extractAndSanitizePhone(merged);
        if (!isValid) return merged;

        return hasPhoneKey ? { ...merged, phone: value } : { ...merged, phone_number: value };
    }

    private normalizePreviewAcknowledgements(data: Record<string, unknown>): void {
        const previewKeys = [
            'preview_ready_to_join',
            'previewReadyToJoin',
            'ready_to_join',
            'readyToJoin',
            'preview_understand_terms_and_conditions',
            'previewUnderstandTermsAndConditions',
            'understand_terms_and_conditions',
            'understandTermsAndConditions',
        ];

        for (const key of previewKeys) {
            if (data[key] === undefined) continue;

            const normalized = this.normalizeBooleanValue(data[key]);
            if (normalized !== undefined) {
                data[key] = normalized;
            }
        }
    }

    private normalizeBooleanValue(value: unknown): boolean | undefined {
        if (typeof value === 'boolean') return value;
        if (typeof value === 'number') {
            if (value === 1) return true;
            if (value === 0) return false;
            return undefined;
        }

        if (typeof value !== 'string') return undefined;

        const normalized = value.trim().toLowerCase();
        if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
            return true;
        }

        if (normalized === 'false' || normalized === '0' || normalized === 'no') {
            return false;
        }

        return undefined;
    }

    private isApplicationCategory(value: string): value is ApplicationCategory {
        return value === ApplicationCategory.fully_funded || value === ApplicationCategory.self_funded;
    }

    private async applyCategorySelection(
        updateData: Record<string, unknown>,
        programId: string,
        data: Record<string, unknown>,
    ): Promise<void> {
        const rawCategory = this.extractCategoryValue(data);
        if (rawCategory === null) return;

        // An empty/blank category value means the section payload simply didn't
        // carry a selection on this save (the field can be present-but-blank as the
        // participant moves through the form) — it must NOT be treated as "clear the
        // category". Destructively nulling here wiped applicationCategory AFTER a
        // successful switch-category, leaving submitted participants with no category
        // and triggering duplicate registration-fee invoices. No-op instead; the
        // category is only ever set via an explicit valid value (below) or the
        // dedicated switch-category endpoint.
        if (!rawCategory) {
            return;
        }

        if (this.isApplicationCategory(rawCategory)) {
            updateData.applicationCategory = rawCategory;
            updateData.participationCategoryId = null;
            return;
        }

        if (!this.isUuid(rawCategory)) {
            return;
        }

        const category = await this.prisma.programParticipationCategory.findFirst({
            where: {
                id: rawCategory,
                programId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
            },
        });

        if (!category) {
            return;
        }

        updateData.participationCategoryId = category.id;

        const mappedCategory = this.mapCategoryNameToApplicationCategory(category.name);
        if (mappedCategory) {
            updateData.applicationCategory = mappedCategory;
        }
    }

    private extractCategoryValue(data: Record<string, unknown>): string | null {
        const keys = [
            'category',
            'application_category',
            'applicationCategory',
            'participation_category',
            'participationCategory',
            'participation_category_id',
            'participationCategoryId',
        ];

        for (const key of keys) {
            if (typeof data[key] === 'string') {
                const value = data[key].trim();
                return value;
            }
        }

        return null;
    }

    private mapCategoryNameToApplicationCategory(name: string): ApplicationCategory | null {
        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (normalized === 'fullyfunded' || normalized === 'fullyfund') {
            return ApplicationCategory.fully_funded;
        }

        if (normalized === 'selffunded' || normalized === 'selffund') {
            return ApplicationCategory.self_funded;
        }

        return null;
    }

    private isUuid(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
    }

    private async invalidateCaches(userId: string): Promise<void> {
        await this.cacheService.invalidatePortalCache(userId);
    }
}
