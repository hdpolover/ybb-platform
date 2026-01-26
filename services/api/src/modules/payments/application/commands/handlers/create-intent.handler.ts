import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateIntentCommand } from '../create-intent.command';
import { PaymentGrpcClient } from '../../../infrastructure/services/payment-grpc.client';

@CommandHandler(CreateIntentCommand)
export class CreateIntentHandler implements ICommandHandler<CreateIntentCommand> {
    constructor(private readonly paymentClient: PaymentGrpcClient) { }

    async execute(command: CreateIntentCommand): Promise<any> {
        const { userId, dto } = command;

        return this.paymentClient.createIntent({
            user_id: userId,
            amount: dto.amount,
            currency: dto.currency,
            reference_type: dto.reference_type,
            reference_id: dto.reference_id,
            participant_id: dto.participant_id,
            metadata: dto.metadata,
            customer_name: dto.customer_name,
            customer_email: dto.customer_email,
            customer_phone: dto.customer_phone,
            description: dto.description,
            item_details: dto.item_details,
        });
    }
}
