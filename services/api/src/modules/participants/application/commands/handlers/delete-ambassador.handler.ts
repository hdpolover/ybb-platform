import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { Logger, NotFoundException } from '@nestjs/common';
import { DeleteAmbassadorCommand } from '../delete-ambassador.command';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

@CommandHandler(DeleteAmbassadorCommand)
export class DeleteAmbassadorHandler implements ICommandHandler<DeleteAmbassadorCommand> {
    private readonly logger = new Logger(DeleteAmbassadorHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) {}

    async execute(command: DeleteAmbassadorCommand): Promise<{ success: boolean }> {
        const { ambassadorId, deletedBy } = command;

        // Fetch userId before mutation so we can invalidate caches afterwards
        const ambassador = await this.prisma.ambassador.findUnique({
            where: { id: ambassadorId },
            select: { id: true, userId: true, deletedAt: true },
        });

        if (!ambassador) {
            throw new NotFoundException(`Ambassador ${ambassadorId} not found`);
        }

        if (ambassador.deletedAt) {
            throw new NotFoundException(`Ambassador ${ambassadorId} not found`);
        }

        await this.prisma.ambassador.update({
            where: { id: ambassadorId },
            data: {
                deletedAt: new Date(),
                deletedBy,
                isActive: false,
            },
        });

        // Invalidate participant-related portal caches
        await this.invalidateParticipantCaches(ambassador.userId);

        return { success: true };
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
