import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AssignBrandAdminCommand } from '../assign-brand-admin.command';

@CommandHandler(AssignBrandAdminCommand)
export class AssignBrandAdminHandler implements ICommandHandler<AssignBrandAdminCommand> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(command: AssignBrandAdminCommand) {
        const brand = await this.prisma.brand.findUnique({ where: { id: command.brandId } });
        if (!brand) throw new NotFoundException('Brand not found');

        const admin = await this.prisma.admin.findUnique({ where: { id: command.adminId } });
        if (!admin) throw new NotFoundException('Admin not found');

        const existing = await this.prisma.adminBrand.findUnique({
            where: { adminId_brandId: { adminId: command.adminId, brandId: command.brandId } },
        });
        if (existing) throw new ConflictException('Admin is already assigned to this brand');

        return this.prisma.adminBrand.create({
            data: {
                adminId: command.adminId,
                brandId: command.brandId,
                roleInBrand: command.roleInBrand ?? 'admin',
                // permissions are managed through the admin roles flow, never client-supplied here
                permissions: [],
                assignedBy: command.assignedBy,
            },
            include: {
                admin: {
                    select: {
                        id: true,
                        fullName: true,
                        user: { select: { email: true } },
                    },
                },
            },
        });
    }
}
