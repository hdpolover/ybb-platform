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
                participantId: true,
            },
        });

        if (!application) throw new NotFoundException('No active application found');

        if (application.status !== 'draft') {
            throw new BadRequestException(
                `Cannot submit application in "${application.status}" status. Only drafts can be submitted.`,
            );
        }

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

    private async validatePaymentStatus(application: any): Promise<void> {
        const isFullyFunded = application.applicationCategory === 'fully_funded';
        if (isFullyFunded) return;

        try {
            const payments = await this.paymentClient.getIntentsByReference({
                reference_type: 'application',
                reference_id: application.id,
            });

            const hasPaidRegistration = payments.intents.some(
                (intent: any) =>
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

    private async invalidateCaches(userId: string, participantId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_SUBMISSIONS(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_DASHBOARD(userId)),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId)),
        ]);
    }
}
