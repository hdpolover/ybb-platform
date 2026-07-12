import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_ACCENT_COLOR = '#26408B';

export interface ReceiptBrandInput {
  name?: string;
  logoUrl?: string | null;
  primaryColor?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactAddress?: string | null;
  websiteUrl?: string | null;
}

export interface GenerateReceiptInput {
  orderId: string;
  amount: number;
  currency: string;
  customerName: string;
  customerEmail?: string;
  date: Date;
  description?: string;
  paymentMethod?: string;
  transactionReference?: string;
  brand?: ReceiptBrandInput | null;
}

// Stage 1 data contract for the WeasyPrint receipt/invoice generator
// (services/file `ReceiptWeasyRequest`) — must match the shape NestJS's
// PortalReceiptService builds. See .planning/receipt-redesign-plan.md
// "Data contract".
interface GenerateReceiptPayload {
  doc_type: 'receipt' | 'invoice';
  status_label: string;
  is_paid: boolean;
  document_number: string;
  issued_date: string;
  settled_line: string | null;
  due_line: string | null;
  transaction_reference: string | null;
  accent_color: string;
  program_name: string;
  program_logo_url: string | null;
  program_initials: string;
  billed_to: { name: string; email: string | null; institution: string | null };
  line_items: Array<{ title: string; subtitle: string | null; amount: string }>;
  subtotal: string;
  fee: string | null;
  total: string;
  fx_line: string | null;
  payment_method_label: string | null;
  brand: {
    name: string;
    contact_email: string | null;
    contact_phone: string | null;
    contact_address: string | null;
    website: string | null;
  };
}

/**
 * Payment-success email attachment. Replaces the old pdfkit renderer with a
 * call to the same file-service WeasyPrint endpoint the portal uses
 * (POST /api/v1/documents/generate/receipt). The payment.succeeded event
 * this service consumes carries less data than the portal's Prisma-backed
 * path (no program/pricing-tier/FX-snapshot fields), so this builds the
 * best payload available from the event + brand payload.
 */
@Injectable()
export class ReceiptService {
  private readonly logger = new Logger(ReceiptService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateReceipt(data: GenerateReceiptInput): Promise<Buffer> {
    const fileServiceUrl = this.getFileServiceUrl();
    const payload = this.buildPayload(data);

    const response = await fetch(`${fileServiceUrl}/api/v1/documents/generate/receipt`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(
        `File service receipt generation failed: ${response.status} ${response.statusText} ${body}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  private getFileServiceUrl(): string {
    // Same env var the API service uses (FileServiceClient) — keeps the two
    // services pointed at the same file-service base URL/topology.
    const url = this.configService.get<string>('FILE_SERVICE_URL', 'http://file-service:8001');
    return url.replace(/\/$/, '');
  }

  private buildPayload(data: GenerateReceiptInput): GenerateReceiptPayload {
    const totalFormatted = formatCurrency(data.amount, data.currency);
    const idShort = data.orderId.slice(0, 8).toUpperCase();

    return {
      doc_type: 'receipt',
      status_label: 'PAID',
      is_paid: true,
      document_number: `R-${idShort}`,
      issued_date: formatDate(data.date),
      settled_line: formatSettledLine(data.date),
      due_line: null,
      transaction_reference: data.transactionReference ?? null,
      accent_color: data.brand?.primaryColor || DEFAULT_ACCENT_COLOR,
      program_name: data.description || 'Program Fee',
      program_logo_url: data.brand?.logoUrl ?? null,
      program_initials: buildInitials(data.brand?.name || 'YBB'),
      billed_to: {
        name: data.customerName,
        email: data.customerEmail ?? null,
        institution: null,
      },
      line_items: [
        {
          title: data.description || 'Payment for services',
          subtitle: null,
          amount: totalFormatted,
        },
      ],
      subtotal: totalFormatted,
      fee: null,
      total: totalFormatted,
      // The payment.succeeded event this service consumes carries no FX
      // snapshot (amount_usd/amount_idr/exchange_rate_snapshot) — those only
      // exist on the ApplicationInvoice row the portal path reads directly.
      // Skipping is correct per the "no snapshot => skip" rule.
      fx_line: null,
      payment_method_label: data.paymentMethod ? formatPaymentMethodLabel(data.paymentMethod) : null,
      brand: {
        name: data.brand?.name || 'YBB Platform',
        contact_email: data.brand?.contactEmail ?? null,
        contact_phone: data.brand?.contactPhone ?? null,
        contact_address: data.brand?.contactAddress ?? null,
        website: data.brand?.websiteUrl ?? null,
      },
    };
  }
}

/**
 * IDR renders grouped with no decimals ("IDR 180,000"); every other currency
 * (USD etc.) renders with 2 decimals ("USD 10.00"). Must match
 * PortalReceiptService's formatter exactly (services/api).
 */
function formatCurrency(amount: number, currency: string): string {
  const upper = currency.toUpperCase();
  const fractionDigits = upper === 'IDR' ? 0 : 2;
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(amount);
  return `${upper} ${formatted}`;
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

function buildInitials(name: string): string {
  return name
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
