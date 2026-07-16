import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { ReplySupportTicketCommand } from '../reply-support-ticket.command';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { SupportTicketMessage } from '@core/entities/support-ticket.entity';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { SupportTicketStatus } from '@prisma/client';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@CommandHandler(ReplySupportTicketCommand)
export class ReplySupportTicketHandler implements ICommandHandler<ReplySupportTicketCommand> {
    constructor(
        @Inject('ISupportTicketRepository')
        private readonly repository: ISupportTicketRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
        private readonly unitOfWork: UnitOfWork,
        private readonly rabbitmqProducer: RabbitMQProducerService,
        private readonly prisma: PrismaService,
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
            (dto.attachments || []) as unknown as import('@core/entities/participant-application.entity').DocumentFile[],
        );

        // ========================================
        // Unit of Work: Support Ticket Reply
        // Message creation and status update must succeed together
        // ========================================
        await this.unitOfWork.execute(
            async (repos) => {
                // Add message to ticket
                await repos.tx.supportTicketMessage.create({
                    data: {
                        id: message.id,
                        ticketId: message.ticketId,
                        message: message.message,
                        isFromAdmin: message.isFromAdmin,
                        senderId: message.senderId,
                        senderName: message.senderName,
                        attachments: message.attachments as unknown as import('@prisma/client').Prisma.InputJsonValue,
                        isRead: message.isRead,
                    },
                });

                // Update ticket status to open if it was waiting
                if (ticket.status === 'waiting_response' || ticket.status === 'resolved') {
                    await repos.tx.supportTicket.update({
                        where: { id: ticket.id },
                        data: { status: SupportTicketStatus.open },
                    });
                }
            },
            { name: 'support-ticket-reply', timeout: 3000 }
        );

        const ticketOwner = await this.prisma.user.findUnique({
            where: { id: participant.userId },
            include: { brand: true },
        });

        if (ticketOwner?.email) {
            const resolvedStatus = (ticket.status === 'waiting_response' || ticket.status === 'resolved')
                ? SupportTicketStatus.open
                : ticket.status as SupportTicketStatus;

            await this.rabbitmqProducer.emit('support.ticket.replied', {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                status: resolvedStatus,
                actorRole: 'participant',
                responderName: participant.fullName,
                messagePreview: message.message.length > 200
                    ? `${message.message.slice(0, 200)}...`
                    : message.message,
                email: ticketOwner.email,
                name: participant.fullName,
                brand: ticketOwner.brand
                    ? {
                        name: ticketOwner.brand.name,
                        websiteUrl: ticketOwner.brand.websiteUrl,
                        logoUrl: ticketOwner.brand.logoUrl,
                        contactEmail: ticketOwner.brand.contactEmail,
                    }
                    : undefined,
            });
        }
    }
}
