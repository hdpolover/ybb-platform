import { Injectable, NotFoundException, ForbiddenException, BadRequestException, PreconditionFailedException, ServiceUnavailableException, Logger } from '@nestjs/common';
import { status as GrpcStatus } from '@grpc/grpc-js';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { ConfirmPortalPaymentCommand } from '../../queries/portal-queries';
import { ConfirmPortalPaymentResponseDto } from '../../../presentation/dto/portal-payment.dto';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { FileGrpcClient } from '@modules/files/infrastructure/clients/file-grpc-client.service';
import { FileResponse } from '@modules/files/infrastructure/clients/file.interface';
import {
    buildParticipantInvoiceUrl,
    buildParticipantPaymentsUrl,
    buildParticipantSubmissionUrl,
} from '@modules/payments/application/utils/participant-dashboard-url.util';
import { resolveUsdInIdrRate } from '../../utils/resolve-usd-in-idr-rate';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';

@Injectable()
export class ConfirmPortalPaymentHandler {
    private readonly logger = new Logger(ConfirmPortalPaymentHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentClient: PaymentGrpcClient,
        private readonly fileGrpcClient: FileGrpcClient,
        private readonly registrationFeeGate: RegistrationFeeGateService,
    ) {}

    async execute(command: ConfirmPortalPaymentCommand): Promise<ConfirmPortalPaymentResponseDto> {
        const { userId, invoiceId, paymentType, paymentMethodId, details } = command;
        if (paymentType === 'manual') {
            if (!details?.accountName?.trim()) {
                throw new BadRequestException('Account name is required for manual payment');
            }
            if (!details?.sourceName?.trim()) {
                throw new BadRequestException('Source name is required for manual payment');
            }
            if (!details?.paymentDate?.trim()) {
                throw new BadRequestException('Payment date is required for manual payment');
            }
            // proofFileId (not proofFileUrl) is the trust anchor: it is what we can
            // actually verify ownership of via the file service below. The old check
            // only required proofFileUrl, which meant an arbitrary URL could be
            // submitted with no proof it belonged to the caller (audit M45).
            if (!details?.proofFileId?.trim()) {
                throw new BadRequestException('Payment proof is required for manual payment');
            }
            if (!details?.proofFileUrl?.trim()) {
                throw new BadRequestException('Payment proof is required for manual payment');
            }
        }

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: invoiceId },
            include: {
                application: {
                    select: {
                        participantId: true,
                        programId: true,
                        program: {
                            select: {
                                name: true,
                                currency: true,
                                usdInIdr: true,
                                brandId: true,
                                brand: {
                                    select: {
                                        landingUrl: true,
                                        websiteUrl: true,
                                    },
                                },
                            },
                        },
                        participant: {
                            select: {
                                fullName: true,
                                user: {
                                    select: { email: true },
                                },
                            },
                        },
                    },
                },
                pricingTier: {
                    select: {
                        name: true,
                        isActive: true,
                        deletedAt: true,
                        feeType: true,
                    },
                },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.application.participantId !== participant.id) {
            throw new ForbiddenException('Access denied');
        }
        if (invoice.status === 'paid') {
            throw new BadRequestException('Invoice is already paid');
        }
        if (invoice.status === 'processing') {
            throw new BadRequestException('This invoice already has a pending payment. Please continue the existing payment from Payment Details.');
        }
        if (!invoice.pricingTier.isActive || invoice.pricingTier.deletedAt) {
            throw new BadRequestException('This payment option is no longer available for new payments.');
        }

        // Duplicate registration-fee guard: if this invoice is for a registration_fee
        // tier but the application already has a paid registration invoice (or the
        // registrationPaymentStatus is 'paid'), block the new payment intent.
        // The invoice.status === 'paid' check above already prevents re-paying a
        // paid invoice; this check catches the cross-invoice case where a different
        // registration_fee invoice was paid (the scenario that caused the 3x overpay).
        if (invoice.pricingTier.feeType === 'registration_fee') {
            const alreadyPaid = await this.registrationFeeGate.isRegistrationFeePaid(invoice.applicationId);
            if (alreadyPaid) {
                throw new BadRequestException('Registration fee has already been paid.');
            }
        }

