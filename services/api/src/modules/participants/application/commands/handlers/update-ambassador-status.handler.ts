import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UpdateAmbassadorStatusCommand } from '../ambassador-admin.commands';

@CommandHandler(UpdateAmbassadorStatusCommand)
export class UpdateAmbassadorStatusHandler implements ICommandHandler<UpdateAmbassadorStatusCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: UpdateAmbassadorStatusCommand): Promise<any> {
        const { ambassadorId, isActive } = command;

        const ambassador = await this.prisma.ambassador.findUnique({
            where: { id: ambassadorId }
        });

        if (!ambassador) {
            throw new NotFoundException('Ambassador not found');
        }

        return this.prisma.ambassador.update({
            where: { id: ambassadorId },
            data: { 
                isActive,
                ...(isActive ? { activatedAt: new Date(), deactivatedAt: null } : { deactivatedAt: new Date() })
            }
        });
    }
}
