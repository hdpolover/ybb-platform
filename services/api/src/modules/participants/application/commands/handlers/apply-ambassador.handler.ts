import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ConflictException, Logger } from '@nestjs/common';
import { ApplyAmbassadorCommand } from '../apply-ambassador.command';
import { IAmbassadorRepository } from '../../../../../core/interfaces/repositories/ambassador.repository.interface';
import { Ambassador } from '../../../../../core/entities/ambassador.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
// import { customAlphabet } from 'nanoid'; // If nanoid is available, else use custom function

@CommandHandler(ApplyAmbassadorCommand)
export class ApplyAmbassadorHandler implements ICommandHandler<ApplyAmbassadorCommand> {
    private readonly logger = new Logger(ApplyAmbassadorHandler.name);

    constructor(
        @Inject('IAmbassadorRepository')
        private readonly ambassadorRepository: IAmbassadorRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async execute(command: ApplyAmbassadorCommand): Promise<Ambassador> {
        const { userId, dto } = command;

        // Check if already ambassador (optional: per program or global? Validating user unique constraint in schema)
        const existing = await this.ambassadorRepository.findByUserId(userId);
        if (existing) {
            throw new ConflictException('User is already an ambassador');
        }

        // Generate Referral Code
        const referralCode = await this.generateReferralCode(dto.fullName);

        // Create
        const ambassador = await this.ambassadorRepository.create({
            userId,
            programId: dto.programId,
            fullName: dto.fullName,
            phoneNumber: dto.phoneNumber,
            institution: dto.institution,
            referralCode,
        });

        // Invalidate participant-related portal caches
        await this.invalidateParticipantCaches(userId);

        return ambassador;
    }

    private async invalidateParticipantCaches(userId: string): Promise<void> {
        try {
            const participant = await this.prisma.participant.findFirst({ where: { userId }, select: { id: true } });
            const participantId = participant?.id;

            const keys = [
                CACHE_KEYS.PORTAL_DASHBOARD(userId),
                CACHE_KEYS.PORTAL_DOCUMENTS(userId),
                CACHE_KEYS.PARTICIPANT_PROFILE(userId),
                ...(participantId ? [
                    CACHE_KEYS.PARTICIPANT_STATS(participantId),
                    CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
                ] : []),
            ];
            const patterns = [
                `portal:submissions:${userId}:*`,
                `portal:submission-detail:${userId}:*`,
                `portal:payments:${userId}:*`,
            ];
            await Promise.all([
                ...keys.map(k => this.cacheService.invalidateKey(k)),
                ...patterns.map(p => this.cacheService.invalidateByPattern(p)),
            ]);
        } catch (error) {
            this.logger.warn(`Failed to invalidate caches for user ${userId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    private async generateReferralCode(name: string): Promise<string> {
        // Generate a fully anonymous opaque code (looks like a session or tracking ID)
        // Format: 8 random alphanumeric chars (e.g., K9X2M4P1)
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
}
