import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { QueryAuditLogsDto } from './query-audit-logs.dto';

/**
 * DTO for the paginated list endpoint. Extends the shared filter DTO with an
 * optional cursor token that enables seek/cursor pagination. The export endpoint
 * uses the base {@link QueryAuditLogsDto} so that cursor is not advertised there.
 *
 * Passing `cursor` as an empty value (e.g. `?cursor=`) bootstraps cursor mode from
 * the beginning of the result set. A non-empty value is treated as an opaque seek
 * token returned by a previous response's `nextCursor` field.
 */
export class ListAuditLogsDto extends QueryAuditLogsDto {
    @ApiPropertyOptional({
        description:
            'Opaque cursor token for seek pagination. ' +
            'Pass as empty string to start cursor mode from the first page. ' +
            'Omit entirely to use offset pagination.',
    })
    @IsOptional()
    @IsString()
    cursor?: string;
}
