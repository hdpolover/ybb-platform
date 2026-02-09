
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetAdminsQuery } from '../get-admins.query';
import { Prisma } from '@prisma/client';

@Injectable()
export class GetAdminsHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(query: GetAdminsQuery) {
        const { page, limit, search, roleId, brandId } = query;
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
                some: {
                    brandId: brandId
                }
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
                        select: { email: true, isActive: true, lastLoginAt: true }
                    },
                    role: true,
                    adminBrands: {
                        include: { brand: { select: { name: true } } }
                    }
                }
            }),
            this.prisma.admin.count({ where }),
        ]);

        return {
            data: data.map(admin => ({
                id: admin.id,
                fullName: admin.fullName,
                email: admin.user.email,
                isActive: admin.user.isActive,
                lastLoginAt: admin.user.lastLoginAt,
                role: admin.role?.name || 'No Role',
                brands: admin.adminBrands.map(ab => ({
                    id: ab.brandId,
                    name: ab.brand.name,
                    role: ab.roleInBrand
                })),
                createdAt: admin.createdAt
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
