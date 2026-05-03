import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException, Inject } from '@nestjs/common';
import { UpdateBrandMetadataCommand } from '../update-brand-metadata.command';
import { IBrandRepository } from '@core/interfaces/repositories/brand.repository.interface';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

@CommandHandler(UpdateBrandMetadataCommand)
export class UpdateBrandMetadataHandler implements ICommandHandler<UpdateBrandMetadataCommand> {
    constructor(
        @Inject('IBrandRepository')
        private readonly brandRepository: IBrandRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) {}

    async execute(command: UpdateBrandMetadataCommand): Promise<Record<string, unknown>> {
        const { id, patch } = command;
        try {
            const result = await this.brandRepository.updateMetadata(id, patch);
            await Promise.all([
                this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId: id } }),
                this.cacheService.invalidateBrandLandingCaches(id),
            ]);
            await this.landingRevalidation.revalidateForBrand(id);
            return result;
        } catch (error: unknown) {
            if (error instanceof Error && error.message.includes('not found')) {
                throw new NotFoundException(`Brand with ID ${id} not found`);
            }
            throw error;
        }
    }
}
