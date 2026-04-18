import { Controller, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { RmqEventPayload } from '@common/types/events';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RedisPubSubService } from '@shared/infrastructure/redis/redis-pubsub.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PaymentStatus, Prisma } from '@prisma/client';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';

@Controller()
export class PaymentEventsController {
    private readonly logger = new Logger(PaymentEventsController.name);

    constructor(
        private readonly metricsService: MetricsService,
        private readonly prisma: PrismaService,
        private readonly unitOfWork: UnitOfWork,
        private readonly cacheService: CacheService,
        @Optional() private readonly pubSubService?: RedisPubSubService,
        @Optional() private readonly referralFunnel?: ReferralFunnelService,
    ) {}

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(@Payload() data: RmqEventPayload) {
        const start = Date.now();
        try {
            // Log basic info for debugging
            this.logger.debug(`Metrics: payment.succeeded event received`);
            
            const currency = (data.currency as string) || 'IDR';
            const method = (data.payment_method as string) || (data.method as string) || 'unknown'; 
            const amount = Number(data.amount) || 0;
            const gatewayOrderId = (data.gateway_order_id as string) || (data.id as string);

            // Counter
            this.metricsService.paymentTotal.inc({
                currency,
                method,
                status: 'success'
            });

            // Histogram
            this.metricsService.paymentAmount.observe({
                currency,
                method,
                status: 'success'
            }, amount);

            // Business Logic: Update Application & Create Invoice
            const metadata = (data.metadata as Record<string, unknown>) || {};
            const applicationId = (metadata.application_id as string) || (data.application_id as string);
            const paymentCategory = (metadata.payment_category as string) || 'registration';
            const intentId = (data.intent_id as string) || '';
            const transactionId = (data.transaction_id as string) || gatewayOrderId || '';

            if (applicationId) {
                const result = await this.processApplicationPayment(
                    applicationId,
                    paymentCategory,
                    amount,
                    currency,
                    transactionId,
                    intentId,
                    method,
                );

                // Invalidate portal cache for this user to reflect payment immediately
                if (result) {
                    await this.invalidateUserPortalCache(result.userId, 'payment succeeded');

                    // Advance referral funnel: → completed (only when all payments are done)
                    if (this.referralFunnel) {
                        await this.referralFunnel.advanceToCompleted(
                            result.participantId,
                            result.programId,
                        );
                    }
                }
            } else {
                this.logger.warn(`Payment succeeded but no application_id found in metadata. ID: ${gatewayOrderId}`);
            }

        } catch (error) {
            this.logger.error(`Failed to handle payment.succeeded: ${error.message}`, error.stack);
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.succeeded', 
                status: 'success' 
            }, duration);
        }
    }

    private async processApplicationPayment(
        applicationId: string,
        category: string,
        amount: number,
        currency: string,
        transactionId: string,
        intentId: string,
        method: string,
    ): Promise<{ userId: string; participantId: string; programId: string } | null> {
        const application = await this.prisma.participantApplication.findUnique({
            where: { id: applicationId },
            include: {
                participant: {
                    select: { id: true, userId: true }
                }
            }
        });

        if (!application) {
            this.logger.warn(`Application ${applicationId} not found`);
            return null;
        }

        const updateData: Prisma.ParticipantApplicationUpdateInput = {};
        if (category === 'registration') {
            updateData.registrationPaymentStatus = PaymentStatus.paid;
        } else if (category === 'program') {
            updateData.programPaymentStatus = PaymentStatus.paid;
        }

        // If pricing tier is missing (edge case), we can't create a valid invoice relation easily
        // But preventing the status update would be worse.
        // We will try to create invoice if tier exists.
        
        // Unit of Work: Application Payment Status Update + Invoice Creation
        await this.unitOfWork.execute(
            async (repos) => {
                // Update application payment status
                await repos.tx.participantApplication.update({
                    where: { id: applicationId },
                    data: updateData
                });

                // Create invoice if pricing tier exists
                if (application.pricingTierId) {
                    await repos.tx.applicationInvoice.create({
                        data: {
                            applicationId: applicationId,
                            pricingTierId: application.pricingTierId,
                            amount: amount,
                            currency: currency,
                            status: PaymentStatus.paid,
                            paidAt: new Date(),
                            externalTransactionId: transactionId,
                            externalIntentId: intentId || null,
                            paymentMethod: method,
                        },
                    });
                } else {
                    this.logger.warn(`Skipping invoice creation for app ${applicationId} - no pricingTierId`);
                }
            },
            { name: 'payment-success-application-update', timeout: 5000 }
        );
        this.logger.log(`Application ${applicationId} updated to PAID (Category: ${category})`);

        // Return context for cache invalidation and referral funnel
        return {
            userId: application.participant.userId,
            participantId: application.participant.id,
            programId: application.programId,
        };
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(@Payload() data: RmqEventPayload) {
        const start = Date.now();
        try {
            this.logger.debug(`Metrics: payment.failed event received`);
            
            const currency = (data.currency as string) || 'IDR';
            const method = (data.payment_method as string) || (data.method as string) || 'unknown';

            this.metricsService.paymentTotal.inc({
                currency,
                method,
                status: 'failed'
            });

            // Also invalidate cache on failure so user sees the failed status
            const metadata = (data.metadata as Record<string, unknown>) || {};
            const applicationId = (metadata.application_id as string) || (data.application_id as string);
            
            if (applicationId) {
                const application = await this.prisma.participantApplication.findUnique({
                    where: { id: applicationId },
                    include: {
                        participant: {
                            select: { userId: true }
                        }
                    }
                });

                if (application?.participant?.userId) {
                    await this.invalidateUserPortalCache(application.participant.userId, 'payment failed');
                }
            }
        } catch (error) {
            this.logger.error(`Failed to handle payment.failed: ${error.message}`, error.stack);
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.failed', 
                status: 'success' 
            }, duration);
        }
    }

    /**
     * Invalidate all portal cache entries for a specific user
     * This ensures the user sees updated payment status immediately
     * 
     * For multi-instance deployments, uses Redis Pub/Sub to broadcast
     * invalidation to all API instances
     */
    private async invalidateUserPortalCache(userId: string, reason: string): Promise<void> {
        try {
            const patterns = [
                CACHE_KEYS.PORTAL_DASHBOARD(userId),
                CACHE_KEYS.PORTAL_SUBMISSIONS(userId),
                CACHE_KEYS.PORTAL_PAYMENTS(userId),
                CACHE_KEYS.PORTAL_DOCUMENTS(userId),
            ];

            // Use Pub/Sub if available (multi-instance), otherwise local only
            if (this.pubSubService) {
                await this.pubSubService.invalidateAndPublish(patterns);
                this.logger.debug(`Broadcast cache invalidation for user ${userId} (reason: ${reason})`);
            } else {
                await Promise.all(patterns.map(key => this.cacheService.invalidateKey(key)));
                this.logger.debug(`Invalidated local cache for user ${userId} (reason: ${reason})`);
            }
        } catch (error) {
            this.logger.error(`Failed to invalidate cache for user ${userId}: ${error.message}`);
            // Don't throw - cache invalidation failures shouldn't break payment processing
        }
    }
}
