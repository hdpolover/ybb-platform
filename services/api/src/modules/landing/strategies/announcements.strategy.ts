import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand, Prisma } from '@prisma/client';
import { LandingSnapshotService } from '../services/landing-snapshot.service';
import { buildRichTextPreview } from '@shared/utils/rich-text';
import { isUuid } from '@shared/utils/url-slug';
import {
  DEFAULT_ANNOUNCEMENTS_LIMIT,
  MAX_ANNOUNCEMENTS_LIMIT,
  ListAnnouncementsQueryDto,
} from '../dto/landing-announcements-query.dto';

const MAX_SYSTEM_ANNOUNCEMENTS = 10;
const MAX_FACET_SAMPLE = 1000;
const MAX_FACET_TAGS = 20;
// Unlike MAX_FACET_SAMPLE (a tag/category *popularity* sample, where dropping
// the tail is harmless), the year selector must never silently omit a year —
// a missing option looks like "no announcements that year" to the frontend.
// Each row here is a single DateTime column, so this cap is generous rather
// than a real-world ceiling.
const MAX_YEAR_SAMPLE = 20000;
// Matches program_announcements.slug VarChar(255); anything longer cannot exist,
// so it is rejected before it reaches the database or the cache key.
const MAX_ANNOUNCEMENT_KEY_LENGTH = 255;

interface AnnouncementFilters {
  search?: string;
  category?: string;
  tag?: string;
  programId?: string;
  year?: number;
}

interface AnnouncementEditionOption {
  id: string;
  title: string;
}

// Response shape for the "filters" block of the announcement list payload —
// the available options the frontend renders as facets (category/tag pickers,
// the program/edition select, and now the year select). All fields are
// always computed and always present, even when empty.
export interface AnnouncementFilterValues {
  categories: string[];
  tags: string[];
  programs: AnnouncementEditionOption[];
  // Distinct calendar years with at least one visible announcement, sorted
  // descending. Computed from the SAME brand/visibility scope as the list,
  // but never narrowed by the currently-active search/category/tag/programId/
  // year filters — see the facetRows/editionPrograms/year-sample queries.
  years: number[];
}

export interface MappedAnnouncement {
  [key: string]: unknown;
  id: string;
  // Program announcements only. System announcements have no slug and are
  // addressed by id; the frontend falls back to the id when this is null.
  slug: string | null;
  title: string;
  excerpt: string;
  content: string;
  image: string | null;
  author: string | null;
  date: Date | null;
  href: string | null;
  category: string;
  tags: string[];
}

