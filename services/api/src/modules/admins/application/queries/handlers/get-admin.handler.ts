
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAdminQuery } from '../get-admin.query';
import {
    buildAccessiblePrograms,
    getAdminProgramAccessScope,
    mapAdminBrandAssignment,
    mapAdminProgramAssignment,
    normalizePermissions,
} from '../../../../../shared/admin-access-response';

@Injectable()
export class GetAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(query: GetAdminQuery) {
        const admin = await this.prisma.admin.findUnique({
            where: { id: query.id },
            include: {
                user: { select: { id: true, email: true, isActive: true, lastLoginAt: true, createdAt: true } },
                role: true,
                adminBrands: {
                    include: {
                        brand: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
                                logoUrl: true,
                                logoWhiteUrl: true,
                                logoColorUrl: true,
                                logoIconUrl: true,
                            },
                        },
                    },
                },
                adminPrograms: {
                    include: {
                        program: {
                            select: {
                                id: true,
                                brandId: true,
                                name: true,
                                slug: true,
                                year: true,
                                status: true,
                                isActive: true,
                                startDate: true,
                                endDate: true,
                                logoUrl: true,
                                logoWhiteUrl: true,
                                logoColorUrl: true,
                                logoIconUrl: true,
                                brand: {
                                    select: {
                                        id: true,
                                        name: true,
                                        slug: true,
                                        isActive: true,
                                        logoUrl: true,
                                        logoWhiteUrl: true,
                                        logoColorUrl: true,
                                        logoIconUrl: true,
                                    },
                                },
                            },
                        },
                    },
                }
            }
        });

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        const accessScope = getAdminProgramAccessScope(admin);
        const accessiblePrograms = accessScope === 'assigned'
            ? admin.adminPrograms.map((assignment) => mapAdminProgramAssignment(assignment))
            : buildAccessiblePrograms({
                availablePrograms: await this.prisma.program.findMany({
                    where: {
                        deletedAt: null,
                        ...(accessScope === 'brand_scope'
                            ? { brandId: { in: admin.adminBrands.map((assignment) => assignment.brandId) } }
                            : {}),
                    },
                    select: {
                        id: true,
                        brandId: true,
                        name: true,
                        slug: true,
                        year: true,
                        status: true,
                        isActive: true,
                        startDate: true,
                        endDate: true,
                        logoUrl: true,
                        logoWhiteUrl: true,
                        logoColorUrl: true,
                        logoIconUrl: true,
                        brand: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
                                logoUrl: true,
                                logoWhiteUrl: true,
                                logoColorUrl: true,
                                logoIconUrl: true,
                            },
                        },
                    },
                    orderBy: [{ isActive: 'desc' }, { year: 'desc' }, { name: 'asc' }],
                }),
                assignments: admin.adminPrograms,
                unassignedAccessType: accessScope,
            });

        return {
            id: admin.id,
            userId: admin.userId,
            fullName: admin.fullName,
            accessLevel: admin.accessLevel,
            canManageAdmins: admin.canManageAdmins,
            canAssignRoles: admin.canAssignRoles,
            user: {
                id: admin.user.id,
                email: admin.user.email,
                isActive: admin.user.isActive,
                createdAt: admin.user.createdAt,
            },
            lastLoginAt: admin.user.lastLoginAt,
            avatarUrl: admin.avatarUrl,
            customPermissions: normalizePermissions(admin.customPermissions),
            roleId: admin.roleId,
            role: admin.role ? {
                id: admin.roleId,
                name: admin.role.name,
                permissions: normalizePermissions(admin.role.permissions),
                isActive: admin.role.isActive,
            } : null,
            brandIds: admin.adminBrands.map((assignment) => assignment.brandId),
            programIds: admin.adminPrograms.map((assignment) => assignment.programId),
            brands: admin.adminBrands.map((assignment) => ({
                ...mapAdminBrandAssignment(assignment),
                roleInBrand: assignment.roleInBrand ?? 'member',
            })),
            programs: admin.adminPrograms.map((assignment) => ({
                ...mapAdminProgramAssignment(assignment),
                roleInProgram: assignment.roleInProgram ?? 'member',
            })),
            accessiblePrograms,
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
        };
    }
}
