import { Injectable, Logger } from '@nestjs/common';
import PDFDocument from 'pdfkit';

@Injectable()
export class ReceiptService {
    private readonly logger = new Logger(ReceiptService.name);

    generateReceipt(data: {
        orderId: string;
        amount: number;
        currency: string;
        customerName: string;
        date: string;
        description?: string;
    }): Promise<Buffer> {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ size: 'A4', margin: 50 });
                const buffers: Buffer[] = [];

                doc.on('data', buffers.push.bind(buffers));
                doc.on('end', () => {
                    const pdfData = Buffer.concat(buffers);
                    resolve(pdfData);
                });

                // Header
                doc.fontSize(20).text('PAYMENT RECEIPT', { align: 'center' });
                doc.moveDown();
                doc.fontSize(12).text('YBB Platform', { align: 'center' });
                doc.moveDown();
                doc.moveDown();

                // Details
                doc.fontSize(12).text(`Date: ${data.date}`, { align: 'right' });
                doc.text(`Receipt #: ${data.orderId}`, { align: 'right' });
                doc.moveDown();

                doc.text(`Billed To:`, { underline: true });
                doc.text(data.customerName);
                doc.moveDown();

                // Table Header
                const startX = 50;
                let currentY = doc.y;
                
                doc.text('Description', startX, currentY, { width: 300 });
                doc.text('Amount', 400, currentY, { width: 100, align: 'right' });
                
                doc.moveTo(startX, currentY + 15).lineTo(550, currentY + 15).stroke();
                doc.moveDown();
                
                // Item
                currentY = doc.y;
                doc.text(data.description || 'Payment for services', startX, currentY, { width: 300 });
                doc.text(`${data.currency} ${data.amount}`, 400, currentY, { width: 100, align: 'right' });

                // Total
                doc.moveDown();
                doc.moveDown();
                doc.fontSize(14).text(`Total: ${data.currency} ${data.amount}`, { align: 'right' });

                // Footer
                doc.moveDown();
                doc.moveDown();
                doc.fontSize(10).text('Thank you for your business!', { align: 'center' });

                doc.end();
            } catch (error) {
                this.logger.error('Failed to generate PDF', error);
                reject(error);
            }
        });
    }
}
