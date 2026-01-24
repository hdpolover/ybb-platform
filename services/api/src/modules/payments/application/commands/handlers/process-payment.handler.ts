import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProcessPaymentCommand } from '../process-payment.command';
import { PaymentGrpcClient } from '../../../infrastructure/services/payment-grpc.client';

@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler implements ICommandHandler<ProcessPaymentCommand> {
    constructor(private readonly paymentClient: PaymentGrpcClient) { }

    async execute(command: ProcessPaymentCommand): Promise<any> {
        const { intentId, dto, userId } = command;

        return this.paymentClient.processPayment({
            intent_id: intentId,
            payment_method_id: dto.payment_method_id,
            gateway_token: dto.gateway_token,
            payment_details: dto.payment_details,
            // Assuming user_id is needed context, or it's tied to intent
        });
    }
}
