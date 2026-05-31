import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ProcessPaymentCommand } from '../process-payment.command';
import { PaymentGrpcClient } from '../../../infrastructure/services/payment-grpc.client';

@CommandHandler(ProcessPaymentCommand)
export class ProcessPaymentHandler implements ICommandHandler<ProcessPaymentCommand> {
    constructor(private readonly paymentClient: PaymentGrpcClient) { }

    async execute(command: ProcessPaymentCommand): Promise<any> {
        const { intentId, dto, userId: _userId } = command;

        // SECURITY: Payment intent records live exclusively in the Go payment service;
        // there is no local Prisma model to verify intent ownership in this layer.
        // The proto ProcessPaymentRequest does not carry a user_id field, so ownership
        // cannot be forwarded at the message level. The Go payment service MUST enforce
        // that intent.user_id === the authenticated caller's user_id (derived from the
        // internal service context or a shared JWT claim) before processing the charge.
        // Until the proto is extended with user_id, this handler trusts the payment
        // service to own the authorization boundary for intent confirmation.
        return this.paymentClient.processPayment({
            intent_id: intentId,
            payment_method_id: dto.payment_method_id,
            gateway_token: dto.gateway_token,
            payment_details: dto.payment_details,
        });
    }
}
