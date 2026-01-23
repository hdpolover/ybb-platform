import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetAmbassadorDashboardQuery } from '../get-ambassador-dashboard.query';
import { IAmbassadorRepository } from '../../../../../core/interfaces/repositories/ambassador.repository.interface';
import { AmbassadorDashboardDto } from '../../../presentation/dto/ambassador.dto';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

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
                 program: {
                     include: {
                         programCategory: true
                     }
                 }
             }
        });

        if (!ambassador) {
            throw new NotFoundException('Ambassador profile not found');
        }

        // Construct Link
        // Scheme: https://{brandDomain}/programs/{programSlug}?t={referralCode}
        const brandUrl = ambassador.program.programCategory.websiteUrl || 'ybb.co';
        const cleanBrandUrl = brandUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const slug = ambassador.program.slug; // Assuming slug exists on Program 
        const shareLink = `https://${cleanBrandUrl}/programs/${slug}?t=${ambassador.referralCode}`;

        // Map to DTO
        return {
            id: ambassador.id,
            referralCode: ambassador.referralCode,
            totalReferrals: ambassador.totalReferrals,
            successfulReferrals: ambassador.successfulReferrals,
            isActive: ambassador.isActive,
            programName: ambassador.program.name,
            shareLink,
        };
    }
}
