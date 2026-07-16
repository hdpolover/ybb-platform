import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UpdateSignatureCommand } from '../update-signature.command';
import { SignatureResponseDto } from '../../../presentation/dto/signature.dto';

function normalizeOptionalString(value?: string): string | null | undefined {
    if (value === undefined) {
        return undefined;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

@CommandHandler(UpdateSignatureCommand)
export class UpdateSignatureHandler implements ICommandHandler<UpdateSignatureCommand> {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: UpdateSignatureCommand): Promise<SignatureResponseDto> {
        const { signatureId, dto } = command;

        const signature = await this.prisma.signature.findFirst({
            where: { id: signatureId, deletedAt: null },
        });
        if (!signature) throw new NotFoundException('Signature not found');

        const updated = await this.prisma.signature.update({
            where: { id: signatureId },
            data: {
                ...(dto.name !== undefined ? { name: dto.name.trim() } : {}),
                ...(dto.title !== undefined ? { title: normalizeOptionalString(dto.title) ?? null } : {}),
                ...(dto.imageUrl !== undefined ? { imageUrl: dto.imageUrl.trim() } : {}),
                ...(dto.sortOrder !== undefined ? { sortOrder: dto.sortOrder } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
        });

        return {
            id: updated.id,
            brandId: updated.brandId,
            name: updated.name,
            title: updated.title ?? undefined,
            imageUrl: updated.imageUrl,
            isActive: updated.isActive,
            sortOrder: updated.sortOrder,
        };
    }
}
