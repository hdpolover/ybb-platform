import { ApiProperty } from '@nestjs/swagger';

export class PortalDashboardAlertDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ['info', 'warning', 'error', 'success'] })
    type: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    message: string;

    @ApiProperty({ required: false })
    actionLabel?: string;

    @ApiProperty({ required: false })
    actionUrl?: string;
}

export class PortalAnnouncementDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    preview: string;

    @ApiProperty()
    date: Date;

    @ApiProperty()
    isRead: boolean;
}

export class PortalApplicationSummaryDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    programName: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    category: string;
    
    @ApiProperty({ description: 'Indicates if category switching is allowed' })
    canSwitchCategory: boolean;

    @ApiProperty()
    progress: number;

    @ApiProperty()
    currentStep: string;

    @ApiProperty({ required: false })
    daysUntilDeadline?: number;
}

export class PortalDashboardMoneyDto {
    @ApiProperty()
    amount: number;

    @ApiProperty()
    currency: string;
}

export class PortalDashboardStatsDto {
    @ApiProperty()
    applicationsCount: number;

    @ApiProperty()
    completedProgramsCount: number;

    @ApiProperty()
    certificatesCount: number;

    @ApiProperty({ type: PortalDashboardMoneyDto })
    totalRequired: PortalDashboardMoneyDto;
}

export class PortalDashboardResponseDto {
    @ApiProperty()
    greeting: string;

    @ApiProperty({ required: false, type: PortalApplicationSummaryDto })
    activeApplication: PortalApplicationSummaryDto | null;

    @ApiProperty({ type: [PortalDashboardAlertDto] })
    alerts: PortalDashboardAlertDto[];

    @ApiProperty({ type: [PortalAnnouncementDto] })
    recentAnnouncements: PortalAnnouncementDto[];
    
    @ApiProperty({ required: false, description: 'Quick stats for the user', type: PortalDashboardStatsDto })
    stats?: PortalDashboardStatsDto;
}
