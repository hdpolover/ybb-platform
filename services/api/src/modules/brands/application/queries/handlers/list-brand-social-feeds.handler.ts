import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ListBrandSocialFeedsQuery } from '../list-brand-social-feeds.query';
import { SocialFeedResponseDto } from '@modules/brands/presentation/dto/brand.dto';

@QueryHandler(ListBrandSocialFeedsQuery)
export class ListBrandSocialFeedsHandler implements IQueryHandler<ListBrandSocialFeedsQuery> {
    private readonly storageUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly configService: ConfigService,
    ) {
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }

    async execute(query: ListBrandSocialFeedsQuery): Promise<SocialFeedResponseDto[]> {
        const feeds = await this.prisma.brandSocialFeed.findMany({
            where: { brandId: query.brandId, deletedAt: null },
            orderBy: [{ postedAt: 'desc' }, { createdAt: 'desc' }],
        });

        return feeds.map((feed) => ({
            id: feed.id,
            platform: feed.platform,
            postId: feed.postId,
            permalink: feed.permalink,
            imageUrl: feed.imageUrl.startsWith('http') ? feed.imageUrl : `${this.storageUrl}/${feed.imageUrl}`,
            caption: feed.caption ?? undefined,
            postedAt: feed.postedAt,
            isActive: feed.isActive,
            programId: feed.programId,
        }));
    }
}
