import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { GetAmbassadorReferralsQuery } from '../../commands/ambassador-admin.commands';

@QueryHandler(GetAmbassadorReferralsQuery)
export class GetAmbassadorReferralsHandler implements IQueryHandler<GetAmbassadorReferralsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetAmbassadorReferralsQuery) {
        const { ambassadorId, page, limit } = query;

        const ambassador = await this.prisma.ambassador.findUnique({
            where: { id: ambassadorId },
            select: { id: true },
        });

        if (!ambassador) {
            throw new NotFoundException(`Ambassador ${ambassadorId} not found`);
        }

        const skip = (page - 1) * limit;

        const [referrals, total] = await Promise.all([
            this.prisma.ambassadorReferral.findMany({
                where: { ambassadorId },
                skip,
                take: limit,
                orderBy: { referredAt: 'desc' },
                include: {
                    participant: {
                        include: {
                            user: {
                                select: { email: true },
                            },
                        },
                    },
                },
            }),
            this.prisma.ambassadorReferral.count({ where: { ambassadorId } }),
        ]);

        return {
            data: referrals.map((r) => ({
                id: r.id,
                status: r.status,
                participantId: r.participantId,
                participantName: r.participant.fullName,
                participantEmail: r.participant.user?.email ?? null,
                referredAt: r.referredAt,
                registeredAt: r.registeredAt,
                appliedAt: r.appliedAt,
                acceptedAt: r.acceptedAt,
                completedAt: r.completedAt,
                daysToRegister: r.daysToRegister,
                daysToApply: r.daysToApply,
                daysToAccept: r.daysToAccept,
                totalConversionDays: r.totalConversionDays,
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
