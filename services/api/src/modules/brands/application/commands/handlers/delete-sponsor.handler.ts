import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { DeleteSponsorCommand } from '../delete-sponsor.command';

@CommandHandler(DeleteSponsorCommand)
export class DeleteSponsorHandler implements ICommandHandler<DeleteSponsorCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: DeleteSponsorCommand): Promise<void> {
        const sponsor = await this.prisma.sponsor.findFirst({
            where: { id: command.sponsorId, brandId: command.brandId },
        });
        if (!sponsor) throw new NotFoundException('Sponsor not found');

        await this.prisma.sponsor.delete({ where: { id: command.sponsorId } });
    }
}
