import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetProgramDetailQuery } from '../get-program-detail.query';
import { CACHE_KEYS, CACHE_TTL } from '../../../../../shared/constants/cache-keys';
import { buildFileUrlMaskMap, extractFileIdFromDownloadUrl } from '@shared/utils/masked-file-url';

@Injectable()
export class GetProgramDetailHandler {
  private readonly logger = new Logger(GetProgramDetailHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async execute(query: GetProgramDetailQuery) {
    const {
      identifier,
      include = 'all',
      isAdmin = false,
    } = query;
    let {
      testimonialsLimit = 10,
      announcementsLimit = 10,
      resourcesLimit = 10,
    } = query;

    // Generate cache key. isAdmin is part of the key (not just the where clause
    // below) because the admin and public responses for the SAME identifier
    // differ — an admin response can include a draft program and non-public
    // resources. Without isAdmin in the key, whichever caller hit this
    // identifier first would poison the cache for the other (audit M13).
    const cacheKey = CACHE_KEYS.PROGRAM_DETAIL(
      `${identifier}:${include}:${testimonialsLimit}:${announcementsLimit}:${resourcesLimit}:${isAdmin}`,
    );

    // Sanitize limits (handle NaN)
    if (isNaN(testimonialsLimit)) testimonialsLimit = 10;
    if (isNaN(announcementsLimit)) announcementsLimit = 10;
    if (isNaN(resourcesLimit)) resourcesLimit = 10;
    
    // Ensure they are numbers
    testimonialsLimit = Number(testimonialsLimit);
    announcementsLimit = Number(announcementsLimit);
    resourcesLimit = Number(resourcesLimit);

    // Try to get from cache
    const cached = await this.cacheManager.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Determine if identifier is UUID or slug
    const isUUID =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
        identifier,
      );

    const where = isUUID ? { id: identifier } : { slug: identifier };

    // Build include object based on requested data
    const includeRelations = this.buildIncludeObject(
      include,
      testimonialsLimit,
      announcementsLimit,
      resourcesLimit,
      isAdmin,
    );

    // Audit M13: a non-admin caller (anonymous, or authenticated without an
    // admin role) must get a 404 for a draft/unpublished/hidden program
    // identical to the 404 for an identifier that doesn't exist at all — no
    // existence leak via a different response shape. Admin callers are
    // unaffected: this controller's other routes already gate program
    // mutation on ADMIN/SUPER_ADMIN, so an admin here legitimately needs to
    // see drafts (e.g. previewing before publish).
    const publicOnlyWhere = isAdmin ? {} : { isPublished: true, isVisibleToUsers: true };

    const program = await this.prisma.program.findFirst({
      where: {
        ...where,
        ...publicOnlyWhere,
        deletedAt: null,
      },
      include: includeRelations,
    });

    if (!program) {
      throw new NotFoundException(
        `Program with ${isUUID ? 'ID' : 'slug'} "${identifier}" not found`,
      );
    }

    // Transform response
    const result = await this.transformResponse(program, include);

    // Cache the result for 5 minutes
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.MEDIUM);

