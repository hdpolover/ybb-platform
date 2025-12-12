import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListBrandSponsorsQuery } from '../list-brand-sponsors.query';
import { ISponsorRepository } from '@core/interfaces/repositories/sponsor.repository.interface';
import { SponsorResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(ListBrandSponsorsQuery)
export class ListBrandSponsorsHandler implements IQueryHandler<ListBrandSponsorsQuery> {
    constructor(
        @Inject('ISponsorRepository')
        private readonly repository: ISponsorRepository,
    ) { }

    async execute(query: ListBrandSponsorsQuery): Promise<SponsorResponseDto[]> {
        const sponsors = await this.repository.findByBrandId(query.brandId);

        return sponsors.map(sponsor => ({
            id: sponsor.id,
            name: sponsor.name,
            type: sponsor.type,
            logoUrl: sponsor.logoUrl || undefined,
            websiteUrl: sponsor.websiteUrl || undefined,
            tier: sponsor.tier || undefined,
            order: sponsor.order,
        }));
    }
}
