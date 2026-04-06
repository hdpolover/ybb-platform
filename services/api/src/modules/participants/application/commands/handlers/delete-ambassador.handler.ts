import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { DeleteAmbassadorCommand } from '../delete-ambassador.command';

@CommandHandler(DeleteAmbassadorCommand)
export class DeleteAmbassadorHandler implements ICommandHandler<DeleteAmbassadorCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: DeleteAmbassadorCommand): Promise<{ success: boolean }> {
        const { ambassadorId, deletedBy } = command;

        const ambassador = await this.prisma.ambassador.findUnique({
            where: { id: ambassadorId },
            select: { id: true, deletedAt: true },
        });

        if (!ambassador) {
            throw new NotFoundException(`Ambassador ${ambassadorId} not found`);
        }

        if (ambassador.deletedAt) {
            throw new NotFoundException(`Ambassador ${ambassadorId} not found`);
        }

        await this.prisma.ambassador.update({
            where: { id: ambassadorId },
            data: {
                deletedAt: new Date(),
                deletedBy,
                isActive: false,
            },
        });

        return { success: true };
    }
}
