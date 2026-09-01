import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { CreateSocialFeedCommand } from '../create-social-feed.command';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SocialFeedResponseDto } from '@modules/brands/presentation/dto/brand.dto';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';
import { derivePostId, resolveSocialFeedMetadata } from './social-feed-metadata.helper';
import { parseInstagramPermalinkInput } from './social-feed-permalink.helper';
import { CacheService } from '@shared/infrastructure/cache/cache.service';

function normalizeOptionalString(value?: string | null): string | null {
    if (value === undefined || value === null) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function normalizePlatform(value?: string): string {
    const platform = value?.trim().toLowerCase() || 'instagram';
    if (platform !== 'instagram') {
        throw new BadRequestException('Only instagram feeds are supported on the landing page.');
    }

    return platform;
}

@CommandHandler(CreateSocialFeedCommand)
export class CreateSocialFeedHandler implements ICommandHandler<CreateSocialFeedCommand> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly landingRevalidation: LandingRevalidationService,
        private readonly cacheService: CacheService,
    ) { }

    async execute(command: CreateSocialFeedCommand): Promise<SocialFeedResponseDto> {
        const { brandId, dto } = command;

        const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) {
            throw new NotFoundException('Brand not found');
        }

        if (dto.programId) {
            const program = await this.prisma.program.findUnique({ where: { id: dto.programId } });
            if (!program || program.brandId !== brandId) {
                throw new BadRequestException('Program does not belong to this brand.');
            }
        }

        const platform = normalizePlatform(dto.platform);
        const permalink = parseInstagramPermalinkInput(dto.permalink);
        const metadata = await resolveSocialFeedMetadata(permalink).catch(() => ({
            imageUrl: null,
            caption: null,
            postedAt: null,
        }));
        const imageUrl = normalizeOptionalString(dto.imageUrl) ?? metadata.imageUrl ?? normalizeOptionalString(brand.bannerUrl) ?? normalizeOptionalString(brand.logoUrl);
        if (!imageUrl) {
            throw new BadRequestException('Could not determine a preview image from the Instagram post URL.');
        }

        const postedAt = dto.postedAt ? new Date(dto.postedAt) : metadata.postedAt ?? new Date();

        const feed = await this.prisma.brandSocialFeed.create({
            data: {
                brandId,
                programId: dto.programId ?? null,
                platform,
                postId: derivePostId(dto.postId, permalink),
                permalink,
                imageUrl,
                caption: dto.caption !== undefined ? normalizeOptionalString(dto.caption) : normalizeOptionalString(metadata.caption),
                postedAt,
                isActive: dto.isActive ?? true,
            },
        });

        await Promise.all([
            this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId } }),
            this.cacheService.invalidateBrandLandingCaches(brandId),
        ]);
        await this.landingRevalidation.revalidateForBrand(brandId);

        return {
            id: feed.id,
            platform: feed.platform,
            postId: feed.postId,
            permalink: feed.permalink,
            imageUrl: feed.imageUrl,
            caption: feed.caption ?? undefined,
            postedAt: feed.postedAt,
            isActive: feed.isActive,
            programId: feed.programId,
        };
    }
}
