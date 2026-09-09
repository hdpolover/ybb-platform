import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { CompleteOnboardingCommand } from '../complete-onboarding.command';
import { Gender } from '@prisma/client';
import { Country } from 'country-state-city';
import { Logger, BadRequestException } from '@nestjs/common';
import { ReferralFunnelService } from '../../services/referral-funnel.service';
import { normalizeReferralCode } from '../../utils/referral-code.util';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

@CommandHandler(CompleteOnboardingCommand)
export class CompleteOnboardingHandler implements ICommandHandler<CompleteOnboardingCommand> {
    private readonly logger = new Logger(CompleteOnboardingHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly unitOfWork: UnitOfWork,
        private readonly referralFunnel: ReferralFunnelService,
        private readonly cacheService: CacheService,
    ) {}

    async execute(command: CompleteOnboardingCommand) {
        const { userId, dto } = command;

        // Validate Country Code
        const country = Country.getCountryByCode(dto.originCountry);
        if (!country) {
            throw new BadRequestException(`Invalid country code: ${dto.originCountry}`);
        }

        const result = await this.unitOfWork.execute(async (repos) => {
            const tx = repos.tx;
            let participant = await tx.participant.upsert({
                where: { userId },
                create: {
                    userId,
                    fullName: dto.fullName,
                    gender: dto.gender as Gender,
                    originCountry: country.isoCode, // Ensure we save the standardized code
                    originCity: dto.originCity,
                    birthdate: new Date(dto.birthDate),
                    knowledgeSource: dto.knowledgeSource,
                    referralCode: dto.referralCode,
                    profileCompletedAt: new Date(),
                    profileCompletionPercentage: 20, // Base completion for basic info
                    currentCountry: country.isoCode, // Default current to origin initially
                },
                update: {
                    fullName: dto.fullName,
                    gender: dto.gender as Gender,
                    originCountry: country.isoCode,
                    originCity: dto.originCity,
                    birthdate: new Date(dto.birthDate),
                    knowledgeSource: dto.knowledgeSource,
                    // Only set profileCompletedAt if it wasn't set before
                    profileCompletedAt: new Date(), 
                    // Only bump percentage if it was 0
                    profileCompletionPercentage: { set: 20 },
                    lastProfileUpdate: new Date(),
                },
            });

            // 1. Sync User Data to Participant (Email Verified Status)
            const user = await tx.user.findUnique({ where: { id: userId } });
            if (user && user.emailVerifiedAt && !participant.emailVerifiedAt) {
                 participant = await tx.participant.update({
                     where: { id: participant.id },
                     data: { emailVerifiedAt: user.emailVerifiedAt }
                 });
            }

            // Handle Referral Logic if provided
            //
            // Brand-wide code, per-programme attribution: an ambassador now holds
            // one code per brand (Ambassador.userId is unique and users are
            // per-brand), so the ambassador lookup below is NOT scoped by
            // ambassador.programId any more - a code from any programme in the
            // caller's brand is usable. What programme the resulting referral is
            // attributed to is decided separately, per participant application
            // (see resolvedProgramId below), and idempotency is per (participant,
            // programme) rather than per participant ever - see the unique index
            // on ambassador_referrals(participant_id, program_id).
            if (dto.referralCode && user) {
                 // 1. Validate Ambassador - brand-scoped, not programme-scoped.
                 // `user` (fetched above) is the participant's own user row, so
                 // user.brandId is the participant's brand. Without this check a
                 // referral code minted for brand A could attribute a referral
                 // for a participant onboarding under brand B - codes are
                 // globally unique strings today so this isn't currently
                 // exploitable, but it becomes load-bearing the moment codes are
                 // brand-wide instead of programme-wide.
                 const ambassador = await tx.ambassador.findFirst({
                     where: {
                         referralCode: normalizeReferralCode(dto.referralCode),
                         isActive: true,
                         deletedAt: null,
                         user: { brandId: user.brandId },
                     }
                 });

                 if (ambassador) {
                     try {
                         // 2. Resolve the programme this referral is attributed
                         // to. Onboarding carries no programme of its own, so
                         // derive it from the participant's own application. If
                         // they have exactly one, attribute to it; if they have
                         // none or several, the intended programme is genuinely
                         // ambiguous, so fall back to the ambassador's own
                         // programId - that preserves today's behaviour rather
                         // than silently dropping a real referral.
                         const applications = await tx.participantApplication.findMany({
                             where: { participantId: participant.id },
                             select: { programId: true },
                             distinct: ['programId'],
                             take: 2,
                         });
                         const resolvedProgramId =
                             applications.length === 1 ? applications[0].programId : ambassador.programId;

                         // 3. Check if a referral for THIS participant + THIS
                         // programme already exists.
                         //
                         // Latent trap, dormant only because nothing writes
                         // AmbassadorReferral.deletedAt today (audit M73): this read is
                         // now soft-delete filtered like every other read, and it is the
                         // only thing standing between a duplicate and the
                         // @@unique([participantId, programId]) index. The moment a
                         // referral soft-delete path exists, a participant with a
                         // soft-deleted referral for the same programme falls through to
                         // create() and P2002s the whole onboarding-completion request -
                         // this one is NOT wrapped in a non-blocking catch, unlike the
                         // sibling in portal-submit-application.handler.ts. Make it an
                         // upsert, or filter on deletedAt explicitly, before adding one.
                         const existingReferral = await tx.ambassadorReferral.findFirst({
                             where: { participantId: participant.id, programId: resolvedProgramId }
                         });

                         if (!existingReferral) {
                             // 4. Create Link
                             await tx.ambassadorReferral.create({
                                 data: {
                                     ambassadorId: ambassador.id,
                                     participantId: participant.id,
                                     programId: resolvedProgramId,
                                     status: 'referred',
                                 }
                             });

                             // 5. Update Stats
                             await tx.ambassador.update({
                                 where: { id: ambassador.id },
                                 data: {
                                     totalReferrals: { increment: 1 },
                                     lastReferralAt: new Date(),
                                 }
                             });

                             // 6. Ensure participant record has the code
                             if (participant.referralCode !== dto.referralCode) {
                                 participant = await tx.participant.update({
                                     where: { id: participant.id },
                                     data: { referralCode: dto.referralCode }
                                 });
                             }
                         }
                     } catch (e) {
                         this.logger.warn(`Failed to process referral for user ${userId}: ${e.message}`);
                     }
                 }
            }

            await tx.user.update({
                where: { id: userId },
                data: { isOnboardingCompleted: true },
            });

            return participant;
        }, { name: 'complete-onboarding', timeout: 5000 });

        // Advance referral funnel: referred → registered
        await this.referralFunnel.advanceToRegistered(result.id);

        // Invalidate participant-related portal caches
        await this.invalidateParticipantCaches(userId, result.id);

        return result;
    }

    private async invalidateParticipantCaches(userId: string, participantId: string): Promise<void> {
        try {
            const keys = [
                CACHE_KEYS.PARTICIPANT_PROFILE(userId),
                CACHE_KEYS.PARTICIPANT_STATS(participantId),
                CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
            ];
            await Promise.all([
                this.cacheService.invalidatePortalCache(userId),
                ...keys.map(k => this.cacheService.invalidateKey(k)),
            ]);
        } catch (error) {
            this.logger.warn(`Failed to invalidate caches for participant ${participantId}: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
