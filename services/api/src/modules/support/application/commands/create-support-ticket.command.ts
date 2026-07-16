import { CreateSupportTicketDto } from '@modules/support/presentation/dto/support-ticket.dto';

export class CreateSupportTicketCommand {
    constructor(
        public readonly userId: string, // Participant User ID
        public readonly dto: CreateSupportTicketDto,
    ) { }
}
