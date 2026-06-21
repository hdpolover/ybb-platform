import { Controller, Logger, Optional } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { createHash } from 'crypto';
import { RmqEventPayload } from '@common/types/events';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RedisPubSubService } from '@shared/infrastructure/redis/redis-pubsub.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PaymentStatus, Prisma } from '@prisma/client';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { PaymentOutboxService } from '../infrastructure/services/payment-outbox.service';
import {
    acknowledgeRmqMessage,
    rejectRmqMessageForRetry,
} from '@shared/infrastructure/rabbitmq/rmq-ack';
import { buildParticipantPaymentsUrl, buildParticipantInvoiceUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

@Controller()
export class PaymentEventsController {
    private readonly logger = new Logger(PaymentEventsController.name);
    private readonly queueName = 'api-service-payment-events';
    private readonly maxRetryAttempts = parsePositiveInt(
        process.env.API_PAYMENT_EVENTS_MAX_RETRIES,
        3,
    );

    constructor(
        private readonly metricsService: MetricsService,
        private readonly prisma: PrismaService,
        private readonly unitOfWork: UnitOfWork,
        private readonly cacheService: CacheService,
        private readonly paymentOutbox: PaymentOutboxService,
        private readonly producer: RabbitMQProducerService,
        @Optional() private readonly pubSubService?: RedisPubSubService,
        @Optional() private readonly referralFunnel?: ReferralFunnelService,
    ) {}

    @EventPattern('payment.created')
    async handlePaymentCreated(
        @Payload() payload: unknown,
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef() as RabbitChannel | undefined;
        const msg = context.getMessage();
        const data = asRecord(payload);
        try {
            const status = getString(data, 'status');
            const applicationId = getString(asRecord(data.metadata), 'application_id');
            if (status !== 'PENDING_REVIEW' || !applicationId) {
                if (channel && msg) channel.ack(msg);
                return;
            }
            const invoiceWithBrand = await this.prisma.applicationInvoice.findFirst({
                where: { applicationId },
                orderBy: { createdAt: 'desc' },
                include: {
                    application: {
                        include: {
                            participant: {
                                include: { user: { select: { email: true } } },
                            },
                            program: { include: { brand: { include: { settings: true } } } },
                        },
                    },
                },
            });
            if (!invoiceWithBrand) {
                this.logger.warn(`handlePaymentCreated: no invoice found for applicationId=${applicationId}`);
                if (channel && msg) channel.ack(msg);
                return;
            }
            const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
            const brandPayload = rawBrand
                ? {
                      name: rawBrand.name,
                      primaryColor: rawBrand.primaryColor,
                      logoUrl: rawBrand.logoUrl,
                      websiteUrl: rawBrand.websiteUrl,
                      contactEmail: rawBrand.contactEmail,
                      contactAddress: rawBrand.contactAddress,
                      socialMediaLinks: rawBrand.socialMediaLinks,
                      settings: rawBrand.settings
                          ? {
                                footerNavigation: rawBrand.settings.footerNavigation,
                                supportEmail: rawBrand.settings.supportEmail,
                            }
                          : null,
                  }
                : null;
            await this.producer.emit('notification.payment_created', {
                email: getString(data, 'email') || invoiceWithBrand?.application?.participant?.user?.email,
                customer_name:
                    getString(asRecord(data.metadata), 'customer_name') ||
                    invoiceWithBrand?.application?.participant?.fullName ||
                    'Customer',
                amount: Number(data.amount) || 0,
                currency: getString(data, 'currency') || 'IDR',
                order_id: invoiceWithBrand.id || getString(data, 'order_id') || '',
                status,
                metadata: { application_id: applicationId, invoice_id: invoiceWithBrand.id },
                brand: brandPayload,
            });
            if (channel && msg) channel.ack(msg);
        } catch (err) {
            this.logger.error('handlePaymentCreated error', err);
            if (channel && msg) channel.nack(msg, false, false);
        }
    }

    @EventPattern('payment.cancelled')
    async handlePaymentCancelled(
        @Payload() data: RmqEventPayload,
        @Ctx() context: RmqContext,
    ) {
        const start = Date.now();
        let status: 'success' | 'failed' = 'success';
        if (await this.moveToDlqWhenRetryExhausted('payment.cancelled', context)) {
            return;
        }

        try {
            const metadata = (data.metadata as Record<string, unknown>) || {};
            const applicationId = (metadata.application_id as string) || (data.application_id as string);
            const invoiceId = (metadata.invoice_id as string) || (data.invoice_id as string);
            const intentId = (data.intent_id as string) || (metadata.intent_id as string);
            const transactionId =
                (data.transaction_id as string)
                || (data.payment_id as string)
                || (metadata.transaction_id as string);
            const cancellationReason =
                (metadata.cancellation_reason as string)
                || (metadata.reason as string)
                || (data.reason as string)
                || (data.message as string)
                || 'Payment cancelled';
            const method = (data.payment_method as string) || (data.method as string) || undefined;

            const cancelledInvoice = await this.markInvoiceCancelled({
                applicationId,
                invoiceId,
                intentId,
                transactionId,
                cancellationReason,
                paymentMethod: method,
            });

            if (cancelledInvoice?.userId) {
                await this.invalidateUserPortalCache(
                    cancelledInvoice.userId,
                    'payment cancelled',
                    cancelledInvoice.invoiceId,
                );
            } else if (applicationId) {
                const application = await this.prisma.participantApplication.findUnique({
                    where: { id: applicationId },
                    include: {
                        participant: {
                            select: { userId: true },
                        },
                    },
                });

                if (application?.participant?.userId) {
                    await this.invalidateUserPortalCache(application.participant.userId, 'payment cancelled');
                }
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Failed to handle payment.cancelled: ${err.message}`, err.stack);
            status = 'failed';
            rejectRmqMessageForRetry(context, this.logger, 'payment.cancelled');
            return;
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe(
                {
                    queue_name: 'payment.cancelled',
                    status,
                },
                duration,
            );
        }

        acknowledgeRmqMessage(context, this.logger, 'payment.cancelled', 'processed');
    }

    @EventPattern('payment.refunded')
    async handlePaymentRefunded(
        @Payload() payload: unknown,
        @Ctx() context: RmqContext,
    ) {
        const channel = context.getChannelRef() as RabbitChannel | undefined;
        const msg = context.getMessage();
        const data = asRecord(payload);
        try {
            const paymentId = getString(data, 'payment_id') || getString(data, 'transaction_id');
            const applicationId = getString(asRecord(data.metadata), 'application_id');
            const brandInclude = {
                application: {
                    include: {
                        participant: {
                            include: { user: { select: { email: true } } },
                        },
                        program: { include: { brand: { include: { settings: true } } } },
                    },
                },
            } as const;
            let invoiceWithBrand: Awaited<ReturnType<typeof this.prisma.applicationInvoice.findFirst<{ include: typeof brandInclude }>>> = null;
            if (paymentId) {
                invoiceWithBrand = await this.prisma.applicationInvoice.findFirst({
                    where: { externalTransactionId: paymentId },
                    include: brandInclude,
                });
            }
            if (!invoiceWithBrand && applicationId) {
                invoiceWithBrand = await this.prisma.applicationInvoice.findFirst({
                    where: { applicationId },
                    orderBy: { createdAt: 'desc' },
                    include: brandInclude,
                });
            }
            const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
            const brandPayload = rawBrand
                ? {
                      name: rawBrand.name,
                      primaryColor: rawBrand.primaryColor,
                      logoUrl: rawBrand.logoUrl,
                      websiteUrl: rawBrand.websiteUrl,
                      contactEmail: rawBrand.contactEmail,
                      contactAddress: rawBrand.contactAddress,
                      socialMediaLinks: rawBrand.socialMediaLinks,
                      settings: rawBrand.settings
                          ? {
                                footerNavigation: rawBrand.settings.footerNavigation,
                                supportEmail: rawBrand.settings.supportEmail,
                            }
                          : null,
                  }
                : null;
            await this.producer.emit('notification.payment_refunded', {
                email: getString(data, 'email') || invoiceWithBrand?.application?.participant?.user?.email,
                customer_name:
                    getString(asRecord(data.metadata), 'customer_name') ||
                    invoiceWithBrand?.application?.participant?.fullName ||
                    'Customer',
                amount: Number(data.amount) || 0,
                currency: getString(data, 'currency') || 'IDR',
                order_id: paymentId || getString(data, 'order_id') || '',
                metadata: { application_id: applicationId, invoice_id: invoiceWithBrand?.id },
                brand: brandPayload,
            });
            if (channel && msg) channel.ack(msg);
        } catch (err) {
            this.logger.error('handlePaymentRefunded error', err);
            if (channel && msg) channel.nack(msg, false, false);
        }
    }

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(
        @Payload() data: RmqEventPayload,
        @Ctx() context: RmqContext,
    ) {
        const start = Date.now();
        let status: 'success' | 'failed' = 'success';
        if (await this.moveToDlqWhenRetryExhausted('payment.succeeded', context)) {
            return;
        }

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
            let applicationId = (metadata.application_id as string) || (data.application_id as string);
            const invoiceId = (metadata.invoice_id as string) || undefined;
            const paymentCategory = (metadata.payment_category as string) || 'registration';
            const intentId = (data.intent_id as string) || '';
            const transactionId = (data.transaction_id as string) || gatewayOrderId || '';

            // Portal-driven manual payments only carry invoice_id in metadata. Resolve
            // application_id from the invoice so we can run the same downstream logic.
            if (!applicationId && invoiceId) {
                const inv = await this.prisma.applicationInvoice.findUnique({
                    where: { id: invoiceId },
                    select: { applicationId: true },
                });
                if (inv) applicationId = inv.applicationId;
            }

            if (applicationId) {
                const result = await this.processApplicationPayment(
                    applicationId,
                    paymentCategory,
                    amount,
                    currency,
                    transactionId,
                    intentId,
                    method,
                    invoiceId,
                );

                // Invalidate portal cache for this user to reflect payment immediately
                if (result) {
                    await this.invalidateUserPortalCache(result.userId, 'payment succeeded', result.invoiceId ?? undefined);

                    // Advance referral funnel: → completed (only when all payments are done)
                    if (this.referralFunnel) {
                        await this.referralFunnel.advanceToCompleted(
                            result.participantId,
                            result.programId,
                        );
                    }
                }

                // Re-emit branded notification event
                try {
                    const invoiceWithBrand = result?.invoiceId
                        ? await this.prisma.applicationInvoice.findUnique({
                              where: { id: result.invoiceId },
                              include: {
                                  application: {
                                      include: {
                                          participant: {
                                              include: { user: { select: { email: true } } },
                                          },
                                          program: { include: { brand: { include: { settings: true } } } },
                                      },
                                  },
                              },
                          })
                        : null;
                    const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
                    const brandPayload = rawBrand
                        ? {
                              name: rawBrand.name,
                              primaryColor: rawBrand.primaryColor,
                              logoUrl: rawBrand.logoUrl,
                              websiteUrl: rawBrand.websiteUrl,
                              contactEmail: rawBrand.contactEmail,
                              contactAddress: rawBrand.contactAddress,
                              socialMediaLinks: rawBrand.socialMediaLinks,
                              settings: rawBrand.settings
                                  ? {
                                        footerNavigation: rawBrand.settings.footerNavigation,
                                        supportEmail: rawBrand.settings.supportEmail,
                                    }
                                  : null,
                          }
                        : null;
                    await this.producer.emit('notification.payment_succeeded', {
                        email: getString(data, 'email') || invoiceWithBrand?.application?.participant?.user?.email,
                        customer_name:
                            getString(asRecord(data.metadata as Record<string, unknown>), 'customer_name') ||
                            invoiceWithBrand?.application?.participant?.fullName ||
                            'Customer',
                        amount: Number(data.amount) || 0,
                        currency: getString(data, 'currency') || 'IDR',
                        order_id: result?.invoiceId || '',
                        payment_id: getString(data, 'payment_id') || getString(data, 'transaction_id'),
                        description:
                            getString(asRecord(data.metadata as Record<string, unknown>), 'description') ||
                            'Payment for services',
                        invoice_url: buildParticipantInvoiceUrl(rawBrand, result?.invoiceId),
                        payments_page_url: buildParticipantPaymentsUrl(rawBrand),
                        metadata: {
                            application_id: applicationId,
                            invoice_id: result?.invoiceId,
                            item_details: asRecord(data.metadata as Record<string, unknown>).item_details,
                        },
                        brand: brandPayload,
                    });
                } catch (emitErr) {
                    this.logger.error('Failed to emit notification.payment_succeeded', emitErr);
                }
            } else {
                this.logger.warn(`Payment succeeded but no application_id found in metadata. ID: ${gatewayOrderId}`);
            }

        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Failed to handle payment.succeeded: ${err.message}`, err.stack);
            status = 'failed';
            rejectRmqMessageForRetry(context, this.logger, 'payment.succeeded');
            return;
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.succeeded', 
                status
            }, duration);
        }

        acknowledgeRmqMessage(context, this.logger, 'payment.succeeded', 'processed');
    }

    private async processApplicationPayment(
        applicationId: string,
        category: string,
        amount: number,
        currency: string,
        transactionId: string,
        intentId: string,
        method: string,
        existingInvoiceId?: string,
    ): Promise<{ userId: string; participantId: string; programId: string; invoiceId: string | null } | null> {
        const application = await this.prisma.participantApplication.findUnique({
            where: { id: applicationId },
            include: {
                participant: {
                    select: { id: true, userId: true }
                },
                program: {
                    select: {
                        id: true,
                        usdInIdr: true,
                    },
                },
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
        let createdInvoiceId: string | null = null;
        let outboxQueued = false;
        let outboxDedupeKey: string | null = null;
        await this.unitOfWork.execute(
            async (repos) => {
                // Update application payment status
                await repos.tx.participantApplication.update({
                    where: { id: applicationId },
                    data: updateData
                });

                // If the portal flow already created an invoice, update it in-place rather
                // than creating a duplicate. The portal handler emits invoice_id in event metadata.
                if (existingInvoiceId) {
                    const updated = await repos.tx.applicationInvoice.update({
                        where: { id: existingInvoiceId },
                        data: {
                            status: PaymentStatus.paid,
                            paidAt: new Date(),
                            externalTransactionId: transactionId,
                            externalIntentId: intentId || undefined,
                            paymentMethod: method,
                        },
                        select: { id: true },
                    });
                    createdInvoiceId = updated.id;
                } else if (application.pricingTierId) {
                    const exchangeRateSnapshot =
                        application.program?.usdInIdr != null
                            ? Number(application.program.usdInIdr)
                            : null;

                    const createdInvoice = await repos.tx.applicationInvoice.create({
                        data: {
                            applicationId: applicationId,
                            pricingTierId: application.pricingTierId,
                            amount: amount,
                            currency: currency,
                            status: PaymentStatus.paid,
                            paidAt: new Date(),
                            exchangeRateSnapshot: exchangeRateSnapshot,
                            externalTransactionId: transactionId,
                            externalIntentId: intentId || null,
                            paymentMethod: method,
                        },
                    });
                    createdInvoiceId = createdInvoice.id;
                } else {
                    this.logger.warn(`Skipping invoice creation for app ${applicationId} - no pricingTierId`);
                }

                const outboxResult = await this.paymentOutbox.enqueueInTransaction(repos.tx, {
                    eventType: 'payment.application-status-updated',
                    aggregateType: 'participant-application',
                    aggregateId: applicationId,
                    correlationId: intentId || transactionId || undefined,
                    // Hash the variable-length external reference so the dedupe key always
                    // fits within the VARCHAR(191) DB column regardless of provider ID length.
                    dedupeKey: buildApplicationDedupeKey(
                        applicationId,
                        transactionId || intentId || createdInvoiceId || 'state-update',
                    ),
                    payload: {
                        applicationId,
                        invoiceId: createdInvoiceId,
                        paymentCategory: category,
                        paymentStatus: 'paid',
                        amount,
                        currency,
                        transactionId,
                        intentId: intentId || null,
                        paymentMethod: method,
                        processedAt: new Date().toISOString(),
                    },
                });
                outboxQueued = outboxResult.queued;
                outboxDedupeKey = outboxResult.dedupeKey;
            },
            { name: 'payment-success-application-update', timeout: 5000 }
        );
        this.logger.log(`Application ${applicationId} updated to PAID (Category: ${category})`);
        if (this.paymentOutbox.isEnabled()) {
            this.logger.log(
                `[payment-outbox] queued=${outboxQueued} dedupe_key=${abbreviateKey(outboxDedupeKey)}`,
            );
        }

        // Return context for cache invalidation and referral funnel
        return {
            userId: application.participant.userId,
            participantId: application.participant.id,
            programId: application.programId,
            invoiceId: createdInvoiceId,
        };
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(
        @Payload() data: RmqEventPayload,
        @Ctx() context: RmqContext,
    ) {
        const start = Date.now();
        let status: 'success' | 'failed' = 'success';
        if (await this.moveToDlqWhenRetryExhausted('payment.failed', context)) {
            return;
        }

        try {
            this.logger.debug(`Metrics: payment.failed event received`);
            
            const currency = (data.currency as string) || 'IDR';
            const method = (data.payment_method as string) || (data.method as string) || 'unknown';

            this.metricsService.paymentTotal.inc({
                currency,
                method,
                status: 'failed'
            });

            const metadata = (data.metadata as Record<string, unknown>) || {};
            const applicationId = (metadata.application_id as string) || (data.application_id as string);
            const invoiceId = (metadata.invoice_id as string) || (data.invoice_id as string);
            const intentId = (data.intent_id as string) || (metadata.intent_id as string);
            const transactionId =
                (data.transaction_id as string)
                || (data.payment_id as string)
                || (metadata.transaction_id as string);
            const failureReason =
                (metadata.failure_reason as string)
                || (metadata.reason as string)
                || (data.reason as string)
                || (data.message as string)
                || undefined;

            const failedInvoice = await this.markInvoiceFailed({
                applicationId,
                invoiceId,
                intentId,
                transactionId,
                failureReason,
                paymentMethod: method,
            });
            
            if (failedInvoice?.userId) {
                await this.invalidateUserPortalCache(failedInvoice.userId, 'payment failed', failedInvoice.invoiceId);
            } else if (applicationId) {
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

            // Re-emit branded notification event
            try {
                if (failedInvoice?.invoiceId) {
                    const invoiceWithBrand = await this.prisma.applicationInvoice.findUnique({
                        where: { id: failedInvoice.invoiceId },
                        include: {
                            application: {
                                include: {
                                    participant: {
                                        include: { user: { select: { email: true } } },
                                    },
                                    program: { include: { brand: { include: { settings: true } } } },
                                },
                            },
                        },
                    });
                    const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
                    const brandPayload = rawBrand
                        ? {
                              name: rawBrand.name,
                              primaryColor: rawBrand.primaryColor,
                              logoUrl: rawBrand.logoUrl,
                              websiteUrl: rawBrand.websiteUrl,
                              contactEmail: rawBrand.contactEmail,
                              contactAddress: rawBrand.contactAddress,
                              socialMediaLinks: rawBrand.socialMediaLinks,
                              settings: rawBrand.settings
                                  ? {
                                        footerNavigation: rawBrand.settings.footerNavigation,
                                        supportEmail: rawBrand.settings.supportEmail,
                                    }
                                  : null,
                          }
                        : null;
                    await this.producer.emit('notification.payment_failed', {
                        email: getString(data, 'email') || invoiceWithBrand?.application?.participant?.user?.email,
                        customer_name:
                            getString(asRecord(data.metadata as Record<string, unknown>), 'customer_name') ||
                            invoiceWithBrand?.application?.participant?.fullName ||
                            'Customer',
                        amount: Number(data.amount) || 0,
                        currency: getString(data, 'currency') || 'IDR',
                        order_id: failedInvoice.invoiceId || getString(data, 'order_id') || '',
                        reason:
                            getString(asRecord(data.metadata as Record<string, unknown>), 'failure_reason') ||
                            getString(data, 'reason') ||
                            'Payment could not be processed',
                        metadata: { application_id: applicationId, invoice_id: failedInvoice.invoiceId },
                        brand: brandPayload,
                    });
                } else {
                    this.logger.warn(
                        `notification.payment_failed not emitted: no resolved invoice for payment.failed event (applicationId=${applicationId ?? 'unknown'} intentId=${intentId ?? 'unknown'})`,
                    );
                }
            } catch (emitErr) {
                this.logger.error('Failed to emit notification.payment_failed', emitErr);
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Failed to handle payment.failed: ${err.message}`, err.stack);
            status = 'failed';
            rejectRmqMessageForRetry(context, this.logger, 'payment.failed');
            return;
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.failed', 
                status
            }, duration);
        }

        acknowledgeRmqMessage(context, this.logger, 'payment.failed', 'processed');
    }

    private async markInvoiceFailed(input: {
        applicationId?: string;
        invoiceId?: string;
        intentId?: string;
        transactionId?: string;
        failureReason?: string;
        paymentMethod?: string;
    }): Promise<{ userId: string; invoiceId: string } | null> {
        const invoice = await this.resolveFailureInvoice(input);
        if (!invoice) {
            return null;
        }

        const userId = invoice.application.participant.userId;
        if (invoice.status === PaymentStatus.paid) {
            return { userId, invoiceId: invoice.id };
        }

        const rejectionReason =
            invoice.rejectionReason
            ?? input.failureReason
            ?? null;
        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.failed }
                : { programPaymentStatus: PaymentStatus.failed };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: PaymentStatus.failed,
                    paidAt: null,
                    paymentMethod: invoice.paymentMethod ?? input.paymentMethod ?? null,
                    externalIntentId: invoice.externalIntentId ?? input.intentId ?? null,
                    externalTransactionId:
                        invoice.externalTransactionId
                        ?? input.transactionId
                        ?? null,
                    rejectionReason,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.applicationId },
                data: paymentStatusPatch,
            }),
        ]);

        return { userId, invoiceId: invoice.id };
    }

    private async markInvoiceCancelled(input: {
        applicationId?: string;
        invoiceId?: string;
        intentId?: string;
        transactionId?: string;
        cancellationReason?: string;
        paymentMethod?: string;
    }): Promise<{ userId: string; invoiceId: string } | null> {
        const invoice = await this.resolveFailureInvoice(input);
        if (!invoice) {
            return null;
        }

        const userId = invoice.application.participant.userId;
        if (invoice.status === PaymentStatus.paid || invoice.status === PaymentStatus.cancelled) {
            return { userId, invoiceId: invoice.id };
        }

        const cancellationReason =
            invoice.rejectionReason
            ?? input.cancellationReason
            ?? 'Payment cancelled';
        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.cancelled }
                : { programPaymentStatus: PaymentStatus.cancelled };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: PaymentStatus.cancelled,
                    paidAt: null,
                    paymentMethod: invoice.paymentMethod ?? input.paymentMethod ?? null,
                    externalIntentId: invoice.externalIntentId ?? input.intentId ?? null,
                    externalTransactionId:
                        invoice.externalTransactionId
                        ?? input.transactionId
                        ?? null,
                    rejectionReason: cancellationReason,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.applicationId },
                data: paymentStatusPatch,
            }),
        ]);

        return { userId, invoiceId: invoice.id };
    }

    private async resolveFailureInvoice(input: {
        applicationId?: string;
        invoiceId?: string;
        intentId?: string;
        transactionId?: string;
    }) {
        const include = {
            pricingTier: {
                select: { feeType: true },
            },
            application: {
                select: {
                    participant: {
                        select: { userId: true },
                    },
                },
            },
        } satisfies Prisma.ApplicationInvoiceInclude;

        if (input.invoiceId) {
            return this.prisma.applicationInvoice.findUnique({
                where: { id: input.invoiceId },
                include,
            });
        }

        if (input.intentId) {
            const byIntent = await this.prisma.applicationInvoice.findFirst({
                where: { externalIntentId: input.intentId },
                include,
                orderBy: { updatedAt: 'desc' },
            });
            if (byIntent) return byIntent;
        }

        if (input.transactionId) {
            const byTransaction = await this.prisma.applicationInvoice.findFirst({
                where: { externalTransactionId: input.transactionId },
                include,
                orderBy: { updatedAt: 'desc' },
            });
            if (byTransaction) return byTransaction;
        }

        if (!input.applicationId) {
            return null;
        }

        return this.prisma.applicationInvoice.findFirst({
            where: { applicationId: input.applicationId },
            include,
            orderBy: { updatedAt: 'desc' },
        });
    }

    private async moveToDlqWhenRetryExhausted(
        eventType: string,
        context: RmqContext,
    ): Promise<boolean> {
        const message = context.getMessage() as RmqMessage | undefined;
        const headers = asRecord(message?.properties?.headers);
        const retryCount = getRejectedRetryCount(headers, this.queueName);
        if (retryCount < this.maxRetryAttempts) {
            return false;
        }

        const channel = context.getChannelRef() as RabbitChannel | undefined;
        const content = message?.content;
        if (!message || !channel || !content) {
            this.logger.error(
                `[payment-events-retry] max retries reached but message could not be routed to DLQ event=${eventType}`,
            );
            return false;
        }

        const dlqName = `${this.queueName}.dlq`;
        const existingHeaders = asRecord(message.properties?.headers);
        const dlqHeaders: Record<string, unknown> = {
            ...existingHeaders,
            'x-final-reason': 'retry-exhausted',
            'x-final-event-type': eventType,
            'x-final-retry-count': retryCount,
        };

        channel.sendToQueue(dlqName, content, {
            persistent: true,
            headers: dlqHeaders,
            messageId: message.properties?.messageId,
            correlationId: message.properties?.correlationId,
            contentType: message.properties?.contentType,
            contentEncoding: message.properties?.contentEncoding,
            deliveryMode: message.properties?.deliveryMode,
            priority: message.properties?.priority,
            expiration: message.properties?.expiration,
            timestamp: message.properties?.timestamp,
            type: message.properties?.type,
            userId: message.properties?.userId,
            appId: message.properties?.appId,
        });

        this.logger.error(
            `[payment-events-retry] moved to DLQ event=${eventType} queue=${dlqName} retries=${retryCount}`,
        );
        acknowledgeRmqMessage(context, this.logger, eventType, 'retry-exhausted');
        return true;
    }

    private ackIgnoredPaymentEvent(context: RmqContext) {
        acknowledgeRmqMessage(context, this.logger, context.getPattern(), 'ignored');
    }

    /**
     * Invalidate all portal cache entries for a specific user
     * This ensures the user sees updated payment status immediately
     * 
     * For multi-instance deployments, uses Redis Pub/Sub to broadcast
     * invalidation to all API instances
     */
    private async invalidateUserPortalCache(userId: string, reason: string, invoiceId?: string): Promise<void> {
        try {
            const patterns = [
                CACHE_KEYS.PORTAL_DASHBOARD(userId),
                // Use wildcards so all program-specific variants are busted:
                // PORTAL_SUBMISSIONS keyed by (userId, programId?) → portal:submissions:${userId}:${programId|'latest'}
                `portal:submissions:${userId}:*`,
                // PORTAL_SUBMISSION_DETAIL keyed by (userId, programId?) → portal:submission-detail:${userId}:${programId|'latest'}
                // The submit gate reads preview.payment.paid from here; bust it so a settled
                // registration fee unblocks the submit button immediately.
                `portal:submission-detail:${userId}:*`,
                // PORTAL_PAYMENTS keyed by (userId, programId?) → portal:payments:${userId}:${programId|'latest'}
                `portal:payments:${userId}:*`,
                CACHE_KEYS.PORTAL_DOCUMENTS(userId),
            ];

            if (invoiceId) {
                patterns.push(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId));
            }

            // Use Pub/Sub if available (multi-instance), otherwise fall back to local invalidation.
            // invalidateAndPublish calls invalidateByPattern for each entry, so wildcard patterns
            // are correctly handled end-to-end.
            if (this.pubSubService) {
                await this.pubSubService.invalidateAndPublish(patterns);
                this.logger.debug(`Broadcast cache invalidation for user ${userId} (reason: ${reason})`);
            } else {
                await Promise.all(
                    patterns.map((p) =>
                        p.includes('*')
                            ? this.cacheService.invalidateByPattern(p)
                            : this.cacheService.invalidateKey(p),
                    ),
                );
                this.logger.debug(`Invalidated local cache for user ${userId} (reason: ${reason})`);
            }
        } catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.logger.error(`Failed to invalidate cache for user ${userId}: ${err.message}`);
            // Don't throw - cache invalidation failures shouldn't break payment processing
        }
    }
}

type RmqMessage = {
    content?: Buffer;
    properties?: {
        headers?: Record<string, unknown>;
        messageId?: string;
        correlationId?: string;
        contentType?: string;
        contentEncoding?: string;
        deliveryMode?: number;
        priority?: number;
        expiration?: string;
        timestamp?: number;
        type?: string;
        userId?: string;
        appId?: string;
    };
};

type RabbitChannel = {
    ack(message: unknown): void;
    nack(message: unknown, allUpTo?: boolean, requeue?: boolean): void;
    sendToQueue: (
        queue: string,
        content: Buffer,
        options?: {
            headers?: Record<string, unknown>;
            contentType?: string;
            contentEncoding?: string;
            deliveryMode?: number;
            priority?: number;
            expiration?: string;
            timestamp?: number;
            type?: string;
            userId?: string;
            appId?: string;
            persistent?: boolean;
            messageId?: string;
            correlationId?: string;
        },
    ) => boolean;
};

function asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        return {};
    }
    return value as Record<string, unknown>;
}

function getString(source: Record<string, unknown>, key: string): string | undefined {
    const value = source[key];
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function getRejectedRetryCount(headers: Record<string, unknown>, queueName: string): number {
    const xDeathRaw = headers['x-death'];
    if (!Array.isArray(xDeathRaw)) return 0;

    let retries = 0;
    for (const item of xDeathRaw) {
        const death = asRecord(item);
        const queue = getString(death, 'queue');
        const reason = getString(death, 'reason');
        if (queue !== queueName || reason !== 'rejected') continue;

        const countRaw = death.count;
        if (typeof countRaw === 'number' && Number.isFinite(countRaw)) {
            retries += Math.floor(countRaw);
            continue;
        }

        if (typeof countRaw === 'string' && countRaw.trim()) {
            const parsed = Number(countRaw);
            if (Number.isFinite(parsed)) {
                retries += Math.floor(parsed);
            }
        }
    }

    return retries;
}

function parsePositiveInt(value: string | undefined, defaultValue: number): number {
    if (!value) return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0
        ? Math.floor(parsed)
        : defaultValue;
}

function abbreviateKey(value: string | null): string {
    if (!value) return 'none';
    return value.length <= 28 ? value : `${value.slice(0, 28)}…`;
}

/**
 * Build a dedupe key for the payment-application outbox event that always fits
 * within the VARCHAR(191) DB column regardless of how long the external IDs are.
 *
 * Format: `payment-application:<applicationId>:<16-char hash of externalRef>`
 * Maximum length: 20 + 36 + 1 + 16 = 73 chars.
 */
function buildApplicationDedupeKey(applicationId: string, externalRef: string): string {
    const refHash = createHash('sha256').update(externalRef).digest('hex').slice(0, 16);
    return `payment-application:${applicationId}:${refHash}`;
}
