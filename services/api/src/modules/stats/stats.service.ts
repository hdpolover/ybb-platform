
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { GetStatsQueryDto, StatSection } from './dto/get-stats.dto';
import { Brand } from '@prisma/client';
import { StatsResponseDto, ParticipantGeographyItemDto } from './dto/stats-response.dto';
import { ProgramDashboardResponseDto } from './dto/program-dashboard-response.dto';

import { CacheService } from '../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../shared/constants/cache-keys';

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
        where: { user: { brandId: categoryId } },
      }),
      this.prisma.participantApplication.count({
        where: {
          program: { brandId: categoryId },
          status: { in: ['accepted', 'interview_scheduled'] },
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
      where: { user: { brandId: categoryId } },
    });

    if (totalParticipants === 0) return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };

    // 2. Group By
    // Prisma groupBy doesn't support pagination (skip/take) directly efficiently with aggregating *all* to sort by count first.
    // However, it does support take/orderBy.
    // But to get the correct "top countries" page 2, we need strict ordering.
    const grouped = await this.prisma.participant.groupBy({
      by: ['originCountry'],
      where: {
        user: { brandId: categoryId },
        originCountry: { not: null },
      },
      _count: { id: true },
      orderBy: {
        _count: { id: 'desc' },
      },
      // Note: Getting ALL groups then paginating in memory might be safer if country count is small (~200 max).
      // But if we want DB pagination: Use take/skip.
      take: limit,
      skip: skip,
    });

    const distinctCountriesCount = await this.getDistinctCountryCount(categoryId);


    const items: ParticipantGeographyItemDto[] = grouped.map((g) => {
      const count = g._count.id;
      const percentage = (count / totalParticipants) * 100;
      return {
        country: g.originCountry || 'Unknown',
        participants: count,
        percentage: Number(percentage.toFixed(1)),
      };
    });

    return {
      items,
      meta: {
        total: distinctCountriesCount,
        page,
        limit,
        totalPages: Math.ceil(distinctCountriesCount / limit)
      }
    }
  }

  private async getDistinctCountryCount(categoryId: string): Promise<number> {
    const result = await this.prisma.$queryRaw<Array<{ count: bigint | number }>>`
      SELECT COUNT(DISTINCT p.origin_country) AS count
      FROM participants p
      INNER JOIN users u ON u.id = p.user_id
      WHERE u.brand_id = ${categoryId}
        AND p.origin_country IS NOT NULL
    `;
    const countValue = result[0]?.count ?? 0;
    return typeof countValue === 'bigint' ? Number(countValue) : countValue;
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
          participant: {
            select: {
              gender: true,
              birthdate: true,
              originCountry: true,
              nationality: true,
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

    const totalParticipants = applications.length;
    const startOfTodayUtc = this.startOfUtcDay(new Date());
    const participantsToday = applications.filter((item) => item.createdAt >= startOfTodayUtc).length;

    const referredParticipantsPercent = totalParticipants > 0
      ? Number(((referredParticipants / totalParticipants) * 100).toFixed(1))
      : 0;

    const createdAtValues = applications.map((item) => item.createdAt);
    const gender = this.buildGenderDistribution(applications);
    const age = this.buildAgeDistribution(applications);
    const nationalities = this.buildTopNationalities(applications);
    const topAmbassadors = ambassadorRows.map((item) => ({
      name: item.fullName,
      country: item.user.participant?.originCountry ?? item.user.participant?.nationality ?? item.institution ?? 'Unknown',
      referrals: item.successfulReferrals > 0 ? item.successfulReferrals : Math.max(item.totalReferrals, item._count.referrals),
    }));

    return {
      kpis: {
        totalParticipants,
        participantsToday,
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
    applications: Array<{
      participant: {
        gender: 'male' | 'female' | null;
      };
    }>,
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
    applications: Array<{
      participant: {
        birthdate: Date | null;
      };
    }>,
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
    applications: Array<{
      participant: {
        originCountry: string | null;
        nationality: string | null;
      };
    }>,
  ): { country: string; count: number }[] {
    const counts = new Map<string, number>();

    for (const item of applications) {
      const country = item.participant.originCountry ?? item.participant.nationality ?? 'Unknown';
      counts.set(country, (counts.get(country) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count || a.country.localeCompare(b.country))
      .slice(0, 10);
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
