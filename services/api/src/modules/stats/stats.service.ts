
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaReadService } from '../../shared/infrastructure/prisma/prisma-read.service';
import { GetStatsQueryDto, StatSection } from './dto/get-stats.dto';
import { ApplicationStatus, Brand } from '@prisma/client';
import { StatsResponseDto, ParticipantGeographyItemDto } from './dto/stats-response.dto';
import { ProgramDashboardResponseDto } from './dto/program-dashboard-response.dto';
import { ProgramAnalyticsResponseDto } from './dto/program-analytics-response.dto';

import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants/cache-keys';
import { normalizeCountryGroups, resolveCountryName } from '@shared/utils/country-groups';
import { resolveUsdInIdrRate } from '../portal/application/utils/resolve-usd-in-idr-rate';

type ProgramDashboardApplication = {
  createdAt: Date;
  lastEditedAt: Date | null;
  submittedAt: Date | null;
  status: ApplicationStatus;
  participant: {
    gender: 'male' | 'female' | null;
    birthdate: Date | null;
    originCountry: string | null;
    nationality: string | null;
    profileCompletedAt: Date | null;
  };
};

@Injectable()
export class StatsService {
  constructor(
    private readonly readPrisma: PrismaReadService,
    private readonly cacheService: CacheService,
  ) { }

  async getStats(query: GetStatsQueryDto): Promise<StatsResponseDto> {
    const category = await this.resolveContext(query);

    // If no context found and not global admin (which we assume isn't the case for public endpoint), 
    // return empty stats or throw. For now, returning zeros if no category found.
    if (!category) {
      return {
        impact: { total_participants: 0, total_countries: 0, alumni: 0 },
        geography: { items: [], meta: { total: 0, page: 1, limit: 20, totalPages: 0 } },
      };
    }

    // Generate cache key based on brand and query parameters
    const queryParams = JSON.stringify(query);
    const cacheKey = CACHE_KEYS.STATS_DASHBOARD(category.id, queryParams);

    // Try to get from cache
    const cachedStats = await this.cacheService.get<StatsResponseDto>(cacheKey);
    if (cachedStats) {
      return cachedStats;
    }

    const response: StatsResponseDto = {};
    const sections = query.sections || Object.values(StatSection);

    if (sections.includes(StatSection.IMPACT)) {
      response.impact = await this.getImpactStats(category.id);
    }

    if (sections.includes(StatSection.GEOGRAPHY)) {
      response.geography = await this.getGeographyStats(category.id, query.page || 1, query.limit || 20);
    }

    // Cache the result for 5 minutes (MEDIUM TTL)
    await this.cacheService.set(cacheKey, response, CACHE_TTL.MEDIUM);

    return response;
  }

  private async resolveContext(query: GetStatsQueryDto): Promise<Brand | null> {
    if (query.brandId) {
      return this.readPrisma.brand.findUnique({ where: { id: query.brandId } });
    }

    if (query.url) {
      // Reusing logic from landing service strategy - find by url
      let category = await this.readPrisma.brand.findFirst({
        where: { websiteUrl: query.url, isActive: true },
      });

      if (!category) {
        category = await this.readPrisma.brand.findFirst({
          where: { websiteUrl: { contains: query.url, mode: 'insensitive' }, isActive: true },
        });
      }
      return category;
    }

    // Default fallbacks if needed, or return null
    return this.readPrisma.brand.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async getImpactStats(categoryId: string) {
    const [totalParticipants, alumni, totalCountries] = await Promise.all([
      this.readPrisma.participant.count({
        where: { user: { brandId: categoryId, deletedAt: null }, deletedAt: null },
      }),
      this.readPrisma.participantApplication.count({
        where: {
          program: { brandId: categoryId, deletedAt: null },
          status: { in: ['accepted', 'interview_scheduled'] },
          deletedAt: null,
        },
      }),
      this.getDistinctCountryCount(categoryId),
    ]);

    return {
      total_participants: totalParticipants,
      total_countries: totalCountries,
      alumni: alumni,
    };
  }

  private async getGeographyStats(categoryId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    // 1. Get Totals first for percentage calculation
    const totalParticipants = await this.readPrisma.participant.count({
      where: { user: { brandId: categoryId, deletedAt: null }, deletedAt: null },
    });

    if (totalParticipants === 0) return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };

    // 2. Group By
    // Prisma groupBy doesn't support pagination (skip/take) directly efficiently with aggregating *all* to sort by count first.
    // However, it does support take/orderBy.
    // But to get the correct "top countries" page 2, we need strict ordering.
    const grouped = await this.readPrisma.participant.groupBy({
      by: ['originCountry'],
      where: {
        user: { brandId: categoryId, deletedAt: null },
        originCountry: { not: null },
        deletedAt: null,
      },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
      // Country cardinality is small enough that normalizing/merging in memory is safer than paginating raw values.
    });

    const normalizedGroups = this.normalizeCountryGroups(
      grouped.map((g) => ({ country: g.originCountry, count: g._count.id })),
    );

    const items: ParticipantGeographyItemDto[] = normalizedGroups
      .slice(skip, skip + limit)
      .map((g) => {
      const count = g.count;
      const percentage = (count / totalParticipants) * 100;
      return {
        country: g.country,
        participants: count,
        percentage: Number(percentage.toFixed(1)),
      };
    });

    return {
      items,
      meta: {
        total: normalizedGroups.length,
        page,
        limit,
        totalPages: Math.ceil(normalizedGroups.length / limit)
      }
    }
  }

