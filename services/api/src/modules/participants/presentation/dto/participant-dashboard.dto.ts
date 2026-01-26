import { ApiProperty } from '@nestjs/swagger';

export class ParticipantDashboardAlertDto {
    @ApiProperty()
    id: string;

    @ApiProperty({ enum: ['info', 'warning', 'error', 'success'] })
    type: 'info' | 'warning' | 'error' | 'success';

    @ApiProperty()
    title: string;

    @ApiProperty()
    message: string;

    @ApiProperty({ required: false })
    actionUrl?: string;

    @ApiProperty({ required: false })
    actionLabel?: string;
}

export class ParticipantDashboardApplicationSummaryDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    programName: string;

    @ApiProperty()
    status: string;

    @ApiProperty()
    category: string;

    @ApiProperty({ required: false })
    daysUntilDeadline?: number;

    @ApiProperty()
    progress: number;

    @ApiProperty()
    currentStep: string;
}

export class ParticipantDashboardAnnouncementDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    date: Date;

    @ApiProperty()
    preview: string;

    @ApiProperty()
    isRead: boolean;
}

export class ParticipantDashboardStatsDto {
    @ApiProperty()
    applicationsCount: number;

    @ApiProperty()
    completedProgramsCount: number;

    @ApiProperty()
    certificatesCount: number;
}

export class ParticipantDashboardResponseDto {
    @ApiProperty()
    greeting: string;

    @ApiProperty({ type: ParticipantDashboardApplicationSummaryDto, nullable: true })
    activeApplication: ParticipantDashboardApplicationSummaryDto | null;

    @ApiProperty({ type: [ParticipantDashboardAlertDto] })
    alerts: ParticipantDashboardAlertDto[];

    @ApiProperty({ type: [ParticipantDashboardAnnouncementDto] })
    recentAnnouncements: ParticipantDashboardAnnouncementDto[];

    @ApiProperty({ type: ParticipantDashboardStatsDto })
    stats: ParticipantDashboardStatsDto;
}
