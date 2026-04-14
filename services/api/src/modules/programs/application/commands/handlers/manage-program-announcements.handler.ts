import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { AnnouncementType, AnnouncementPriority } from '@prisma/client';
import {
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
  DeleteProgramAnnouncementCommand,
  ListProgramAnnouncementsCommand,
} from '../program-announcement.commands';

@Injectable()
export class ListProgramAnnouncementsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ListProgramAnnouncementsCommand) {
    const { programId, type, priority, page, limit } = command;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { programId };
    if (type) where.type = type as AnnouncementType;
    if (priority) where.priority = priority as AnnouncementPriority;

    const [data, total] = await Promise.all([
      this.prisma.programAnnouncement.findMany({
        where,
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip,
        take: limit,
      }),
      this.prisma.programAnnouncement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

@Injectable()
export class CreateProgramAnnouncementHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateProgramAnnouncementCommand) {
    const { programId, dto, createdBy } = command;

    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);

    return this.prisma.programAnnouncement.create({
      data: {
        programId,
        title: dto.title,
        content: dto.content,
        type: dto.type ?? 'general',
        priority: dto.priority ?? 'normal',
        target: dto.target ?? 'all',
        expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null,
        showBanner: dto.showBanner ?? false,
        createdBy,
        isActive: true,
      },
    });
  }
}

@Injectable()
export class UpdateProgramAnnouncementHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateProgramAnnouncementCommand) {
    const { id, dto } = command;

    const existing = await this.prisma.programAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    return this.prisma.programAnnouncement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.target !== undefined && { target: dto.target }),
        ...(dto.expiresAt !== undefined && { expiresAt: dto.expiresAt ? new Date(dto.expiresAt) : null }),
        ...(dto.showBanner !== undefined && { showBanner: dto.showBanner }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
  }
}

@Injectable()
export class DeleteProgramAnnouncementHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteProgramAnnouncementCommand) {
    const { id } = command;

    const existing = await this.prisma.programAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    await this.prisma.programAnnouncement.delete({ where: { id } });
    return { success: true, id };
  }
}
