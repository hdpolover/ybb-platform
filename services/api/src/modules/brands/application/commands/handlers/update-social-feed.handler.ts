import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { UpdateSocialFeedCommand } from '../update-social-feed.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SocialFeedResponseDto } from '@modules/brands/presentation/dto/brand.dto';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { derivePostId, resolveSocialFeedMetadata } from './social-feed-metadata.helper';
import { parseInstagramPermalinkInput } from './social-feed-permalink.helper';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

function normalizeOptionalString(value?: string | null): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }
    if (value === null) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizePlatform(value?: string): string | undefined {
    if (value === undefined) {
        return undefined;
    }

    const platform = value.trim().toLowerCase();
    if (platform !== 'instagram') {
        throw new BadRequestException('Only instagram feeds are supported on the landing page.');
    }

    return platform;
}

@CommandHandler(UpdateSocialFeedCommand)
export class UpdateSocialFeedHandler implements ICommandHandler<UpdateSocialFeedCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly landingRevalidation: LandingRevalidationService,
        private readonly cacheService: CacheService,
    ) { }

    async execute(command: UpdateSocialFeedCommand): Promise<SocialFeedResponseDto> {
        const { brandId, socialFeedId, dto } = command;

        const feed = await this.prisma.brandSocialFeed.findFirst({
            where: { id: socialFeedId, brandId, deletedAt: null },
        });
        if (!feed) {
            throw new NotFoundException('Social feed not found');
        }

        const nextPermalink = dto.permalink !== undefined
            ? parseInstagramPermalinkInput(dto.permalink)
            : feed.permalink;
        const metadata = dto.permalink !== undefined
            ? await resolveSocialFeedMetadata(nextPermalink).catch(() => ({
                imageUrl: null,
                caption: null,
                postedAt: null,
            }))
            : null;
        const nextImageUrl = dto.imageUrl !== undefined
            ? dto.imageUrl.trim()
            : metadata?.imageUrl ?? feed.imageUrl;
        const nextCaption = dto.caption !== undefined
            ? normalizeOptionalString(dto.caption) ?? null
            : metadata?.caption ?? feed.caption ?? null;
        const nextPostedAt = dto.postedAt !== undefined
            ? new Date(dto.postedAt)
            : metadata?.postedAt ?? feed.postedAt;
        const nextPostId = dto.postId !== undefined
            ? normalizeOptionalString(dto.postId) || derivePostId(undefined, nextPermalink)
            : dto.permalink !== undefined
                ? derivePostId(undefined, nextPermalink)
                : feed.postId;

        const updated = await this.prisma.brandSocialFeed.update({
            where: { id: socialFeedId },
            data: {
                ...(dto.platform !== undefined ? { platform: normalizePlatform(dto.platform) } : {}),
                ...(dto.postId !== undefined || dto.permalink !== undefined ? { postId: nextPostId } : {}),
                ...(dto.permalink !== undefined ? { permalink: nextPermalink } : {}),
                ...(dto.imageUrl !== undefined || dto.permalink !== undefined ? { imageUrl: nextImageUrl } : {}),
                ...(dto.caption !== undefined || dto.permalink !== undefined ? { caption: nextCaption } : {}),
                ...(dto.postedAt !== undefined || dto.permalink !== undefined ? { postedAt: nextPostedAt } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });

        await Promise.all([
            this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId } }),
            this.cacheService.invalidateBrandLandingCaches(brandId),
        ]);
        await this.landingRevalidation.revalidateForBrand(brandId);

        return {
            id: updated.id,
            platform: updated.platform,
            postId: updated.postId,
            permalink: updated.permalink,
            imageUrl: updated.imageUrl,
            caption: updated.caption ?? undefined,
            postedAt: updated.postedAt,
            isActive: updated.isActive,
        };
    }
}
