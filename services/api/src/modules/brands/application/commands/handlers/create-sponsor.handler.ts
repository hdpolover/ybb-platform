import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '../../../../files/application/storage.service';
import { CreateSponsorCommand } from '../create-sponsor.command';
import { SponsorResponseDto } from '../../../presentation/dto/brand.dto';

@CommandHandler(CreateSponsorCommand)
export class CreateSponsorHandler implements ICommandHandler<CreateSponsorCommand> {
    private readonly storageUrl: string;

    constructor(
        private readonly prisma: PrismaService,
        private readonly storageService: StorageService,
        private readonly configService: ConfigService,
    ) {
        const rawUrl = this.configService.get('STORAGE_PUBLIC_URL', 'http://localhost:9000');
        this.storageUrl = rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`;
    }

    async execute(command: CreateSponsorCommand): Promise<SponsorResponseDto> {
        const { brandId, dto, userId, file } = command;

        const brand = await this.prisma.brand.findUnique({ where: { id: brandId } });
        if (!brand) throw new NotFoundException('Brand not found');

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

        const sponsor = await this.prisma.sponsor.create({
            data: {
                brandId,
                name: dto.name,
                type: dto.type,
                tier: dto.tier ?? null,
                websiteUrl: dto.websiteUrl ?? null,
                description: dto.description ?? null,
                order: dto.order ?? 0,
                isActive: true,
                ...(logoPath ? { logoUrl: logoPath } : {}),
            },
        });

        return {
            id: sponsor.id,
            name: sponsor.name,
            type: sponsor.type,
            logoUrl: sponsor.logoUrl ? `${this.storageUrl}/${sponsor.logoUrl}` : undefined,
            websiteUrl: sponsor.websiteUrl ?? undefined,
            tier: sponsor.tier ?? undefined,
            description: sponsor.description ?? undefined,
            order: sponsor.order,
        };
    }
}
