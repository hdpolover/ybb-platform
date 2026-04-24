import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PortalSubmitApplicationCommand } from '../../queries/portal-queries';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';

/**
 * Portal Submit Application Handler
 *
 * Portal-facing submit that resolves participant from JWT user ID,
 * validates payment status, and transitions the application to submitted.
 */
@Injectable()
export class PortalSubmitApplicationHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentClient: PaymentGrpcClient,
    ) { }

    async execute(command: PortalSubmitApplicationCommand): Promise<{ success: boolean; applicationId: string; status: string }> {
        const { userId } = command;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            orderBy: { updatedAt: 'desc' },
            select: {
                id: true,
                status: true,
                applicationCategory: true,
                registrationPaymentStatus: true,
                personalData: true,
                participationCategory: {
                    select: {
                        name: true,
                    },
                },
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

        // Check payment for non-fully-funded applicants
        await this.validatePaymentStatus(application);

        // Submit the application
        await this.prisma.participantApplication.update({
            where: { id: application.id },
            data: {
                status: 'submitted',
                submittedAt: new Date(),
            },
        });

        await this.invalidateCaches(userId, participant.id);

        return {
            success: true,
            applicationId: application.id,
            status: 'submitted',
        };
    }

    private async validatePaymentStatus(application: {
        id: string;
        applicationCategory: string | null;
        registrationPaymentStatus: string;
        participationCategory: { name: string } | null;
    }): Promise<void> {
        const isFullyFunded = this.isFullyFundedApplication(application);
        if (isFullyFunded) return;

        if (application.registrationPaymentStatus === 'paid') {
            return;
        }

        try {
            const payments = await this.paymentClient.getIntentsByReference({
                reference_type: 'application',
                reference_id: application.id,
            });

            const hasPaidRegistration = payments.intents.some(
                (intent: { status: string; metadata?: Record<string, unknown> }) =>
                    intent.status === 'SUCCEEDED' &&
                    intent.metadata?.['payment_category'] === 'registration',
            );

            if (!hasPaidRegistration) {
                throw new BadRequestException(
                    'Registration fee must be paid before submission.',
                );
            }
        } catch (error) {
            if (error instanceof BadRequestException) throw error;
            // If payment service is unavailable, allow submission with warning
            // This prevents blocking users due to infra issues
        }
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

    private isFullyFundedApplication(application: {
        applicationCategory: string | null;
        participationCategory: { name: string } | null;
    }): boolean {
        if (application.applicationCategory === 'fully_funded') {
            return true;
        }

        const fromCategoryName = this.mapCategoryNameToApplicationCategory(
            application.participationCategory?.name,
        );

        return fromCategoryName === 'fully_funded';
    }

    private mapCategoryNameToApplicationCategory(name: string | null | undefined): 'fully_funded' | 'self_funded' | null {
        if (!name) return null;

        const normalized = name.toLowerCase().replace(/[^a-z0-9]/g, '');

        if (
            normalized === 'fullyfunded'
            || normalized === 'fullyfund'
            || normalized === 'fullfunded'
            || normalized === 'fullscholarship'
        ) {
            return 'fully_funded';
        }

        if (
            normalized === 'selffunded'
            || normalized === 'selffund'
            || normalized === 'selfsponsored'
        ) {
            return 'self_funded';
        }

        return null;
    }

    private async invalidateCaches(userId: string, participantId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSIONS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId)),
        ]);
    }
}
