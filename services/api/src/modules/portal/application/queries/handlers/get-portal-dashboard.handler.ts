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
                        }
                    }
                },
                invoices: {
                    select: {
                        id: true,
                        status: true,
                        amount: true
                    }
                }
            }
        });

        // 2. Stats (using cached lookup)
        const stats = await this.portalCacheService.getParticipantStats(participant.id) || {
            applicationsCount: 0,
            completedProgramsCount: 0,
            certificatesCount: 0
        };

        // 3. Application Summary & Alerts
        let activeAppSummary: PortalApplicationSummaryDto | null = null;
        let alerts: PortalDashboardAlertDto[] = [];
        let announcements: { id: string; title: string; date: Date | null; preview: string; isRead: boolean }[] = [];

        if (latestApplication) {
            alerts = this.generateAlerts(latestApplication);
            
            activeAppSummary = {
                id: latestApplication.id,
                programName: latestApplication.program.name,
                status: latestApplication.status,
                category: latestApplication.applicationCategory || 'general',
                canSwitchCategory: ['draft', 'submitted'].includes(latestApplication.status),
                progress: calculateSubmissionProgress(latestApplication),
                currentStep: determineSubmissionCurrentStep(latestApplication),
                daysUntilDeadline: this.calculateDaysUntilDeadline(latestApplication.program.applicationDeadline),
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
            stats
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
            stats: { applicationsCount: 0, completedProgramsCount: 0, certificatesCount: 0 }
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