        // Manual-payment proof ownership check (audit M45). Previously proofFileId
        // and proofFileUrl were forwarded to the Go payment service verbatim, so a
        // participant could submit any other user's file id, or any arbitrary URL,
        // and have it shown to admins as their own payment proof. brandId comes
        // from the invoice's own program — the same brand scope used everywhere
        // else in this handler — not the caller's JWT, so a cross-brand file id
        // can't slip through.
        let verifiedProofFileUrl: string | undefined;
        if (paymentType === 'manual') {
            const proofFileId = details!.proofFileId!.trim();
            const proofFileUrl = details!.proofFileUrl!.trim();
            const brandId = invoice.application.program.brandId;

            let verifiedFile: FileResponse;
            try {
                verifiedFile = await this.fileGrpcClient.getFile(proofFileId, userId, brandId);
            } catch (error) {
                // The file service collapses "file doesn't exist" and "file belongs
                // to someone else" into the same NOT_FOUND abort (see
                // get_file_handler.py) — both cases mean this proof isn't usable, so
                // surface a clean 404 rather than letting the raw gRPC error (or a
                // transient service-down error) bubble up as a 500.
                const code = (error as { code?: number })?.code;
                if (code === GrpcStatus.NOT_FOUND) {
                    throw new NotFoundException('Payment proof file not found');
                }
                this.logger.error(`[confirm-payment] proof file lookup failed for file=${proofFileId}: ${(error as Error)?.message}`);
                throw new ServiceUnavailableException('Unable to verify payment proof file. Please try again.');
            }

            // Do NOT persist verifiedFile.url here: for the private `documents`
            // bucket that field is a 1-hour presigned download URL (see
            // GetFile in services/file/app/grpc_main.py), which would expire long
            // before an admin reviews the payment. Instead, trust the client's
            // proofFileUrl only after confirming it actually points at the file we
            // just verified belongs to this caller (matches its storage_path) —
            // the admin proof viewer (payment-admin.controller.ts downloadInvoiceProof)
            // reads whatever URL was stored at submission time as-is and has no
            // path to re-derive one from a file id.
            if (!verifiedFile.storage_path || !proofUrlPointsAtFile(proofFileUrl, verifiedFile.storage_path)) {
                throw new BadRequestException('Payment proof URL does not match the uploaded file');
            }
            verifiedProofFileUrl = proofFileUrl;
        }

        // Build customer identity for downstream events (notification service uses
        // these to address receipts and status emails). Without `email` in metadata,
        // payment.succeeded / payment.failed events get dropped silently by the
        // notification consumer because it short-circuits when `data.email` is empty.
        const customerEmail = invoice.application.participant?.user?.email ?? '';
        const customerName = invoice.application.participant?.fullName ?? customerEmail;
        const participantBrand = invoice.application.program.brand;
        const paymentsPageUrl = buildParticipantPaymentsUrl(participantBrand);
        const submissionPageUrl = buildParticipantSubmissionUrl(participantBrand);
        const invoiceUrl = buildParticipantInvoiceUrl(participantBrand, invoice.id);

        // Manual transfers settle in IDR — flip the canonical amount/currency to
        // the IDR snapshot taken at invoice creation. Gateway flows stay USD.
        // If the IDR snapshot is missing (legacy tier without dual pricing), we
        // fall through with whatever the invoice currently holds.
        const idrSnapshot = invoice.amountIdr !== null && invoice.amountIdr !== undefined
            ? Number(invoice.amountIdr)
            : null;
        const settlementIsManualIdr =
            paymentType === 'manual' && idrSnapshot !== null && idrSnapshot > 0;
        const settlementAmount = settlementIsManualIdr ? idrSnapshot : Number(invoice.amount);
        const settlementCurrency = settlementIsManualIdr ? 'IDR' : invoice.currency;

        let exchangeRate = resolveUsdInIdrRate({
            snapshot: invoice.exchangeRateSnapshot,
            programRate: invoice.application.program.usdInIdr,
        });

        if (exchangeRate === undefined && settlementCurrency.toUpperCase() === 'USD') {
            const brandSettings = await this.prisma.brandSetting.findFirst({
                where: { brandId: invoice.application.program.brandId },
                select: { usdInIdr: true },
            });
            exchangeRate = resolveUsdInIdrRate({ programRate: brandSettings?.usdInIdr });
        }

