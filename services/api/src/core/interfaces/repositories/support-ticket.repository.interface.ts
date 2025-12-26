import { SupportTicket, SupportTicketMessage } from '../../entities/support-ticket.entity';

export interface ISupportTicketRepository {
    create(ticket: SupportTicket): Promise<SupportTicket>;
    findById(id: string): Promise<SupportTicket | null>;
    findByParticipantId(participantId: string): Promise<SupportTicket[]>;
    addMessage(message: SupportTicketMessage): Promise<SupportTicketMessage>;
    updateStatus(id: string, status: string, resolvedAt?: Date, closedAt?: Date): Promise<void>;
    generateTicketNumber(): Promise<string>;
}
