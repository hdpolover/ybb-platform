import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { EmailService } from '../email/email.service';
import { ReceiptService } from '../email/receipt.service';

@Controller()
export class EventsController {
    private readonly logger = new Logger(EventsController.name);

    constructor(
        private readonly emailService: EmailService,
        private readonly receiptService: ReceiptService
    ) { }

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received payment.succeeded event: ${JSON.stringify(data)}`);

        if (data.email) {
            let receiptBuffer: Buffer | undefined;
            const items = data.metadata?.item_details || [];
            const description = data.metadata?.description || 'Payment for services';

            try {
                receiptBuffer = await this.receiptService.generateReceipt({
                    orderId: data.order_id || data.payment_id,
                    amount: data.amount,
                    currency: data.currency,
                    customerName: data.metadata?.customer_name || data.customer_name || 'Customer',
                    date: new Date().toLocaleDateString(),
                    description: description,
                    items: items
                });
            } catch (error) {
                this.logger.error('Failed to generate receipt', error);
            }

            await this.emailService.sendPaymentSuccessEmail(data.email, {
                name: data.metadata?.customer_name || data.customer_name || 'Customer',
                amount: data.amount,
                currency: data.currency,
                orderId: data.order_id || data.payment_id,
                description: description,
                invoiceUrl: '#', // TODO: Add real invoice URL
                items: items
            }, receiptBuffer);
        }
    }

    @EventPattern('payment.created')
    async handlePaymentCreated(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received payment.created event: ${JSON.stringify(data)}`);
        
        // Notify user that manual payment proof is received
        if (data.status === 'PENDING_REVIEW' && data.email) {
             await this.emailService.sendManualPaymentReceivedEmail(data.email, {
                name: data.metadata?.customer_name || data.customer_name || 'Customer',
                amount: data.amount,
                currency: data.currency,
                orderId: data.order_id || data.payment_id,
             });
        }
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received payment.failed event: ${JSON.stringify(data)}`);
        
        if (data.email) {
             await this.emailService.sendPaymentFailedEmail(data.email, {
                name: data.metadata?.customer_name || data.customer_name || 'Customer',
                amount: data.amount,
                currency: data.currency,
                orderId: data.order_id || data.payment_id,
                reason: data.metadata?.failure_reason || 'Transaction could not be processed',
             });
        }
    }

    @EventPattern('payment.refunded')
    async handlePaymentRefunded(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received payment.refunded event: ${JSON.stringify(data)}`);
        
        if (data.email) {
             await this.emailService.sendPaymentRefundedEmail(data.email, {
                name: data.metadata?.customer_name || data.customer_name || 'Customer',
                amount: data.amount,
                currency: data.currency,
                orderId: data.order_id || data.payment_id,
                description: 'Refund for services'
             });
        }
    }

    @EventPattern('user.registered')
    async handleUserRegistered(@Payload() data: any) {
        this.logger.log(`Received user.registered event: ${JSON.stringify(data)}`);

        if (data.email) {
            await this.emailService.sendWelcomeEmail(
                data.email,
                data.first_name || data.name || 'User',
                data.programCategory
            );
        }
    }

    @EventPattern('user.forgot-password')
    async handleForgotPassword(@Payload() data: any) {
        this.logger.log(`Received user.forgot-password event: ${JSON.stringify(data)}`);

        if (data.email) {
            await this.emailService.sendForgotPasswordEmail(
                data.email,
                data.name || 'User',
                data.token,
                data.programCategory
            );
        }
    }

    @EventPattern('user.verify-email')
    async handleVerifyEmail(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received user.verify-email event START processing`);
        this.logger.log(`Event Data: ${JSON.stringify(data)}`);
        
        try {
            if (data.email && data.token) {
                this.logger.log(`Calling emailService.sendVerificationEmail for ${data.email}`);
                const result = await this.emailService.sendVerificationEmail(
                    data.email,
                    data.name || 'User',
                    data.token,
                    data.programCategory
                );
                this.logger.log(`Email service returned successfully for ${data.email}. Result: ${JSON.stringify(result)}`);
            } else {
                 this.logger.warn(`Invalid data received for user.verify-email: Missing email or token`);
            }
        } catch (error) {
            this.logger.error(`Error processing user.verify-email event: ${error.message}`, error.stack);
        }
        this.logger.log(`Received user.verify-email event FINISHED processing`);
    }

    @EventPattern('user.email-verified')
    async handleEmailVerified(@Payload() data: any) {
        this.logger.log(`Received user.email-verified event: ${JSON.stringify(data)}`);

        if (data.email) {
            await this.emailService.sendEmailVerifiedEmail(
                data.email,
                data.name || 'User',
                data.programCategory
            );
        }
    }
}
