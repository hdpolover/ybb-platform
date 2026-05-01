import { Injectable, Logger } from '@nestjs/common';
// pdfkit is CommonJS; without esModuleInterop in this service's tsconfig, a
// default import resolves to undefined. Use require to get the constructor.
 
const PDFDocument = require('pdfkit') as typeof import('pdfkit');

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
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers: Buffer[] = [];

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

    private renderHeader(doc: PDFKit.PDFDocument, brandName: string): void {
        doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor('#555').text(brandName, { align: 'center' });
        doc.fillColor('black');
        doc.moveDown();
    }

    private renderMeta(doc: PDFKit.PDFDocument, data: ReceiptData): void {
        const dateStr = data.paidAt.toISOString().slice(0, 10);
        doc.fontSize(11);
        doc.text(`Receipt No.: ${data.receiptNumber}`, { align: 'right' });
        doc.text(`Date: ${dateStr}`, { align: 'right' });
        if (data.transactionId) {
            doc.text(`Transaction: ${data.transactionId}`, { align: 'right' });
        }
        doc.moveDown();
    }

    private renderBilledTo(doc: PDFKit.PDFDocument, data: ReceiptData): void {
        doc.fontSize(11).text('Billed To:', { underline: true });
        doc.text(data.customerName);
        if (data.customerEmail) doc.text(data.customerEmail);
        doc.moveDown();
    }

    private renderLineItem(doc: PDFKit.PDFDocument, data: ReceiptData): void {
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

    private renderTotal(doc: PDFKit.PDFDocument, data: ReceiptData): void {
        doc.fontSize(13).text(`Total: ${data.currency} ${data.amount.toFixed(2)}`, { align: 'right' });
        if (data.paymentMethod) {
            doc.moveDown(0.5);
            doc.fontSize(10).fillColor('#555').text(`Paid via: ${data.paymentMethod}`, { align: 'right' });
            doc.fillColor('black');
        }
    }

    private renderFooter(doc: PDFKit.PDFDocument): void {
        doc.moveDown(2);
        doc.fontSize(9).fillColor('#777')
            .text('This receipt was generated automatically. Keep it for your records.', { align: 'center' });
        doc.fillColor('black');
    }
}
