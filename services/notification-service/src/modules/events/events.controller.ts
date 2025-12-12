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
                data.first_name || data.name || 'User'
            );
        }
    }
}
