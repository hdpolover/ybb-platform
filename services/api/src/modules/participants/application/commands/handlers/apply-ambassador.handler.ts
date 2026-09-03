// services/api/src/modules/participants/application/commands/handlers/apply-ambassador.handler.ts
import { randomInt } from 'crypto';
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Inject, ConflictException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApplyAmbassadorCommand } from '../apply-ambassador.command';
import { IAmbassadorRepository } from '../../../../../core/interfaces/repositories/ambassador.repository.interface';
import { Ambassador } from '../../../../../core/entities/ambassador.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
// import { customAlphabet } from 'nanoid'; // If nanoid is available, else use custom function

@CommandHandler(ApplyAmbassadorCommand)
export class ApplyAmbassadorHandler implements ICommandHandler<ApplyAmbassadorCommand> {
    private readonly logger = new Logger(ApplyAmbassadorHandler.name);

    constructor(
        @Inject('IAmbassadorRepository')
        private readonly ambassadorRepository: IAmbassadorRepository,
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly rabbitMQProducerService: RabbitMQProducerService,
        private readonly configService: ConfigService,
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

        // Best-effort: send ambassador welcome/credentials email. Never fail the command.
        try {
            const [userRecord, programRecord] = await Promise.all([
                this.prisma.user.findUnique({ where: { id: userId }, select: { email: true } }),
                this.prisma.program.findUnique({
                    where: { id: dto.programId },
                    select: { contactEmail: true, contactAddress: true, brand: true },
                }),
            ]);

            const email = userRecord?.email;
            // Merge program-owned contact fields back onto the emitted `brand`
            // shape — services/notification reads brand.contactEmail/contactAddress
            // from this event payload's field names, unchanged by this phase.
            const brand = programRecord?.brand
                ? { ...programRecord.brand, contactEmail: programRecord.contactEmail, contactAddress: programRecord.contactAddress }
                : null;

            if (email) {
                let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
                if (brand?.websiteUrl) baseUrl = brand.websiteUrl.replace(/\/$/, '');
                const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
                const loginUrl = `${normalizedBaseUrl}/login?role=ambassador`;

                await this.rabbitMQProducerService.emit('notification.ambassador_created', {
                    id: ambassador.id,
                    email,
                    name: dto.fullName,
                    referralCode: ambassador.referralCode,
                    loginUrl,
                    brand,
                });
            }
        } catch (error) {
            this.logger.warn(
                `Failed to emit ambassador welcome email for ambassador ${ambassador.id}: ${error instanceof Error ? error.message : String(error)}`,
            );
        }

        return ambassador;
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

    private async generateReferralCode(name: string): Promise<string> {
        // Generate a fully anonymous opaque code (looks like a session or tracking ID)
        // Format: 8 random alphanumeric chars (e.g., K9X2M4P1)
        // CSPRNG, not Math.random(): this code is a credential, because
        // /auth/ambassador-login accepts email + code with no password. V8's
        // PRNG state is recoverable from observed outputs, so codes minted in
        // one process would predict each other.
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No ambiguous chars
        let result = '';
        for (let i = 0; i < 8; i++) {
            result += chars.charAt(randomInt(chars.length));
        }
        return result;
    }
}
