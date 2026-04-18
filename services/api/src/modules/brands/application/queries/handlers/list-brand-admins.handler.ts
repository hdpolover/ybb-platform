import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ListBrandAdminsQuery } from '../list-brand-admins.query';

@QueryHandler(ListBrandAdminsQuery)
export class ListBrandAdminsHandler implements IQueryHandler<ListBrandAdminsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: ListBrandAdminsQuery) {
        const brand = await this.prisma.brand.findUnique({ where: { id: query.brandId } });
        if (!brand) throw new NotFoundException('Brand not found');

        return this.prisma.adminBrand.findMany({
            where: { brandId: query.brandId },
            include: {
                admin: {
                    select: {
                        id: true,
                        fullName: true,
                        user: { select: { email: true } },
                    },
                },
            },
            orderBy: { assignedAt: 'asc' },
        });
    }
}
