import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { GetBrandMetadataQuery } from '../get-brand-metadata.query';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';

@QueryHandler(GetBrandMetadataQuery)
export class GetBrandMetadataHandler implements IQueryHandler<GetBrandMetadataQuery> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
    ) {}

    async execute(query: GetBrandMetadataQuery): Promise<Record<string, unknown>> {
        const metadata = await this.brandRepository.getMetadata(query.id);
        if (metadata === null) {
            throw new NotFoundException(`Brand with ID ${query.id} not found`);
        }
        return metadata;
    }
}
