import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../../../files/application/storage.service';
import { UpdateSponsorCommand } from '../update-sponsor.command';
import { SponsorResponseDto } from '../../../presentation/dto/brand.dto';

@CommandHandler(UpdateSponsorCommand)
export class UpdateSponsorHandler implements ICommandHandler<UpdateSponsorCommand> {
    private readonly storageUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
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

        let logoPath: string | undefined;
        if (file) {
            const result = await this.storageService.uploadFile(
                file,
                userId,
                brandId,
                'brands/sponsor-logos',
            );
            logoPath = result.path;
        }

        const updated = await this.prisma.sponsor.update({
            where: { id: sponsorId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name } : {}),
                ...(dto.type !== undefined ? { type: dto.type } : {}),
                ...(dto.tier !== undefined ? { tier: dto.tier ?? null } : {}),
                ...(dto.websiteUrl !== undefined ? { websiteUrl: dto.websiteUrl ?? null } : {}),
                ...(dto.description !== undefined ? { description: dto.description ?? null } : {}),
                ...(dto.order !== undefined ? { order: dto.order } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
                ...(logoPath ? { logoUrl: logoPath } : {}),
            },
        });

        return {
            id: updated.id,
            name: updated.name,
            type: updated.type,
            logoUrl: updated.logoUrl ? `${this.storageUrl}/${updated.logoUrl}` : undefined,
            websiteUrl: updated.websiteUrl ?? undefined,
            tier: updated.tier ?? undefined,
            description: updated.description ?? undefined,
            order: updated.order,
        };
    }
}
