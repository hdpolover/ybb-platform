import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateSignatureCommand } from '../create-signature.command';
import { SignatureResponseDto } from '../../../presentation/dto/signature.dto';

function normalizeOptionalString(value?: string): string | null {
    if (value === undefined) {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

@CommandHandler(CreateSignatureCommand)
export class CreateSignatureHandler implements ICommandHandler<CreateSignatureCommand> {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: CreateSignatureCommand): Promise<SignatureResponseDto> {
        const { dto } = command;

        const brand = await this.prisma.brand.findUnique({ where: { id: dto.brandId } });
        if (!brand) throw new NotFoundException('Brand not found');

        const signature = await this.prisma.signature.create({
            data: {
                brandId: dto.brandId,
                name: dto.name.trim(),
                title: normalizeOptionalString(dto.title),
                imageUrl: dto.imageUrl.trim(),
                sortOrder: dto.sortOrder ?? 0,
                isActive: true,
            },
        });

        return {
            id: signature.id,
            brandId: signature.brandId,
            name: signature.name,
            title: signature.title ?? undefined,
            imageUrl: signature.imageUrl,
            isActive: signature.isActive,
            sortOrder: signature.sortOrder,
        };
    }
}
