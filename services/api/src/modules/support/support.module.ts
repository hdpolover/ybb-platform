import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SupportTicketsController } from './presentation/support-tickets.controller';
import { AdminSupportTicketsController } from './presentation/admin-support-tickets.controller';
import { SupportTicketRepository } from './infrastructure/persistence/support-ticket.repository';
import { ParticipantRepository } from '@modules/participants/infrastructure/persistence/participant.repository';
import { CreateSupportTicketHandler } from './application/commands/handlers/create-support-ticket.handler';
import { ListSupportTicketsHandler } from './application/queries/handlers/list-support-tickets.handler';
import { GetSupportTicketHandler } from './application/queries/handlers/get-support-ticket.handler';
import { ReplySupportTicketHandler } from './application/commands/handlers/reply-support-ticket.handler';
import { SupportTicketPriorityClassifierService } from './application/services/support-ticket-priority-classifier.service';

@Module({
    imports: [CqrsModule, AuthModule],
    controllers: [SupportTicketsController, AdminSupportTicketsController],
    providers: [
        {
            provide: 'ISupportTicketRepository',
            useClass: SupportTicketRepository,
        },
        {
            provide: 'IParticipantRepository',
            useClass: ParticipantRepository,
        },
        CreateSupportTicketHandler,
        ListSupportTicketsHandler,
        GetSupportTicketHandler,
        ReplySupportTicketHandler,
        SupportTicketPriorityClassifierService,
    ],
})
export class SupportModule { }
