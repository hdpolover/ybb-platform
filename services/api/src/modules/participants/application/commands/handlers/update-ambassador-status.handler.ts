import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { UpdateAmbassadorStatusCommand } from '../ambassador-admin.commands';

@CommandHandler(UpdateAmbassadorStatusCommand)
export class UpdateAmbassadorStatusHandler implements ICommandHandler<UpdateAmbassadorStatusCommand> {
    private readonly logger = new Logger(UpdateAmbassadorStatusHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async execute(command: UpdateAmbassadorStatusCommand): Promise<any> {
        const { ambassadorId, isActive } = command;

        // Fetch ambassador before mutation to capture userId for cache invalidation
        const ambassador = await this.prisma.ambassador.findUnique({
            where: { id: ambassadorId }
        });

        if (!ambassador) {
            throw new NotFoundException('Ambassador not found');
        }

        const result = await this.prisma.ambassador.update({
            where: { id: ambassadorId },
            data: {
                isActive,
                ...(isActive ? { activatedAt: new Date(), deactivatedAt: null } : { deactivatedAt: new Date() })
            }
        });

        // Invalidate participant-related portal caches
        await this.invalidateParticipantCaches(ambassador.userId);

        return result;
    }

    private async invalidateParticipantCaches(userId: string): Promise<void> {
        try {
            const participant = await this.prisma.participant.findFirst({ where: { userId }, select: { id: true } });
            const participantId = participant?.id;

            const keys = [
                CACHE_KEYS.PARTICIPANT_PROFILE(userId),
                ...(participantId ? [
                    CACHE_KEYS.PARTICIPANT_STATS(participantId),
                    CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
                ] : []),
            ];
            await Promise.all([
                this.cacheService.invalidatePortalCache(userId),
                ...keys.map(k => this.cacheService.invalidateKey(k)),
            ]);
        } catch (error) {
            this.logger.warn(`Failed to invalidate caches for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
