
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UpdateAdminCommand } from '../update-admin.command';

@Injectable()
export class UpdateAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: UpdateAdminCommand) {
        const { id, updates, updatedBy } = command;

        const admin = await this.prisma.admin.findUnique({
            where: { id },
            include: { user: true }
        });

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        return this.prisma.$transaction(async (tx) => {
            // Update User-level fields (isActive)
            if (updates.isActive !== undefined) {
                await tx.user.update({
                    where: { id: admin.userId },
                    data: { isActive: updates.isActive }
                });
            }

            // Update Admin-level fields
            if (updates.fullName || updates.roleId) {
                await tx.admin.update({
                    where: { id },
                    data: {
                        fullName: updates.fullName,
                        roleId: updates.roleId,
                        updatedAt: new Date(),
                        // updatedBy: updatedBy // Schema check: Admin has no updatedBy field?
                    }
                });
            }

            // Update Brands
            if (updates.brandIds) {
                // Remove existing brands
                await tx.adminBrand.deleteMany({
                    where: { adminId: id }
                });

                // Add new brands
                if (updates.brandIds.length > 0) {
                    await tx.adminBrand.createMany({
                        data: updates.brandIds.map(brandId => ({
                            adminId: id,
                            brandId: brandId,
                            roleInBrand: 'admin'
                        }))
                    });
                }
            }

            return { success: true };
        });
    }
}
