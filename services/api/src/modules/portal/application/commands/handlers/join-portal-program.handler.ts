// src/modules/portal/application/commands/handlers/join-portal-program.handler.ts
import { BadRequestException, Injectable, Optional } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { invalidateParticipantPortalCache } from '@shared/utils/invalidate-participant-portal-cache.util';
import { MetaCapiService } from '../../../../meta/meta-capi.service';
import {
    ensureParticipantExists,
    ensureProgramApplication,
    toProgramRegistrationInfo,
    ProgramRegistrationInfo,
} from '../../../../auth/application/services/auth-program-linking.util';
import { JoinPortalProgramCommand } from '../../queries/portal-queries';

/**
 * The deliberate "join a second edition" act that the login guard in
 * ensureProgramApplication (skipCreateIfBrandApplicationExists) defers to.
 * Deliberately omits that flag; the util still enforces brand ownership,
 * open registration, category windows and idempotency.
 */
@Injectable()
export class JoinPortalProgramHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        @Optional() private readonly metaCapiService?: MetaCapiService,
    ) {}

    async execute(command: JoinPortalProgramCommand): Promise<ProgramRegistrationInfo> {
        const { userId, brandId, email, programId } = command;

        const participant = await ensureParticipantExists(this.prisma, userId);

        const result = await ensureProgramApplication(this.prisma, {
            participantId: participant.id,
            brandId,
            programId,
            metaCapiService: this.metaCapiService,
            userEmail: email,
            userId,
        });

        const info = toProgramRegistrationInfo(result);
        if (!info) {
            throw new BadRequestException('Program could not be resolved');
        }

        if (result.status === 'created') {
            await invalidateParticipantPortalCache(this.prisma, this.cacheService, participant.id, userId);
        }

        return info;
    }
}
