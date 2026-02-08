import { Controller, Logger, Optional } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RedisPubSubService } from '@shared/infrastructure/redis/redis-pubsub.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PaymentStatus } from '@prisma/client';

@Controller()
export class PaymentEventsController {
    private readonly logger = new Logger(PaymentEventsController.name);

    constructor(
        private readonly metricsService: MetricsService,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        @Optional() private readonly pubSubService?: RedisPubSubService,
    ) {}

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(@Payload() data: any) {
        const start = Date.now();
        try {
            // Log basic info for debugging
            this.logger.debug(`Metrics: payment.succeeded event received`);
            
            const currency = data.currency || 'IDR';
            const method = data.payment_method || data.method || 'unknown'; 
            const amount = Number(data.amount) || 0;
            const gatewayOrderId = data.gateway_order_id || data.id;

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
            const metadata = data.metadata || {};
            const applicationId = metadata.application_id || data.application_id;
            const paymentCategory = metadata.payment_category || 'registration';

            if (applicationId) {
                const userId = await this.processApplicationPayment(
                    applicationId, 
                    paymentCategory, 
                    amount, 
                    currency, 
                    gatewayOrderId, 
                    method
                );

                // Invalidate portal cache for this user to reflect payment immediately
                if (userId) {
                    await this.invalidateUserPortalCache(userId, 'payment succeeded');
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
        method: string
    ): Promise<string | null> {
        const application = await this.prisma.participantApplication.findUnique({
            where: { id: applicationId },
            include: {
                participant: {
                    select: { userId: true }
                }
            }
        });

        if (!application) {
            this.logger.warn(`Application ${applicationId} not found`);
            return null;
        }

        const updateData: any = {};
        if (category === 'registration') {
            updateData.registrationPaymentStatus = PaymentStatus.paid;
        } else if (category === 'program') {
            updateData.programPaymentStatus = PaymentStatus.paid;
        }

        // If pricing tier is missing (edge case), we can't create a valid invoice relation easily
        // But preventing the status update would be worse.
        // We will try to create invoice if tier exists.
        const ops: any[] = [
            this.prisma.participantApplication.update({
                where: { id: applicationId },
                data: updateData
            })
        ];

        if (application.pricingTierId) {
            ops.push(
                this.prisma.applicationInvoice.create({
                    data: {
                        applicationId: applicationId,
                        pricingTierId: application.pricingTierId,
                        amount: amount,
                        currency: currency,
                        status: PaymentStatus.paid,
                        paidAt: new Date(),
                        externalTransactionId: transactionId,
                        paymentMethod: method
                    }
                })
            );
        } else {
            this.logger.warn(`Skipping invoice creation for app ${applicationId} - no pricingTierId`);
        }

        await this.prisma.$transaction(ops);
        this.logger.log(`Application ${applicationId} updated to PAID (Category: ${category})`);

        // Return userId for cache invalidation
        return application.participant.userId;
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(@Payload() data: any) {
        const start = Date.now();
        try {
            this.logger.debug(`Metrics: payment.failed event received`);
            
            const currency = data.currency || 'IDR';
            const method = data.payment_method || data.method || 'unknown';

            this.metricsService.paymentTotal.inc({
                currency,
                method,
                status: 'failed'
            });

            // Also invalidate cache on failure so user sees the failed status
            const metadata = data.metadata || {};
            const applicationId = metadata.application_id || data.application_id;
            
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
