import { ReplySupportTicketDto } from '@modules/support/presentation/dto/support-ticket.dto';

export class ReplySupportTicketCommand {
    constructor(
        public readonly userId: string,
        public readonly ticketId: string,
        public readonly dto: ReplySupportTicketDto,
    ) { }
}
