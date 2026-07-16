import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ForbiddenException } from '@nestjs/common';
import { CreateIntentCommand } from '../create-intent.command';
import { PaymentGrpcClient } from '../../../infrastructure/services/payment-grpc.client';
import { CreateIntentResponse } from '../../../common/proto/payment.interface';
import { IParticipantRepository } from '../../../../../core/interfaces/repositories/participant.repository.interface';

@CommandHandler(CreateIntentCommand)
export class CreateIntentHandler implements ICommandHandler<CreateIntentCommand> {
    constructor(
        private readonly paymentClient: PaymentGrpcClient,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(command: CreateIntentCommand): Promise<CreateIntentResponse> {
        const { userId, dto } = command;

        // SECURITY: user_id is always sourced from the authenticated JWT (never from the
        // caller's DTO). If participant_id is provided, verify it belongs to the calling
        // user to prevent a caller from creating an intent on behalf of another participant.
        if (dto.participant_id) {
            const participant = await this.participantRepository.findByUserId(userId);
            if (!participant || participant.id !== dto.participant_id) {
                throw new ForbiddenException('participant_id does not belong to the caller');
            }
        }

        return this.paymentClient.createIntent({
            user_id: userId,
            amount: dto.amount,
            currency: dto.currency,
            reference_type: dto.reference_type,
            reference_id: dto.reference_id,
            participant_id: dto.participant_id,
            metadata: dto.metadata as Record<string, string> | undefined,
            customer_name: dto.customer_name,
            customer_email: dto.customer_email,
            customer_phone: dto.customer_phone,
            description: dto.description,
            item_details: dto.item_details,
        });
    }
}
