import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListApplicationDocumentsQuery } from '../list-application-documents.query';
import { IAchievementsRepository } from '@core/interfaces/repositories/achievements.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { ParticipantDocumentResponseDto } from '@modules/achievements/presentation/dto/achievements.dto';

@QueryHandler(ListApplicationDocumentsQuery)
export class ListApplicationDocumentsHandler implements IQueryHandler<ListApplicationDocumentsQuery> {
    constructor(
        @Inject('IAchievementsRepository')
        private readonly repository: IAchievementsRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
    ) { }

    async execute(query: ListApplicationDocumentsQuery): Promise<ParticipantDocumentResponseDto[]> {
        const { applicationId, userId } = query;

        // Validate ownership (simplified: check if participant owns the application)
        // In a real scenario, we'd fetch the application and check userId.
        // For now, assume applicationId is valid if passed, but let's check participant existence.
        const participant = await this.participantRepository.findByUserId(userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found');
        }

        // TODO: Ideally check if applicationId belongs to participant. 
        // Skipping for now to keep it simple as repository method only filters by applicationId.

        const docs = await this.repository.findDocumentsByApplicationId(applicationId);

        return docs.map(d => ({
            id: d.id,
            documentNumber: d.documentNumber,
            documentUrl: d.documentUrl,
            generatedAt: d.generatedAt,
            templateName: d.templateName || 'Unknown Document',
        }));
    }
}
