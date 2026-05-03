import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ListSupportTicketsQuery } from '../list-support-tickets.query';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { SupportTicketResponseDto } from '@modules/support/presentation/dto/support-ticket.dto';

@QueryHandler(ListSupportTicketsQuery)
export class ListSupportTicketsHandler implements IQueryHandler<ListSupportTicketsQuery> {
    constructor(
        @Inject('ISupportTicketRepository')
        private readonly repository: ISupportTicketRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(query: ListSupportTicketsQuery): Promise<SupportTicketResponseDto[]> {
        const participant = await this.participantRepository.findByUserId(query.userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found');
        }

        const tickets = await this.repository.findByParticipantId(participant.id);

        return tickets.map(t => ({
            id: t.id,
            ticketNumber: t.ticketNumber,
            category: t.category,
            subCategory: t.subCategory,
            subject: t.subject,
            status: t.status,
            priority: t.priority,
            createdAt: t.createdAt,
            updatedAt: t.updatedAt,
        }));
    }
}
