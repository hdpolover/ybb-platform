import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ApplicationCategory } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { normalizePhoneCountryCode } from '@shared/utils/phone-country-code';
import { extractAndSanitizePhone } from '@shared/utils/phone-e164';
import { PrismaTransactionClient } from '@shared/types/prisma-transaction.type';
import { isPastSubmissionDeadline } from '@shared/utils/submission-deadline.util';
import { wibDateKey } from '@shared/utils/wib-time';
import { PortalCacheService } from '../../services/portal-cache.service';
import { SaveSubmissionSectionCommand } from '../../queries/portal-queries';
import { SubmissionSection } from '../../../presentation/dto/save-submission-section.dto';
import { currentApplicationWhere, currentApplicationOrderBy } from '../../utils/current-application.query';

interface LockedApplicationRow {
    id: string;
    status: string;
    personalData: unknown;
    essayAnswers: unknown;
    uploadedFiles: unknown;
}

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

        // Resolve WHICH application this save targets. The row lock below is
        // taken by id, so this findFirst only needs to identify the row - the
        // actual personalData/essayAnswers/uploadedFiles/status used for the
        // merge come from the locked read inside the transaction, not this one.
        const application = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id, programId),
            orderBy: currentApplicationOrderBy,
            select: {
                id: true,
                programId: true,
                program: { select: { name: true, applicationDeadline: true } },
            },
        });

        if (!application) throw new NotFoundException('No active application found');

        // Editing closes WITH the submission deadline, not with submission.
        //
        // The `status !== 'draft'` guard below only bites AFTER a participant
        // submits, which is the one case already settled. A participant who
        // never submits stays in `draft` forever and, without this, could keep
        // rewriting essays indefinitely past the deadline. Admins submit those
        // stragglers on their behalf, so what they submit has to be frozen at
        // the same instant everyone else's was.
        //
        // Same shared resolver as every submit path (inclusive through the end
        // of the deadline's WIB calendar day), so "too late to edit" and "too
        // late to submit" cannot drift apart. A program with no deadline set is
        // unrestricted, exactly as it is for submitting.
        const applicationDeadline = application.program?.applicationDeadline ?? null;
        if (isPastSubmissionDeadline(applicationDeadline)) {
            throw new BadRequestException(
                `The submission deadline for "${application.program?.name ?? 'this program'}" was ` +
                `${wibDateKey(applicationDeadline as Date)} (WIB). This application can no longer be edited.`,
            );
        }

        await this.prisma.$transaction(async (tx) => {
            // Row lock: personalData/essayAnswers/uploadedFiles are @db.Json
            // columns (not Jsonb), so there is no atomic `jsonb ||` merge
            // available without a cast that silently reorders keys and drops
            // duplicates (see audit M4/M61 note on the cast trap). SELECT ...
            // FOR UPDATE instead: it serializes concurrent saves on the SAME
            // application row, so the second save's in-memory merge starts
            // from what the first save just committed, not from its own
            // now-stale pre-save copy. That stale copy is exactly what
            // silently dropped fields under two-tab / two-device concurrent
            // saves before this fix - the merge logic itself is unchanged.
            const rows = await tx.$queryRaw<LockedApplicationRow[]>`
                SELECT
                    id,
                    status,
                    personal_data AS "personalData",
                    essay_answers AS "essayAnswers",
                    uploaded_files AS "uploadedFiles"
                FROM participant_applications
                WHERE id = ${application.id}::uuid
                FOR UPDATE
            `;
            const current = rows[0];
            if (!current) throw new NotFoundException('No active application found');

            if (current.status !== 'draft') {
                throw new BadRequestException(
                    `Cannot edit application in "${current.status}" status. Only drafts can be edited.`,
                );
            }

            const updateData = this.buildUpdatePayload(section, current, data);
            await this.applyCategorySelection(tx, updateData, application.programId, data);

            await tx.participantApplication.update({
                where: { id: current.id },
                data: updateData,
            });
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
        tx: PrismaTransactionClient,
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

        const category = await tx.programParticipationCategory.findFirst({
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
