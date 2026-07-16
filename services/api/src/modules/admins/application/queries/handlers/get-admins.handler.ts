
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAdminsQuery } from '../get-admins.query';
import { Prisma } from '@prisma/client';
import { normalizePermissions } from '../../../../../shared/admin-access-response';

@Injectable()
export class GetAdminsHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(query: GetAdminsQuery) {
        const { page, limit, search, roleId, brandId, programId } = query;
        const skip = (page - 1) * limit;

        const where: Prisma.AdminWhereInput = {
            deletedAt: null,
        };

        if (search) {
            where.OR = [
                { fullName: { contains: search, mode: 'insensitive' } },
                { user: { email: { contains: search, mode: 'insensitive' } } },
            ];
        }

        if (roleId) {
            where.roleId = roleId;
        }

        if (brandId) {
            where.adminBrands = {
                some: { brandId },
            };
        }

        if (programId) {
            where.adminPrograms = {
                some: {
                    programId,
                    removedAt: null,
                },
            };
        }

        const [data, total] = await Promise.all([
            this.prisma.admin.findMany({
                where,
                skip,
                take: limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    user: {
                        select: { id: true, email: true, isActive: true, lastLoginAt: true, createdAt: true }
                    },
                    role: true,
                    adminBrands: {
                        include: { brand: { select: { id: true, name: true } } }
                    },
                    adminPrograms: {
                        where: {
                            removedAt: null,
                        },
                        include: {
                            program: {
                                select: {
                                    id: true,
                                    name: true,
                                    brandId: true,
                                },
                            },
                        },
                    }
                }
            }),
            this.prisma.admin.count({ where }),
        ]);

        return {
            data: data.map(admin => ({
                id: admin.id,
                fullName: admin.fullName,
                userId: admin.userId,
                roleId: admin.roleId,
                accessLevel: admin.accessLevel,
                canManageAdmins: admin.canManageAdmins,
                canAssignRoles: admin.canAssignRoles,
                user: admin.user ? {
                    id: admin.user.id,
                    email: admin.user.email,
                    isActive: admin.user.isActive,
                    createdAt: admin.user.createdAt,
                } : null,
                role: admin.role ? {
                    id: admin.role.id,
                    name: admin.role.name,
                    permissions: normalizePermissions(admin.role.permissions),
                    isActive: admin.role.isActive,
                } : null,
                brandIds: admin.adminBrands.map(ab => ab.brandId),
                programIds: admin.adminPrograms.map((assignment) => assignment.programId),
                brands: admin.adminBrands.map((assignment) => ({
                    brandId: assignment.brandId,
                    brandName: assignment.brand.name,
                    roleInBrand: assignment.roleInBrand,
                    permissions: normalizePermissions(assignment.permissions),
                })),
                programs: admin.adminPrograms.map((assignment) => ({
                    programId: assignment.programId,
                    programName: assignment.program.name,
                    brandId: assignment.program.brandId,
                    roleInProgram: assignment.roleInProgram,
                    permissions: normalizePermissions(assignment.permissions),
                })),
                createdAt: admin.createdAt,
                updatedAt: admin.updatedAt,
            })),
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
            },
        };
    }
}