        // Fail early when gateway payment needs IDR conversion but no rate is configured.
        // Without this check, createIntent succeeds with a nil exchange rate, and the
        // downstream ProcessPayment call returns a cryptic 412 after the intent is
        // already written to the DB.
        if (paymentType !== 'manual' && settlementCurrency.toUpperCase() === 'USD' && exchangeRate === undefined) {
            throw new PreconditionFailedException(
                'Exchange rate (USD → IDR) is not configured for this program. Please contact an administrator to set it up before retrying.'
            );
        }

        this.logger.log(`[confirm-payment] invoiceId=${invoiceId} currency=${settlementCurrency} programUsdInIdr=${invoice.application.program.usdInIdr} snapshot=${invoice.exchangeRateSnapshot} resolvedRate=${exchangeRate}`);

        // Description shown on the gateway dashboard (e.g. Xendit invoice list).
        // Append the invoice's own display amount/currency, not the settlement
        // amount/currency (which flips to IDR for manual transfers) so this stays
        // the human-facing price regardless of payment type.
        const baseDescription = `${invoice.pricingTier.name} - ${invoice.application.program.name}`;
        const invoiceDisplayAmount = invoice.amount !== null && invoice.amount !== undefined ? Number(invoice.amount) : NaN;
        const invoiceDisplayCurrency = invoice.currency?.trim();
        const description =
            !Number.isNaN(invoiceDisplayAmount) && invoiceDisplayCurrency
                ? `${baseDescription} (${invoiceDisplayCurrency.toUpperCase()} ${invoiceDisplayAmount.toFixed(2)})`.slice(0, 255)
                : baseDescription;

        // Create a payment intent via the Payment Service
        const intentResponse = await this.paymentClient.createIntent({
            user_id: userId,
            participant_id: participant.id,
            amount: settlementAmount,
            currency: settlementCurrency,
            reference_type: 'invoice',
            reference_id: invoice.id,
            description,
            metadata: {
                invoice_id: invoice.id,
                application_id: invoice.applicationId,
                program_id: invoice.application.programId,
                payment_method: paymentMethodId,
                email: customerEmail,
                customer_email: customerEmail,
                customer_name: customerName,
                payment_category: 'registration',
                payments_page_url: paymentsPageUrl,
                submission_page_url: submissionPageUrl,
                invoice_url: invoiceUrl,
                ...(exchangeRate !== undefined ? { exchange_rate_value: String(exchangeRate) } : {}),
            },
            exchange_rate: exchangeRate,
        });

