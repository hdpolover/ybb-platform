import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ResolveAmbassadorShareTokenQuery } from '../resolve-ambassador-share-token.query';
import { parseAmbassadorShareToken } from '../../utils/ambassador-share-token.util';

@QueryHandler(ResolveAmbassadorShareTokenQuery)
export class ResolveAmbassadorShareTokenHandler implements IQueryHandler<ResolveAmbassadorShareTokenQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: ResolveAmbassadorShareTokenQuery): Promise<{ referralCode: string }> {
        const token = query.token?.trim();
        if (!token) {
            throw new BadRequestException('token is required');
        }

        let ambassadorId: string;
        try {
            ambassadorId = parseAmbassadorShareToken(token);
        } catch {
            throw new BadRequestException('Invalid ambassador share token');
        }

        const ambassador = await this.prisma.ambassador.findFirst({
            where: {
                id: ambassadorId,
                deletedAt: null,
                isActive: true,
            },
            select: {
                referralCode: true,
            },
        });

        if (!ambassador) {
            throw new NotFoundException('Ambassador share token not found');
        }

        return { referralCode: ambassador.referralCode };
    }
}
