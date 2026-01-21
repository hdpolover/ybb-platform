import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload, Ctx, RmqContext } from '@nestjs/microservices';
import { EmailService } from '../email/email.service';

@Controller()
export class EventsController {
    private readonly logger = new Logger(EventsController.name);

    constructor(private readonly emailService: EmailService) { }

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(@Payload() data: any, @Ctx() context: RmqContext) {
        this.logger.log(`Received payment.succeeded event: ${JSON.stringify(data)}`);

        if (data.email) {
            await this.emailService.sendPaymentSuccessEmail(data.email, {
                name: data.customer_name || 'Customer',
                amount: data.amount,
                currency: data.currency,
                orderId: data.order_id,
                description: 'Payment for services',
                invoiceUrl: '#', // TODO: Add real invoice URL
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
                data.token
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
}
