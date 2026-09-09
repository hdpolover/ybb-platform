import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { invalidateLandingCacheByProgramId } from './manage-program-content.handlers';
import {
  GetProgramAnnouncementCommand,
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
  DeleteProgramAnnouncementCommand,
  ListProgramAnnouncementsCommand,
} from '../program-announcement.commands';

@Injectable()
export class ListProgramAnnouncementsHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: ListProgramAnnouncementsCommand) {
    const { programId, category, targetAudience, page, limit, isAdmin } = command;
    const skip = (page - 1) * limit;

    // deletedAt is explicit here (not just relying on PrismaService's
    // auto-inject) because count() below does NOT get the auto-inject that
    // findMany() does, and both must share this where clause.
    const where: Record<string, unknown> = { programId, deletedAt: null };
    if (category) where.category = category;

    if (isAdmin) {
      // Audit M14: admins manage announcements before they go live, so they
      // legitimately need to see drafts, future-scheduled and
      // audience-restricted announcements. Let them filter explicitly.
      if (targetAudience) where.targetAudience = targetAudience;
    } else {
      // Audit M14: this route is @Public()+OptionalJwtAuthGuard, so an
      // anonymous or non-admin caller must only ever see announcements that
      // are genuinely live — matching the filter get-program-detail.handler
      // already applies to its own announcements include. targetAudience is
      // force-set (not just defaulted) so a caller can't bypass this by
      // passing ?targetAudience=participants explicitly.
      where.isActive = true;
      where.publishDate = { lte: new Date() };
      where.targetAudience = 'all';
    }

    const [data, total] = await Promise.all([
      this.prisma.programAnnouncement.findMany({
        where,
        orderBy: [{ isPinned: 'desc' }, { publishDate: 'desc' }],
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
export class GetProgramAnnouncementHandler {
  constructor(private readonly prisma: PrismaService) {}

  async execute(command: GetProgramAnnouncementCommand) {
    const { id } = command;

    const announcement = await this.prisma.programAnnouncement.findUnique({
      where: { id },
    });

    if (!announcement) {
      throw new NotFoundException(`Announcement ${id} not found`);
    }

    return announcement;
  }
}

@Injectable()
export class CreateProgramAnnouncementHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async execute(command: CreateProgramAnnouncementCommand) {
    const { programId, dto, createdBy } = command;

    const program = await this.prisma.program.findUnique({ where: { id: programId } });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);

    const result = await this.prisma.programAnnouncement.create({
      data: {
        programId,
        title: dto.title,
        content: dto.content,
        category: dto.category ?? null,
        targetAudience: dto.targetAudience ?? 'all',
        tags: dto.tags ?? [],
        sendEmail: dto.sendEmail ?? false,
        isPinned: dto.isPinned ?? false,
        imageUrl: dto.imageUrl ?? null,
        publishDate: dto.publishDate ? new Date(dto.publishDate) : new Date(),
        isActive: dto.isActive ?? true,
      },
    });
    // AnnouncementsStrategy reads programAnnouncement directly for the public
    // news feed; this handler previously cleared no cache layer at all.
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);
    return result;
  }
}

@Injectable()
export class UpdateProgramAnnouncementHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async execute(command: UpdateProgramAnnouncementCommand) {
    const { id, dto } = command;

    const existing = await this.prisma.programAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    const result = await this.prisma.programAnnouncement.update({
      where: { id },
      data: {
        ...(dto.title !== undefined && { title: dto.title }),
        ...(dto.content !== undefined && { content: dto.content }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.targetAudience !== undefined && { targetAudience: dto.targetAudience }),
        ...(dto.tags !== undefined && { tags: dto.tags }),
        ...(dto.sendEmail !== undefined && { sendEmail: dto.sendEmail }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.publishDate !== undefined && { publishDate: new Date(dto.publishDate) }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });
    await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
    return result;
  }
}

@Injectable()
export class DeleteProgramAnnouncementHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  async execute(command: DeleteProgramAnnouncementCommand) {
    const { id } = command;

    const existing = await this.prisma.programAnnouncement.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException(`Announcement ${id} not found`);

    await this.prisma.programAnnouncement.delete({ where: { id } });
    await invalidateLandingCacheByProgramId(existing.programId, this.prisma, this.landingCacheInvalidation);
    return { success: true, id };
  }
}
