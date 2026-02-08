import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';
import { GetPortalDashboardQuery } from '../portal-queries';
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
        // 1. Fetch Participant and latest application
        const participant = await this.prisma.participant.findUnique({
            where: { userId },
            include: { user: true }
        });

        if (!participant) {
            return this.buildOnboardingDashboard();
        }

        const latestApplication = await this.prisma.participantApplication.findFirst({
            where: { participantId: participant.id },
            orderBy: { updatedAt: 'desc' },
            include: {
                program: {
                    include: {
                        programAnnouncements: {
                            orderBy: { createdAt: 'desc' },
                            take: 3,
                            where: { isActive: true },
                            include: { reads: { where: { userId } } }
                        },
                        announcements: { // System Announcements
                            where: { isPublished: true },
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            include: { reads: { where: { userId } } }
                        }
                    }
                },
                invoices: true
            }
        });

        // 2. Stats
        const stats = await this.getStats(participant.id);

        // 3. Application Summary & Alerts
        let activeAppSummary: PortalApplicationSummaryDto | null = null;
        let alerts: PortalDashboardAlertDto[] = [];
        let announcements: any[] = [];

        if (latestApplication) {
            alerts = this.generateAlerts(latestApplication);
            
            activeAppSummary = {
                id: latestApplication.id,
                programName: latestApplication.program.name,
                status: latestApplication.status,
                category: latestApplication.applicationCategory || 'general',
                canSwitchCategory: ['draft', 'submitted'].includes(latestApplication.status),
                progress: this.calculateProgress(latestApplication),
                currentStep: this.determineCurrentStep(latestApplication),
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

        const result = {
            greeting: `Welcome back, ${participant.fullName.split(' ')[0]}`,
            activeApplication: activeAppSummary,
            alerts,
            recentAnnouncements: announcements,
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

    private async getStats(participantId: string) {
        const appCount = await this.prisma.participantApplication.count({ where: { participantId } });
        const certCount = await this.prisma.participantDocument.count({
            where: { application: { participantId }, type: 'certificate' }
        });
        return {
            applicationsCount: appCount,
            completedProgramsCount: 0, // Placeholder
            certificatesCount: certCount
        };
    }

    private generateAlerts(application: any): PortalDashboardAlertDto[] {
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

    private calculateProgress(application: any): number {
        if (application.status === 'draft') return 25;
        if (application.status === 'submitted') return 50;
        if (application.status === 'accepted') return 100;
        return 0;
    }

    private determineCurrentStep(application: any): string {
        switch (application.status) {
            case 'draft': return 'Application Drafting';
            case 'submitted': return 'Documentation Check';
            case 'accepted': return 'Program Preparation';
            default: return 'Review';
        }
    }

    private calculateDaysUntilDeadline(deadline: Date | null): number | undefined {
        if (!deadline) return undefined;
        const diff = new Date(deadline).getTime() - new Date().getTime();
        return Math.ceil(diff / (1000 * 3600 * 24));
    }
}
