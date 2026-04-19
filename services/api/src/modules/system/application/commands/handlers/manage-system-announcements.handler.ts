import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  ListAllSystemAnnouncementsCommand,
  CreateSystemAnnouncementCommand,
  UpdateSystemAnnouncementCommand,
  DeleteSystemAnnouncementCommand,
  TogglePublishSystemAnnouncementCommand,
  GetAdminSystemAnnouncementCommand,
} from '../manage-system-announcement.commands';

@Injectable()
@CommandHandler(ListAllSystemAnnouncementsCommand)
export class ListAllSystemAnnouncementsHandler
  implements ICommandHandler<ListAllSystemAnnouncementsCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ListAllSystemAnnouncementsCommand) {
    const { page, limit, brandId } = command;
    const skip = (page - 1) * limit;

    const where = brandId ? { brandId } : {};

    const [data, total] = await Promise.all([
      this.prisma.systemAnnouncement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.systemAnnouncement.count({ where }),
    ]);

    return {
      data,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }
}

@Injectable()
@CommandHandler(CreateSystemAnnouncementCommand)
export class CreateSystemAnnouncementHandler
  implements ICommandHandler<CreateSystemAnnouncementCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: CreateSystemAnnouncementCommand) {
    const { dto, createdBy } = command;

    const announcement = await this.prisma.systemAnnouncement.create({
      data: {
        title: dto.title,
        content: dto.content,
        summary: dto.summary ?? null,
        targetAudience: (dto.targetAudience as any) ?? 'all',
        brandId: dto.brandId ?? null,
        programId: dto.programId ?? null,
        priority: (dto.priority as any) ?? 'normal',
        type: (dto.type as any) ?? 'general',
        isPublished: dto.isPublished ?? false,
        publishedAt: dto.isPublished ? new Date() : null,
        isDismissible: dto.isDismissible ?? true,
        showBanner: dto.showBanner ?? false,
        actionUrl: dto.actionUrl ?? null,
        actionLabel: dto.actionLabel ?? null,
        startDate: dto.startDate ? new Date(dto.startDate) : null,
        endDate: dto.endDate ? new Date(dto.endDate) : null,
        metadata: dto.metadata ?? {},
        createdBy,
      },
    });

    return announcement;
  }
}

@Injectable()
@CommandHandler(UpdateSystemAnnouncementCommand)
export class UpdateSystemAnnouncementHandler
  implements ICommandHandler<UpdateSystemAnnouncementCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: UpdateSystemAnnouncementCommand) {
    const { id, dto, updatedBy } = command;

    const existing = await this.prisma.systemAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    const updated = await this.prisma.systemAnnouncement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.summary !== undefined && { summary: dto.summary }),
        ...(dto.targetAudience !== undefined && { targetAudience: dto.targetAudience as any }),
        ...(dto.brandId !== undefined && { brandId: dto.brandId }),
        ...(dto.programId !== undefined && { programId: dto.programId }),
        ...(dto.priority !== undefined && { priority: dto.priority as any }),
        ...(dto.type !== undefined && { type: dto.type as any }),
        ...(dto.isDismissible !== undefined && { isDismissible: dto.isDismissible }),
        ...(dto.showBanner !== undefined && { showBanner: dto.showBanner }),
        ...(dto.actionUrl !== undefined && { actionUrl: dto.actionUrl }),
        ...(dto.actionLabel !== undefined && { actionLabel: dto.actionLabel }),
        ...(dto.startDate !== undefined && { startDate: dto.startDate ? new Date(dto.startDate) : null }),
        ...(dto.endDate !== undefined && { endDate: dto.endDate ? new Date(dto.endDate) : null }),
        ...(dto.metadata !== undefined && { metadata: dto.metadata }),
        updatedBy,
      },
    });

    return updated;
  }
}

@Injectable()
@CommandHandler(DeleteSystemAnnouncementCommand)
export class DeleteSystemAnnouncementHandler
  implements ICommandHandler<DeleteSystemAnnouncementCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: DeleteSystemAnnouncementCommand) {
    const { id } = command;

    const existing = await this.prisma.systemAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    await this.prisma.systemAnnouncement.delete({ where: { id } });
    return { success: true, id };
  }
}

@Injectable()
@CommandHandler(TogglePublishSystemAnnouncementCommand)
export class TogglePublishSystemAnnouncementHandler
  implements ICommandHandler<TogglePublishSystemAnnouncementCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: TogglePublishSystemAnnouncementCommand) {
    const { id, publish, updatedBy } = command;

    const existing = await this.prisma.systemAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    const updated = await this.prisma.systemAnnouncement.update({
      where: { id },
      data: {
        isPublished: publish,
        publishedAt: publish ? (existing.publishedAt ?? new Date()) : existing.publishedAt,
        updatedBy,
      },
    });

    return updated;
  }
}

@Injectable()
@CommandHandler(GetAdminSystemAnnouncementCommand)
export class GetAdminSystemAnnouncementHandler
  implements ICommandHandler<GetAdminSystemAnnouncementCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GetAdminSystemAnnouncementCommand) {
    const { id } = command;

    const announcement = await this.prisma.systemAnnouncement.findUnique({ where: { id } });
    if (!announcement) throw new NotFoundException(`Announcement ${id} not found`);

    return announcement;
  }
}
