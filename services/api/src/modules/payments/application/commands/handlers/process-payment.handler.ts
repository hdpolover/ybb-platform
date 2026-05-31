import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProcessPaymentCommand } from '../process-payment.command';
import { PaymentGrpcClient } from '../../../infrastructure/services/payment-grpc.client';

@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler implements ICommandHandler<ProcessPaymentCommand> {
    constructor(private readonly paymentClient: PaymentGrpcClient) { }

    async execute(command: ProcessPaymentCommand): Promise<any> {
        const { intentId, dto, userId } = command;

        // SECURITY: user_id is sourced from the authenticated JWT (via ProcessPaymentCommand)
        // and forwarded to the Go payment service, which verifies that the intent belongs
        // to the caller before processing the charge.
        return this.paymentClient.processPayment({
            intent_id: intentId,
            payment_method_id: dto.payment_method_id,
            gateway_token: dto.gateway_token,
            payment_details: dto.payment_details,
            user_id: userId,
        });
    }
}
