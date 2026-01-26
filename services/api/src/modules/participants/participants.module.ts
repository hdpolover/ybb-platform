import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ParticipantRepository } from './infrastructure/persistence/participant.repository';
import { GetMyParticipantProfileHandler } from './application/queries/handlers/get-my-participant-profile.handler';
import { GetParticipantDashboardHandler } from './application/queries/handlers/get-participant-dashboard.handler';
import { UpdateParticipantProfileHandler } from './application/commands/handlers/update-participant-profile.handler';

import { AmbassadorRepository } from './infrastructure/persistence/ambassador.repository';
import { ApplyAmbassadorHandler } from './application/commands/handlers/apply-ambassador.handler';
import { GetAmbassadorDashboardHandler } from './application/queries/handlers/get-ambassador-dashboard.handler';

import { ParticipantsController } from './presentation/participants.controller';
import { AmbassadorAdminController } from './presentation/ambassador-admin.controller';
import { CompleteOnboardingHandler } from './application/commands/handlers/complete-onboarding.handler';
import { GetAmbassadorsListHandler } from './application/queries/handlers/get-ambassadors-list.handler';
import { UpdateAmbassadorStatusHandler } from './application/commands/handlers/update-ambassador-status.handler';

@Module({
    imports: [CqrsModule, AuthModule],
    controllers: [ParticipantsController, AmbassadorAdminController],
    providers: [
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
        GetParticipantDashboardHandler,
        UpdateParticipantProfileHandler,
        CompleteOnboardingHandler,
        ApplyAmbassadorHandler,
        GetAmbassadorDashboardHandler,
        GetAmbassadorsListHandler,
        UpdateAmbassadorStatusHandler,
    ],
    exports: ['IParticipantRepository', 'IAmbassadorRepository'],
})
export class ParticipantsModule { }
