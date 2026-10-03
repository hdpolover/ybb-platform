import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalSubmissionDetailHandler } from '../../queries/handlers/get-portal-submission-detail.handler';
import { PortalSubmitApplicationCommand } from '../../queries/portal-queries';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { formatSubmissionDeadlineMessage, isPastSubmissionDeadline } from '@shared/utils/submission-deadline.util';
import { currentApplicationWhere, currentApplicationOrderBy } from '../../utils/current-application.query';
import { normalizeReferralCode } from '@modules/participants/application/utils/referral-code.util';

/**
 * Portal Submit Application Handler
 *
 * Portal-facing submit that resolves participant from JWT user ID,
 * validates payment status via the shared RegistrationFeeGateService, and
 * transitions the application to submitted.
 *
 * Registration fee applies to ALL participants (fully_funded AND self_funded)
 * under the reimbursement model — pay first, reimburse later.
 */
@Injectable()
export class PortalSubmitApplicationHandler {
    private readonly logger = new Logger(PortalSubmitApplicationHandler.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly registrationFeeGate: RegistrationFeeGateService,
        private readonly referralFunnel: ReferralFunnelService,
        private readonly submissionDetail: GetPortalSubmissionDetailHandler,
    ) { }

    async execute(command: PortalSubmitApplicationCommand): Promise<{ success: boolean; applicationId: string; status: string }> {
        const { userId, programId } = command;

        const participant = await this.portalCacheService.getParticipantProfile(userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const application = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id, programId),
            orderBy: currentApplicationOrderBy,
            select: {
                id: true,
                status: true,
                personalData: true,
                participantId: true,
                programId: true,
                program: {
                    select: {
                        name: true,
                        brandId: true,
                        applicationDeadline: true,
                        formFields: {
                            // Only fields the participant could actually see,
                            // in form order - referral detection below reads
                            // these, and a soft-deleted or disabled duplicate
                            // must not shadow the live field.
                            where: { isActive: true, deletedAt: null },
                            orderBy: { order: 'asc' },
                            select: {
                                name: true,
                                label: true,
                                validationRules: true,
                            },
                        },
                    },
                },
            },
        });

        if (!application) throw new NotFoundException('No active application found');

        if (application.status !== 'draft') {
            throw new BadRequestException(
                `Cannot submit application in "${application.status}" status. Only drafts can be submitted.`,
            );
        }

        // Submission deadline gate: Program.applicationDeadline, inclusive
        // through the end of its WIB calendar day (see submission-deadline.util.ts).
        // Same shared resolver as the admin submit path and the reminder cron,
        // so this cannot silently diverge from either.
        const applicationDeadline = application.program?.applicationDeadline ?? null;
        if (isPastSubmissionDeadline(applicationDeadline)) {
            throw new BadRequestException(
                formatSubmissionDeadlineMessage(
                    application.program?.name ?? 'this program',
                    applicationDeadline as Date,
                ),
            );
        }

        this.validatePreviewAcknowledgements(
            (application.personalData as Record<string, unknown>) || {},
        );

        // Completeness gate: required fields / essays / documents were only ever
        // enforced by disabling the browser's Submit button, so a direct POST or a
        // stale cached detail response could submit an incomplete application. Reuse
        // the detail handler's own computation (uncached) rather than re-deriving
        // required-ness here. Admin submit is a deliberate override and skips this.
        const incompleteItems = await this.submissionDetail.findIncompleteRequiredItems(userId, programId);
        if (incompleteItems.length > 0) {
            // Drop any cached detail that claimed canSubmit so the UI refetches truth.
            await this.invalidateCaches(userId, participant.id);
            throw new BadRequestException(
                `Your application is incomplete. Please: ${incompleteItems.join('; ')}.`,
            );
        }

        // Validate registration fee via shared gate (applies to all categories).
        await this.registrationFeeGate.assertRegistrationFeePaid(application.id);

        // Submit the application. Guarded on status: 'draft' so a double-tapped
        // Submit (or two tabs) can't both pass the draft check above and both
        // write - only the first writer's updateMany actually matches a row.
        const submitResult = await this.prisma.participantApplication.updateMany({
            where: { id: application.id, status: 'draft' },
            data: {
                status: 'submitted',
                submittedAt: new Date(),
            },
        });

        if (submitResult.count === 0) {
            // Someone else (the other half of the double-tap/two-tab race)
            // already flipped this application to submitted between our status
            // check above and this write. The application genuinely IS
            // submitted - the existing contract for a double-submit is "both
            // requests report success" (see M69 audit note), not an error - so
            // return the same success shape without re-stamping submittedAt or
            // re-running the referral/funnel side effects a second time.
            await this.invalidateCaches(userId, participant.id);
            return {
                success: true,
                applicationId: application.id,
                status: 'submitted',
            };
        }

        await this.invalidateCaches(userId, participant.id);

        // Non-blocking referral linking
        const resolvedProgramId = application.programId;
        try {
            // Detect referral field robustly
            const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
            const referralKeywords = ['referral', 'refcode', 'ambassadorcode', 'ambassadorreferral'];
            const formFields = application.program?.formFields ?? [];
            // A form can carry several fields that look like a referral field:
            // a legacy custom one beside the system one, or a "how did you hear
            // about us" select whose name contains "referral". Taking only the
            // first match dropped the code whenever it was typed into another
            // one, so collect every candidate value and let the ambassador
            // lookup below decide which of them is a real code.
            const referralFields = formFields.filter((f) => {
                const normName = normalize(f.name ?? '');
                const normLabel = normalize(f.label ?? '');
                if (referralKeywords.some((kw) => normName.includes(kw) || normLabel.includes(kw))) {
                    return true;
                }
                const fieldKind = (f.validationRules as any)?.fieldKind as string | undefined;
                if (fieldKind && /referral|ambassador/i.test(fieldKind)) {
                    return true;
                }
                return false;
            });

            const personalData = (application.personalData as Record<string, unknown>) || {};
            // trim() alone is not enough: codes are stored uppercase and compared
            // case-sensitively, so a lower-case entry matched nothing here.
            const candidateCodes = [
                ...new Set(
                    referralFields
                        .map((f) => personalData[f.name])
                        .map((raw) => (typeof raw === 'string' ? normalizeReferralCode(raw) : ''))
                        .filter((code) => code.length > 0),
                ),
            ];

            if (candidateCodes.length > 0) {
                await this.prisma.$transaction(async (tx) => {
                    const participantId = application.participantId;
                    // The submitted application's own programme is the
                    // attribution target — this is the one call site where it
                    // is never ambiguous, unlike onboarding.
                    const programId = application.programId;

                    // Dedup: one referral per participant PER PROGRAMME, not
                    // per participant ever (ambassador_referrals is unique on
                    // [participantId, programId] as of the brand-wide-code
                    // model change) - a participant referred into one
                    // programme must still be attributable when they submit
                    // into a different one.
                    const existing = await tx.ambassadorReferral.findFirst({
                        where: { participantId, programId },
                    });
                    if (existing) return;

                    // Brand of the application being submitted. Must be a real
                    // value before the ambassador lookup below - if it were
                    // undefined, spreading it into the Prisma where clause would
                    // omit the filter entirely (Prisma treats `undefined` as
                    // "no filter"), silently reopening cross-brand attribution.
                    const brandId = application.program?.brandId;
                    if (!brandId) return;

                    // Brand-scoped, not programme-scoped: an ambassador now
                    // holds one code per brand, valid across every programme
                    // in that brand. Without the brand check here a code
                    // minted for brand A could attribute a referral for a
                    // participant applying under brand B - codes are globally
                    // unique strings today so this isn't currently
                    // exploitable, but it becomes load-bearing the moment
                    // codes are brand-wide instead of programme-wide.
                    let ambassador: Awaited<ReturnType<typeof tx.ambassador.findFirst>> = null;
                    for (const referralCode of candidateCodes) {
                        ambassador = await tx.ambassador.findFirst({
                            where: {
                                referralCode,
                                isActive: true,
                                user: { brandId },
                            },
                        });
                        if (ambassador) break;
                    }
                    if (!ambassador) return;

                    await tx.ambassadorReferral.create({
                        data: {
                            ambassadorId: ambassador.id,
                            participantId,
                            programId,
                            status: 'referred',
                        },
                    });

                    await tx.ambassador.update({
                        where: { id: ambassador.id },
                        data: {
                            totalReferrals: { increment: 1 },
                            lastReferralAt: new Date(),
                        },
                    });

                    const participant = await tx.participant.findUnique({
                        where: { id: participantId },
                        select: { referralCode: true },
                    });
                    // Store the ambassador's own code so the stored value matches
                    // the ambassador credited above.
                    if (participant && participant.referralCode !== ambassador.referralCode) {
                        await tx.participant.update({
                            where: { id: participantId },
                            data: { referralCode: ambassador.referralCode },
                        });
                    }
                });
            }

            // Advance referral funnel (no-op if no referral; call unconditionally when programId available)
            if (resolvedProgramId) {
                await this.referralFunnel.advanceToApplied(application.participantId, resolvedProgramId);
            }
        } catch (err) {
            // Referral linking must never block submit
            this.logger.warn('Referral linking failed (non-blocking)', { err });
        }

        return {
            success: true,
            applicationId: application.id,
            status: 'submitted',
        };
    }

    private validatePreviewAcknowledgements(personalData: Record<string, unknown>): void {
        const readyToJoinKeys = [
            'preview_ready_to_join',
            'previewReadyToJoin',
            'ready_to_join',
            'readyToJoin',
        ];
        const termsAcknowledgedKeys = [
            'preview_understand_terms_and_conditions',
            'previewUnderstandTermsAndConditions',
            'understand_terms_and_conditions',
            'understandTermsAndConditions',
        ];

        const hasPreviewFlag = [...readyToJoinKeys, ...termsAcknowledgedKeys].some(
            (key) => personalData[key] !== undefined,
        );

        // Backward compatibility: older clients may still submit without preview payload.
        if (!hasPreviewFlag) return;

        const isReadyToJoin = this.readBoolean(personalData, readyToJoinKeys);
        const hasAcceptedTerms = this.readBoolean(personalData, termsAcknowledgedKeys);

        if (!isReadyToJoin || !hasAcceptedTerms) {
            throw new BadRequestException(
                'Please complete all preview confirmations before submitting.',
            );
        }
    }

    private readBoolean(data: Record<string, unknown>, keys: string[]): boolean {
        for (const key of keys) {
            const value = data[key];
            if (typeof value === 'boolean') return value;
            if (typeof value === 'number') {
                if (value === 1) return true;
                if (value === 0) return false;
            }
            if (typeof value === 'string') {
                const normalized = value.trim().toLowerCase();
                if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
                    return true;
                }
                if (normalized === 'false' || normalized === '0' || normalized === 'no') {
                    return false;
                }
            }
        }

        return false;
    }

    private async invalidateCaches(userId: string, participantId: string): Promise<void> {
        await Promise.all([
            this.cacheService.invalidatePortalCache(userId),
            this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId)),
        ]);
    }
}
