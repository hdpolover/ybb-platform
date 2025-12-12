import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AchievementsController } from './presentation/achievements.controller';
import { AchievementsRepository } from './infrastructure/persistence/achievements.repository';
import { ParticipantRepository } from '@modules/participants/infrastructure/persistence/participant.repository';
import { ListApplicationDocumentsHandler } from './application/queries/handlers/list-application-documents.handler';
import { ListParticipantAwardsHandler } from './application/queries/handlers/list-participant-awards.handler';

@Module({
    imports: [CqrsModule],
    controllers: [AchievementsController],
    providers: [
        PrismaService,
        {
            provide: 'IAchievementsRepository',
            useClass: AchievementsRepository,
        },
        {
            provide: 'IParticipantRepository',
            useClass: ParticipantRepository,
        },
        ListApplicationDocumentsHandler,
        ListParticipantAwardsHandler,
    ],
})
export class AchievementsModule { }