  private async getDistinctCountryCount(categoryId: string): Promise<number> {
    const grouped = await this.readPrisma.participant.groupBy({
      by: ['originCountry'],
      where: {
        user: { brandId: categoryId, deletedAt: null },
        originCountry: { not: null },
        deletedAt: null,
      },
      _count: { id: true },
    });

    return this.normalizeCountryGroups(
      grouped.map((item) => ({ country: item.originCountry, count: item._count.id })),
    ).length;
  }

  async getAdminAnalytics(brandId?: string) {
    const cacheKey = CACHE_KEYS.STATS_ADMIN_ANALYTICS(brandId);
    const cached = await this.cacheService.get<Record<string, unknown>>(cacheKey);
    if (cached) {
      return cached;
    }

    const brandFilter = brandId ? { brandId } : {};
    const userBrandFilter = brandId ? { brandId } : {};

    const [
      totalPrograms,
      publishedPrograms,
      activePrograms,
      draftPrograms,
      totalUsers,
      activeUsers,
      totalApplications,
      applicationsByStatus,
      totalParticipants,
      topPrograms,
    ] = await Promise.all([
      this.readPrisma.program.count({ where: { ...brandFilter, deletedAt: null } }),
      this.readPrisma.program.count({ where: { ...brandFilter, isPublished: true, deletedAt: null } }),
      this.readPrisma.program.count({ where: { ...brandFilter, isActive: true, deletedAt: null } }),
      this.readPrisma.program.count({ where: { ...brandFilter, isPublished: false, deletedAt: null } }),
      this.readPrisma.user.count({ where: { ...userBrandFilter, deletedAt: null } }),
      this.readPrisma.user.count({ where: { ...userBrandFilter, isActive: true, deletedAt: null } }),
      this.readPrisma.participantApplication.count({
        where: { program: { ...brandFilter, deletedAt: null } },
      }),
      this.readPrisma.participantApplication.groupBy({
        by: ['status'],
        where: { program: { ...brandFilter, deletedAt: null } },
        _count: { id: true },
      }),
      this.readPrisma.participant.count({
        where: { user: { ...userBrandFilter, deletedAt: null } },
      }),
      this.readPrisma.program.findMany({
        where: { ...brandFilter, deletedAt: null },
        select: {
          id: true,
          name: true,
          _count: { select: { applications: true } },
        },
        orderBy: { applications: { _count: 'desc' } },
        take: 5,
      }),
    ]);

    // New users this month
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const newUsersThisMonth = await this.readPrisma.user.count({
      where: { ...userBrandFilter, createdAt: { gte: startOfMonth }, deletedAt: null },
    });

    const statusMap = applicationsByStatus.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    const response = {
      programs: {
        total: totalPrograms,
        published: publishedPrograms,
        active: activePrograms,
        draft: draftPrograms,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        new_this_month: newUsersThisMonth,
      },
      applications: {
        total: totalApplications,
        by_status: statusMap,
      },
      participants: {
        total: totalParticipants,
      },
      top_programs: topPrograms.map((p) => ({
        id: p.id,
        name: p.name,
        applicants: p._count.applications,
      })),
    };

    await this.cacheService.set(cacheKey, response, CACHE_TTL.SHORT);
    return response;
  }

