import { Injectable, NotFoundException, Inject, Logger } from '@nestjs/common';
import { CACHE_MANAGER, Cache } from '@nestjs/cache-manager';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetProgramDetailQuery } from '../get-program-detail.query';
import { CACHE_KEYS, CACHE_TTL } from '../../../../../shared/constants/cache-keys';

@Injectable()
export class GetProgramDetailHandler {
  private readonly logger = new Logger(GetProgramDetailHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private readonly cacheManager: Cache,
  ) { }

  async execute(query: GetProgramDetailQuery) {
    let {
      identifier,
      include = 'all',
      testimonialsLimit = 10,
      announcementsLimit = 10,
      resourcesLimit = 10,
    } = query;

    // Generate cache key
    const cacheKey = CACHE_KEYS.PROGRAM_DETAIL(
      `${identifier}:${include}:${testimonialsLimit}:${announcementsLimit}:${resourcesLimit}`,
    );

    // Sanitize limits (handle NaN)
    if (isNaN(testimonialsLimit)) testimonialsLimit = 10;
    if (isNaN(announcementsLimit)) announcementsLimit = 10;
    if (isNaN(resourcesLimit)) resourcesLimit = 10;
    
    // Ensure they are numbers
    testimonialsLimit = Number(testimonialsLimit);
    announcementsLimit = Number(announcementsLimit);
    resourcesLimit = Number(resourcesLimit);

    this.logger.debug(`GetProgramDetailHandler limits sanitized: ${JSON.stringify({ testimonialsLimit, announcementsLimit, resourcesLimit })}`);

    console.log('DEBUG: GetProgramDetailHandler limits sanitized:', { testimonialsLimit, announcementsLimit, resourcesLimit });

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
    );

    const program = await this.prisma.program.findFirst({
      where: {
        ...where,
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
    const result = this.transformResponse(program, include);

    // Cache the result for 5 minutes
    await this.cacheManager.set(cacheKey, result, CACHE_TTL.MEDIUM);

    return result;
  }

  private buildIncludeObject(
    include: string,
    testimonialsLimit: number,
    announcementsLimit: number,
    resourcesLimit: number,
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
        orderBy: { order: 'asc' },
      };
    }

    if (include === 'all') {
      includes.resources = {
        where: {
          isActive: true,
          OR: [{ isPublic: true }, { isPublic: false }], // Include all for now, filter in controller based on auth
        },
        orderBy: { order: 'asc' },
        take: resourcesLimit, // Pagination
      };
      includes.programAnnouncements = {
        where: {
          isActive: true,
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

  private transformResponse(program: Record<string, unknown>, include: string) {
    const now = new Date();

    const response: Record<string, unknown> = {
      id: program.id,
      name: program.name,
      slug: program.slug,
      description: program.description,
      shortDescription: program.shortDescription,
      programType: program.programType,
      programFormat: program.programFormat,
      startDate: program.startDate,
      endDate: program.endDate,
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

    /*
    // Transform payments with current period info
    if (program.payments) {
      response.payments = program.payments.map((payment: any) => {
        const currentPeriod = payment.periods.find(
          (p: any) =>
            p.isActive && new Date(p.startDate) <= now && new Date(p.endDate) >= now,
        );

        return {
          id: payment.id,
          name: payment.name,
          description: payment.description,
          paymentType: payment.paymentType,
          amount: Number(payment.amount),
          currency: payment.currency,
          isRequired: payment.isRequired,
          order: payment.order,
          periods: payment.periods.map((p: any) => ({
            id: p.id,
            name: p.name,
            startDate: p.startDate,
            endDate: p.endDate,
            amount: p.amount ? Number(p.amount) : Number(payment.amount),
            isActive: p.isActive,
          })),
          currentPeriod: currentPeriod
            ? {
              id: currentPeriod.id,
              name: currentPeriod.name,
              startDate: currentPeriod.startDate,
              endDate: currentPeriod.endDate,
              amount: currentPeriod.amount
                ? Number(currentPeriod.amount)
                : Number(payment.amount),
              isActive: currentPeriod.isActive,
            }
            : null,
          isCurrentlyAvailable: !!currentPeriod,
        };
      });

      // Calculate total cost based on current periods
      response.totalCost = response.payments.reduce((sum: number, p: any) => {
        const amount = p.currentPeriod ? p.currentPeriod.amount : p.amount;
        return sum + amount;
      }, 0);
    }
    */

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
      response.resources = (program.resources as { fileSize: unknown }[]).map((r) => ({
        ...r,
        fileSize: r.fileSize ? Number(r.fileSize) : null,
      }));
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
