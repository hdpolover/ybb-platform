
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { DeleteAdminCommand } from '../delete-admin.command';

@Injectable()
export class DeleteAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: DeleteAdminCommand) {
        const { id, deletedBy } = command;

        const admin = await this.prisma.admin.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        return this.prisma.$transaction(async (tx) => {
            const now = new Date();

            // Deactivate User
            await tx.user.update({
                where: { id: admin.userId },
                data: {
                    isActive: false,
                    deletedAt: now
                }
            });

            // Delete Admin
            await tx.admin.update({
                where: { id },
                data: {
                    deletedAt: now,
                    deletedBy: deletedBy
                }
            });

            return { success: true };
        });
    }
}