    return result;
  }

  private buildIncludeObject(
    include: string,
    testimonialsLimit: number,
    announcementsLimit: number,
    resourcesLimit: number,
    isAdmin: boolean,
  ) {
    const now = new Date();

    // Basic includes (always included)
    const basic = {
      brand: {
        select: {
          id: true,
          name: true,
          slug: true,
          websiteUrl: true,
          logoUrl: true,
          about: true,
        },
      },
    };

    if (include === 'basic') {
      return basic;
    }

    // Build full includes
    const includes: Record<string, unknown> = { ...basic };

    /*
    if (include === 'all' || include === 'payments') {
      includes.payments = {
        where: { isActive: true },
        include: {
          periods: {
            where: { isActive: true },
            orderBy: { order: 'asc' },
          },
        },
        orderBy: { order: 'asc' },
      };
    }
    */

    if (include === 'all' || include === 'content') {
      includes.faqs = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.speakers = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.timeline = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.schedules = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.gallery = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
    }

    if (include === 'all' || include === 'testimonials') {
      includes.testimonials = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
        take: testimonialsLimit, // Pagination
      };
    }

    if (include === 'all' || include === 'team') {
      includes.partners = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.team = {
        where: { isActive: true, programId: { not: null } },
        orderBy: { order: 'asc' },
      };
    }

    if (include === 'all' || include === 'requirements') {
      includes.requirements = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.formFields = {
        where: { isActive: true },
        orderBy: { order: 'asc' },
      };
      includes.participationCategories = {
        where: { isActive: true, deletedAt: null },
        orderBy: { order: 'asc' },
      };
    }

    if (include === 'all') {
      includes.resources = {
        // Audit M13: this used to fetch isPublic:true AND isPublic:false with a
        // comment promising the controller would filter by auth — it never did,
        // so every anonymous caller received non-public resources verbatim.
        // isAdmin now comes from the resolved caller (OptionalJwtAuthGuard), so
        // a non-admin's query is scoped to public resources at the DB level
        // rather than trusting a later filter step that doesn't exist.
        where: isAdmin
          ? { isActive: true }
          : { isActive: true, isPublic: true },
        orderBy: { order: 'asc' },
        take: resourcesLimit, // Pagination
      };
      includes.programAnnouncements = {
        where: {
          isActive: true,
          targetAudience: 'all',
          publishDate: { lte: now },
        },
        orderBy: [{ isPinned: 'desc' }, { publishDate: 'desc' }],
        take: announcementsLimit, // Pagination
      };
      includes.tags = {
        include: {
          tag: true,
        },
      };
    }

    return includes;
  }

  private async transformResponse(program: Record<string, unknown>, include: string) {
    const now = new Date();

    const response: Record<string, unknown> = {
      id: program.id,
      name: program.name,
      slug: program.slug,
      description: program.description,
      shortDescription: program.shortDescription,
      year: program.year,
      theme: program.theme,
      programType: program.programType,
      programFormat: program.programFormat,
      startDate: program.startDate,
      endDate: program.endDate,
      applicationDeadline: program.applicationDeadline,
      isPublished: program.isPublished,
      isActive: program.isActive,
      registrationOpenDate: program.registrationOpenDate,
      registrationCloseDate: program.registrationCloseDate,
      location: program.location,
      thumbnailUrl: program.thumbnailUrl,
      bannerUrl: program.bannerUrl,
      logoUrl: program.logoUrl,
      videoUrl: program.videoUrl,
      status: program.status,
      isVisibleToUsers: program.isVisibleToUsers,
      allowRegistration: program.allowRegistration,
      requireEmailVerification: program.requireEmailVerification,
      requirePayment: program.requirePayment,
      currency: program.currency,
      usdInIdr: program.usdInIdr ? Number(program.usdInIdr) : null,
      requirementsDescription: program.requirementsDescription,
      benefitsDescription: program.benefitsDescription,
      termsAndConditions: program.termsAndConditions,
      previewChecklistItems: program.previewChecklistItems,
      metaTitle: program.metaTitle,
      metaDescription: program.metaDescription,
      brand: program.brand,
      createdAt: program.createdAt,
      updatedAt: program.updatedAt,
    };

    // Transform other relations
    if (program.faqs) {
      response.faqs = program.faqs;
    }

    if (program.speakers) {
      response.speakers = program.speakers;
    }

    if (program.timeline) {
      response.timeline = program.timeline;
    }

    if (program.schedules) {
      response.schedules = program.schedules;
    }

    if (program.testimonials) {
      response.testimonials = (program.testimonials as { rating: unknown }[]).map((t) => ({
        ...t,
        rating: t.rating ? Number(t.rating) : null,
      }));
    }

    if (program.requirements) {
      response.requirements = program.requirements;
    }

    if (program.formFields) {
      response.formFields = program.formFields;
    }

    if (program.participationCategories) {
        response.participationCategories = program.participationCategories;
    }

    if (program.partners) {
      response.partners = program.partners;
    }

    if (program.resources) {
      const resources = program.resources as Array<{ fileSize: unknown; fileUrl?: string | null }>;
      const fileUrlMap = await buildFileUrlMaskMap(
        this.prisma,
        resources
          .map((resource) => resource.fileUrl)
          .filter((fileUrl): fileUrl is string => typeof fileUrl === 'string' && fileUrl.trim().length > 0),
      );

      response.resources = resources.map((r) => {
        const rawUrl = typeof r.fileUrl === 'string' ? r.fileUrl : null;
        const maskedByRaw = rawUrl ? fileUrlMap.get(rawUrl) : null;
        const idFromMaskedUrl = rawUrl ? extractFileIdFromDownloadUrl(rawUrl) : null;
        const maskedById = idFromMaskedUrl ? fileUrlMap.get(idFromMaskedUrl) : null;

        return {
          ...r,
          fileUrl: maskedByRaw ?? maskedById ?? rawUrl,
          fileSize: r.fileSize ? Number(r.fileSize) : null,
        };
      });
    }

    if (program.tags) {
      response.tags = (program.tags as { tag: unknown }[]).map((t) => t.tag);
    }

    if (program.programAnnouncements) {
      response.announcements = program.programAnnouncements;
    }

    return response;
  }
}
