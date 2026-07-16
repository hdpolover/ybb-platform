import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
    FileServiceClient,
    GenerateReceiptPayload,
} from '@modules/files/infrastructure/clients/file-service.client';

// Net-7 grace period used to derive an invoice due date. ApplicationInvoice
// has no dedicated due_date column (see prisma/schema/applications.prisma) —
// per the plan, unpaid invoices fall back to createdAt + this offset.
const INVOICE_DUE_OFFSET_DAYS = 7;

const DEFAULT_ACCENT_COLOR = '#26408B';

const STATUS_LABELS: Record<string, string> = {
    paid: 'PAID',
    unpaid: 'UNPAID',
    pending: 'PENDING',
    processing: 'PROCESSING',
    failed: 'FAILED',
    cancelled: 'CANCELLED',
    refunded: 'REFUNDED',
};

const FEE_TYPE_LABELS: Record<string, string> = {
    registration_fee: 'Registration Fee',
    program_fee_1: 'Program Fee',
    program_fee_2: 'Program Fee (Installment 2)',
    full_fee: 'Full Program Fee',
    custom_fee: 'Program Fee',
};

export interface ReceiptDocInput {
    docType: 'receipt' | 'invoice';
    invoiceId: string;
    status: string;
    amount: number;
    currency: string;
    amountUsd: number | null;
    amountIdr: number | null;
    exchangeRateSnapshot: number | null;
    feeProvider: number | null;
    paidAt: Date | null;
    createdAt: Date;
    transactionReference: string | null;
    paymentMethod: string | null;
    customerName: string;
    customerEmail: string | null;
    customerInstitution: string | null;
    programName: string;
    programLogoUrl: string | null;
    programLogoColorUrl: string | null;
    pricingTierName: string | null;
    feeType: string | null;
    brand: {
        name: string;
        logoUrl: string | null;
        primaryColor: string | null;
        contactEmail: string | null;
        contactPhone: string | null;
        contactAddress: string | null;
        websiteUrl: string | null;
    } | null;
}

/**
 * Builds the Stage-1 WeasyPrint data contract for portal receipts/invoices
 * and calls the file service to render the PDF. Replaces the old pdfkit
 * renderer — all currency formatting, logo-fallback resolution, accent
 * color, and FX-line construction now live here (see
 * .planning/receipt-redesign-plan.md "Currency truth" + "Data contract").
 */
@Injectable()
export class PortalReceiptService {
    private readonly logger = new Logger(PortalReceiptService.name);
    private readonly storageUrl: string;

