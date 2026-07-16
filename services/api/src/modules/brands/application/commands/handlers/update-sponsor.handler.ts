import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../../../files/application/storage.service';
import { UpdateSponsorCommand } from '../update-sponsor.command';
import { SponsorResponseDto } from '../../../presentation/dto/brand.dto';
import { LandingRevalidationService } from '../../services/landing-revalidation.service';

function normalizeOptionalString(value?: string): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

@CommandHandler(UpdateSponsorCommand)
export class UpdateSponsorHandler implements ICommandHandler<UpdateSponsorCommand> {
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

    async execute(command: UpdateSponsorCommand): Promise<SponsorResponseDto> {
        const { brandId, sponsorId, dto, userId, file } = command;

        const sponsor = await this.prisma.sponsor.findFirst({
            where: { id: sponsorId, brandId },
        });
        if (!sponsor) throw new NotFoundException('Sponsor not found');

        const normalizedLogoUrl = normalizeOptionalString(dto.logoUrl);
        let logoUrl: string | undefined;
        if (file) {
            const result = await this.storageService.uploadFile(
                file,
                userId,
                brandId,
                'brands/sponsor-logos',
            );
            logoUrl = result.url;
        }

        const updated = await this.prisma.sponsor.update({
            where: { id: sponsorId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.type !== undefined ? { type: dto.type.trim() } : {}),
                ...(dto.tier !== undefined ? { tier: normalizeOptionalString(dto.tier) ?? null } : {}),
                ...(dto.websiteUrl !== undefined ? { websiteUrl: normalizeOptionalString(dto.websiteUrl) ?? null } : {}),
                ...(dto.description !== undefined ? { description: normalizeOptionalString(dto.description) ?? null } : {}),
                ...(dto.order !== undefined ? { order: dto.order } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
                ...(file ? { logoUrl } : {}),
                ...(file === undefined && dto.logoUrl !== undefined ? { logoUrl: normalizedLogoUrl ?? null } : {}),
            },
        });

        await this.prisma.brandLandingSnapshot.deleteMany({ where: { brandId } });
        await this.landingRevalidation.revalidateForBrand(brandId);

        return {
            id: updated.id,
            name: updated.name,
            type: updated.type,
            // Legacy rows may hold a storage path; prepend storageUrl as a
            // safety net so the frontend always receives an http(s) URL.
            logoUrl: updated.logoUrl
                ? (updated.logoUrl.startsWith('http') ? updated.logoUrl : `${this.storageUrl}/${updated.logoUrl}`)
                : undefined,
            websiteUrl: updated.websiteUrl ?? undefined,
            tier: updated.tier ?? undefined,
            description: updated.description ?? undefined,
            order: updated.order,
        };
    }
}
