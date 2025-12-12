import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ParticipantRepository } from './infrastructure/persistence/participant.repository';
import { GetMyParticipantProfileHandler } from './application/queries/handlers/get-my-participant-profile.handler';
import { UpdateParticipantProfileHandler } from './application/commands/handlers/update-participant-profile.handler';

import { AmbassadorRepository } from './infrastructure/persistence/ambassador.repository';
import { ApplyAmbassadorHandler } from './application/commands/handlers/apply-ambassador.handler';
import { GetAmbassadorDashboardHandler } from './application/queries/handlers/get-ambassador-dashboard.handler';

@Module({
    imports: [CqrsModule],
    controllers: [],
    providers: [
        PrismaService,
        {
            provide: 'IParticipantRepository',
            useClass: ParticipantRepository,
        },
        {
            provide: 'IAmbassadorRepository',
            useClass: AmbassadorRepository,
        },
        ParticipantRepository,
        AmbassadorRepository,
        GetMyParticipantProfileHandler,
        UpdateParticipantProfileHandler,
        ApplyAmbassadorHandler,
        GetAmbassadorDashboardHandler,
    ],
    exports: ['IParticipantRepository', 'IAmbassadorRepository'],
})
export class ParticipantsModule { }
