export class GetSupportTicketQuery {
    constructor(
        public readonly ticketId: string,
        public readonly userId: string,
    ) { }
}
