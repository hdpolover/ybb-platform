import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetAmbassadorDashboardQuery } from '../get-ambassador-dashboard.query';
import { IAmbassadorRepository } from '../../../../../core/interfaces/repositories/ambassador.repository.interface';
import { AmbassadorDashboardDto } from '../../../presentation/dto/ambassador.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { createAmbassadorShareToken } from '../../utils/ambassador-share-token.util';

@QueryHandler(GetAmbassadorDashboardQuery)
export class GetAmbassadorDashboardHandler implements IQueryHandler<GetAmbassadorDashboardQuery> {
    constructor(
        @Inject('IAmbassadorRepository')
        private readonly ambassadorRepository: IAmbassadorRepository,
        private readonly prisma: PrismaService,
    ) { }

    async execute(query: GetAmbassadorDashboardQuery): Promise<AmbassadorDashboardDto> {
        const { userId } = query;
        // Direct query to include relations for the dashboard read-model
            const ambassador = await this.prisma.ambassador.findUnique({
             where: { userId },
             include: {
                 referrals: {
                     where: { deletedAt: null },
                     orderBy: { referredAt: 'desc' },
                     include: {
                         participant: {
                             select: {
                                 id: true,
                                 fullName: true,
                             },
                         },
                     },
                 },
                 program: {
                     include: {
                         brand: true
                     }
                 }
             }
        });

        if (!ambassador) {
            throw new NotFoundException('Ambassador profile not found');
        }

        // Construct Link
        // Scheme: https://{brandDomain}/programs/{programSlug}?r={shareToken}
        const brandUrl = ambassador.program.brand.websiteUrl || 'ybb.co';
        const cleanBrandUrl = brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const slug = ambassador.program.slug; // Assuming slug exists on Program
        const shareToken = createAmbassadorShareToken(ambassador.id);
        const shareLink = `https://${cleanBrandUrl}/programs/${slug}?r=${shareToken}`;

        // Map to DTO
        return {
            id: ambassador.id,
            fullName: ambassador.fullName,
            referralCode: ambassador.referralCode,
            totalReferrals: ambassador.totalReferrals,
            successfulReferrals: ambassador.successfulReferrals,
            isActive: ambassador.isActive,
            programName: ambassador.program.name,
            shareLink,
            referrals: ambassador.referrals.map((referral) => ({
                id: referral.id,
                participantId: referral.participant.id,
                participantName: referral.participant.fullName || 'Participant',
                status: referral.status,
                referredAt: referral.referredAt,
                registeredAt: referral.registeredAt,
                appliedAt: referral.appliedAt,
                acceptedAt: referral.acceptedAt,
                completedAt: referral.completedAt,
                daysToRegister: referral.daysToRegister,
                daysToApply: referral.daysToApply,
                daysToAccept: referral.daysToAccept,
                totalConversionDays: referral.totalConversionDays,
            })),
        };
    }
}
