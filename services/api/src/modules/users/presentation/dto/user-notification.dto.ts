import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserNotificationResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    type: string;

    @ApiProperty()
    title: string;

    @ApiProperty()
    message: string;

    @ApiPropertyOptional()
    actionUrl?: string;

    @ApiPropertyOptional()
    actionLabel?: string;

    @ApiPropertyOptional()
    relatedEntityType?: string;

    @ApiPropertyOptional()
    relatedEntityId?: string;

    @ApiProperty()
    metadata: Record<string, unknown>;

    @ApiProperty()
    isRead: boolean;

    @ApiPropertyOptional()
    readAt?: Date;

    @ApiProperty()
    priority: string;

    @ApiProperty()
    createdAt: Date;
}
