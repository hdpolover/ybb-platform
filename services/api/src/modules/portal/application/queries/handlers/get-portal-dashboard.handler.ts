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

@Injectable()
@QueryHandler(GetPortalDashboardQuery)
export class GetPortalDashboardHandler implements IQueryHandler<GetPortalDashboardQuery> {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
    ) {}

    async execute(query: GetPortalDashboardQuery): Promise<PortalDashboardResponseDto> {
        const { userId } = query;

        // Check cache first
        const cacheKey = CACHE_KEYS.PORTAL_DASHBOARD(userId);
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
            where: { participantId: participant.id },
            orderBy: { updatedAt: 'desc' },
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
                            },
                            orderBy: { order: 'asc' },
                        },
                        essays: {
                            where: { isActive: true },
                            select: {
                                id: true,
                                isRequired: true,
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
                            select: { id: true, allowedCategories: true }
                        },
                        resources: {
                            where: { isActive: true, type: 'guide' },
                            orderBy: { order: 'asc' },
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

        const totalRequired = this.calculateTotalRequired(
            latestApplication?.invoices ?? [],
            latestApplication?.program?.currency,
        );

        // 3. Application Summary & Alerts
        let activeAppSummary: PortalApplicationSummaryDto | null = null;
        let alerts: PortalDashboardAlertDto[] = [];
        let announcements: { id: string; title: string; date: Date | null; preview: string; isRead: boolean }[] = [];

        if (latestApplication) {
            alerts = this.generateAlerts(latestApplication);
            
            const tiers = (latestApplication.program.pricingTiers ?? []) as unknown as { allowedCategories: string[] }[];
            const hasSelfFundedTier = tiers.some(
                (tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes('self_funded'),
            );
            const hasFullyFundedTier = tiers.some(
                (tier) => Array.isArray(tier.allowedCategories) && tier.allowedCategories.includes('fully_funded'),
            );
            const bothTiersActive = hasSelfFundedTier && hasFullyFundedTier;

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
                progress: calculateSubmissionProgress(latestApplication),
                currentStep: determineSubmissionCurrentStep(latestApplication),
                daysUntilDeadline: this.calculateDaysUntilDeadline(latestApplication.program.applicationDeadline),
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
                preview: a.content.substring(0, 100) + '...',
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
            greeting: `Welcome back, ${participant.fullName.split(' ')[0]}`,
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

    private calculateTotalRequired(
        invoices: Array<{ status: string; amount: unknown }>,
        currency?: string | null,
    ): { amount: number; currency: string } {
        const requiredStatuses = new Set(['unpaid', 'failed']);
        const totalRequiredAmount = invoices
            .filter((invoice) => requiredStatuses.has(String(invoice.status).toLowerCase()))
            .reduce((sum, invoice) => {
                const parsedAmount = Number(invoice.amount ?? 0);
                return Number.isFinite(parsedAmount) ? sum + parsedAmount : sum;
            }, 0);

        return {
            amount: Math.round(totalRequiredAmount * 100) / 100,
            currency: String(currency || 'USD').toUpperCase(),
        };
    }

    private generateAlerts(application: { invoices: { status: string }[] }): PortalDashboardAlertDto[] {
        const alerts: PortalDashboardAlertDto[] = [];
        
        // Payment Alert
        const hasUnpaidInvoices = application.invoices.some(inv => inv.status === 'unpaid' || inv.status === 'failed');
        if (hasUnpaidInvoices) {
            alerts.push({
                id: 'payment-due',
                type: 'error',
                title: 'Payment Required',
                message: 'You have outstanding invoices.',
                actionLabel: 'Pay Now',
                actionUrl: `/portal/payments`
            });
        }

        return alerts;
    }
    private calculateDaysUntilDeadline(deadline: Date | null): number | undefined {
        if (!deadline) return undefined;
        const diff = new Date(deadline).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 3600 * 24));
    }
}
