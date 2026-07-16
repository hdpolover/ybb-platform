import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RemoveBrandAdminCommand } from '../remove-brand-admin.command';

@CommandHandler(RemoveBrandAdminCommand)
export class RemoveBrandAdminHandler implements ICommandHandler<RemoveBrandAdminCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: RemoveBrandAdminCommand) {
        const record = await this.prisma.adminBrand.findUnique({
            where: { adminId_brandId: { adminId: command.adminId, brandId: command.brandId } },
        });
        if (!record) throw new NotFoundException('Admin is not assigned to this brand');

        await this.prisma.adminBrand.delete({
            where: { adminId_brandId: { adminId: command.adminId, brandId: command.brandId } },
        });

        return { message: 'Admin removed from brand successfully' };
    }
}
