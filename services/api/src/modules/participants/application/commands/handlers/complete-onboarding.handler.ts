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

        // Hoisted out of the transaction (audit M202): this is a pure read
        // with no dependency on the participant upsert below, so it has no
        // reason to sit inside the 5s tx holding the participant/user locks.
        // Narrow select — only emailVerifiedAt (synced onto the participant)
        // and brandId (scopes the ambassador lookup below) are used.
        const user = await this.prisma.user.findUnique({
            where: { id: userId },
            select: { emailVerifiedAt: true, brandId: true },
        });

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

            // Sync User Data to Participant (Email Verified Status)
            if (user && user.emailVerifiedAt && !participant.emailVerifiedAt) {
                 participant = await tx.participant.update({
                     where: { id: participant.id },
                     data: { emailVerifiedAt: user.emailVerifiedAt }
                 });
            }

            await tx.user.update({
                where: { id: userId },
                data: { isOnboardingCompleted: true },
            });

            return participant;
        }, { name: 'complete-onboarding', timeout: 5000 });

        // Referral attribution runs in its own transaction, deliberately
        // OUTSIDE the onboarding transaction above (audit M202). The
        // ambassador lookup and referral reads need participant.id, which
        // only exists once the upsert above has committed, so they cannot be
        // hoisted any earlier than this point. Running them in the same tx as
        // the upsert was the actual bug: a P2002 on ambassadorReferral.create
        // aborts the underlying Postgres transaction, and the inner
        // try/catch that used to wrap this block could not stop that abort
        // from surfacing on the next statement in the same tx (tx.user.update)
        // — so despite looking non-blocking, a referral race could fail the
        // whole onboarding request. Isolating it in its own transaction with
        // its own catch, same as the sibling in
        // portal-submit-application.handler.ts, is what actually makes it
        // non-blocking.
        // linkReferral reports back the referralCode it actually persisted (or
        // null when it wrote nothing — no ambassador matched, or a referral
        // already existed for this participant+programme). `result` was
        // returned by the onboarding transaction BEFORE linkReferral ran, so
        // it does not reflect that write; merge the reported code back in
        // here rather than re-reading the participant, since linkReferral
        // already knows the value it wrote.
        let linkedReferralCode: string | null = null;
        if (dto.referralCode && user) {
            linkedReferralCode = await this.linkReferral(userId, user.brandId, result.id, dto.referralCode);
        }

        // Advance referral funnel: referred → registered
        await this.referralFunnel.advanceToRegistered(result.id);

        // Invalidate participant-related portal caches
        await this.invalidateParticipantCaches(userId, result.id);

        return linkedReferralCode ? { ...result, referralCode: linkedReferralCode } : result;
    }

    // Brand-wide code, per-programme attribution: an ambassador now holds one
    // code per brand (Ambassador.userId is unique and users are per-brand),
    // so the ambassador lookup below is NOT scoped by ambassador.programId
    // any more - a code from any programme in the caller's brand is usable.
    // What programme the resulting referral is attributed to is decided
    // separately, per participant application (see resolvedProgramId below),
    // and idempotency is per (participant, programme) rather than per
    // participant ever - see the unique index on
    // ambassador_referrals(participant_id, program_id).
    private async linkReferral(
        userId: string,
        brandId: string,
        participantId: string,
        referralCode: string,
    ): Promise<string | null> {
        try {
            return await this.prisma.$transaction(async (tx) => {
                // 1. Validate Ambassador - brand-scoped, not programme-scoped.
                // `brandId` is the participant's own user row's brandId.
                // Without this check a referral code minted for brand A could
                // attribute a referral for a participant onboarding under
                // brand B - codes are globally unique strings today so this
                // isn't currently exploitable, but it becomes load-bearing the
                // moment codes are brand-wide instead of programme-wide.
                const ambassador = await tx.ambassador.findFirst({
                    where: {
                        referralCode: normalizeReferralCode(referralCode),
                        isActive: true,
                        deletedAt: null,
                        user: { brandId },
                    }
                });
                if (!ambassador) return null;

                // 2. Resolve the programme this referral is attributed to.
                // Onboarding carries no programme of its own, so derive it
                // from the participant's own application. If they have
                // exactly one, attribute to it; if they have none or several,
                // the intended programme is genuinely ambiguous, so fall back
                // to the ambassador's own programId - that preserves today's
                // behaviour rather than silently dropping a real referral.
                const applications = await tx.participantApplication.findMany({
                    where: { participantId },
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
                // soft-delete filtered like every other read, and it is the
                // only thing standing between a duplicate and the
                // @@unique([participantId, programId]) index. The moment a
                // referral soft-delete path exists, a participant with a
                // soft-deleted referral for the same programme falls through
                // to create() and P2002s — that is now caught by the outer
                // try/catch below and logged, not allowed to fail onboarding.
                const existingReferral = await tx.ambassadorReferral.findFirst({
                    where: { participantId, programId: resolvedProgramId }
                });
                if (existingReferral) return null;

                // 4. Create Link
                await tx.ambassadorReferral.create({
                    data: {
                        ambassadorId: ambassador.id,
                        participantId,
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
                const participant = await tx.participant.findUnique({
                    where: { id: participantId },
                    select: { referralCode: true },
                });
                if (participant && participant.referralCode !== referralCode) {
                    await tx.participant.update({
                        where: { id: participantId },
                        data: { referralCode }
                    });
                }

                // Report back the code actually persisted so the caller can
                // merge it into the onboarding response (see execute() —
                // `result` was captured before this transaction ran).
                return referralCode;
            });
        } catch (e) {
            // Referral linking must never block onboarding completion.
            this.logger.warn(`Failed to process referral for user ${userId}: ${e instanceof Error ? e.message : String(e)}`);
            return null;
        }
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
