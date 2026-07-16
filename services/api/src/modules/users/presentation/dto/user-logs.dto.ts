import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserActivityLogResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    activityType: string;

    @ApiPropertyOptional()
    activityCategory?: string;

    @ApiProperty()
    activityData: Record<string, unknown>;

    @ApiPropertyOptional()
    pageUrl?: string;

    @ApiPropertyOptional()
    referrerUrl?: string;

    @ApiPropertyOptional()
    ipAddress?: string;

    @ApiPropertyOptional()
    userAgent?: string;

    @ApiPropertyOptional()
    deviceType?: string;

    @ApiProperty()
    createdAt: Date;
}

export class UserSecurityLogResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    eventType: string;

    @ApiProperty()
    eventStatus: string;

    @ApiPropertyOptional()
    eventDescription?: string;

    @ApiPropertyOptional()
    ipAddress?: string;

    @ApiPropertyOptional()
    userAgent?: string;

    @ApiPropertyOptional()
    location?: string;

    @ApiPropertyOptional()
    riskLevel?: string;

    @ApiProperty()
    flagged: boolean;

    @ApiProperty()
    createdAt: Date;
}
