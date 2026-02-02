import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentStatus } from '@prisma/client';

@Controller()
export class PaymentEventsController {
    private readonly logger = new Logger(PaymentEventsController.name);

    constructor(
        private readonly metricsService: MetricsService,
        private readonly prisma: PrismaService,
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
                await this.processApplicationPayment(
                    applicationId, 
                    paymentCategory, 
                    amount, 
                    currency, 
                    gatewayOrderId, 
                    method
                );
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
    ) {
        const application = await this.prisma.participantApplication.findUnique({
            where: { id: applicationId }
        });

        if (!application) {
            this.logger.warn(`Application ${applicationId} not found`);
            return;
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
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.failed', 
                status: 'success' 
            }, duration);
        }
    }
}