  async getAdminProgramDashboard(programId: string): Promise<ProgramDashboardResponseDto> {
    const cacheKey = CACHE_KEYS.STATS_ADMIN_PROGRAM_DASHBOARD(programId);
    const cached = await this.cacheService.get<ProgramDashboardResponseDto>(cacheKey);
    if (cached) {
      return cached;
    }

    const program = await this.readPrisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        status: true,
        isActive: true,
        registrationCloseDate: true,
        endDate: true,
      },
    });

    if (!program) {
      throw new NotFoundException(`Program with ID "${programId}" not found`);
    }

    const [applications, totalAmbassadors, activeAmbassadors, referredParticipants, ambassadorRows] = await Promise.all([
      this.readPrisma.participantApplication.findMany({
        where: { programId, deletedAt: null },
        select: {
          createdAt: true,
          lastEditedAt: true,
          submittedAt: true,
          status: true,
          participant: {
            select: {
              gender: true,
              birthdate: true,
              originCountry: true,
              nationality: true,
              profileCompletedAt: true,
            },
          },
        },
      }),
      this.readPrisma.ambassador.count({
        where: { programId, deletedAt: null },
      }),
      this.readPrisma.ambassador.count({
        where: { programId, isActive: true, deletedAt: null },
      }),
      this.readPrisma.ambassadorReferral.count({
        where: {
          deletedAt: null,
          ambassador: {
            programId,
            deletedAt: null,
          },
        },
      }),
      this.readPrisma.ambassador.findMany({
        where: { programId, deletedAt: null },
        select: {
          fullName: true,
          institution: true,
          successfulReferrals: true,
          totalReferrals: true,
          _count: {
            select: {
              referrals: true,
            },
          },
          user: {
            select: {
              participant: {
                select: {
                  originCountry: true,
                  nationality: true,
                },
              },
            },
          },
        },
        orderBy: [
          { successfulReferrals: 'desc' },
          { totalReferrals: 'desc' },
          { createdAt: 'asc' },
        ],
      }),
    ]);

    const registeredUsers = applications.length;
    const startOfTodayUtc = this.startOfUtcDay(new Date());
    const registrationsToday = applications.filter((item) => item.createdAt >= startOfTodayUtc).length;
    const formsStarted = applications.filter((item) => this.hasStartedApplication(item)).length;
    const submittedApplications = applications.filter((item) => this.isSubmittedApplication(item)).length;
    const registeredOnly = Math.max(registeredUsers - formsStarted, 0);

    const referredParticipantsPercent = registeredUsers > 0
      ? Number(((referredParticipants / registeredUsers) * 100).toFixed(1))
      : 0;

    const createdAtValues = applications.map((item) => item.createdAt);
    const gender = this.buildGenderDistribution(applications);
    const age = this.buildAgeDistribution(applications);
    const nationalities = this.buildTopNationalities(applications);
    const topAmbassadors = ambassadorRows.map((item) => ({
      name: item.fullName,
      country: this.resolveCountryName(
        item.user.participant?.originCountry,
        item.user.participant?.nationality,
      ) ?? item.institution ?? 'Unknown',
      referrals: item.successfulReferrals > 0 ? item.successfulReferrals : Math.max(item.totalReferrals, item._count.referrals),
    }));

    const response: ProgramDashboardResponseDto = {
      kpis: {
        registeredUsers,
        registrationsToday,
        formsStarted,
        submittedApplications,
        registeredOnly,
        totalAmbassadors,
        activeAmbassadors,
        referredParticipants,
        referredParticipantsPercent,
        programStatus: program.isActive ? 'active' : program.status,
        programStatusDate: program.registrationCloseDate?.toISOString() ?? program.endDate?.toISOString() ?? null,
      },
      trend: {
        daily: this.buildDailyTrend(createdAtValues, 7),
        weekly: this.buildWeeklyTrend(createdAtValues, 8),
        monthly: this.buildMonthlyTrend(createdAtValues, 6),
      },
      gender,
      age,
      nationalities,
      topAmbassadors,
    };

    await this.cacheService.set(cacheKey, response, CACHE_TTL.SHORT);
    return response;
  }

  private hasStartedApplication(application: ProgramDashboardApplication): boolean {
    return this.isSubmittedApplication(application)
      || Boolean(application.lastEditedAt)
      || Boolean(application.participant.profileCompletedAt);
  }

  private isSubmittedApplication(application: ProgramDashboardApplication): boolean {
    return Boolean(application.submittedAt) || application.status !== ApplicationStatus.draft;
  }

  private startOfUtcDay(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  }

  private startOfUtcWeek(date: Date): Date {
    const day = date.getUTCDay();
    const daysFromMonday = (day + 6) % 7;
    const start = this.startOfUtcDay(date);
    start.setUTCDate(start.getUTCDate() - daysFromMonday);
    return start;
  }

  private startOfUtcMonth(date: Date): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  }

  private addDays(date: Date, days: number): Date {
    const next = new Date(date);
    next.setUTCDate(next.getUTCDate() + days);
    return next;
  }

  private addMonths(date: Date, months: number): Date {
    return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
  }

  private formatDayLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
  }

  private formatWeekLabel(date: Date): string {
    const end = this.addDays(date, 6);
    return `${date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}–${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
  }

  private formatMonthLabel(date: Date): string {
    return date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
  }

  private buildDailyTrend(createdAtValues: Date[], points: number): { label: string; registrations: number }[] {
    const todayStart = this.startOfUtcDay(new Date());
    const firstBucket = this.addDays(todayStart, -(points - 1));
    const counts = new Map<string, number>();

    for (const createdAt of createdAtValues) {
      if (createdAt < firstBucket) continue;
      const bucket = this.startOfUtcDay(createdAt).toISOString();
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    const result: { label: string; registrations: number }[] = [];
    for (let index = 0; index < points; index += 1) {
      const bucketDate = this.addDays(firstBucket, index);
      const key = bucketDate.toISOString();
      result.push({
        label: this.formatDayLabel(bucketDate),
        registrations: counts.get(key) ?? 0,
      });
    }

    return result;
  }

  private buildWeeklyTrend(createdAtValues: Date[], points: number): { label: string; registrations: number }[] {
    const thisWeekStart = this.startOfUtcWeek(new Date());
    const firstBucket = this.addDays(thisWeekStart, -7 * (points - 1));
    const counts = new Map<string, number>();

    for (const createdAt of createdAtValues) {
      if (createdAt < firstBucket) continue;
      const bucket = this.startOfUtcWeek(createdAt).toISOString();
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    const result: { label: string; registrations: number }[] = [];
    for (let index = 0; index < points; index += 1) {
      const bucketDate = this.addDays(firstBucket, index * 7);
      const key = bucketDate.toISOString();
      result.push({
        label: this.formatWeekLabel(bucketDate),
        registrations: counts.get(key) ?? 0,
      });
    }

    return result;
  }

  private buildMonthlyTrend(createdAtValues: Date[], points: number): { label: string; registrations: number }[] {
    const thisMonthStart = this.startOfUtcMonth(new Date());
    const firstBucket = this.addMonths(thisMonthStart, -(points - 1));
    const counts = new Map<string, number>();

    for (const createdAt of createdAtValues) {
      if (createdAt < firstBucket) continue;
      const bucket = this.startOfUtcMonth(createdAt).toISOString();
      counts.set(bucket, (counts.get(bucket) ?? 0) + 1);
    }

    const result: { label: string; registrations: number }[] = [];
    for (let index = 0; index < points; index += 1) {
      const bucketDate = this.addMonths(firstBucket, index);
      const key = bucketDate.toISOString();
      result.push({
        label: this.formatMonthLabel(bucketDate),
        registrations: counts.get(key) ?? 0,
      });
    }

    return result;
  }

  private buildGenderDistribution(
    applications: ProgramDashboardApplication[],
  ): { name: string; value: number }[] {
    const counts = new Map<string, number>();
    for (const item of applications) {
      const label = item.participant.gender === 'female'
        ? 'Female'
        : item.participant.gender === 'male'
          ? 'Male'
          : 'Unknown';
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }

  private buildAgeDistribution(
    applications: ProgramDashboardApplication[],
  ): { range: string; count: number }[] {
    const buckets = [
      { range: '17-20', min: 17, max: 20, count: 0 },
      { range: '21-24', min: 21, max: 24, count: 0 },
      { range: '25-28', min: 25, max: 28, count: 0 },
      { range: '29-32', min: 29, max: 32, count: 0 },
      { range: 'Others', min: Number.NEGATIVE_INFINITY, max: Number.POSITIVE_INFINITY, count: 0 },
    ];
    const today = new Date();

    for (const item of applications) {
      if (!item.participant.birthdate) {
        buckets[buckets.length - 1].count += 1;
        continue;
      }

      const age = this.calculateAge(item.participant.birthdate, today);
      const bucket = buckets.find((candidate) => age >= candidate.min && age <= candidate.max) ?? buckets[buckets.length - 1];
      bucket.count += 1;
    }

    return buckets.map(({ range, count }) => ({ range, count }));
  }

  private buildTopNationalities(
    applications: ProgramDashboardApplication[],
  ): { country: string; count: number }[] {
    return this.normalizeCountryGroups(
      applications.map((item) => ({
        country: this.resolveCountryName(item.participant.originCountry, item.participant.nationality),
        count: 1,
      })),
    ).slice(0, 10);
  }

  private resolveCountryName(...values: Array<string | null | undefined>): string | null {
    return resolveCountryName(...values);
  }

  private normalizeCountryGroups(
    groups: Array<{ country: string | null | undefined; count: number }>,
  ): Array<{ country: string; count: number }> {
    return normalizeCountryGroups(groups);
  }

  private calculateAge(birthdate: Date, now: Date): number {
    let age = now.getUTCFullYear() - birthdate.getUTCFullYear();
    const monthDiff = now.getUTCMonth() - birthdate.getUTCMonth();
    const dayDiff = now.getUTCDate() - birthdate.getUTCDate();
    if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
      age -= 1;
    }
    return age;
  }

  async getAdminProgramAnalytics(
    programId: string,
    filters: {
      dateFrom?: string;
      dateTo?: string;
      payDateFrom?: string;
      payDateTo?: string;
      appStatuses?: string[];
      appCategory?: string;
      paymentStatuses?: string[];
      currency?: string;
    } = {},
  ): Promise<ProgramAnalyticsResponseDto> {
    const program = await this.readPrisma.program.findUnique({
      where: { id: programId },
      select: { id: true, usdInIdr: true },
    });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);

    const MS_DAY = 86399999;
    const appDateFrom = filters.dateFrom ? new Date(filters.dateFrom) : undefined;
    const appDateTo = filters.dateTo ? new Date(new Date(filters.dateTo).getTime() + MS_DAY) : undefined;
    const payDateFrom = filters.payDateFrom ? new Date(filters.payDateFrom) : undefined;
    const payDateTo = filters.payDateTo ? new Date(new Date(filters.payDateTo).getTime() + MS_DAY) : undefined;

    const [appRows, invoiceRows] = await Promise.all([
      this.readPrisma.participantApplication.findMany({
        where: {
          programId,
          deletedAt: null,
          ...(appDateFrom || appDateTo
            ? { createdAt: { ...(appDateFrom && { gte: appDateFrom }), ...(appDateTo && { lte: appDateTo }) } }
            : {}),
          ...(filters.appStatuses?.length ? { status: { in: filters.appStatuses as ApplicationStatus[] } } : {}),
          ...(filters.appCategory ? { applicationCategory: filters.appCategory as any } : {}),
        },
        select: {
          id: true,
          status: true,
          applicationCategory: true,
          submittedAt: true,
          lastEditedAt: true,
          participant: {
            select: {
              educationLevel: true,
              institution: true,
              originCountry: true,
              nationality: true,
              profileCompletedAt: true,
            },
          },
        },
      }),
      this.readPrisma.applicationInvoice.findMany({
        where: {
          application: {
            programId,
            ticketStatus: { not: 'ambassador' },
          },
          ...(payDateFrom || payDateTo
            ? { paidAt: { ...(payDateFrom && { gte: payDateFrom }), ...(payDateTo && { lte: payDateTo }) } }
            : {}),
          ...(filters.paymentStatuses?.length ? { status: { in: filters.paymentStatuses as any[] } } : {}),
          ...(filters.currency ? { currency: { equals: filters.currency, mode: 'insensitive' } } : {}),
        },
        select: {
          applicationId: true,
          amount: true,
          currency: true,
          status: true,
          paymentMethod: true,
          paidAt: true,
          exchangeRateSnapshot: true,
          pricingTier: { select: { name: true, feeType: true } },
          application: {
            select: {
              participant: { select: { originCountry: true, nationality: true } },
            },
          },
        },
      }),
    ]);

    const total = appRows.length;
    const pct = (n: number) => (total > 0 ? Number(((n / total) * 100).toFixed(1)) : 0);

    // ── Funnel ────────────────────────────────────────────────────────────────
    const formsStarted = appRows.filter(
      (a) => Boolean(a.lastEditedAt) || Boolean(a.participant.profileCompletedAt) || a.status !== 'draft',
    ).length;
    const submitted = appRows.filter((a) => Boolean(a.submittedAt) || a.status !== 'draft').length;
    const accepted = appRows.filter((a) => ['accepted', 'interview_scheduled'].includes(a.status)).length;
    const paidAppIds = new Set(
      invoiceRows.filter((i) => i.status === 'paid').map((i) => i.applicationId),
    );
    const paid = paidAppIds.size;

    const funnel = [
      { stage: 'Registered', count: total, pct: 100 },
      { stage: 'Form Started', count: formsStarted, pct: total > 0 ? Number(((formsStarted / total) * 100).toFixed(1)) : 0 },
      { stage: 'Submitted', count: submitted, pct: total > 0 ? Number(((submitted / total) * 100).toFixed(1)) : 0 },
      { stage: 'Accepted', count: accepted, pct: total > 0 ? Number(((accepted / total) * 100).toFixed(1)) : 0 },
      { stage: 'Paid', count: paid, pct: total > 0 ? Number(((paid / total) * 100).toFixed(1)) : 0 },
    ];

    // ── Category breakdown ────────────────────────────────────────────────────
    const catMap = new Map<string, number>();
    for (const a of appRows) {
      const cat = a.applicationCategory ?? 'unset';
      catMap.set(cat, (catMap.get(cat) ?? 0) + 1);
    }
    const byCategory = Array.from(catMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([category, count]) => ({ category, count, pct: pct(count) }));

    // ── Education breakdown ───────────────────────────────────────────────────
    const eduMap = new Map<string, number>();
    for (const a of appRows) {
      const lvl = a.participant.educationLevel ?? 'Unknown';
      eduMap.set(lvl, (eduMap.get(lvl) ?? 0) + 1);
    }
    const byEducation = Array.from(eduMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([level, count]) => ({ level, count, pct: pct(count) }));

    // ── Top institutions ──────────────────────────────────────────────────────
    const instMap = new Map<string, number>();
    for (const a of appRows) {
      const inst = a.participant.institution?.trim();
      if (inst) instMap.set(inst, (instMap.get(inst) ?? 0) + 1);
    }
    const topInstitutions = Array.from(instMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([name, count]) => ({ name, count }));

    // ── Payment KPIs ──────────────────────────────────────────────────────────
    const paidInvoices = invoiceRows.filter((i) => i.status === 'paid');
    // FX rate resolution never hardcodes a constant: invoice's own exchangeRateSnapshot
    // first, then falls back to the program's configured usdInIdr. If neither is
    // available, the invoice is excluded from USD-derived IDR aggregation entirely
    // rather than assuming a rate (see resolveUsdInIdrRate).
    let totalIdr = 0;
    let totalUsd = 0;
    for (const inv of paidInvoices) {
      const amt = Number(inv.amount);
      if (inv.currency.toUpperCase() === 'USD') {
        totalUsd += amt;
        const rate = resolveUsdInIdrRate({ snapshot: inv.exchangeRateSnapshot, programRate: program.usdInIdr });
        if (rate !== undefined) {
          totalIdr += amt * rate;
        }
      } else {
        totalIdr += amt;
      }
    }

    const submittedCount = appRows.filter((a) => Boolean(a.submittedAt) || a.status !== 'draft').length;
    const conversionRate = submittedCount > 0 ? Number(((paidInvoices.length / submittedCount) * 100).toFixed(1)) : 0;

    // ── Revenue by month (6 months) ───────────────────────────────────────────
    const now = new Date();
    const revenueByMonth = Array.from({ length: 6 }, (_, idx) => {
      const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - idx), 1));
      const next = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1));
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit', timeZone: 'UTC' });
      let idr = 0;
      let usd = 0;
      for (const inv of paidInvoices) {
        if (!inv.paidAt || inv.paidAt < d || inv.paidAt >= next) continue;
        const amt = Number(inv.amount);
        if (inv.currency.toUpperCase() === 'USD') {
          usd += amt;
          const rate = resolveUsdInIdrRate({ snapshot: inv.exchangeRateSnapshot, programRate: program.usdInIdr });
          if (rate !== undefined) {
            idr += amt * rate;
          }
        } else {
          idr += amt;
        }
      }
      return { label, idr: Math.round(idr), usd: Number(usd.toFixed(2)) };
    });

    // ── By tier ───────────────────────────────────────────────────────────────
    const tierMap = new Map<string, { paidCount: number; totalAmount: number; currency: string }>();
    for (const inv of paidInvoices) {
      const key = inv.pricingTier?.name ?? 'Unknown';
      const existing = tierMap.get(key) ?? { paidCount: 0, totalAmount: 0, currency: inv.currency };
      existing.paidCount += 1;
      existing.totalAmount += Number(inv.amount);
      tierMap.set(key, existing);
    }
    const byTier = Array.from(tierMap.entries())
      .sort((a, b) => b[1].paidCount - a[1].paidCount)
      .map(([name, v]) => ({ name, ...v }));

    // ── By payment method ─────────────────────────────────────────────────────
    const methodMap = new Map<string, number>();
    for (const inv of paidInvoices) {
      const method = inv.paymentMethod ?? 'unknown';
      methodMap.set(method, (methodMap.get(method) ?? 0) + 1);
    }
    const byPaymentMethod = Array.from(methodMap.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([method, count]) => ({ method, count }));

    // ── Countries by payment status ───────────────────────────────────────────
    const csMap = new Map<string, { paid: number; processing: number; unpaid: number; failed: number; cancelled: number }>();
    for (const inv of invoiceRows) {
      const country = this.resolveCountryName(
        inv.application.participant?.originCountry ?? '',
        inv.application.participant?.nationality ?? '',
      ) ?? 'Unknown';
      const entry = csMap.get(country) ?? { paid: 0, processing: 0, unpaid: 0, failed: 0, cancelled: 0 };
      const s = inv.status.toLowerCase();
      if (s === 'paid') entry.paid += 1;
      else if (s === 'processing') entry.processing += 1;
      else if (s === 'failed') entry.failed += 1;
      else if (s === 'cancelled') entry.cancelled += 1;
      else entry.unpaid += 1;
      csMap.set(country, entry);
    }
    const countriesByStatus = Array.from(csMap.entries())
      .map(([country, s]) => ({
        country,
        ...s,
        total: s.paid + s.processing + s.unpaid + s.failed + s.cancelled,
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 15);

    return {
      participants: { funnel, byCategory, byEducation, topInstitutions },
      payments: {
        kpis: {
          totalInvoices: invoiceRows.length,
          paidCount: paidInvoices.length,
          processingCount: invoiceRows.filter((i) => i.status === 'processing').length,
          unpaidCount: invoiceRows.filter((i) => i.status === 'unpaid').length,
          failedCount: invoiceRows.filter((i) => i.status === 'failed').length,
          cancelledCount: invoiceRows.filter((i) => i.status === 'cancelled').length,
          totalRevenueIdr: Math.round(totalIdr),
          totalRevenueUsd: Number(totalUsd.toFixed(2)),
          conversionRate,
        },
        revenueByMonth,
        byTier,
        byPaymentMethod,
        countriesByStatus,
      },
    };
  }
}
