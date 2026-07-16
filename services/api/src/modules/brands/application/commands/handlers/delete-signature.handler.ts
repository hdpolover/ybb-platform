import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { DeleteSignatureCommand } from '../delete-signature.command';

@CommandHandler(DeleteSignatureCommand)
export class DeleteSignatureHandler implements ICommandHandler<DeleteSignatureCommand> {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: DeleteSignatureCommand): Promise<void> {
        const signature = await this.prisma.signature.findFirst({
            where: { id: command.signatureId, deletedAt: null },
        });
        if (!signature) throw new NotFoundException('Signature not found');

        await this.prisma.signature.update({
            where: { id: command.signatureId },
            data: { deletedAt: new Date(), isActive: false },
        });
    }
}
