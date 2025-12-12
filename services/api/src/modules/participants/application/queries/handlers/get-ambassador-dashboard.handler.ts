import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { GetAmbassadorDashboardQuery } from '../get-ambassador-dashboard.query';
import { IAmbassadorRepository } from '../../../../../core/interfaces/repositories/ambassador.repository.interface';
import { AmbassadorDashboardDto } from '../../../presentation/dto/ambassador.dto';

@QueryHandler(GetAmbassadorDashboardQuery)
export class GetAmbassadorDashboardHandler implements IQueryHandler<GetAmbassadorDashboardQuery> {
    constructor(
        @Inject('IAmbassadorRepository')
        private readonly ambassadorRepository: IAmbassadorRepository,
    ) { }

    async execute(query: GetAmbassadorDashboardQuery): Promise<AmbassadorDashboardDto> {
        const { userId } = query;
        const ambassador = await this.ambassadorRepository.findByUserId(userId);

        if (!ambassador) {
            throw new NotFoundException('Ambassador profile not found');
        }

        // Map to DTO
        return {
            id: ambassador.id,
            referralCode: ambassador.referralCode,
            totalReferrals: ambassador.totalReferrals,
            successfulReferrals: ambassador.successfulReferrals,
            isActive: ambassador.isActive,
            // programName could be fetched if we extend repository to include Program
        };
    }
}
