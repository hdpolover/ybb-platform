import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateSupportTicketCommand } from '../create-support-ticket.command';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { SupportTicket } from '@core/entities/support-ticket.entity';

@CommandHandler(CreateSupportTicketCommand)
export class CreateSupportTicketHandler implements ICommandHandler<CreateSupportTicketCommand> {
    constructor(
        @Inject('ISupportTicketRepository')
        private readonly repository: ISupportTicketRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(command: CreateSupportTicketCommand): Promise<string> {
        const { userId, dto } = command;

        // Check if user is a participant
        const participant = await this.participantRepository.findByUserId(userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found. Please complete profile first.');
        }

        const ticketNumber = await this.repository.generateTicketNumber();

        const ticket = new SupportTicket(
            uuidv4(),
            participant.id,
            ticketNumber,
            dto.category,
            dto.subject,
            dto.description,
            'open', // status
            dto.priority || 'normal',
            new Date(),
            new Date(),
            dto.subCategory,
        );

        const created = await this.repository.create(ticket);
        return created.id;
    }
}
