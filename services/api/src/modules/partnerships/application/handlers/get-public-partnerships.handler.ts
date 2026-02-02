import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetPublicPartnershipsQuery } from '../queries/get-public-partnerships.query';
import { PartnershipResponseDto } from '../dto/partnership-response.dto';
import { NotFoundException } from '@nestjs/common';

@QueryHandler(GetPublicPartnershipsQuery)
export class GetPublicPartnershipsHandler implements IQueryHandler<GetPublicPartnershipsQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetPublicPartnershipsQuery): Promise<PartnershipResponseDto> {
    const { brandSlug } = query;

    // Find the Program Category ID by Slug
    const brand = await this.prisma.brand.findUnique({
      where: { slug: brandSlug },
      select: { id: true }
    });

    if (!brand) {
      throw new NotFoundException(`Brand with slug '${brandSlug}' not found`);
    }

    const [opportunities, sponsorshipTiers] = await Promise.all([
      this.prisma.partnershipOpportunity.findMany({
        where: { brandId: brand.id, isActive: true },
        orderBy: { order: 'asc' }
      }),
      this.prisma.sponsorshipTier.findMany({
        where: { brandId: brand.id, isActive: true },
        orderBy: { order: 'asc' }
      })
    ]);

    return {
      opportunities: opportunities.map(opt => ({
        id: opt.id,
        title: opt.title,
        subtitle: opt.subtitle || undefined,
        description: opt.description || undefined,
        type: opt.type,
        features: (opt.features as any) || [],
        ctaLabel: opt.ctaLabel || undefined
      })),
      sponsorshipTiers: sponsorshipTiers.map(tier => ({
        id: tier.id,
        name: tier.name,
        priceDescription: tier.priceDescription || undefined,
        description: tier.description || undefined,
        features: (tier.features as any) || []
      }))
    };
  }
}
