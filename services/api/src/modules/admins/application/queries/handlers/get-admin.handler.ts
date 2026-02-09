
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAdminQuery } from '../get-admin.query';

@Injectable()
export class GetAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(query: GetAdminQuery) {
        const admin = await this.prisma.admin.findUnique({
            where: { id: query.id },
            include: {
                user: { select: { email: true, isActive: true, lastLoginAt: true } },
                role: true,
                adminBrands: { include: { brand: { select: { name: true } } } },
                adminPrograms: { include: { program: { select: { name: true } } } }
            }
        });

        if (!admin) {
            throw new NotFoundException('Admin not found');
        }

        return {
            id: admin.id,
            fullName: admin.fullName,
            email: admin.user.email,
            isActive: admin.user.isActive,
            lastLoginAt: admin.user.lastLoginAt,
            role: {
                id: admin.roleId,
                name: admin.role?.name,
                permissions: admin.role?.permissions
            },
            brands: admin.adminBrands.map(ab => ({
                id: ab.brandId,
                name: ab.brand.name,
                role: ab.roleInBrand
            })),
            programs: admin.adminPrograms.map(ap => ({
                id: ap.programId,
                name: ap.program.name,
                role: ap.roleInProgram
            })),
            createdAt: admin.createdAt,
            updatedAt: admin.updatedAt,
        };
    }
}
