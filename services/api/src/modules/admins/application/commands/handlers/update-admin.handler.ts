
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { UpdateAdminCommand } from '../update-admin.command';
import { normalizePermissions } from '../../../../../shared/admin-access-response';

@Injectable()
export class UpdateAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: UpdateAdminCommand) {
        const { id, updates, updatedBy } = command;

        const admin = await this.prisma.admin.findUnique({
            where: { id },
            include: {
                user: true,
                role: true,
                adminBrands: {
                    select: {
                        brandId: true,
                    },
                },
                adminPrograms: {
                    where: {
                        removedAt: null,
                    },
                    select: {
                        programId: true,
                    },
                },
            }
        });

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        const nextRole = updates.roleId !== undefined
            ? (updates.roleId
                ? await this.prisma.adminRole.findFirst({
                    where: {
                        id: updates.roleId,
                        deletedAt: null,
                        isActive: true,
                    },
                })
                : null)
            : admin.role;

        if (updates.roleId && !nextRole) {
            throw new BadRequestException('Selected role was not found or is inactive.');
        }

        const nextProgramIds = updates.programIds !== undefined
            ? Array.from(new Set(updates.programIds))
            : admin.adminPrograms.map((assignment) => assignment.programId);

        const programs = nextProgramIds.length > 0
            ? await this.prisma.program.findMany({
                where: {
                    id: { in: nextProgramIds },
                    deletedAt: null,
                },
                select: {
                    id: true,
                    brandId: true,
                },
            })
            : [];

        if (programs.length !== nextProgramIds.length) {
            throw new BadRequestException('One or more selected programs were not found.');
        }

        const manualBrandIds = updates.brandIds !== undefined
            ? updates.brandIds
            : admin.adminBrands.map((assignment) => assignment.brandId);
        const nextBrandIds = Array.from(new Set([
            ...manualBrandIds,
            ...programs.map((program) => program.brandId),
        ]));

        const assignmentRoleName = nextRole?.name ?? 'Admin';
        const assignmentPermissions = normalizePermissions(nextRole?.permissions);

        return this.prisma.$transaction(async (tx) => {
            // Update User-level fields (isActive)
            if (updates.isActive !== undefined) {
                await tx.user.update({
                    where: { id: admin.userId },
                    data: { isActive: updates.isActive }
                });
            }

            // Update Admin-level fields
            if (updates.fullName !== undefined || updates.roleId !== undefined) {
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
            if (updates.brandIds !== undefined || updates.programIds !== undefined || updates.roleId !== undefined) {
                await tx.adminBrand.deleteMany({
                    where: { adminId: id }
                });

                if (nextBrandIds.length > 0) {
                    await tx.adminBrand.createMany({
                        data: nextBrandIds.map(brandId => ({
                            adminId: id,
                            brandId: brandId,
                            roleInBrand: assignmentRoleName,
                            permissions: assignmentPermissions,
                        }))
                    });
                }

                await tx.user.update({
                    where: { id: admin.userId },
                    data: {
                        brandId: nextBrandIds[0] ?? admin.user.brandId,
                    },
                });
            }

            if (updates.programIds !== undefined || updates.roleId !== undefined) {
                await tx.adminProgram.deleteMany({
                    where: { adminId: id },
                });

                if (nextProgramIds.length > 0) {
                    await tx.adminProgram.createMany({
                        data: nextProgramIds.map((programId) => ({
                            adminId: id,
                            programId,
                            roleInProgram: assignmentRoleName,
                            permissions: assignmentPermissions,
                            assignedBy: updatedBy,
                        })),
                    });
                }
            }

            return { success: true };
        });
    }
}
