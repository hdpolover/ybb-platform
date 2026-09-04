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
import { PaymentStatus, PricingFeeType, Prisma } from '@prisma/client';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { PaymentOutboxService } from '../infrastructure/services/payment-outbox.service';
import { findPaidSiblingInvoice, supersededByPaidInvoiceReason } from '@shared/utils/paid-sibling-invoice.util';
import {
    acknowledgeRmqMessage,
} from '@shared/infrastructure/rabbitmq/rmq-ack';
import { buildParticipantPaymentsUrl, buildParticipantInvoiceUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PaymentGatewayClient } from '../infrastructure/services/payment-gateway.client';

@Controller()
export class PaymentEventsController {
    private readonly logger = new Logger(PaymentEventsController.name);
    constructor(
        private readonly metricsService: MetricsService,
        private readonly prisma: PrismaService,
        private readonly unitOfWork: UnitOfWork,
        private readonly cacheService: CacheService,
        private readonly paymentOutbox: PaymentOutboxService,
        private readonly producer: RabbitMQProducerService,
        private readonly paymentGatewayClient: PaymentGatewayClient,
        @Optional() private readonly pubSubService?: RedisPubSubService,
        @Optional() private readonly referralFunnel?: ReferralFunnelService,
    ) {}

    @EventPattern('payment.created')
    async handlePaymentCreated(
        @Payload() payload: unknown,
        @Ctx() context: RmqContext,
    ) {
        acknowledgeRmqMessage(context, this.logger, 'payment.created', 'received');
        const data = asRecord(payload);
        try {
            const status = getString(data, 'status');
            const applicationId = getString(asRecord(data.metadata), 'application_id');
            if (status !== 'PENDING_REVIEW' || !applicationId) {
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
                return;
            }
            const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
            const rawProgram = invoiceWithBrand?.application?.program ?? null;
            const brandPayload = rawBrand
                ? {
                      name: rawBrand.name,
                      primaryColor: rawBrand.primaryColor,
                      logoUrl: rawBrand.logoUrl,
                      websiteUrl: rawBrand.websiteUrl,
                      contactEmail: rawProgram?.contactEmail ?? null,
                      contactAddress: rawProgram?.contactAddress ?? null,
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
        } catch (err) {
            this.logger.error('handlePaymentCreated error', err);
        }
    }

    @EventPattern('payment.cancelled')
    async handlePaymentCancelled(
        @Payload() data: RmqEventPayload,
        @Ctx() context: RmqContext,
    ) {
        acknowledgeRmqMessage(context, this.logger, 'payment.cancelled', 'received');
        const start = Date.now();
        let status: 'success' | 'failed' = 'success';

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
            const method =
                (data.payment_method_id as string)
                || (data.payment_method as string)
                || (data.method as string)
                || undefined;

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
    }

    @EventPattern('payment.refunded')
    async handlePaymentRefunded(
        @Payload() payload: unknown,
        @Ctx() context: RmqContext,
    ) {
        acknowledgeRmqMessage(context, this.logger, 'payment.refunded', 'received');
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
            const rawProgram = invoiceWithBrand?.application?.program ?? null;
            const brandPayload = rawBrand
                ? {
                      name: rawBrand.name,
                      primaryColor: rawBrand.primaryColor,
                      logoUrl: rawBrand.logoUrl,
                      websiteUrl: rawBrand.websiteUrl,
                      contactEmail: rawProgram?.contactEmail ?? null,
                      contactAddress: rawProgram?.contactAddress ?? null,
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
        } catch (err) {
            this.logger.error('handlePaymentRefunded error', err);
        }
    }

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(
        @Payload() data: RmqEventPayload,
        @Ctx() context: RmqContext,
    ) {
        acknowledgeRmqMessage(context, this.logger, 'payment.succeeded', 'received');
        const start = Date.now();
        let status: 'success' | 'failed' = 'success';

        try {
            // Log basic info for debugging
            this.logger.debug(`Metrics: payment.succeeded event received`);
            
            const currency = (data.currency as string) || 'IDR';
            // Real method, sourced from the payment service's payment_method_id
            // (mirrors fee_provider/net_amount below). Deliberately has NO 'unknown'
            // fallback here - that literal must never be written to the invoice.
            // 'unknown' is only used for the Prometheus label a few lines down.
            const rawMethod =
                (data.payment_method_id as string)
                || (data.payment_method as string)
                || (data.method as string)
                || undefined;
            const method = rawMethod || 'unknown';
            const amount = Number(data.amount) || 0;
            const gatewayOrderId = (data.gateway_order_id as string) || (data.id as string);
            // Fee/net settlement fields sourced from payment_transactions by the payment
            // service. May be absent on older events still in flight — stays undefined
            // (not 0) so the invoice column is simply left untouched/null, never zeroed.
            const feeProvider = getNullableNumber(data, 'fee_provider');
            const netAmount = getNullableNumber(data, 'net_amount');

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
            // application_id from the invoice so we can run the same downstream logic -
            // and, before anything is flipped to paid, verify the event really settles
            // THAT invoice: it must belong to the application named in the event, and
            // the settled amount/currency must be what the invoice actually owes.
            // On any mismatch nothing is touched; the invoice is left for admin review.
            if (invoiceId) {
                const inv = await this.prisma.applicationInvoice.findUnique({
                    where: { id: invoiceId },
                    select: { applicationId: true, amount: true, currency: true },
                });
                if (!inv) {
                    this.logger.warn(
                        `payment.succeeded: invoice ${invoiceId} not found - skipping paid transition (application=${applicationId ?? 'none'} txn=${transactionId})`,
                    );
                    return;
                }
                if (applicationId && inv.applicationId !== applicationId) {
                    this.logger.warn(
                        `payment.succeeded: invoice ${invoiceId} belongs to application ${inv.applicationId}, not ${applicationId} - skipping paid transition (txn=${transactionId})`,
                    );
                    return;
                }
                if (!settlesInvoice(data.amount, currency, inv.amount, inv.currency)) {
                    this.logger.warn(
                        `payment.succeeded: settled ${String(data.amount)} ${currency} does not match invoice ${invoiceId} (${String(inv.amount)} ${inv.currency}) - skipping paid transition (application=${inv.applicationId} txn=${transactionId})`,
                    );
                    return;
                }
                applicationId = inv.applicationId;
            }

            if (applicationId) {
                const result = await this.processApplicationPayment(
                    applicationId,
                    paymentCategory,
                    amount,
                    currency,
                    transactionId,
                    intentId,
                    rawMethod,
                    invoiceId,
                    feeProvider,
                    netAmount,
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
                    const rawProgram = invoiceWithBrand?.application?.program ?? null;
                    const brandPayload = rawBrand
                        ? {
                              name: rawBrand.name,
                              primaryColor: rawBrand.primaryColor,
                              logoUrl: rawBrand.logoUrl,
                              websiteUrl: rawBrand.websiteUrl,
                              contactEmail: rawProgram?.contactEmail ?? null,
                              contactAddress: rawProgram?.contactAddress ?? null,
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
            return;
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({
                queue_name: 'payment.succeeded',
                status
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
        method: string | undefined,
        existingInvoiceId?: string,
        feeProvider?: number,
        netAmount?: number,
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

        // Supersede guard (paid direction): `category` is already collapsed to
        // 'registration' | 'program' by the caller, not a real PricingFeeType, so a
        // stand-in fee type is passed here purely to steer
        // paymentCategoryForFeeType's equality check onto the same column - any
        // non-registration value maps to 'program' identically to a real tier's
        // feeType. excludeInvoiceId is existingInvoiceId when known (portal-driven
        // payments); it's undefined for the create/existingByRef paths below since
        // that invoice id isn't resolved until inside the transaction.
        // On the PAID direction a sibling does not change what the column should
        // say - both invoices settle it to 'paid' - so there is nothing to
        // suppress. What a paid sibling means here is that the same column has
        // now been paid twice, i.e. real money to refund, which is why this
        // flags the invoice below instead of skipping anything.
        const paidSibling =
            category === 'registration' || category === 'program'
                ? await findPaidSiblingInvoice(
                      this.prisma,
                      applicationId,
                      category === 'registration' ? PricingFeeType.registration_fee : PricingFeeType.program_fee_1,
                      existingInvoiceId,
                  )
                : null;
        if (paidSibling) {
            this.logger.warn(
                `processApplicationPayment: application ${applicationId} category=${category} ` +
                `superseded by paid invoice ${paidSibling.id} - skipping application column overwrite`,
            );
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
                // Update application payment status. Deliberately UNCONDITIONAL
                // even when a paid sibling exists: money really did arrive, so
                // 'paid' is the truthful value, writing it is idempotent when the
                // sibling already set it, and it is the only thing that repairs a
                // column an earlier cancel wrongly left at 'cancelled'. Gating
                // this would remove that self-heal. The duplicate is handled
                // AFTER the transaction, by flagging the invoice for refund
                // review rather than by suppressing a correct write.
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
                            // Undefined (not written) when the event carries no real method -
                            // preserves whatever was already set at payment-initiation time
                            // (e.g. confirm-portal-payment) instead of clobbering it.
                            ...(method ? { paymentMethod: method } : {}),
                            feeProvider: feeProvider ?? undefined,
                            netAmount: netAmount ?? undefined,
                        },
                        select: { id: true },
                    });
                    createdInvoiceId = updated.id;
                } else if (application.pricingTierId) {
                    // Idempotency guard: check if an invoice with this transaction/intent already exists
                    const lookupConditions: Array<Record<string, unknown>> = [];
                    if (transactionId) lookupConditions.push({ externalTransactionId: transactionId });
                    if (intentId) lookupConditions.push({ externalIntentId: intentId });

                    const existingByRef =
                        lookupConditions.length > 0
                            ? await repos.tx.applicationInvoice.findFirst({
                                  where: { applicationId, OR: lookupConditions },
                                  select: { id: true, status: true },
                              })
                            : null;

                    if (existingByRef) {
                        if ((existingByRef as { id: string; status: string }).status === PaymentStatus.paid) {
                            // Already settled - use its id and skip re-settling
                            createdInvoiceId = (existingByRef as { id: string }).id;
                        } else {
                            // In-place idempotent re-settle
                            const updated = await repos.tx.applicationInvoice.update({
                                where: { id: (existingByRef as { id: string }).id },
                                data: {
                                    status: PaymentStatus.paid,
                                    paidAt: new Date(),
                                    externalTransactionId: transactionId || undefined,
                                    externalIntentId: intentId || undefined,
                                    // See existingInvoiceId branch above: only overwrite when a
                                    // real method is known, otherwise preserve the current value.
                                    ...(method ? { paymentMethod: method } : {}),
                                    feeProvider: feeProvider ?? undefined,
                                    netAmount: netAmount ?? undefined,
                                },
                                select: { id: true },
                            });
                            createdInvoiceId = (updated as { id: string }).id;
                        }
                    } else {
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
                                // No prior invoice row exists here to preserve a value from, so
                                // fall back to null (the established "no data" sentinel) rather
                                // than the literal 'unknown' when the event carries no method.
                                paymentMethod: method ?? null,
                                feeProvider: feeProvider ?? null,
                                netAmount: netAmount ?? null,
                            },
                        });
                        createdInvoiceId = createdInvoice.id;
                    }
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
                        paymentMethod: method ?? null,
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

        // Duplicate settlement: the column was already paid by another invoice, so
        // this one is real money that needs a refund decision. Same signal
        // settlePaid raises during reconciliation, raised here on the primary
        // webhook path where the vast majority of payments actually settle.
        // Done after the transaction because the invoice id is only resolved
        // inside it, across three different branches.
        //
        // The identity check is load-bearing, not defensive. This is the only one
        // of the nine guard sites that runs BEFORE the invoice it acts on is
        // known: excludeInvoiceId above is metadata.invoice_id, which is absent
        // on non-portal flows, and the invoice is then resolved inside the
        // transaction by transaction/intent reference. On an idempotent replay of
        // an already-settled event that lookup returns the very invoice the guard
        // just found as a "sibling", and without this check a legitimate single
        // payment would be stamped as superseded BY ITSELF and sent for refund
        // review.
        if (paidSibling && createdInvoiceId && paidSibling.id !== createdInvoiceId) {
            try {
                await this.prisma.applicationInvoice.updateMany({
                    // updateMany + a rejectionReason: null filter makes this a no-op
                    // when a reason is already recorded, without a read-back first.
                    where: { id: createdInvoiceId, rejectionReason: null },
                    data: { rejectionReason: supersededByPaidInvoiceReason(paidSibling.id) },
                });
            } catch (error) {
                // Best-effort, and caught locally on purpose. The payment itself is
                // already committed; letting this escape would abort the rest of
                // handlePaymentSucceeded and silently cost the portal cache
                // invalidation, the referral funnel advance and the receipt email
                // for a payment that succeeded. Matches how the notification emit
                // below is handled.
                this.logger.error(
                    `Duplicate settlement on application ${applicationId}: invoice ${createdInvoiceId} ` +
                    `is superseded by paid invoice ${paidSibling.id} and NEEDS REFUND REVIEW, but the ` +
                    `flag could not be written: ${error instanceof Error ? error.message : String(error)}`,
                );
            }
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
        acknowledgeRmqMessage(context, this.logger, 'payment.failed', 'received');
        const start = Date.now();
        let status: 'success' | 'failed' = 'success';

        try {
            this.logger.debug(`Metrics: payment.failed event received`);
            
            const currency = (data.currency as string) || 'IDR';
            const rawMethod =
                (data.payment_method_id as string)
                || (data.payment_method as string)
                || (data.method as string)
                || undefined;
            const method = rawMethod || 'unknown'; // Prometheus label only, never persisted

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
                paymentMethod: rawMethod,
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
                if (failedInvoice?.superseded) {
                    // Either a stale event for an invoice that's actually paid, or
                    // a genuine failure superseded by a different paid invoice on
                    // the same application column - either way the participant
                    // must not get a "payment failed" email.
                    this.logger.debug(
                        `notification.payment_failed not emitted: invoice ${failedInvoice.invoiceId} superseded (already paid or superseded by a paid sibling)`,
                    );
                } else if (failedInvoice?.invoiceId) {
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
                    const rawProgram = invoiceWithBrand?.application?.program ?? null;
                    const brandPayload = rawBrand
                        ? {
                              name: rawBrand.name,
                              primaryColor: rawBrand.primaryColor,
                              logoUrl: rawBrand.logoUrl,
                              websiteUrl: rawBrand.websiteUrl,
                              contactEmail: rawProgram?.contactEmail ?? null,
                              contactAddress: rawProgram?.contactAddress ?? null,
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
            return;
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({
                queue_name: 'payment.failed',
                status
            }, duration);
        }
    }

    private async markInvoiceFailed(input: {
        applicationId?: string;
        invoiceId?: string;
        intentId?: string;
        transactionId?: string;
        failureReason?: string;
        paymentMethod?: string;
    }): Promise<{ userId: string; invoiceId: string; superseded?: boolean } | null> {
        const invoice = await this.resolveFailureInvoice(input);
        if (!invoice) {
            return null;
        }

        const userId = invoice.application.participant.userId;
        if (invoice.status === PaymentStatus.paid) {
            // Stale/duplicate failure event for an invoice that's actually paid -
            // nothing to write, and the caller must not send a "payment failed"
            // email for a payment that in fact succeeded.
            return { userId, invoiceId: invoice.id, superseded: true };
        }

        const rejectionReason =
            invoice.rejectionReason
            ?? input.failureReason
            ?? null;
        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.failed }
                : { programPaymentStatus: PaymentStatus.failed };

        // Supersede guard (non-paid direction): a different invoice already paid
        // this application's column, so this failure is real for THIS invoice but
        // must not overwrite the application-level status a paid sibling already
        // set correctly.
        const paidSibling = await findPaidSiblingInvoice(
            this.prisma,
            invoice.applicationId,
            invoice.pricingTier?.feeType,
            invoice.id,
        );
        if (paidSibling) {
            this.logger.warn(
                `markInvoiceFailed: invoice ${invoice.id} superseded by paid invoice ${paidSibling.id} - ` +
                `marking invoice failed but skipping application column overwrite`,
            );
        }

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
            ...(paidSibling
                ? []
                : [
                      this.prisma.participantApplication.update({
                          where: { id: invoice.applicationId },
                          data: paymentStatusPatch,
                      }),
                  ]),
        ]);

        return { userId, invoiceId: invoice.id, superseded: !!paidSibling };
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

        const transactionId = invoice.externalTransactionId ?? input.transactionId ?? null;
        if (transactionId) {
            const voidResult = await this.paymentGatewayClient.voidTransaction(
                transactionId,
                invoice.id,
                cancellationReason,
            );
            if (voidResult.outcome === 'danger_settled') {
                this.logger.error(
                    `markInvoiceCancelled: refusing to cancel invoice ${invoice.id} — ` +
                    `transaction ${transactionId} is settled at the gateway (${voidResult.detail})`,
                );
                return { userId, invoiceId: invoice.id };
            }
            // This is an async event consumer (payment.cancelled), not a synchronous
            // user-facing action — throwing here would just trigger a message
            // redelivery/retry loop. Instead we log and skip the cancellation,
            // leaving the invoice as-is for the admin to resolve via verify.
            if (voidResult.outcome === 'needs_review') {
                this.logger.warn(
                    `markInvoiceCancelled: skipping cancellation for invoice ${invoice.id} — ` +
                    `transaction ${transactionId} is awaiting manual review (${voidResult.detail})`,
                );
                return { userId, invoiceId: invoice.id };
            }
            // 'voided' | 'already_terminal' | 'error' all proceed: a transient gateway
            // failure must not block the invoice write — the widened reconciler
            // (Component 2) is the backstop that will retry the void later.
        }

        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.cancelled }
                : { programPaymentStatus: PaymentStatus.cancelled };

        // Supersede guard (non-paid direction): see markInvoiceFailed above - a
        // paid sibling invoice already covers this application's column, so the
        // cancellation is real for THIS invoice but must not overwrite it. No
        // notification fires on this path (handlePaymentCancelled only invalidates
        // cache), so there's nothing else to suppress here.
        const paidSibling = await findPaidSiblingInvoice(
            this.prisma,
            invoice.applicationId,
            invoice.pricingTier?.feeType,
            invoice.id,
        );
        if (paidSibling) {
            this.logger.warn(
                `markInvoiceCancelled: invoice ${invoice.id} superseded by paid invoice ${paidSibling.id} - ` +
                `marking invoice cancelled but skipping application column overwrite`,
            );
        }

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
            ...(paidSibling
                ? []
                : [
                      this.prisma.participantApplication.update({
                          where: { id: invoice.applicationId },
                          data: paymentStatusPatch,
                      }),
                  ]),
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
                // PORTAL_DASHBOARD is keyed by (userId, programId?) too, so this must
                // be a wildcard - the bare key only clears the `:latest` variant.
                CACHE_KEYS.PORTAL_DASHBOARD(userId, '*'),
                // Use wildcards so all program-specific variants are busted:
                // PORTAL_SUBMISSIONS keyed by (userId, programId?) → portal:submissions:${userId}:${programId|'latest'}
                `portal:submissions:${userId}:*`,
                // PORTAL_SUBMISSION_DETAIL keyed by (userId, programId?) → portal:submission-detail:${userId}:${programId|'latest'}
                // The submit gate reads preview.payment.paid from here; bust it so a settled
                // registration fee unblocks the submit button immediately.
                `portal:submission-detail:${userId}:*`,
                // PORTAL_PAYMENTS keyed by (userId, programId?) → portal:payments:${userId}:${programId|'latest'}
                `portal:payments:${userId}:*`,
                // PORTAL_DOCUMENTS is keyed by (userId, programId?) too, so this must
                // be a wildcard - the bare key only clears the `:latest` variant.
                CACHE_KEYS.PORTAL_DOCUMENTS(userId, '*'),
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

/**
 * Reads a nullable numeric field off the raw event payload. Returns undefined
 * (not 0) when absent/invalid so callers can skip writing the column entirely
 * rather than zeroing it out — needed while feeProvider/netAmount are being
 * rolled out onto payment.succeeded and older in-flight events still lack them.
 */
function getNullableNumber(source: Record<string, unknown>, key: string): number | undefined {
    const value = source[key];
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string' && value.trim() !== '') {
        const parsed = Number(value);
        if (Number.isFinite(parsed)) return parsed;
    }
    return undefined;
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

/**
 * True when a payment.succeeded event actually settles the invoice it names.
 *
 * A missing/non-positive event amount counts as a mismatch (fail closed) — an
 * event that cannot prove what was paid must never flip an invoice to paid.
 * Both sides are Decimal(10,2) money, so they are compared in whole cents to
 * keep float representation noise out of the check.
 */
function settlesInvoice(
    eventAmount: unknown,
    eventCurrency: string,
    invoiceAmount: unknown,
    invoiceCurrency: string,
): boolean {
    const paid = Number(eventAmount);
    const owed = Number(invoiceAmount);
    if (!Number.isFinite(paid) || paid <= 0 || !Number.isFinite(owed)) return false;
    if ((eventCurrency || '').trim().toUpperCase() !== (invoiceCurrency || '').trim().toUpperCase()) {
        return false;
    }
    return Math.round(paid * 100) === Math.round(owed * 100);
}
