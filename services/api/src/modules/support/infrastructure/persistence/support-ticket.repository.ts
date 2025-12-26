import { Injectable } from '@nestjs/common';
import { ISupportTicketRepository } from '@core/interfaces/repositories/support-ticket.repository.interface';
import { SupportTicket, SupportTicketMessage } from '@core/entities/support-ticket.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { TicketStatus, TicketPriority } from '@prisma/client';

@Injectable()
export class SupportTicketRepository implements ISupportTicketRepository {
    constructor(private readonly prisma: PrismaService) { }

    async create(ticket: SupportTicket): Promise<SupportTicket> {
        const created = await this.prisma.supportTicket.create({
            data: {
                id: ticket.id,
                participantId: ticket.participantId,
                ticketNumber: ticket.ticketNumber,
                category: ticket.category,
                subCategory: ticket.subCategory,
                subject: ticket.subject,
                description: ticket.description,
                status: ticket.status as TicketStatus,
                priority: ticket.priority as TicketPriority,
            },
        });
        return this.mapToEntity(created);
    }

    async findById(id: string): Promise<SupportTicket | null> {
        const ticket = await this.prisma.supportTicket.findUnique({
            where: { id },
            include: {
                messages: {
                    orderBy: { createdAt: 'asc' },
                },
            },
        });
        return ticket ? this.mapToEntity(ticket) : null;
    }

    async findByParticipantId(participantId: string): Promise<SupportTicket[]> {
        const tickets = await this.prisma.supportTicket.findMany({
            where: { participantId },
            orderBy: { createdAt: 'desc' },
            include: {
                messages: {
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                }
            }
        });
        return tickets.map(this.mapToEntity);
    }

    async addMessage(message: SupportTicketMessage): Promise<SupportTicketMessage> {
        const created = await this.prisma.supportTicketMessage.create({
            data: {
                id: message.id,
                ticketId: message.ticketId,
                message: message.message,
                isFromAdmin: message.isFromAdmin,
                senderId: message.senderId,
                senderName: message.senderName,
                attachments: message.attachments,
                isRead: message.isRead,
            },
        });
        return this.mapMessageToEntity(created);
    }

    async updateStatus(id: string, status: string, resolvedAt?: Date, closedAt?: Date): Promise<void> {
        const data: any = { status: status as TicketStatus };
        if (resolvedAt) data.resolvedAt = resolvedAt;
        if (closedAt) data.closedAt = closedAt;

        await this.prisma.supportTicket.update({
            where: { id },
            data,
        });
    }

    async generateTicketNumber(): Promise<string> {
        const count = await this.prisma.supportTicket.count();
        const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const num = (count + 1).toString().padStart(4, '0');
        return `TKT-${date}-${num}`;
    }

    private mapToEntity(prisma: any): SupportTicket {
        const messages = prisma.messages?.map(this.mapMessageToEntity) || [];
        return new SupportTicket(
            prisma.id,
            prisma.participantId,
            prisma.ticketNumber,
            prisma.category,
            prisma.subject,
            prisma.description,
            prisma.status,
            prisma.priority,
            prisma.createdAt,
            prisma.updatedAt,
            prisma.subCategory,
            prisma.assignedTo,
            prisma.programId,
            prisma.resolution,
            prisma.resolvedAt,
            prisma.closedAt,
            prisma.satisfactionRating,
            prisma.feedback,
            messages,
        );
    }

    private mapMessageToEntity(prisma: any): SupportTicketMessage {
        return new SupportTicketMessage(
            prisma.id,
            prisma.ticketId,
            prisma.message,
            prisma.isFromAdmin,
            prisma.senderId,
            prisma.senderName,
            prisma.createdAt,
            prisma.attachments as any[],
            prisma.isRead,
        );
    }
}