    constructor(
        private readonly fileServiceClient: FileServiceClient,
        private readonly configService: ConfigService,
    ) {
        const rawUrl = this.configService.get<string>('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }

    async generate(input: ReceiptDocInput): Promise<Buffer> {
        const payload = this.buildPayload(input);
        try {
            return await this.fileServiceClient.generateReceipt(payload);
        } catch (error) {
            this.logger.error(
                `Failed to generate ${input.docType} for invoice ${input.invoiceId}`,
                error instanceof Error ? error.stack : String(error),
            );
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    private buildPayload(input: ReceiptDocInput): GenerateReceiptPayload {
        const isReceipt = input.docType === 'receipt';
        const idShort = input.invoiceId.slice(0, 8).toUpperCase();
        const documentNumber = isReceipt ? `R-${idShort}` : `INV-${idShort}`;

        const totalFormatted = formatCurrency(input.amount, input.currency);
        const feeFormatted =
            input.feeProvider != null ? formatCurrency(input.feeProvider, input.currency) : null;

        const feeTypeLabel = input.feeType ? FEE_TYPE_LABELS[input.feeType] ?? null : null;
        const lineItemTitle = input.pricingTierName || feeTypeLabel || 'Program Fee';
        const lineItemSubtitle = [input.programName, feeTypeLabel && feeTypeLabel !== lineItemTitle ? feeTypeLabel : null]
            .filter(Boolean)
            .join(' · ') || null;

        const dueDate = new Date(input.createdAt);
        dueDate.setDate(dueDate.getDate() + INVOICE_DUE_OFFSET_DAYS);

        return {
            doc_type: input.docType,
            status_label: STATUS_LABELS[input.status] ?? input.status.toUpperCase(),
            is_paid: input.status === 'paid',
            document_number: documentNumber,
            issued_date: formatDate(input.createdAt),
            settled_line: isReceipt && input.paidAt ? formatSettledLine(input.paidAt) : null,
            due_line: !isReceipt ? formatDueLine(dueDate) : null,
            transaction_reference: input.transactionReference,
            accent_color: input.brand?.primaryColor || DEFAULT_ACCENT_COLOR,
            program_name: input.programName,
            program_logo_url: this.resolveProgramLogoUrl(input),
            program_initials: buildInitials(input.programName),
            billed_to: {
                name: input.customerName,
                email: input.customerEmail,
                institution: input.customerInstitution,
            },
            line_items: [
                {
                    title: lineItemTitle,
                    subtitle: lineItemSubtitle,
                    amount: totalFormatted,
                },
            ],
            subtotal: totalFormatted,
            fee: feeFormatted,
            total: totalFormatted,
            fx_line: buildFxLine(input),
            payment_method_label: input.paymentMethod ? formatPaymentMethodLabel(input.paymentMethod) : null,
            brand: {
                name: input.brand?.name || 'YBB Platform',
                contact_email: input.brand?.contactEmail ?? null,
                contact_phone: input.brand?.contactPhone ?? null,
                contact_address: input.brand?.contactAddress ?? null,
                website: input.brand?.websiteUrl ?? null,
            },
        };
    }

    // Logo fallback chain: program.logoUrl -> program.logoColorUrl -> brand.logoUrl -> none.
    private resolveProgramLogoUrl(input: ReceiptDocInput): string | null {
        const candidate = input.programLogoUrl || input.programLogoColorUrl || input.brand?.logoUrl || null;
        if (!candidate) return null;
        return candidate.startsWith('http') ? candidate : `${this.storageUrl}/${candidate}`;
    }
}

/**
 * IDR renders grouped with no decimals ("IDR 180,000"); every other currency
 * (USD etc.) renders with 2 decimals ("USD 10.00"). Verified against live
 * invoice data — see .planning/receipt-redesign-plan.md "Currency truth".
 */
export function formatCurrency(amount: number, currency: string): string {
    const upper = currency.toUpperCase();
    const fractionDigits = upper === 'IDR' ? 0 : 2;
    const formatted = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(amount);
    return `${upper} ${formatted}`;
}

function formatRate(rate: number): string {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(rate);
}

/**
 * FX line only appears when an exchange rate snapshot exists AND the
 * equivalent currency actually differs from what was paid — e.g. an IDR
 * invoice shows "≈ USD 10.00 · rate 17,580"; a USD invoice with an IDR
 * equivalent on file shows the reverse. Same-currency / no-snapshot skips it.
 */
export function buildFxLine(input: {
    currency: string;
    exchangeRateSnapshot: number | null;
    amountUsd: number | null;
    amountIdr: number | null;
}): string | null {
    if (input.exchangeRateSnapshot == null) return null;
    const upper = input.currency.toUpperCase();

    if (upper === 'IDR' && input.amountUsd != null) {
        return `≈ ${formatCurrency(input.amountUsd, 'USD')} · rate ${formatRate(input.exchangeRateSnapshot)}`;
    }
    if (upper === 'USD' && input.amountIdr != null) {
        return `≈ ${formatCurrency(input.amountIdr, 'IDR')} · rate ${formatRate(input.exchangeRateSnapshot)}`;
    }
    return null;
}

function formatDate(date: Date): string {
    return new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta',
    }).format(date);
}

function formatSettledLine(date: Date): string {
    const formatted = new Intl.DateTimeFormat('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Jakarta',
    }).format(date);
    return `Settled ${formatted} WIB`;
}

function formatDueLine(date: Date): string {
    return `Due ${formatDate(date)}`;
}

function buildInitials(programName: string): string {
    return programName
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 3)
        .map(word => word[0]?.toUpperCase() ?? '')
        .join('');
}

function formatPaymentMethodLabel(method: string): string {
    return method
        .split(/[_\s]+/)
        .filter(Boolean)
        .map(word => word[0].toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
}
