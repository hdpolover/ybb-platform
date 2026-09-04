import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { GetPortalDashboardQuery } from '../portal-queries';
import {
    calculateSubmissionProgress,
    determineSubmissionCurrentStep,
} from '../../services/submission-progress.util';
import {
    PortalDashboardResponseDto, 
    PortalDashboardAlertDto,
    PortalApplicationSummaryDto
} from '../../../presentation/dto/portal-dashboard.dto';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';
import { buildRichTextPreview } from '@shared/utils/rich-text';
import { calculatePortalTotalRequired } from '../../utils/calculate-portal-total-required';
import { currentApplicationWhere, currentApplicationOrderBy } from '../../utils/current-application.query';
import { isPastSubmissionDeadline, resolveSubmissionCutoff } from '@shared/utils/submission-deadline.util';
import { effectiveStart, hasTierPeriodEnded } from '@shared/utils/tier-period.util';

@Injectable()
@QueryHandler(GetPortalDashboardQuery)
export class GetPortalDashboardHandler implements IQueryHandler<GetPortalDashboardQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(query: GetPortalDashboardQuery): Promise<PortalDashboardResponseDto> {
        const { userId, programId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_DASHBOARD(userId, programId);
        const cached = await this.cacheService.get<PortalDashboardResponseDto>(cacheKey);
        if (cached) {
            return cached;
        }

        // Cache miss - fetch from database
        // 1. Fetch Participant (using cached lookup)
        const participant = await this.portalCacheService.getParticipantProfile(userId);

        if (!participant) {
            return this.buildOnboardingDashboard();
        }

        const latestApplication = await this.prisma.participantApplication.findFirst({
            where: currentApplicationWhere(participant.id, programId),
            orderBy: currentApplicationOrderBy,
            select: {
                id: true,
                status: true,
                applicationCategory: true,
                updatedAt: true,
                personalData: true,
                essayAnswers: true,
                uploadedFiles: true,
                program: {
                    select: {
                        id: true,
                        name: true,
                        currency: true,
                        applicationDeadline: true,
                        formFields: {
                            where: { isActive: true },
                            select: {
                                section: true,
                                name: true,
                                isRequired: true,
                                allowedCategories: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                        essays: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                isRequired: true,
                                allowedCategories: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                        requirements: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                isRequired: true,
                            },
                            orderBy: { order: 'asc' },
                        },
                        programAnnouncements: {
                            where: { isActive: true },
                            orderBy: { createdAt: 'desc' },
                            take: 3,
                            select: {
                                id: true,
                                title: true,
                                content: true,
                                createdAt: true,
                                reads: {
                                    where: { userId },
                                    select: { id: true }
                                }
                            }
                        },
                        announcements: {
                            where: { isPublished: true },
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            select: {
                                id: true,
                                title: true,
                                content: true,
                                summary: true,
                                publishedAt: true,
                                createdAt: true,
                                reads: {
                                    where: { userId },
                                    select: { id: true }
                                }
                            }
                        },
                        pricingTiers: {
                            where: { isActive: true, deletedAt: null, feeType: 'registration_fee' },
                            select: {
                                id: true,
                                allowedCategories: true,
                                price: true,
                                currency: true,
                                usdPrice: true,
                                idrPrice: true,
                                validityPeriods: { select: { startDate: true, endDate: true } },
                            }
                        },
                        resources: {
                            where: { isActive: true, type: 'guide' },
                            orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
                            select: {
                                title: true,
                                fileUrl: true,
                            },
                        }
                    }
                },
                registrationPaymentStatus: true,
                        invoices: {
                            select: {
                                id: true,
                                status: true,
                                amount: true
                                ,
                                pricingTier: {
                                    select: {
                                        feeType: true,
                                    },
                                },
                            }
                        }
            }
        });

        // 2. Stats (using cached lookup)
        const baseStats = await this.portalCacheService.getParticipantStats(participant.id) || {
            applicationsCount: 0,
            completedProgramsCount: 0,
            certificatesCount: 0,
        };

        const totalRequiredResult = calculatePortalTotalRequired(
            latestApplication?.applicationCategory ?? null,
            latestApplication?.invoices ?? [],
            latestApplication?.program?.pricingTiers ?? [],
            latestApplication?.program?.currency,
            new Date(),
        );
        const totalRequired = {
            amount: totalRequiredResult.amount,
            currency: totalRequiredResult.currency,
        };
        const hasOutstandingPayment = totalRequiredResult.hasOutstanding;

        // 3. Application Summary & Alerts
        let activeAppSummary: PortalApplicationSummaryDto | null = null;
        let alerts: PortalDashboardAlertDto[] = [];
        let announcements: { id: string; title: string; date: Date | null; preview: string; isRead: boolean }[] = [];

        if (latestApplication) {
            alerts = this.generateAlerts(hasOutstandingPayment);
            
            const tiers = (latestApplication.program.pricingTiers ?? []) as unknown as {
                allowedCategories: string[];
                validityPeriods?: { startDate: Date; endDate: Date }[];
            }[];
            const hasSelfFundedTier = tiers.some(
                (tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes('self_funded'),
            );
            const hasFullyFundedTier = tiers.some(
                (tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes('fully_funded'),
            );
            const bothTiersActive = hasSelfFundedTier && hasFullyFundedTier;

            // Fully Funded registration is "closed" when at least one FF tier
            // exists AND every FF tier is configured with validity windows that
            // have all ended. A tier with no validityPeriods counts as "not
            // closed" (windows are open-ended / not yet configured).
            const now = new Date();
            const ffTiers = tiers.filter(
                (tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes('fully_funded'),
            );
            const fullyFundedRegistrationClosed =
                ffTiers.length > 0 &&
                ffTiers.every(
                    (tier) =>
                        (tier.validityPeriods?.length ?? 0) > 0 &&
                        (tier.validityPeriods ?? []).every((period) => hasTierPeriodEnded(period, now)),
                );

            // Deadline shown in the "submit your application form" reminder.
            // Scoped to the application's OWN category: a Self Funded
            // applicant must never be shown the Fully Funded window (that
            // bug told ~4,268 MEYS 6th self-funders their deadline was
            // 5 Sep when theirs was 30 Nov), and once FF closed the old
            // logic flipped and showed every FF applicant the SF date.
            //
            // Staged registration ("bertahap"): the owner runs a MAIN window
            // followed by short "extension" windows on purpose, to create
            // urgency at each step (e.g. a 2-month main window, then a run
            // of 1-day extensions). Showing the MAX end across every window
            // would publish the whole extension ladder months in advance and
            // contradict the date the public site advertises for the main
            // window. Show only the window that is CURRENTLY ACTIVE for the
            // application's own category (start <= now < end) - the shown
            // date only moves forward when an extension actually takes
            // effect. If two active windows overlap, the later end is the
            // real operative close.
            const activeCategoryWindowEnd = (category: string): Date | null => {
                // effectiveStart/hasTierPeriodEnded are evaluated against the
                // tier's OWN period list, before flattening across tiers.
                // effectiveStart's overlap test asks "is a period that starts
                // earlier still open here", which only means anything among
                // siblings of one tier - handing it the flattened cross-tier
                // array would let an unrelated tier's window suppress the
                // widening and reintroduce the 07:00 WIB start.
                const activeEnds = tiers
                    .filter((tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes(category))
                    .flatMap((tier) => {
                        const periods = tier.validityPeriods ?? [];
                        return periods
                            .filter((period) => effectiveStart(period, periods) <= now && !hasTierPeriodEnded(period, now))
                            .map((period) => period.endDate.getTime());
                    });
                return activeEnds.length > 0 ? new Date(Math.max(...activeEnds)) : null;
            };
            // No category yet (application_category is nullable) is treated
            // exactly like "this category has no active window": fall back
            // to the program's applicationDeadline rather than guessing a
            // category. Guessing Self Funded would over-promise a later
            // date to someone who turns out to be Fully Funded, and
            // applicationDeadline is the only date that is true for every
            // applicant - it is what the submit path actually enforces
            // (portal-submit-application.handler.ts -> isPastSubmissionDeadline).
            const categoryWindowEnd = latestApplication.applicationCategory
                ? activeCategoryWindowEnd(String(latestApplication.applicationCategory))
                : null;
            const programDeadline = latestApplication.program.applicationDeadline ?? null;
            // No window contains `now`: either every window for this
            // category has ended (the extension ladder is exhausted) or
            // we're sitting in a gap between windows. Both cases revert to
            // the programme's default guideline timing - once extensions
            // run out, the participant page must not keep implying more are
            // guaranteed. An already-ended fallback deadline is reported as
            // "no deadline" so the reminder popup stays shut - it reads
            // "submit before X", and a past X under "applications not
            // submitted by the deadline will not be reviewed" is its own
            // bug. The frontend already renders nothing when
            // submissionDeadline is absent, so no UI change is needed.
            const submissionDeadline = categoryWindowEnd
                ? categoryWindowEnd
                : isPastSubmissionDeadline(programDeadline, now)
                    ? null
                    : programDeadline;

            const switchLockedStatuses = new Set(['processing', 'paid']);
            const blockingRegistrationInvoice = latestApplication.invoices.find(
                (invoice) =>
                    invoice.pricingTier?.feeType === 'registration_fee' &&
                    switchLockedStatuses.has(String(invoice.status).toLowerCase()),
            );
            const hasLockedRegistrationInvoice = Boolean(blockingRegistrationInvoice);
            const hasLockedRegistrationPayment = switchLockedStatuses.has(
                String(latestApplication.registrationPaymentStatus ?? '').toLowerCase(),
            );

            let switchCategoryMessage: string | undefined;
            let switchCategoryBlockingInvoiceId: string | undefined;
            if (!bothTiersActive) {
                switchCategoryMessage = 'Category switching is unavailable because one registration category is inactive.';
            } else if (latestApplication.status !== 'draft') {
                switchCategoryMessage = 'Category switching is only available while your application is still in draft.';
            } else if (hasLockedRegistrationInvoice || hasLockedRegistrationPayment) {
                switchCategoryMessage = 'Category switching is locked because a registration fee payment is processing or already paid.';
                // Only expose an invoice id when a specific invoice is the
                // blocker. If the lock fires only from `registrationPaymentStatus`
                // (a stale/aggregate flag with no associated invoice row), leave
                // the field undefined so the frontend doesn't render a broken link.
                if (blockingRegistrationInvoice) {
                    switchCategoryBlockingInvoiceId = blockingRegistrationInvoice.id;
                }
            }

            const canSwitchCategory = !switchCategoryMessage;

            const guidebooks = await Promise.all(
                latestApplication.program.resources
                    .filter((resource) => typeof resource.fileUrl === 'string' && resource.fileUrl.trim().length > 0)
                    .map(async (resource) => ({
                        label: `Read Guidebook (${resource.title})`,
                        url: await resolveMaskedFileUrl(this.prisma, resource.fileUrl!),
                    })),
            );

            activeAppSummary = {
                id: latestApplication.id,
                programName: latestApplication.program.name,
                status: latestApplication.status,
                category: latestApplication.applicationCategory || 'general',
                canSwitchCategory,
                switchCategoryMessage,
                switchCategoryBlockingInvoiceId,
                fullyFundedRegistrationClosed,
                progress: calculateSubmissionProgress(latestApplication),
                currentStep: determineSubmissionCurrentStep(latestApplication),
                daysUntilDeadline: this.calculateDaysUntilDeadline(latestApplication.program.applicationDeadline, now),
                submissionDeadline: submissionDeadline ? submissionDeadline.toISOString() : undefined,
                guidebooks,
            };

            const sysAnnouncements = latestApplication.program.announcements.map(a => ({
                id: a.id,
                title: a.title,
                date: a.publishedAt || a.createdAt,
                preview: (a.summary || a.content).substring(0, 100) + '...',
                isRead: a.reads.length > 0
            }));

            const progAnnouncements = latestApplication.program.programAnnouncements.map(a => ({
                id: a.id,
                title: a.title,
                date: a.createdAt,
                preview: buildRichTextPreview(a.content),
                isRead: a.reads.length > 0
            }));

            announcements = [...sysAnnouncements, ...progAnnouncements]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);
        } else {
             alerts.push({
                 id: 'start-app',
                 type: 'info',
                 title: 'Start your journey',
                 message: 'Browse available programs and start your application today.',
                 actionLabel: 'Browse Programs',
                 actionUrl: '/programs'
             });
        }

        const result: PortalDashboardResponseDto = {
            // fullName is blank until onboarding completes, which would render
            // "Welcome back, " with a dangling comma.
            greeting: `Welcome back, ${participant.fullName.split(' ')[0] || 'Participant'}`,
            activeApplication: activeAppSummary,
            alerts,
            recentAnnouncements: announcements as unknown as import('../../../presentation/dto/portal-dashboard.dto').PortalAnnouncementDto[],
            stats: {
                applicationsCount: baseStats.applicationsCount,
                completedProgramsCount: baseStats.completedProgramsCount,
                certificatesCount: baseStats.certificatesCount,
                totalRequired,
            }
        };

        // Cache the result for 5 minutes
        await this.cacheService.set(cacheKey, result, CACHE_TTL.MEDIUM);

        return result;
    }

    private buildOnboardingDashboard(): PortalDashboardResponseDto {
         return {
            greeting: 'Welcome!',
            activeApplication: null,
            alerts: [{
                id: 'onboarding-req',
                type: 'warning',
                title: 'Complete your profile',
                message: 'Please complete your participant profile to get started.',
                actionLabel: 'Complete Profile',
                actionUrl: '/onboarding'
            }],
            recentAnnouncements: [],
            stats: {
                applicationsCount: 0,
                completedProgramsCount: 0,
                certificatesCount: 0,
                totalRequired: {
                    amount: 0,
                    currency: 'USD',
                },
            }
         };
    }

    private generateAlerts(hasOutstandingPayment: boolean): PortalDashboardAlertDto[] {
        const alerts: PortalDashboardAlertDto[] = [];

        // Payment Alert — fires on any amount owed, including a registration fee
        // that is due but not yet invoiced (see calculatePortalTotalRequired).
        if (hasOutstandingPayment) {
            alerts.push({
                id: 'payment-due',
                type: 'error',
                title: 'Payment Required',
                message: 'You have an outstanding payment.',
                actionLabel: 'Pay Now',
                actionUrl: `/dashboard/payments`
            });
        }

        return alerts;
    }
    /**
     * Counts down to the instant submission actually closes, not to the raw
     * stored deadline. application_deadline is a WIB CALENDAR DAY stored as an
     * instant (usually 00:00 UTC = 07:00 WIB), and the submit path allows
     * submission through 23:59:59.999 WIB on that day
     * (portal-submit-application.handler.ts -> isPastSubmissionDeadline). A raw
     * diff hit zero at 07:00 WIB on the deadline's own day, so the participant
     * was told they had no days left for the ~17 hours they could still submit.
     * Same field, same question, same helper as the gate that enforces it.
     */
    private calculateDaysUntilDeadline(deadline: Date | null, now: Date): number | undefined {
        const cutoff = resolveSubmissionCutoff(deadline);
        if (!cutoff) return undefined;
        return Math.ceil((cutoff.getTime() - now.getTime()) / (1000 * 3600 * 24));
    }
}
