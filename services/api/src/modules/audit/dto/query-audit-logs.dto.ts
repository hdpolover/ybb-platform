import { IsOptional, IsString, IsDateString, IsInt, Min, Max } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class QueryAuditLogsDto {
    @ApiPropertyOptional({ description: 'Page number', default: 1 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    page?: number = 1;

    @ApiPropertyOptional({ description: 'Items per page', default: 20 })
    @IsOptional()
    @Type(() => Number)
    @IsInt()
    @Min(1)
    @Max(100)
    limit?: number = 20;

    @ApiPropertyOptional({ description: 'Opaque cursor token for seek pagination' })
    @IsOptional()
    @IsString()
    cursor?: string;

    @ApiPropertyOptional({ description: 'Filter by entity type (e.g., ParticipantApplication)' })
    @IsOptional()
    @IsString()
    entityType?: string;

    @ApiPropertyOptional({ description: 'Filter by entity ID' })
    @IsOptional()
    @IsString()
    entityId?: string;

    @ApiPropertyOptional({ description: 'Filter by action', enum: ['create', 'update', 'delete', 'status_change', 'bulk_update'] })
    @IsOptional()
    @IsString()
    action?: string;

    @ApiPropertyOptional({ description: 'Filter by actor ID (UUID)' })
    @IsOptional()
    @IsString()
    actorId?: string;

    @ApiPropertyOptional({ description: 'Filter by actor type', enum: ['admin', 'participant', 'system', 'webhook'] })
    @IsOptional()
    @IsString()
    actorType?: string;

    @ApiPropertyOptional({ description: 'Filter by risk level', enum: ['low', 'medium', 'high', 'critical'] })
    @IsOptional()
    @IsString()
    riskLevel?: string;

    @ApiPropertyOptional({ description: 'Filter by source', enum: ['http', 'rabbitmq', 'cron'] })
    @IsOptional()
    @IsString()
    source?: string;

    @ApiPropertyOptional({ description: 'Filter logs from this date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dateFrom?: string;

    @ApiPropertyOptional({ description: 'Filter logs until this date (ISO 8601)' })
    @IsOptional()
    @IsDateString()
    dateTo?: string;

    @ApiPropertyOptional({ description: 'Search in event name or endpoint' })
    @IsOptional()
    @IsString()
    search?: string;
}
