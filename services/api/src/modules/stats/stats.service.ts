
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { GetStatsQueryDto, StatSection } from './dto/get-stats.dto';
import { ApplicationStatus, Brand } from '@prisma/client';
import { StatsResponseDto, ParticipantGeographyItemDto } from './dto/stats-response.dto';
import { ProgramDashboardResponseDto } from './dto/program-dashboard-response.dto';

import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants/cache-keys';
import { normalizeCountryGroups, resolveCountryName } from '@shared/utils/country-groups';

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
    private readonly prisma: PrismaService,
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
      return this.prisma.brand.findUnique({ where: { id: query.brandId } });
    }

    if (query.url) {
      // Reusing logic from landing service strategy - find by url
      let category = await this.prisma.brand.findFirst({
        where: { websiteUrl: query.url, isActive: true },
      });

      if (!category) {
        category = await this.prisma.brand.findFirst({
          where: { websiteUrl: { contains: query.url, mode: 'insensitive' }, isActive: true },
        });
      }
      return category;
    }

    // Default fallbacks if needed, or return null
    return this.prisma.brand.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async getImpactStats(categoryId: string) {
    const [totalParticipants, alumni, totalCountries] = await Promise.all([
      this.prisma.participant.count({
        where: { user: { brandId: categoryId, deletedAt: null }, deletedAt: null },
      }),
      this.prisma.participantApplication.count({
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
    const totalParticipants = await this.prisma.participant.count({
      where: { user: { brandId: categoryId, deletedAt: null }, deletedAt: null },
    });

    if (totalParticipants === 0) return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };

    // 2. Group By
    // Prisma groupBy doesn't support pagination (skip/take) directly efficiently with aggregating *all* to sort by count first.
    // However, it does support take/orderBy.
    // But to get the correct "top countries" page 2, we need strict ordering.
    const grouped = await this.prisma.participant.groupBy({
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
    const grouped = await this.prisma.participant.groupBy({
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
      this.prisma.program.count({ where: { ...brandFilter, deletedAt: null } }),
      this.prisma.program.count({ where: { ...brandFilter, isPublished: true, deletedAt: null } }),
      this.prisma.program.count({ where: { ...brandFilter, isActive: true, deletedAt: null } }),
      this.prisma.program.count({ where: { ...brandFilter, isPublished: false, deletedAt: null } }),
      this.prisma.user.count({ where: { ...userBrandFilter, deletedAt: null } }),
      this.prisma.user.count({ where: { ...userBrandFilter, isActive: true, deletedAt: null } }),
      this.prisma.participantApplication.count({
        where: { program: { ...brandFilter, deletedAt: null } },
      }),
      this.prisma.participantApplication.groupBy({
        by: ['status'],
        where: { program: { ...brandFilter, deletedAt: null } },
        _count: { id: true },
      }),
      this.prisma.participant.count({
        where: { user: { ...userBrandFilter, deletedAt: null } },
      }),
      this.prisma.program.findMany({
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
    const newUsersThisMonth = await this.prisma.user.count({
      where: { ...userBrandFilter, createdAt: { gte: startOfMonth }, deletedAt: null },
    });

    const statusMap = applicationsByStatus.reduce<Record<string, number>>((acc, item) => {
      acc[item.status] = item._count.id;
      return acc;
    }, {});

    return {
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
  }

  async getAdminProgramDashboard(programId: string): Promise<ProgramDashboardResponseDto> {
    const program = await this.prisma.program.findUnique({
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
      this.prisma.participantApplication.findMany({
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
      this.prisma.ambassador.count({
        where: { programId, deletedAt: null },
      }),
      this.prisma.ambassador.count({
        where: { programId, isActive: true, deletedAt: null },
      }),
      this.prisma.ambassadorReferral.count({
        where: {
          deletedAt: null,
          ambassador: {
            programId,
            deletedAt: null,
          },
        },
      }),
      this.prisma.ambassador.findMany({
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

    return {
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
}
