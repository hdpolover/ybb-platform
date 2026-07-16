import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ListApplicationDocumentsQuery } from '../list-application-documents.query';
import { IAchievementsRepository } from '@core/interfaces/repositories/achievements.repository.interface';
import { IParticipantRepository } from '@core/interfaces/repositories/participant.repository.interface';
import { ParticipantDocumentResponseDto } from '@modules/achievements/presentation/dto/achievements.dto';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@QueryHandler(ListApplicationDocumentsQuery)
export class ListApplicationDocumentsHandler implements IQueryHandler<ListApplicationDocumentsQuery> {
    constructor(
        @Inject('IAchievementsRepository')
        private readonly repository: IAchievementsRepository,
        @Inject('IParticipantRepository')
        private readonly participantRepository: IParticipantRepository,
        private readonly prisma: PrismaService,
    ) { }

    async execute(query: ListApplicationDocumentsQuery): Promise<ParticipantDocumentResponseDto[]> {
        const { applicationId, userId } = query;

        const participant = await this.participantRepository.findByUserId(userId);
        if (!participant) {
            throw new NotFoundException('Participant profile not found');
        }

        // Ownership check: verify this application belongs to the calling participant.
        const application = await this.prisma.participantApplication.findUnique({
            where: { id: applicationId },
            select: { participant: { select: { userId: true } } },
        });
        if (!application || application.participant.userId !== userId) {
            throw new ForbiddenException('Access denied');
        }

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
