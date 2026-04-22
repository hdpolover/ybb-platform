import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ListBrandSponsorsQuery } from '../list-brand-sponsors.query';
import { ISponsorRepository } from '@core/interfaces/repositories/sponsor.repository.interface';
import { SponsorResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(ListBrandSponsorsQuery)
export class ListBrandSponsorsHandler implements IQueryHandler<ListBrandSponsorsQuery> {
    private readonly storageUrl: string;

    constructor(
        @Inject('ISponsorRepository')
        private readonly repository: ISponsorRepository,
        private readonly configService: ConfigService,
    ) { 
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }

    async execute(query: ListBrandSponsorsQuery): Promise<SponsorResponseDto[]> {
        const sponsors = await this.repository.findByBrandId(query.brandId);

        return sponsors.map(sponsor => ({
            id: sponsor.id,
            name: sponsor.name,
            type: sponsor.type,
            logoUrl: sponsor.logoUrl
                ? (sponsor.logoUrl.startsWith('http') ? sponsor.logoUrl : `${this.storageUrl}/${sponsor.logoUrl}`)
                : undefined,
            websiteUrl: sponsor.websiteUrl || undefined,
            tier: sponsor.tier || undefined,
            description: sponsor.description || undefined,
            order: sponsor.order,
        }));
    }
}
