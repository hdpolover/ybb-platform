// services/api/src/modules/audit/dto/admin-security-events.dto.ts
import { IsDateString, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export const ADMIN_SECURITY_EVENTS_MAX_LIMIT = 100;

export class AdminSecurityEventsQueryDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20, maximum: ADMIN_SECURITY_EVENTS_MAX_LIMIT })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(ADMIN_SECURITY_EVENTS_MAX_LIMIT)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Filter by admin id (admins.id, not users.id)' })
    @IsOptional()
    @IsUUID()
    adminId?: string;

    @ApiPropertyOptional({ description: 'Events from this date (YYYY-MM-DD = WIB calendar day, or ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @ApiPropertyOptional({ description: 'Events until this date (YYYY-MM-DD = WIB calendar day, or ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dateTo?: string;
}
