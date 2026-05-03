import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';
import { CreateSupportTicketCommand } from '../create-support-ticket.command';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { SupportTicket } from '@core/entities/support-ticket.entity';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { SupportTicketPriorityClassifierService } from '@modules/support/application/services/support-ticket-priority-classifier.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@CommandHandler(CreateSupportTicketCommand)
export class CreateSupportTicketHandler implements ICommandHandler<CreateSupportTicketCommand> {
    constructor(
        @Inject('ISupportTicketRepository')
        private readonly repository: ISupportTicketRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
        private readonly unitOfWork: UnitOfWork,
        private readonly priorityClassifier: SupportTicketPriorityClassifierService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
        private readonly prisma: PrismaService,
    ) { }

    async execute(command: CreateSupportTicketCommand): Promise<string> {
        const { userId, dto } = command;

        // Check if user is a participant
        const participant = await this.participantRepository.findByUserId(userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found. Please complete profile first.');
        }

        const classification = await this.priorityClassifier.classify({
            category: dto.category,
            subCategory: dto.subCategory ?? undefined,
            subject: dto.subject,
            description: dto.description,
        });

        const ticketNumber = await this.repository.generateTicketNumber();

        const ticket = new SupportTicket(
            uuidv4(),
            participant.id,
            ticketNumber,
            dto.category,
            dto.subject,
            dto.description,
            'open', // status
            classification.priority,
            new Date(),
            new Date(),
            dto.subCategory,
            undefined,
            dto.programId,
        );

        await this.unitOfWork.execute(
            async (repos) => {
                await repos.tx.supportTicket.create({
                    data: {
                        id: ticket.id,
                        participantId: ticket.participantId,
                        ticketNumber: ticket.ticketNumber,
                        category: ticket.category,
                        subCategory: ticket.subCategory,
                        subject: ticket.subject,
                        description: ticket.description,
                        status: ticket.status as import('@prisma/client').SupportTicketStatus,
                        priority: ticket.priority as import('@prisma/client').SupportTicketPriority,
                        programId: ticket.programId,
                    },
                });

                await repos.tx.supportTicketMessage.create({
                    data: {
                        id: uuidv4(),
                        ticketId: ticket.id,
                        message: ticket.description,
                        isFromAdmin: false,
                        senderId: participant.id,
                        senderName: participant.fullName,
                        attachments: (dto.attachments ?? []) as unknown as import('@prisma/client').Prisma.InputJsonValue,
                        isRead: false,
                    },
                });
            },
            { name: 'support-ticket-create', timeout: 3000 },
        );

        const ticketOwner = await this.prisma.user.findUnique({
            where: { id: participant.userId },
            include: { brand: true },
        });

        if (ticketOwner?.email) {
            await this.rabbitmqProducer.emit('support.ticket.created', {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                category: ticket.category,
                subCategory: ticket.subCategory,
                subject: ticket.subject,
                status: ticket.status,
                priority: ticket.priority,
                createdAt: ticket.createdAt.toISOString(),
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
                aiClassification: {
                    source: classification.source,
                    model: classification.model,
                    confidence: classification.confidence,
                    reason: classification.reason,
                },
            });
        }

        return ticket.id;
    }
}
