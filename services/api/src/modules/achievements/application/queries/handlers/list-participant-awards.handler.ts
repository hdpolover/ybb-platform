import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException } from '@nestjs/common';
import { ListParticipantAwardsQuery } from '../list-participant-awards.query';
import { IAchievementsRepository } from '@core/interfaces/repositories/achievements.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { ParticipantAwardResponseDto } from '@modules/achievements/presentation/dto/achievements.dto';

@QueryHandler(ListParticipantAwardsQuery)
export class ListParticipantAwardsHandler implements IQueryHandler<ListParticipantAwardsQuery> {
    constructor(
        @Inject('IAchievementsRepository')
        private readonly repository: IAchievementsRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(query: ListParticipantAwardsQuery): Promise<ParticipantAwardResponseDto[]> {
        const { applicationId, userId } = query;

        const participant = await this.participantRepository.findByUserId(userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found');
        }

        const awards = await this.repository.findAwardsByApplicationId(applicationId);

        return awards.map(a => ({
            id: a.id,
            awardName: a.awardName || 'Unknown Award',
            awardDescription: a.awardDescription || null,
            badgeUrl: a.awardBadgeUrl || null,
            awardedAt: a.awardedAt,
            certificateUrl: a.certificateUrl,
        }));
    }
}
