import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetParticipantDashboardQuery } from '../get-participant-dashboard.query';
import { 
    ParticipantDashboardResponseDto, 
    ParticipantDashboardAlertDto,
    ParticipantDashboardApplicationSummaryDto,
    ParticipantDashboardAnnouncementDto
} from '../../../presentation/dto/participant-dashboard.dto';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { buildRichTextPreview } from '@shared/utils/rich-text';

@Injectable()
@QueryHandler(GetParticipantDashboardQuery)
export class GetParticipantDashboardHandler implements IQueryHandler<GetParticipantDashboardQuery> {
    constructor(
        private readonly prisma: PrismaService,
    ) {}

    async execute(query: GetParticipantDashboardQuery): Promise<ParticipantDashboardResponseDto> {
        const { userId, participantId } = query;
        let participant;

        // 1. Fetch Participant Profile
        // If participantId is provided, look it up by ID and verify ownership
        if (participantId) {
            participant = await this.prisma.participant.findUnique({
                where: { id: participantId },
                include: {
                    user: true
                }
            });

            if (!participant) {
                throw new NotFoundException('Participant not found');
            }

            if (participant.userId !== userId) {
                throw new ForbiddenException('You do not have permission to access this participant dashboard');
            }
        } else {
            // No participantId provided, try to find the one associated with the user
            participant = await this.prisma.participant.findUnique({
                where: { userId },
                include: {
                    user: true
                }
            });

            if (!participant) {
               // If no participant profile yet, return basic dashboard asking for onboarding
               return this.buildOnboardingDashboard(userId);
            }
        }

        // 2. Fetch Active Application (Latest)
        // Including Program for name and timeline
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
                            include: {
                                reads: {
                                    where: { userId: participant.userId }
                                }
                            }
                        },
                        announcements: { // System Announcements linked to Program
                            where: { 
                                isPublished: true,
                            },
                            orderBy: { createdAt: 'desc' },
                            take: 5,
                            include: {
                                reads: {
                                    where: { userId: participant.userId }
                                }
                            }
                        }
                    }
                },
                invoices: true
            }
        });

        // 3. Build Stats
        const stats = await this.getStats(participant.id);

        // 4. Construct Alerts & Summary
        let activeAppSummary: ParticipantDashboardApplicationSummaryDto | null = null;
        let alerts: ParticipantDashboardAlertDto[] = [];
        let announcements: ParticipantDashboardAnnouncementDto[] = [];

        if (latestApplication) {
            // Generate Alerts based on application state
            alerts = this.generateAlerts(latestApplication);
            
            // Map Application Summary
             activeAppSummary = {
                id: latestApplication.id,
                programName: latestApplication.program.name,
                status: latestApplication.status,
                category: latestApplication.applicationCategory ?? 'general',
                progress: this.calculateProgress(latestApplication),
                currentStep: this.determineCurrentStep(latestApplication),
                daysUntilDeadline: this.calculateDaysUntilDeadline(latestApplication.program.applicationDeadline),
             };

             // Announcements (Merge Program Announcements with System Announcements)
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

             // Combine and Sort
             announcements = [...sysAnnouncements, ...progAnnouncements]
                .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                .slice(0, 5);
        } else {
             // No application started
             alerts.push({
                 id: 'start-app',
                 type: 'info',
                 title: 'Start your journey',
                 message: 'Browse available programs and start your application today.',
                 actionLabel: 'Browse Programs',
                 actionUrl: '/programs'
             });
        }

        // 5. Greeting
        const greeting = `Welcome back, ${participant.fullName.split(' ')[0]}`;

        return {
            greeting,
            activeApplication: activeAppSummary,
            alerts,
            recentAnnouncements: announcements,
            stats
        };
    }

    private buildOnboardingDashboard(userId: string): ParticipantDashboardResponseDto {
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
                certificatesCount: 0
            }
         };
    }

    private async getStats(participantId: string) {
        const appCount = await this.prisma.participantApplication.count({
            where: { participantId }
        });
        
        // Example: Completed means Status is COMPLETED or similar
        // Adjust based on your Status Enum
        const completedCount = 0; 
        
        const certCount = await this.prisma.participantDocument.count({
            where: { 
                application: { participantId },
                type: 'certificate'
            }
        });

        return {
            applicationsCount: appCount,
            completedProgramsCount: completedCount,
            certificatesCount: certCount
        };
    }

    private generateAlerts(application: Record<string, unknown>): ParticipantDashboardAlertDto[] {
        const alerts: ParticipantDashboardAlertDto[] = [];
        const status = application.status;

        // Payment Alert
        const invoices = (application.invoices as { status: string }[]) || [];
        const hasUnpaidInvoices = invoices.some(inv => inv.status === 'unpaid' || inv.status === 'failed');
        if (hasUnpaidInvoices) {
            alerts.push({
                id: 'payment-due',
                type: 'error',
                title: 'Payment Required',
                message: 'You have outstanding invoices. Please complete payment to proceed.',
                actionLabel: 'Pay Now',
                actionUrl: `/applications/${application.id}/payment`
            });
        }

        // Draft Alert
        const program = application.program as { applicationDeadline: Date | string | null; name: string } | null;
        if (status === 'draft') {
            const deadline = new Date(program?.applicationDeadline ?? 0);
            const now = new Date();
            const daysLeft = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 3600 * 24));
            
            if (daysLeft < 3 && daysLeft >= 0) {
                 alerts.push({
                    id: 'deadline-near',
                    type: 'warning',
                    title: 'Application Deadline Approaching',
                    message: `Only ${daysLeft} days left to submit your application for ${program?.name}.`,
                    actionLabel: 'Continue Application',
                    actionUrl: `/applications/${application.id}`
                });
            } else if (daysLeft < 0) {
                 alerts.push({
                    id: 'deadline-missed',
                    type: 'error',
                    title: 'Deadline Missed',
                    message: `The application period for ${program?.name} has ended.`,
                });
            } else {
                 alerts.push({
                    id: 'draft-reminder',
                    type: 'info',
                    title: 'Complete your Application',
                    message: `Your application for ${program?.name} is still in draft.`,
                    actionLabel: 'Continue',
                    actionUrl: `/applications/${application.id}`
                });
            }
        }

        // Status specific alerts
        if (status === 'accepted') {
            alerts.push({
                id: 'accepted-congrats',
                type: 'success',
                title: 'Congratulations!',
                message: 'You have been accepted into the program. Please check your next steps.',
                actionLabel: 'View Details',
                actionUrl: `/applications/${application.id}`
            });
        }

        return alerts;
    }

    private calculateProgress(application: Record<string, unknown>): number {
        // Simple heuristic
        if (application.status === 'draft') return 25;
        if (application.status === 'submitted') return 50;
        if (application.status === 'under_review') return 60;
        if (application.status === 'interview_scheduled') return 75;
        if (application.status === 'accepted') return 100;
        if (application.status === 'rejected') return 100;
        return 0;
    }

    private determineCurrentStep(application: Record<string, unknown>): string {
        switch (application.status) {
            case 'draft': return 'Application Drafting';
            case 'submitted': return 'Documentation Check';
            case 'under_review': return 'Selection Process';
            case 'interview_scheduled': return 'Interview';
            case 'accepted': return 'Program Preparation';
            case 'rejected': return 'Closed';
            default: return 'Review';
        }
    }

    private calculateDaysUntilDeadline(deadline: Date | null): number | undefined {
        if (!deadline) return undefined;
        const d = new Date(deadline);
        const now = new Date();
        const diff = d.getTime() - now.getTime();
        return Math.ceil(diff / (1000 * 3600 * 24));
    }
}