        if (paymentType === 'manual') {
            // Submit manual payment details to the Payment Service. Use the
            // verified proofFileId/proofFileUrl computed above, not the raw
            // `details` values — they've already passed ownership + URL-match
            // checks by this point (audit M45).
            const verifiedProofFileId = details!.proofFileId!.trim();
            const manualResponse = await this.paymentClient.submitManualPayment({
                intent_id: intentResponse.intent_id,
                proof_file_id: verifiedProofFileId,
                proof_file_url: verifiedProofFileUrl,
                details: JSON.stringify({
                    account_name: details?.accountName,
                    source_name: details?.sourceName,
                    payment_date: details?.paymentDate,
                    payment_method: paymentMethodId,
                    proof_file_id: verifiedProofFileId,
                    proof_file_url: verifiedProofFileUrl,
                    notes: details?.notes,
                }),
            });

            // Mark invoice as processing. For manual transfers the canonical
            // settlement is in IDR, so flip amount/currency to the IDR snapshot
            // when available — this is what the participant actually wired and
            // what admin verification needs to match against.
            await this.prisma.applicationInvoice.update({
                where: { id: invoiceId },
                data: {
                    status: 'processing',
                    paymentMethod: paymentMethodId,
                    externalIntentId: intentResponse.intent_id,
                    externalTransactionId: manualResponse.transaction_id,
                    ...(settlementIsManualIdr
                        ? { amount: settlementAmount, currency: settlementCurrency }
                        : {}),
                },
            });

            // Invalidate caches
            await Promise.all([
                this.cacheService.invalidatePortalCache(userId),
                this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId)),
            ]);

            return {
                status: 'PROCESSING',
                invoice_id: invoiceId,
                intent_id: intentResponse.intent_id,
                message: 'Manual payment submitted successfully. Our team will verify your payment shortly.',
            };
        }

        // Gateway payment: process via Payment Service
        const processResponse = await this.paymentClient.processPayment({
            intent_id: intentResponse.intent_id,
            payment_method_id: paymentMethodId,
            gateway_token: details?.gatewayToken,
            user_id: userId,
        });

        // Update invoice with intent reference
        await this.prisma.applicationInvoice.update({
            where: { id: invoiceId },
            data: {
                status: 'processing',
                paymentMethod: paymentMethodId,
                externalIntentId: intentResponse.intent_id,
                externalTransactionId: processResponse.transaction_id,
            },
        });

        // Invalidate caches
        await Promise.all([
            this.cacheService.invalidatePortalCache(userId),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENT_DETAIL(userId, invoiceId)),
        ]);

        const action = processResponse.action
            ? { type: processResponse.action.type as 'redirect' | 'checkout', url: processResponse.action.url ?? '' }
            : undefined;

        return {
            status: processResponse.status === 'PENDING' ? 'REQUIRES_ACTION' : processResponse.status,
            invoice_id: invoiceId,
            intent_id: intentResponse.intent_id,
            action,
            message: action
                ? 'Redirecting to payment gateway. Please complete your payment there.'
                : 'Payment initiated successfully.',
        };
    }
}

/**
 * Hosts a stored proof URL may legitimately live on.
 *
 * Read ONLY from FILE_CDN_HOSTS, deliberately not from STORAGE_PUBLIC_URL. In
 * production those disagree: STORAGE_PUBLIC_URL is files.ybbhub.com while all
 * 221 proof URLs on record are cdn.ybbhub.com, so deriving the allowlist from it
 * would reject every real manual payment. Empty means the host check is inert.
 */
function allowedProofHosts(): Set<string> {
    const hosts = new Set<string>();
    for (const entry of (process.env.FILE_CDN_HOSTS ?? '').split(',')) {
        const trimmed = entry.trim().toLowerCase();
        if (!trimmed) continue;
        const host = trimmed.replace(/^[a-z][a-z0-9+.-]*:\/\//, '').split('/')[0].split('@').pop()?.replace(/:\d+$/, '');
        if (host) hosts.add(host);
    }
    return hosts;
}

/**
 * Does this URL actually point at the file we just verified belongs to the caller?
 *
 * Two checks, and both matter. The PATH check is against the URL's pathname, not
 * the raw string: a plain `url.includes(storagePath)` passes for
 * `https://evil.example/?x=<real storage path>`, which is exactly the payload
 * this guard exists to stop — an admin opens the stored proof URL by hand.
 *
 * The HOST check is opt-in and INERT until FILE_CDN_HOSTS is set, because
 * arming it against the wrong host rejects real payments — see allowedProofHosts.
 * Set FILE_CDN_HOSTS=cdn.ybbhub.com to arm it. Until then the path check stands
 * alone, which still blocks the query-string payload but NOT an attacker-hosted
 * URL that carries the real path in its pathname.
 *
 * Relative URLs are accepted on host: the upload route falls back to
 * `/api/proxy/files/<id>/download`, which has no host to check.
 */
export function proofUrlPointsAtFile(rawUrl: string, storagePath: string): boolean {
    const isAbsolute = /^https?:\/\//i.test(rawUrl);
    let pathname: string;

    if (isAbsolute) {
        let parsed: URL;
        try {
            parsed = new URL(rawUrl);
        } catch {
            return false;
        }
        const hosts = allowedProofHosts();
        if (hosts.size > 0 && !hosts.has(parsed.hostname.toLowerCase())) return false;
        pathname = parsed.pathname;
    } else {
        pathname = rawUrl.split('?')[0].split('#')[0];
    }

    let decoded: string;
    try {
        decoded = decodeURIComponent(pathname);
    } catch {
        decoded = pathname;
    }
    return decoded.includes(storagePath);
}
