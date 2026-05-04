import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { IsArray, IsEnum, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { Prisma, SupportTicketPriority, SupportTicketStatus } from '@prisma/client';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { AuditTrail } from '@shared/decorators/audit-trail.decorator';
import { ChangeType } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

class SupportTicketAttachmentInputDto {
  @IsString()
  fileId: string;

  @IsString()
  fileName: string;

  @IsString()
  fileUrl: string;

  @IsOptional()
  @IsString()
  mimeType?: string;

  @IsOptional()
  @IsString()
  uploadedAt?: string;
}

class AdminReplySupportTicketDto {
  @IsString()
  message: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportTicketAttachmentInputDto)
  attachments?: SupportTicketAttachmentInputDto[];

  @IsOptional()
  isInternalNote?: boolean;
}

class AdminUpdateSupportTicketDto {
  @IsOptional()
  @IsEnum(SupportTicketStatus)
  status?: SupportTicketStatus;

  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @IsOptional()
  @IsUUID()
  assignedTo?: string | null;

  @IsOptional()
  @IsString()
  resolution?: string | null;

  @IsOptional()
  @IsString()
  closedReason?: string | null;
}

type SupportTicketAttachmentResponse = {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
  uploadedAt?: string;
};

@ApiTags('Support')
@Controller('admin/programs/:programId/support-tickets')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AdminSupportTicketsController {
  constructor(private readonly prisma: PrismaService) {}

  private async assertProgramAdminAccess(user: CurrentUserData, programId: string): Promise<{ adminId: string; adminName: string }> {
    const admin = await this.prisma.admin.findUnique({
      where: { userId: user.userId },
      select: {
        id: true,
        fullName: true,
        adminPrograms: {
          where: {
            programId,
            removedAt: null,
          },
          select: { id: true },
        },
      },
    });

    if (!admin) {
      throw new ForbiddenException('Admin profile not found.');
    }

    if (admin.adminPrograms.length === 0) {
      throw new ForbiddenException('You are not assigned to this program.');
    }

    return { adminId: admin.id, adminName: admin.fullName };
  }

  private normalizeAttachments(value: Prisma.JsonValue): SupportTicketAttachmentResponse[] {
    if (!Array.isArray(value)) return [];

    return value
      .filter(
        (item): item is Record<string, unknown> =>
          typeof item === 'object' && item !== null,
      )
      .map((item, index) => {
        const fileUrl = typeof item.fileUrl === 'string' ? item.fileUrl : '';
        const fileName = typeof item.fileName === 'string' ? item.fileName : `Attachment ${index + 1}`;
        const fileId = typeof item.fileId === 'string' ? item.fileId : `${fileUrl}-${index}`;

        return {
          fileId,
          fileName,
          fileUrl,
          mimeType: typeof item.mimeType === 'string' ? item.mimeType : undefined,
          uploadedAt: typeof item.uploadedAt === 'string' ? item.uploadedAt : undefined,
        };
      })
      .filter((attachment) => attachment.fileUrl.length > 0);
  }

  @Get()
  @ApiOperation({ summary: 'Admin: list support tickets for a program' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({ name: 'status', required: false, enum: SupportTicketStatus })
  @ApiQuery({ name: 'priority', required: false, enum: SupportTicketPriority })
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiResponse({ status: 200, description: 'Paginated support tickets' })
  async list(
    @CurrentUser() user: CurrentUserData,
    @Param('programId') programId: string,
    @Query('page') pageRaw?: string,
    @Query('limit') limitRaw?: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('search') search?: string,
  ) {
    await this.assertProgramAdminAccess(user, programId);

    const page = Math.max(1, Number(pageRaw || 1));
    const limit = Math.min(100, Math.max(1, Number(limitRaw || 20)));
    const trimmedSearch = search?.trim();

    const where: Prisma.SupportTicketWhereInput = {
      programId,
      deletedAt: null,
      ...(status && Object.values(SupportTicketStatus).includes(status as SupportTicketStatus)
        ? { status: status as SupportTicketStatus }
        : {}),
      ...(priority && Object.values(SupportTicketPriority).includes(priority as SupportTicketPriority)
        ? { priority: priority as SupportTicketPriority }
        : {}),
    };

    if (trimmedSearch) {
      const matchedParticipants = await this.prisma.participant.findMany({
        where: {
          OR: [
            { fullName: { contains: trimmedSearch, mode: 'insensitive' } },
            { user: { email: { contains: trimmedSearch, mode: 'insensitive' } } },
          ],
        },
        select: { id: true },
        take: 100,
      });

      const participantIds = matchedParticipants.map((participant) => participant.id);
      where.OR = [
        { ticketNumber: { contains: trimmedSearch, mode: 'insensitive' } },
        { subject: { contains: trimmedSearch, mode: 'insensitive' } },
        { category: { contains: trimmedSearch, mode: 'insensitive' } },
        { subCategory: { contains: trimmedSearch, mode: 'insensitive' } },
        ...(participantIds.length > 0 ? [{ participantId: { in: participantIds } }] : []),
      ];
    }

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supportTicket.findMany({
        where,
        include: {
          messages: {
            take: 1,
            orderBy: { createdAt: 'desc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.supportTicket.count({ where }),
    ]);

    const participantIds = Array.from(new Set(items.map((item) => item.participantId)));
    const participants = await this.prisma.participant.findMany({
      where: { id: { in: participantIds } },
      select: {
        id: true,
        fullName: true,
        user: { select: { email: true } },
      },
    });
    const participantById = new Map(participants.map((participant) => [participant.id, participant]));

    return {
      data: items.map((item) => {
        const participant = participantById.get(item.participantId);
        return {
          id: item.id,
          ticketNumber: item.ticketNumber,
          category: item.category,
          subCategory: item.subCategory,
          subject: item.subject,
          status: item.status,
          priority: item.priority,
          createdAt: item.createdAt,
          updatedAt: item.updatedAt,
          participant: participant
            ? {
                id: participant.id,
                fullName: participant.fullName,
                email: participant.user.email,
              }
            : null,
          lastMessageAt: item.messages[0]?.createdAt ?? item.updatedAt,
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
  @ApiOperation({ summary: 'Admin: get support ticket detail for a program' })
  @ApiResponse({ status: 200, description: 'Support ticket detail' })
  async getDetail(
    @CurrentUser() user: CurrentUserData,
    @Param('programId') programId: string,
    @Param('id') id: string,
  ) {
    await this.assertProgramAdminAccess(user, programId);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id,
        programId,
        deletedAt: null,
      },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const participant = await this.prisma.participant.findUnique({
      where: { id: ticket.participantId },
      select: {
        id: true,
        fullName: true,
        user: { select: { email: true } },
      },
    });

    return {
      id: ticket.id,
      ticketNumber: ticket.ticketNumber,
      category: ticket.category,
      subCategory: ticket.subCategory,
      subject: ticket.subject,
      description: ticket.description,
      status: ticket.status,
      priority: ticket.priority,
      resolution: ticket.resolution,
      closedReason: ticket.closedReason,
      assignedTo: ticket.assignedTo,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
      resolvedAt: ticket.resolvedAt,
      closedAt: ticket.closedAt,
      participant: participant
        ? {
            id: participant.id,
            fullName: participant.fullName,
            email: participant.user.email,
          }
        : null,
      messages: ticket.messages.map((message) => ({
        id: message.id,
        message: message.message,
        isFromAdmin: message.isFromAdmin,
        isInternalNote: message.isInternalNote,
        senderId: message.senderId,
        senderName: message.senderName,
        createdAt: message.createdAt,
        attachments: this.normalizeAttachments(message.attachments),
      })),
    };
  }

  @Post(':id/messages')
  @ApiOperation({ summary: 'Admin: reply to support ticket' })
  @ApiResponse({ status: 201, description: 'Reply created' })
  @AuditTrail({ entityType: 'SupportTicketMessage', action: ChangeType.create })
  async reply(
    @CurrentUser() user: CurrentUserData,
    @Param('programId') programId: string,
    @Param('id') id: string,
    @Body() dto: AdminReplySupportTicketDto,
  ) {
    const { adminId, adminName } = await this.assertProgramAdminAccess(user, programId);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id,
        programId,
        deletedAt: null,
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    const message = dto.message?.trim();
    if (!message) {
      throw new BadRequestException('message is required');
    }

    const attachments = (dto.attachments ?? []) as unknown as Prisma.InputJsonValue;

    await this.prisma.$transaction(async (tx) => {
      await tx.supportTicketMessage.create({
        data: {
          ticketId: ticket.id,
          message,
          isFromAdmin: true,
          isInternalNote: dto.isInternalNote === true,
          senderId: adminId,
          senderName: adminName,
          attachments,
          isRead: false,
        },
      });

      if (ticket.status !== SupportTicketStatus.closed) {
        await tx.supportTicket.update({
          where: { id: ticket.id },
          data: { status: SupportTicketStatus.waiting_response },
        });
      }
    });

    return { success: true };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Admin: update support ticket status/priority' })
  @ApiResponse({ status: 200, description: 'Support ticket updated' })
  @AuditTrail({ entityType: 'SupportTicket', action: ChangeType.update })
  async update(
    @CurrentUser() user: CurrentUserData,
    @Param('programId') programId: string,
    @Param('id') id: string,
    @Body() dto: AdminUpdateSupportTicketDto,
  ) {
    const { adminId } = await this.assertProgramAdminAccess(user, programId);

    const ticket = await this.prisma.supportTicket.findFirst({
      where: {
        id,
        programId,
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!ticket) {
      throw new NotFoundException('Support ticket not found.');
    }

    if (
      dto.status === undefined &&
      dto.priority === undefined &&
      dto.assignedTo === undefined &&
      dto.resolution === undefined &&
      dto.closedReason === undefined
    ) {
      throw new BadRequestException('At least one field is required.');
    }

    const data: Prisma.SupportTicketUpdateInput = {};

    if (dto.status !== undefined) {
      data.status = dto.status;

      if (dto.status === SupportTicketStatus.resolved) {
        data.resolvedAt = new Date();
        data.resolvedBy = adminId;
        data.closedAt = null;
        data.closedBy = null;
      } else if (dto.status === SupportTicketStatus.closed) {
        data.closedAt = new Date();
        data.closedBy = adminId;
        if (dto.closedReason !== undefined) {
          data.closedReason = dto.closedReason;
        }
        if (dto.resolution !== undefined) {
          data.resolution = dto.resolution;
        }
      } else {
        data.resolvedAt = null;
        data.resolvedBy = null;
        data.closedAt = null;
        data.closedBy = null;
        data.closedReason = null;
      }
    }

    if (dto.priority !== undefined) {
      data.priority = dto.priority;
    }

    if (dto.assignedTo !== undefined) {
      data.assignedTo = dto.assignedTo || null;
    }

    if (dto.resolution !== undefined) {
      data.resolution = dto.resolution || null;
    }

    if (dto.closedReason !== undefined) {
      data.closedReason = dto.closedReason || null;
    }

    const updated = await this.prisma.supportTicket.update({
      where: { id: ticket.id },
      data,
    });

    return {
      id: updated.id,
      ticketNumber: updated.ticketNumber,
      status: updated.status,
      priority: updated.priority,
      resolution: updated.resolution,
      closedReason: updated.closedReason,
      assignedTo: updated.assignedTo,
      updatedAt: updated.updatedAt,
      resolvedAt: updated.resolvedAt,
      closedAt: updated.closedAt,
    };
  }
}