@Injectable()
export class AnnouncementsStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly landingSnapshotService: LandingSnapshotService,
  ) { }

  // ILandingPageStrategy interface requirement — default unfiltered page 1.
  async getData(category: Brand | null) {
    return this.getAnnouncements(category, {});
  }

  async getAnnouncements(category: Brand | null, query: ListAnnouncementsQueryDto) {
    const pageNum = this.normalizePage(query.page);
    const limitNum = this.normalizeLimit(query.limit);
    const filters: AnnouncementFilters = {
      search: query.search?.trim() || undefined,
      category: query.category?.trim() || undefined,
      tag: query.tag?.trim() || undefined,
      programId: query.programId?.trim() || undefined,
      year: query.year,
    };

    const isDefaultView = this.isDefaultView(pageNum, limitNum, filters);

    if (category && isDefaultView) {
      return this.landingSnapshotService.getOrBuildAnnouncementsSnapshot(
        category,
        () => this.buildAnnouncementsPayload(category, pageNum, limitNum, filters),
      );
    }

    if (!category && isDefaultView) {
      const cacheKey = CACHE_KEYS.LANDING_ANNOUNCEMENTS('default');
      const cached = await this.cacheService.get(cacheKey);
      if (cached) {
        return cached;
      }

      const result = await this.buildAnnouncementsPayload(category, pageNum, limitNum, filters);
      await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
      return result;
    }

    const cacheKey = CACHE_KEYS.LANDING_ANNOUNCEMENTS_LIST(
      category?.id ?? 'default',
      pageNum,
      limitNum,
      filters.search ?? '',
      filters.category ?? '',
      filters.tag ?? '',
      filters.programId ?? '',
      filters.year ? String(filters.year) : '',
    );
    const cached = await this.cacheService.get(cacheKey);
    if (cached) {
      return cached;
    }

    const result = await this.buildAnnouncementsPayload(category, pageNum, limitNum, filters);
    await this.cacheService.set(cacheKey, result, CACHE_TTL.LONG);
    return result;
  }

  /**
   * One announcement for /announcements/<key>, where key is a slug or, for old
   * links and system announcements, a UUID id.
   *
   * Visibility is exactly the list's: a program announcement must be active,
   * published (publishDate <= now), audience 'all', not deleted, and belong to a
   * published + visible program of this brand. A system announcement must be
   * published, not deleted, and either global or this brand's. Anything the
   * list would not show returns null, so a draft cannot be read by guessing
   * its slug.
   *
   * Only hits are cached. Caching misses would let arbitrary URLs mint Redis
   * keys, and a scheduled announcement going live would stay 404 until the TTL.
   * The key sits under landing:announcements:<brand>: so every existing
   * announcement/brand invalidation already clears it.
   */
  async getAnnouncementDetail(category: Brand | null, rawKey: string): Promise<MappedAnnouncement | null> {
    const key = (rawKey ?? '').trim();
    if (!key || key.length > MAX_ANNOUNCEMENT_KEY_LENGTH) return null;

    const cacheKey = CACHE_KEYS.LANDING_ANNOUNCEMENT_DETAIL(category?.id ?? 'default', key);
    const cached = await this.cacheService.get<MappedAnnouncement>(cacheKey);
    if (cached) return cached;

    const found = await this.findAnnouncementDetail(category, key);
    if (found) {
      await this.cacheService.set(cacheKey, found, CACHE_TTL.LONG);
    }
    return found;
  }

  private async findAnnouncementDetail(category: Brand | null, key: string): Promise<MappedAnnouncement | null> {
    const now = new Date();
    const byId = isUuid(key);
    // Lowercased so the cache entry and the query agree on one canonical id.
    const lookup = byId ? { id: key.toLowerCase() } : { slug: key };

    const programAnnouncement = await this.prisma.programAnnouncement.findFirst({
      where: {
        ...lookup,
        ...this.publicProgramAnnouncementWhere(category, now),
      },
      include: {
        program: {
          select: { name: true, slug: true },
        },
      },
    });
    if (programAnnouncement) return this.mapProgramAnnouncement(programAnnouncement);

    if (!byId) return null;

    const systemAnnouncement = await this.prisma.systemAnnouncement.findFirst({
      where: {
        id: key.toLowerCase(),
        isPublished: true,
        deletedAt: null,
        OR: [{ brandId: category?.id ?? undefined }, { brandId: null }],
      },
    });
    return systemAnnouncement ? this.mapSystemAnnouncement(systemAnnouncement) : null;
  }

  // Shared by the list and the detail lookup so the two can never disagree
  // about what the public may see.
  private publicProgramWhere(category: Brand | null): Prisma.ProgramWhereInput {
    return {
      ...(category?.id ? { brandId: category.id } : {}),
      isPublished: true,
      isVisibleToUsers: true,
    };
  }

  private publicProgramAnnouncementWhere(category: Brand | null, now: Date): Prisma.ProgramAnnouncementWhereInput {
    return {
      isActive: true,
      deletedAt: null,
      targetAudience: 'all',
      publishDate: { lte: now },
      program: this.publicProgramWhere(category),
    };
  }

  private mapSystemAnnouncement(
    announcement: Prisma.SystemAnnouncementGetPayload<Record<string, never>>,
  ): MappedAnnouncement {
    const meta = (announcement.metadata as Record<string, unknown>) ?? {};
    const tags = this.extractSystemTags(meta);

    return {
      id: announcement.id,
      slug: null,
      title: announcement.title,
      excerpt: announcement.summary ?? buildRichTextPreview(announcement.content, 160),
      content: announcement.content,
      image: (meta.imageUrl as string) ?? null,
      author: (meta.author as string) ?? null,
      date: announcement.publishedAt,
      href: announcement.actionUrl ?? null,
      category: announcement.type,
      tags,
    };
  }

  private mapProgramAnnouncement(
    announcement: Prisma.ProgramAnnouncementGetPayload<{ include: { program: { select: { name: true; slug: true } } } }>,
  ): MappedAnnouncement {
    return {
      id: announcement.id,
      slug: announcement.slug,
      title: announcement.title,
      excerpt: buildRichTextPreview(announcement.content, 160),
      content: announcement.content,
      image: announcement.imageUrl,
      author: announcement.program.name,
      date: announcement.publishDate,
      href: announcement.program.slug ? `/programs/${announcement.program.slug}` : null,
      category: announcement.category ?? 'general',
      tags: announcement.tags,
    };
  }

  private normalizePage(page?: number): number {
    const raw = Number(page);
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 1;
  }

  private normalizeLimit(limit?: number): number {
    const raw = Number(limit);
    return Number.isFinite(raw) && raw > 0
      ? Math.min(Math.floor(raw), MAX_ANNOUNCEMENTS_LIMIT)
      : DEFAULT_ANNOUNCEMENTS_LIMIT;
  }

  private isDefaultView(page: number, limit: number, filters: AnnouncementFilters): boolean {
    return (
      page === 1 &&
      limit === DEFAULT_ANNOUNCEMENTS_LIMIT &&
      !filters.search &&
      !filters.category &&
      !filters.tag &&
      !filters.programId &&
      !filters.year
    );
  }

  private yearRange(year?: number): { gte: Date; lt: Date } | undefined {
    if (!year) return undefined;
    return {
      gte: new Date(Date.UTC(year, 0, 1)),
      lt: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }

  /**
   * PAGINATION STRATEGY (two source tables merged then sorted by date):
   *
   * Real skip/take pagination is scoped to ProgramAnnouncement only, which is
   * ordered deterministically ([isPinned desc, publishDate desc, id asc] —
   * the id tiebreak guarantees a stable total order even when many rows share
   * a publishDate). Iterating pages 1..N over that single query, with that
   * one ordering, is provably correct: every row appears on exactly one page,
   * in exactly one position, no matter how dates interleave.
   *
   * SystemAnnouncement is a small, largely static set (capped at 10) that is
   * fetched only for page 1 and merged into that page's items — never
   * counted in `total`/`total_pages`, and never present on page 2+. This is
   * option (a) from the pagination spec, not option (b) (a raw SQL UNION
   * with one ORDER BY/LIMIT/OFFSET across both tables). (b) would make
   * system + program announcements strictly co-paginated (truly interleaved
   * by date on every page), which is more "correct" in the abstract, but:
   *   - it requires hand-written SQL bypassing Prisma's typed query builder
   *     for both filtering and the count query, doubling the surface area
   *     for a filter-parity bug between the SQL and the ORM path;
   *   - system announcements are global chrome (~10 rows), not paged
   *     content — spreading them thinly across dozens of program-announcement
   *     pages actively hurts UX (a user on page 4 would rarely see one);
   *   - it would need its own tiebreak scheme across two id columns from two
   *     tables, which is exactly the kind of subtle bug this task warns
   *     about.
   * Given system announcements are small and static, (a) is simpler while
   * remaining provably correct for the table that actually needs paging.
   */
  private async buildAnnouncementsPayload(
    category: Brand | null,
    pageNum: number,
    limitNum: number,
    filters: AnnouncementFilters,
  ) {
    const now = new Date();
    const range = this.yearRange(filters.year);

    // News is brand-level: show announcements from every program in the brand that is
    // published and visible on the website, including completed/past editions. We gate on
    // isVisibleToUsers (NOT isActive) so past programs — which stop accepting applications
    // and therefore have isActive=false — still surface their news.
    const programWhere = this.publicProgramWhere(category);

    const programAnnouncementWhere: Prisma.ProgramAnnouncementWhereInput = {
      ...this.publicProgramAnnouncementWhere(category, now),
      publishDate: { lte: now, ...(range ? { gte: range.gte, lt: range.lt } : {}) },
      program: filters.programId ? { ...programWhere, id: filters.programId } : programWhere,
      ...(filters.category ? { category: { equals: filters.category, mode: 'insensitive' } } : {}),
      ...(filters.tag ? { tags: { hasSome: [filters.tag] } } : {}),
      ...(filters.search
        ? {
          OR: [
            { title: { contains: filters.search, mode: 'insensitive' } },
            { content: { contains: filters.search, mode: 'insensitive' } },
          ],
        }
        : {}),
    };

    const systemAnnouncementWhere: Prisma.SystemAnnouncementWhereInput = {
      isPublished: true,
      deletedAt: null,
      AND: [
        { OR: [{ brandId: category?.id ?? undefined }, { brandId: null }] },
        ...(filters.programId ? [{ programId: filters.programId }] : []),
        ...(range ? [{ publishedAt: { gte: range.gte, lt: range.lt } }] : []),
        ...(filters.search
          ? [{
            OR: [
              { title: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
              { content: { contains: filters.search, mode: Prisma.QueryMode.insensitive } },
            ],
          }]
          : []),
      ],
    };

    const systemAnnouncementsQuery: Promise<Prisma.SystemAnnouncementGetPayload<Record<string, never>>[]> =
      pageNum === 1
        ? this.prisma.systemAnnouncement.findMany({
          where: systemAnnouncementWhere,
          orderBy: { publishedAt: 'desc' },
          take: MAX_SYSTEM_ANNOUNCEMENTS,
        })
        : Promise.resolve([]);

    // Same base visibility scope as the facet sample above (brand + published
    // program only) — no category/tag/programId/search/year filter applied,
    // so the year select always offers every year the caller could pick.
    const publicProgramAnnouncementBaseWhere: Prisma.ProgramAnnouncementWhereInput = {
      isActive: true,
      deletedAt: null,
      targetAudience: 'all',
      publishDate: { lte: now },
      program: programWhere,
    };

    // Mirrors systemAnnouncementWhere's brand/publication scope only — no
    // programId/range/search filter — for the same reason.
    const systemAnnouncementYearsWhere: Prisma.SystemAnnouncementWhereInput = {
      isPublished: true,
      deletedAt: null,
      OR: [{ brandId: category?.id ?? undefined }, { brandId: null }],
    };

    const [
      systemAnnouncementsRaw,
      programAnnouncements,
      programAnnouncementsTotal,
      facetRows,
      editionPrograms,
      programYearRows,
      systemYearRows,
    ] = await Promise.all([
      systemAnnouncementsQuery,
      this.prisma.programAnnouncement.findMany({
        where: programAnnouncementWhere,
        orderBy: [{ isPinned: 'desc' }, { publishDate: 'desc' }, { id: 'asc' }],
        skip: (pageNum - 1) * limitNum,
        take: limitNum,
        include: {
          program: {
            select: { name: true, slug: true },
          },
        },
      }),
      this.prisma.programAnnouncement.count({ where: programAnnouncementWhere }),
      // Facet sample is intentionally brand-scoped only (not filtered by the
      // current request's category/tag/programId/search/year) so the
      // available-filter-values list doesn't shrink as the caller narrows
      // their own query — it always reflects everything they *could* pick.
      this.prisma.programAnnouncement.findMany({
        where: publicProgramAnnouncementBaseWhere,
        select: { category: true, tags: true },
        take: MAX_FACET_SAMPLE,
      }),
      this.prisma.program.findMany({
        where: programWhere,
        select: { id: true, name: true, year: true },
      }),
      // Year facet sample — same base scope as facetRows above, but unbounded
      // (a single DateTime column per row is cheap) so no year is ever
      // dropped just because it fell outside a popularity-style sample cap.
      this.prisma.programAnnouncement.findMany({
        where: publicProgramAnnouncementBaseWhere,
        select: { publishDate: true },
        take: MAX_YEAR_SAMPLE,
      }),
      this.prisma.systemAnnouncement.findMany({
        where: systemAnnouncementYearsWhere,
        select: { publishedAt: true },
        take: MAX_YEAR_SAMPLE,
      }),
    ]);

    // category/tag matching against SystemAnnouncement happens in-memory: `type` is a
    // fixed enum (not the free-text `category` values content editors actually use) and
    // tags live inside the JSON `metadata` blob, neither of which Prisma can filter at the
    // DB level for this model. The set is capped at 10 rows so this is cheap.
    const systemAnnouncements = systemAnnouncementsRaw.filter((announcement) => {
      const meta = (announcement.metadata as Record<string, unknown>) ?? {};
      const tags = this.extractSystemTags(meta);

      if (filters.category && announcement.type.toLowerCase() !== filters.category.toLowerCase()) {
        return false;
      }
      if (filters.tag && !tags.some((t) => t.toLowerCase() === filters.tag!.toLowerCase())) {
        return false;
      }
      return true;
    });

    const mappedSystem: MappedAnnouncement[] = systemAnnouncements.map((announcement) =>
      this.mapSystemAnnouncement(announcement),
    );

    const mappedProgram: MappedAnnouncement[] = programAnnouncements.map((announcement) =>
      this.mapProgramAnnouncement(announcement),
    );

    // Page 1 merges the (small, unpaginated) system feed into the paginated program
    // feed and re-sorts by date, matching the pre-pagination merge behavior. Page 2+
    // is program announcements only, already in correct DB order — see the
    // PAGINATION STRATEGY note above for why this is still gap/duplicate free.
    const pageAnnouncements = pageNum === 1
      ? [...mappedSystem, ...mappedProgram].sort((left, right) => {
        const leftTime = left.date ? new Date(left.date).getTime() : 0;
        const rightTime = right.date ? new Date(right.date).getTime() : 0;
        return rightTime - leftTime;
      })
      : mappedProgram;

    const total = programAnnouncementsTotal;
    const totalPages = limitNum > 0 ? Math.ceil(total / limitNum) : 0;

    const result = {
      slug: 'announcements',
      title: 'Announcements',
      sections: [
        {
          type: 'hero',
          content: {
            headline: 'Latest News & Updates',
            subheadline: 'Stay informed about our latest activities and opportunities.',
          },
        },
        {
          type: 'announcement_list',
          data: pageAnnouncements,
          content: {
            pagination: {
              total,
              page: pageNum,
              limit: limitNum,
              total_pages: totalPages,
            },
            filters: this.buildFilterValues(
              facetRows,
              editionPrograms,
              this.computeAvailableYears(programYearRows, systemYearRows),
            ),
          },
        },
      ],
    };
    return result;
  }

  private extractSystemTags(meta: Record<string, unknown>): string[] {
    return Array.isArray(meta.tags)
      ? meta.tags.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0)
      : [];
  }

  private buildFilterValues(
    facetRows: Array<{ category: string | null; tags: string[] }>,
    editionPrograms: Array<{ id: string; name: string; year: number }>,
    years: number[],
  ): AnnouncementFilterValues {
    const categoryByKey = new Map<string, string>();
    const tagCounts = new Map<string, number>();

    for (const row of facetRows) {
      const normalizedCategory = this.normalizeCategoryLabel(row.category);
      if (normalizedCategory) {
        categoryByKey.set(normalizedCategory.toLowerCase(), normalizedCategory);
      }
      for (const tag of row.tags) {
        const trimmed = tag.trim();
        if (!trimmed) continue;
        const key = trimmed.toLowerCase();
        tagCounts.set(key, (tagCounts.get(key) ?? 0) + 1);
      }
    }

    const categories = [...categoryByKey.values()].sort((a, b) => a.localeCompare(b));
    const tags = [...tagCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_FACET_TAGS)
      .map(([tag]) => tag);

    return {
      categories,
      tags,
      programs: this.sortEditionPrograms(editionPrograms).map((program) => ({
        id: program.id,
        title: program.name,
      })),
      years,
    };
  }

  private normalizeCategoryLabel(raw: string | null): string | null {
    const trimmed = raw?.trim();
    if (!trimmed) return null;
    return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
  }

  // Year desc, then title asc — with yearless/"(Archive)"-style entries
  // always sorted last regardless of what a numeric year comparison would
  // otherwise say. Program.year is a required column today, but the
  // null/undefined guard is kept defensively rather than assumed away.
  private sortEditionPrograms<T extends { name: string; year: number | null | undefined }>(programs: T[]): T[] {
    const isArchived = (program: T) => program.year == null || /\(archive\)/i.test(program.name);

    return [...programs].sort((left, right) => {
      const leftArchived = isArchived(left);
      const rightArchived = isArchived(right);
      if (leftArchived !== rightArchived) return leftArchived ? 1 : -1;
      if (!leftArchived && !rightArchived && left.year !== right.year) {
        return (right.year as number) - (left.year as number);
      }
      return left.name.localeCompare(right.name);
    });
  }

  // Distinct calendar years across program announcements (publishDate) and
  // system announcements (publishedAt, nullable — unpublished-date rows
  // contribute no year), merged and sorted descending.
  private computeAvailableYears(
    programYearRows: Array<{ publishDate: Date }>,
    systemYearRows: Array<{ publishedAt: Date | null }>,
  ): number[] {
    const years = new Set<number>();

    for (const row of programYearRows) {
      years.add(row.publishDate.getUTCFullYear());
    }
    for (const row of systemYearRows) {
      if (row.publishedAt) {
        years.add(row.publishedAt.getUTCFullYear());
      }
    }

    return [...years].sort((a, b) => b - a);
  }
}
