import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { UserRole } from '@core/entities/user.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType, Prisma, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { v4 as uuidv4 } from 'uuid';

type UpdateSupportTicketDto = {
  status?: SupportTicketStatus;
  priority?: SupportTicketPriority;
  assignedTo?: string | null;
  resolution?: string | null;
};

type ReplySupportTicketByAdminDto = {
  message: string;
  attachments?: unknown[];
  isInternalNote?: boolean;
};

@ApiTags('Support')
@Controller('admin/programs/:programId/support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class SupportTicketsAdminController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: 'Admin: list support tickets by program' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  @ApiQuery({ name: 'priority', required: false, enum: SupportTicketPriority })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated support ticket list' })
  async list(
    @Param('programId') programId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') status?: SupportTicketStatus,
    @Query('priority') priority?: SupportTicketPriority,
    @Query('search') search?: string,
  ) {
    const page = Math.max(1, Number(pageRaw || 1));
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20)));
    const trimmedSearch = search?.trim();

    const where: Prisma.SupportTicketWhereInput = {
      programId,
      ...(status ? { status } : {}),
      ...(priority ? { priority } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { ticketNumber: { contains: trimmedSearch, mode: 'insensitive' } },
              { category: { contains: trimmedSearch, mode: 'insensitive' } },
              { subject: { contains: trimmedSearch, mode: 'insensitive' } },
              { description: { contains: trimmedSearch, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    const participantIds = Array.from(new Set(items.map((item) => item.participantId)));
    const participants = participantIds.length
      ? await this.prisma.participant.findMany({
          where: { id: { in: participantIds } },
          select: { id: true, fullName: true, userId: true },
        })
      : [];

    const userIds = Array.from(new Set(participants.map((participant) => participant.userId)));
    const users = userIds.length
      ? await this.prisma.user.findMany({
          where: { id: { in: userIds } },
          select: { id: true, email: true },
        })
      : [];

    const participantMap = new Map(participants.map((participant) => [participant.id, participant]));
    const userMap = new Map(users.map((user) => [user.id, user]));

    return {
      data: items.map((item) => {
        const participant = participantMap.get(item.participantId);
        const user = participant ? userMap.get(participant.userId) : null;

        return {
          id: item.id,
          ticketNumber: item.ticketNumber,
          category: item.category,
          subCategory: item.subCategory,
          subject: item.subject,
          description: item.description,
          status: item.status,
          priority: item.priority,
          assignedTo: item.assignedTo,
          participantId: item.participantId,
          participantName: participant?.fullName ?? null,
          participantEmail: user?.email ?? null,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          latestMessageAt: item.messages[0]?.createdAt ?? null,
        };
      }),
      meta: {
        total,
        page,
        limit,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Admin: get support ticket detail' })
  @ApiResponse({ status: 200, description: 'Support ticket detail' })
  async getById(
    @Param('programId') programId: string,
    @Param('id') id: string,
  ) {
    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, programId },
      include: {
        messages: {
          where: { isInternalNote: false },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new BadRequestException('Support ticket not found for this program');
    }

    const participant = await this.prisma.participant.findFirst({
      where: { id: ticket.participantId },
      select: { id: true, fullName: true, userId: true },
    });
    const user = participant
      ? await this.prisma.user.findFirst({
          where: { id: participant.userId },
          select: { id: true, email: true },
        })
      : null;

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      subCategory: ticket.subCategory,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      assignedTo: ticket.assignedTo,
      resolution: ticket.resolution,
      participantId: ticket.participantId,
      participantName: participant?.fullName ?? null,
      participantEmail: user?.email ?? null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        message: message.message,
        isFromAdmin: message.isFromAdmin,
        senderId: message.senderId,
        senderName: message.senderName,
        attachments: message.attachments,
        createdAt: message.createdAt,
      })),
    };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: update support ticket' })
  @ApiResponse({ status: 200, description: 'Updated support ticket' })
  @AuditTrail({ entityType: 'SupportTicket', action: ChangeType.update })
  async update(
    @Param('programId') programId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSupportTicketDto,
  ) {
    const payload: Prisma.SupportTicketUpdateInput = {};

    if (dto.status !== undefined) {
      payload.status = dto.status;
      if (dto.status === SupportTicketStatus.resolved) {
        payload.resolvedAt = new Date();
      }
      if (dto.status === SupportTicketStatus.closed) {
        payload.closedAt = new Date();
      }
    }

    if (dto.priority !== undefined) payload.priority = dto.priority;
    if (dto.assignedTo !== undefined) payload.assignedTo = dto.assignedTo;
    if (dto.resolution !== undefined) payload.resolution = dto.resolution;

    if (Object.keys(payload).length === 0) {
      throw new BadRequestException('No update payload provided');
    }

    const updated = await this.prisma.supportTicket.updateMany({
      where: { id, programId },
      data: payload,
    });

    if (updated.count === 0) {
      throw new BadRequestException('Support ticket not found for this program');
    }

    return this.prisma.supportTicket.findUniqueOrThrow({ where: { id } });
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Admin: reply to support ticket' })
  @ApiResponse({ status: 201, description: 'Support ticket reply created' })
  @AuditTrail({ entityType: 'SupportTicketMessage', action: ChangeType.create })
  async reply(
    @Param('programId') programId: string,
    @Param('id') id: string,
    @CurrentUser() user: CurrentUserData,
    @Body() dto: ReplySupportTicketByAdminDto,
  ) {
    const message = dto.message?.trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    const ticket = await this.prisma.supportTicket.findFirst({
      where: { id, programId },
      select: { id: true },
    });
    if (!ticket) {
      throw new BadRequestException('Support ticket not found for this program');
    }

    const created = await this.prisma.supportTicketMessage.create({
      data: {
        id: uuidv4(),
        ticketId: id,
        message,
        isFromAdmin: true,
        senderId: user.adminId ?? user.userId,
        senderName: user.email,
        attachments: (dto.attachments ?? []) as Prisma.InputJsonValue,
        isInternalNote: dto.isInternalNote ?? false,
      },
    });

    return {
      id: created.id,
      message: created.message,
      isFromAdmin: created.isFromAdmin,
      senderId: created.senderId,
      senderName: created.senderName,
      attachments: created.attachments,
      createdAt: created.createdAt,
    };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Admin: delete support ticket (soft delete)' })
  @ApiResponse({ status: 204, description: 'Support ticket deleted' })
  @AuditTrail({ entityType: 'SupportTicket', action: ChangeType.delete })
  async delete(
    @Param('programId') programId: string,
    @Param('id') id: string,
  ): Promise<void> {
    const deleted = await this.prisma.supportTicket.updateMany({
      where: { id, programId },
      data: { deletedAt: new Date() },
    });

    if (deleted.count === 0) {
      throw new BadRequestException('Support ticket not found for this program');
    }
  }
}
