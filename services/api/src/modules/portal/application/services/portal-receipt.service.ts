import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
type PdfDocumentInstance = any;

// ---------------------------------------------------------------------------
// Unicode font resolution for pdfkit
// ---------------------------------------------------------------------------
// pdfkit's built-in fonts (Helvetica, Times-Roman, etc.) are AFM-only and
// cannot render non-Latin glyphs.  A TTF must be registered explicitly.
//
// Search order for NotoSans-Regular.ttf at process start:
//   1. services/api/assets/fonts/NotoSans-Regular.ttf  (repo-bundled, highest priority)
//   2. /usr/share/fonts/noto/NotoSans-Regular.ttf      (alpine: apk add font-noto)
//   3. /usr/share/fonts/truetype/noto/NotoSans-Regular.ttf  (debian: apt fonts-noto-core)
//
// If none is found the service falls back to Helvetica — Latin renders fine;
// non-Latin glyphs will appear as tofu boxes.  To fix: place a NotoSans-Regular.ttf
// in services/api/assets/fonts/ (gitignored binary) or install font-noto in the
// container image (see Dockerfile.dev / Dockerfile.prod).

const NOTO_SANS_SEARCH_PATHS: readonly string[] = [
    path.resolve(__dirname, '../../../../../assets/fonts/NotoSans-Regular.ttf'),
    '/usr/share/fonts/noto/NotoSans-Regular.ttf',
    '/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf',
];

function resolveNotoSansPath(): string | null {
    for (const candidate of NOTO_SANS_SEARCH_PATHS) {
        try {
            if (fs.existsSync(candidate)) {
                return candidate;
            }
        } catch {
            // continue
        }
    }
    return null;
}

const NOTO_SANS_TTF_PATH = resolveNotoSansPath();
const UNICODE_FONT = NOTO_SANS_TTF_PATH ? 'NotoSans' : 'Helvetica';

export interface ReceiptData {
    receiptNumber: string;
    invoiceId: string;
    transactionId?: string;
    amount: number;
    currency: string;
    paidAt: Date;
    customerName: string;
    customerEmail?: string;
    description: string;
    programName: string;
    paymentMethod?: string;
    brandName?: string;
}

/**
 * Generates a payment receipt PDF on the API side. Mirrors the notification
 * service's ReceiptService but lives where invoices are owned, so participants
 * can pull a receipt synchronously even when the email channel is down.
 */
@Injectable()
export class PortalReceiptService {
    private readonly logger = new Logger(PortalReceiptService.name);

    generate(data: ReceiptData): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const PDFDocument = this.getPdfDocumentConstructor();
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers: Buffer[] = [];

                // Register NotoSans once per document if the TTF is available.
                // This is idempotent — pdfkit silently ignores duplicate registrations
                // for the same alias within the same document instance.
                if (NOTO_SANS_TTF_PATH) {
                    try {
                        doc.registerFont('NotoSans', NOTO_SANS_TTF_PATH);
                    } catch (fontErr) {
                        this.logger.warn('NotoSans font registration failed; falling back to Helvetica', fontErr);
                    }
                }

                doc.on('data', (chunk: Buffer) => buffers.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(buffers)));
                doc.on('error', reject);

                this.renderHeader(doc, data.brandName ?? 'YBB Platform');
                this.renderMeta(doc, data);
                this.renderBilledTo(doc, data);
                this.renderLineItem(doc, data);
                this.renderTotal(doc, data);
                this.renderFooter(doc);

                doc.end();
            } catch (error) {
                this.logger.error('Failed to generate receipt PDF', error);
                reject(error instanceof Error ? error : new Error(String(error)));
            }
        });
    }

    private getPdfDocumentConstructor(): new (...args: any[]) => PdfDocumentInstance {
        try {
            return require('pdfkit');
        } catch {
            throw new Error('Missing runtime dependency "pdfkit". Rebuild API image after installing dependencies.');
        }
    }

    private renderHeader(doc: PdfDocumentInstance, brandName: string): void {
        doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#555').text(brandName, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown();
    }

    private renderMeta(doc: PdfDocumentInstance, data: ReceiptData): void {
        const dateStr = data.paidAt.toISOString().slice(0, 10);
        doc.fontSize(11);
        doc.text(`Receipt No.: ${data.receiptNumber}`, { align: 'right' });
        doc.text(`Date: ${dateStr}`, { align: 'right' });
        if (data.transactionId) {
            doc.text(`Transaction: ${data.transactionId}`, { align: 'right' });
        }
        doc.moveDown();
    }

    private renderBilledTo(doc: PdfDocumentInstance, data: ReceiptData): void {
        doc.fontSize(11).text('Billed To:', { underline: true });
        // Switch to the Unicode-capable font for the participant name so non-Latin
        // scripts (Arabic, Bengali, diacritics) render instead of tofu boxes.
        doc.font(UNICODE_FONT).text(data.customerName);
        // Restore default Helvetica for the remaining fields which are Latin-only.
        doc.font('Helvetica');
        if (data.customerEmail) doc.text(data.customerEmail);
        doc.moveDown();
    }

    private renderLineItem(doc: PdfDocumentInstance, data: ReceiptData): void {
        const startX = 50;
        const headerY = doc.y;
        doc.fontSize(11);
        doc.text('Description', startX, headerY, { width: 350 });
        doc.text('Amount', 410, headerY, { width: 140, align: 'right' });
        doc.moveTo(startX, headerY + 16).lineTo(550, headerY + 16).stroke();
        doc.moveDown(1);

        const itemY = doc.y;
        doc.text(`${data.description} - ${data.programName}`, startX, itemY, { width: 350 });
        doc.text(`${data.currency} ${data.amount.toFixed(2)}`, 410, itemY, { width: 140, align: 'right' });
        doc.moveDown(2);
    }

    private renderTotal(doc: PdfDocumentInstance, data: ReceiptData): void {
        doc.fontSize(13).text(`Total: ${data.currency} ${data.amount.toFixed(2)}`, { align: 'right' });
        if (data.paymentMethod) {
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#555').text(`Paid via: ${data.paymentMethod}`, { align: 'right' });
            doc.fillColor('black');
        }
    }

    private renderFooter(doc: PdfDocumentInstance): void {
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#777')
            .text('This receipt was generated automatically. Keep it for your records.', { align: 'center' });
        doc.fillColor('black');
    }
}
