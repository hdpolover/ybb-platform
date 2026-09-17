import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma, ProgramAnnouncement } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { resolveUniqueSlug } from '../../../../../shared/utils/url-slug';
import { targetFieldsOf } from '../../../../../shared/utils/prisma-error.util';
import { LandingCacheInvalidationService } from '../../../../brands/application/services/landing-cache-invalidation.service';
import { invalidateLandingCacheByProgramId } from './manage-program-content.handlers';
import {
  GetProgramAnnouncementCommand,
  CreateProgramAnnouncementCommand,
  UpdateProgramAnnouncementCommand,
  DeleteProgramAnnouncementCommand,
  ListProgramAnnouncementsCommand,
} from '../program-announcement.commands';

/**
 * True when ANY row holds this slug, soft-deleted rows included.
 *
 * The unique index on program_announcements.slug covers soft-deleted rows, so
 * the check has to as well, or a slug freed by a delete would be handed out
 * again and the insert would hit P2002. That is why this is count() and not
 * findFirst(): PrismaService's soft-delete extension injects deletedAt: null
 * into findUnique/findFirst/findMany, but leaves count() alone.
 */
async function isAnnouncementSlugTaken(
  prisma: PrismaService,
  slug: string,
  excludeId?: string,
): Promise<boolean> {
  const count = await prisma.programAnnouncement.count({
    where: { slug, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return count > 0;
}

function isSlugUniqueViolation(error: unknown): boolean {
  // Duck-typed rather than instanceof, for the reason prisma-error.util.ts gives:
  // a second copy of @prisma/client breaks class identity.
  if ((error as { code?: unknown } | null)?.code !== 'P2002') return false;
  const fields = targetFieldsOf(error as Prisma.PrismaClientKnownRequestError);
  // An unidentifiable target is treated as the slug: it is the only unique
  // column an admin create/update can collide on (legacy_id is never written here).
  return fields.length === 0 || fields.includes('slug');
}

function slugConflict(slug: string): ConflictException {
  return new ConflictException(`The slug "${slug}" is already used by another announcement.`);
}

// Two admins creating same-titled announcements at once can both pass the
// existence check; the loser retries against the now-visible winner.
const MAX_GENERATED_SLUG_ATTEMPTS = 3;

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

    const data = {
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
    };

    const result = dto.slug
      ? await this.createWithExplicitSlug(data, dto.slug)
      : await this.createWithGeneratedSlug(data, dto.title);
    // AnnouncementsStrategy reads programAnnouncement directly for the public
    // news feed; this handler previously cleared no cache layer at all.
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);
    return result;
  }

  // An admin-chosen slug is never silently altered: if it is taken, say so.
  private async createWithExplicitSlug(data: Omit<Prisma.ProgramAnnouncementUncheckedCreateInput, 'slug'>, slug: string) {
    if (await isAnnouncementSlugTaken(this.prisma, slug)) throw slugConflict(slug);
    try {
      return await this.prisma.programAnnouncement.create({ data: { ...data, slug } });
    } catch (error) {
      if (isSlugUniqueViolation(error)) throw slugConflict(slug);
      throw error;
    }
  }

  private async createWithGeneratedSlug(data: Omit<Prisma.ProgramAnnouncementUncheckedCreateInput, 'slug'>, title: string) {
    for (let attempt = 1; ; attempt += 1) {
      const slug = await resolveUniqueSlug(title, (candidate) => isAnnouncementSlugTaken(this.prisma, candidate), {
        fallback: () => `announcement-${randomUUID().slice(0, 8)}`,
      });
      try {
        return await this.prisma.programAnnouncement.create({ data: { ...data, slug } });
      } catch (error) {
        if (!isSlugUniqueViolation(error) || attempt >= MAX_GENERATED_SLUG_ATTEMPTS) throw error;
      }
    }
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

    // Only an explicit, different slug changes it. A title edit deliberately
    // leaves the slug alone: the old URL may already be shared or indexed.
    const nextSlug = dto.slug !== undefined && dto.slug !== existing.slug ? dto.slug : undefined;
    if (nextSlug !== undefined && (await isAnnouncementSlugTaken(this.prisma, nextSlug, id))) {
      throw slugConflict(nextSlug);
    }

    let result: ProgramAnnouncement;
    try {
      result = await this.prisma.programAnnouncement.update({
        where: { id },
        data: {
          ...(nextSlug !== undefined && { slug: nextSlug }),
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
    } catch (error) {
      if (nextSlug !== undefined && isSlugUniqueViolation(error)) throw slugConflict(nextSlug);
      throw error;
    }
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
