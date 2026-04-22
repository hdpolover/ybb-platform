import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../../../files/application/storage.service';
import { CreateSponsorCommand } from '../create-sponsor.command';
import { SponsorResponseDto } from '../../../presentation/dto/brand.dto';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';

function normalizeOptionalString(value?: string): string | null {
    if (value === undefined) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

@CommandHandler(CreateSponsorCommand)
export class CreateSponsorHandler implements ICommandHandler<CreateSponsorCommand> {
    private readonly storageUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
        private readonly landingRevalidation: LandingRevalidationService,
    ) {
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }

    async execute(command: CreateSponsorCommand): Promise<SponsorResponseDto> {
        const { brandId, dto, userId, file } = command;

        const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) throw new NotFoundException('Brand not found');

        let logoUrl = normalizeOptionalString(dto.logoUrl) ?? undefined;
        if (file) {
            const result = await this.storageService.uploadFile(
                file,
                userId,
                brandId,
                'brands/sponsor-logos',
            );
            logoUrl = result.url;
        }

        const sponsor = await this.prisma.sponsor.create({
            data: {
                brandId,
                name: dto.name.trim(),
                type: dto.type.trim(),
                tier: normalizeOptionalString(dto.tier),
                websiteUrl: normalizeOptionalString(dto.websiteUrl),
                description: normalizeOptionalString(dto.description),
                order: dto.order ?? 0,
                isActive: true,
                ...(logoUrl ? { logoUrl } : {}),
            },
        });

        await this.landingRevalidation.revalidateForBrand(brandId);

        return {
            id: sponsor.id,
            name: sponsor.name,
            type: sponsor.type,
            // Legacy rows may hold a storage path instead of an http(s) URL;
            // prepend storageUrl for those so the frontend always gets a URL.
            logoUrl: sponsor.logoUrl
                ? (sponsor.logoUrl.startsWith('http') ? sponsor.logoUrl : `${this.storageUrl}/${sponsor.logoUrl}`)
                : undefined,
            websiteUrl: sponsor.websiteUrl ?? undefined,
            tier: sponsor.tier ?? undefined,
            description: sponsor.description ?? undefined,
            order: sponsor.order,
        };
    }
}
