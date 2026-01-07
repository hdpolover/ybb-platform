
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { GetStatsQueryDto, StatSection } from './dto/get-stats.dto';
import { ProgramCategory } from '@prisma/client';
import { StatsResponseDto, ParticipantGeographyItemDto } from './dto/stats-response.dto';

@Injectable()
export class StatsService {
  constructor(private readonly prisma: PrismaService) {}

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

    const response: StatsResponseDto = {};
    const sections = query.sections || Object.values(StatSection);

    if (sections.includes(StatSection.IMPACT)) {
      response.impact = await this.getImpactStats(category.id);
    }

    if (sections.includes(StatSection.GEOGRAPHY)) {
      response.geography = await this.getGeographyStats(category.id, query.page || 1, query.limit || 20);
    }

    return response;
  }

  private async resolveContext(query: GetStatsQueryDto): Promise<ProgramCategory | null> {
    if (query.programCategoryId) {
      return this.prisma.programCategory.findUnique({ where: { id: query.programCategoryId } });
    }

    if (query.url) {
      // Reusing logic from landing service strategy - find by url
      let category = await this.prisma.programCategory.findFirst({
        where: { websiteUrl: query.url, isActive: true },
      });

      if (!category) {
        category = await this.prisma.programCategory.findFirst({
          where: { websiteUrl: { contains: query.url, mode: 'insensitive' }, isActive: true },
        });
      }
      return category;
    }

    // Default fallbacks if needed, or return null
    return this.prisma.programCategory.findFirst({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' }
    });
  }

  private async getImpactStats(categoryId: string) {
    const totalParticipants = await this.prisma.participant.count({
      where: { user: { programCategoryId: categoryId } },
    });

    const alumni = await this.prisma.participantApplication.count({
      where: {
        program: { programCategoryId: categoryId },
        status: { in: ['accepted', 'interview_scheduled'] },
      },
    });

    // Total Countries (Distinct)
    // Note: This can be heavy if participants are millions, but fine for thousands.
    // Optimization: Depending on DB size, could assume geography list length if page limit is high, but distinct count is better.
    const distinctCountries = await this.prisma.participant.findMany({
      where: {
        user: { programCategoryId: categoryId },
        originCountry: { not: null },
      },
      distinct: ['originCountry'],
      select: { originCountry: true },
    });

    return {
      total_participants: totalParticipants,
      total_countries: distinctCountries.length,
      alumni: alumni,
    };
  }

  private async getGeographyStats(categoryId: string, page: number, limit: number) {
    const skip = (page - 1) * limit;

    // 1. Get Totals first for percentage calculation
    const totalParticipants = await this.prisma.participant.count({
      where: { user: { programCategoryId: categoryId } },
    });

    if (totalParticipants === 0) return { items: [], meta: { total: 0, page, limit, totalPages: 0 } };

    // 2. Group By
    // Prisma groupBy doesn't support pagination (skip/take) directly efficiently with aggregating *all* to sort by count first.
    // However, it does support take/orderBy.
    // But to get the correct "top countries" page 2, we need strict ordering.
    const grouped = await this.prisma.participant.groupBy({
      by: ['originCountry'],
      where: {
        user: { programCategoryId: categoryId },
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

    // We also need total count of *groups* (countries) to calculate total pages for geography list
    // This is essentially "total_countries" from impact, but let's re-query to be safe/isolated
    // Usually standard SQL: SELECT COUNT(DISTINCT country) ...
    // Prisma:
     const distinctCountriesCount = (await this.prisma.participant.findMany({
      where: {
        user: { programCategoryId: categoryId },
        originCountry: { not: null },
      },
      distinct: ['originCountry'],
      select: { id: true } // minimal select
    })).length;


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
}
