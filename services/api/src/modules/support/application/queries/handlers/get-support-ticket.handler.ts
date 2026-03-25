import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { GetSupportTicketQuery } from '../get-support-ticket.query';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { SupportTicketResponseDto } from '@modules/support/presentation/dto/support-ticket.dto';

@QueryHandler(GetSupportTicketQuery)
export class GetSupportTicketHandler implements IQueryHandler<GetSupportTicketQuery> {
    constructor(
        @Inject('ISupportTicketRepository')
        private readonly repository: ISupportTicketRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(query: GetSupportTicketQuery): Promise<SupportTicketResponseDto> {
        const participant = await this.participantRepository.findByUserId(query.userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found');
        }

        const ticket = await this.repository.findById(query.ticketId);
        if (!ticket) {
            throw new NotFoundException('Ticket not found');
        }

        // Authorization check
        if (ticket.participantId !== participant.id) {
            throw new ForbiddenException('You are not authorized to view this ticket');
        }

        return {
            id: ticket.id,
            ticketNumber: ticket.ticketNumber,
            category: ticket.category,
            subject: ticket.subject,
            status: ticket.status,
            priority: ticket.priority,
            createdAt: ticket.createdAt,
            updatedAt: ticket.updatedAt,
            messages: ticket.messages?.map(m => ({
                id: m.id,
                message: m.message,
                isFromAdmin: m.isFromAdmin,
                senderName: m.senderName,
                createdAt: m.createdAt,
                attachments: m.attachments as unknown as string[],
            })),
        };
    }
}
