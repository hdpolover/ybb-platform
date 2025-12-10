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
        // Ideally use a template service here
        if (data.email) {
            await this.emailService.sendEmail(
                data.email,
                'Payment Confirmation',
                `<h1>Payment Successful</h1><p>Amount: ${data.amount}</p>`
            );
        }
    }

    @EventPattern('user.registered')
    async handleUserRegistered(@Payload() data: any) {
        this.logger.log(`Received user.registered event: ${JSON.stringify(data)}`);
        if (data.email) {
            await this.emailService.sendEmail(
                data.email,
                'Welcome to YBB Platform',
                `<p>Hi ${data.name || 'User'}, welcome to our platform!</p>`
            );
        }
    }
}
