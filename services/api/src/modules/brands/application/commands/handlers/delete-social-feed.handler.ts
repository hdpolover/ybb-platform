import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { DeleteSocialFeedCommand } from '../delete-social-feed.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

@CommandHandler(DeleteSocialFeedCommand)
export class DeleteSocialFeedHandler implements ICommandHandler<DeleteSocialFeedCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly landingRevalidation: LandingRevalidationService,
        private readonly cacheService: CacheService,
    ) { }

    async execute(command: DeleteSocialFeedCommand): Promise<void> {
        const feed = await this.prisma.brandSocialFeed.findFirst({
            where: { id: command.socialFeedId, brandId: command.brandId, deletedAt: null },
        });
        if (!feed) {
            throw new NotFoundException('Social feed not found');
        }

        await this.prisma.brandSocialFeed.delete({
            where: { id: command.socialFeedId },
        });
        await this.cacheService.invalidateBrandLandingCaches(command.brandId);
        await this.landingRevalidation.revalidateForBrand(command.brandId);
    }
}
