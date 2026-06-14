import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PortalSubmitApplicationCommand } from '../../queries/portal-queries';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';

/**
 * Portal Submit Application Handler
 *
 * Portal-facing submit that resolves participant from JWT user ID,
 * validates payment status via the shared RegistrationFeeGateService, and
 * transitions the application to submitted.
 *
 * Registration fee applies to ALL participants (fully_funded AND self_funded)
 * under the reimbursement model — pay first, reimburse later.
 */
@Injectable()
export class PortalSubmitApplicationHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly registrationFeeGate: RegistrationFeeGateService,
    ) { }

    async execute(command: PortalSubmitApplicationCommand): Promise<{ success: boolean; applicationId: string; status: string }> {
        const { userId, programId } = command;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const whereClause = programId
            ? { participantId: participant.id, programId }
            : { participantId: participant.id };

        const application = await this.prisma.participantApplication.findFirst({
            where: whereClause,
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                status: true,
                personalData: true,
                participantId: true,
            },
        });

        if (!application) throw new NotFoundException('No active application found');

        if (application.status !== 'draft') {
            throw new BadRequestException(
                `Cannot submit application in "${application.status}" status. Only drafts can be submitted.`,
            );
        }

        this.validatePreviewAcknowledgements(
            (application.personalData as Record<string, unknown>) || {},
        );

        // Validate registration fee via shared gate (applies to all categories).
        await this.registrationFeeGate.assertRegistrationFeePaid(application.id);

        // Submit the application
        await this.prisma.participantApplication.update({
            where: { id: application.id },
            data: {
                status: 'submitted',
                submittedAt: new Date(),
            },
        });

        await this.invalidateCaches(userId, participant.id, programId);

        return {
            success: true,
            applicationId: application.id,
            status: 'submitted',
        };
    }

    private validatePreviewAcknowledgements(personalData: Record<string, unknown>): void {
        const readyToJoinKeys = [
            'preview_ready_to_join',
            'previewReadyToJoin',
            'ready_to_join',
            'readyToJoin',
        ];
        const termsAcknowledgedKeys = [
            'preview_understand_terms_and_conditions',
            'previewUnderstandTermsAndConditions',
            'understand_terms_and_conditions',
            'understandTermsAndConditions',
        ];

        const hasPreviewFlag = [...readyToJoinKeys, ...termsAcknowledgedKeys].some(
            (key) => personalData[key] !== undefined,
        );

        // Backward compatibility: older clients may still submit without preview payload.
        if (!hasPreviewFlag) return;

        const isReadyToJoin = this.readBoolean(personalData, readyToJoinKeys);
        const hasAcceptedTerms = this.readBoolean(personalData, termsAcknowledgedKeys);

        if (!isReadyToJoin || !hasAcceptedTerms) {
            throw new BadRequestException(
                'Please complete all preview confirmations before submitting.',
            );
        }
    }

    private readBoolean(data: Record<string, unknown>, keys: string[]): boolean {
        for (const key of keys) {
            const value = data[key];
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

    private async invalidateCaches(userId: string, participantId: string, programId?: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId, programId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSIONS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId)),
        ]);
    }
}
