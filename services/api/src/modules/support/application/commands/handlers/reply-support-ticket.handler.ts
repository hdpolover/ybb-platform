import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ReplySupportTicketCommand } from '../reply-support-ticket.command';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { SupportTicketMessage } from '@core/entities/support-ticket.entity';

@CommandHandler(ReplySupportTicketCommand)
export class ReplySupportTicketHandler implements ICommandHandler<ReplySupportTicketCommand> {
    constructor(
        @Inject('ISupportTicketRepository')
        private readonly repository: ISupportTicketRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(command: ReplySupportTicketCommand): Promise<void> {
        const { userId, ticketId, dto } = command;

        const participant = await this.participantRepository.findByUserId(userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found');
        }

        const ticket = await this.repository.findById(ticketId);
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        if (ticket.participantId !== participant.id) {
            throw new ForbiddenException('You are not authorized to reply to this ticket');
        }

        const message = new SupportTicketMessage(
            uuidv4(),
            ticket.id,
            dto.message,
            false, // isFromAdmin
            participant.id, // senderId
            participant.fullName, // senderName
            new Date(),
            dto.attachments || [],
        );

        await this.repository.addMessage(message);

        // Update ticket status to open if it was waiting
        if (ticket.status === 'waiting_response' || ticket.status === 'resolved') {
            await this.repository.updateStatus(ticket.id, 'open');
        }
    }
}
