import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    Res,
    UseGuards,
    UnauthorizedException,
    HttpException,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ExcelService } from '../../shared/infrastructure/excel/excel.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/infrastructure/guards/roles.guard';
import { Roles } from '../auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';
import { CurrentUser, CurrentUserData } from '../../shared/decorators/current-user.decorator';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AuditCleanupService } from './audit-cleanup.service';
import { Prisma, ChangeType, ChangedByType, RiskLevel } from '@prisma/client';

@ApiTags('audit')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
export class AuditAdminController {
    private readonly logger = new Logger(AuditAdminController.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly excelService: ExcelService,
        private readonly auditCleanupService: AuditCleanupService,
    ) { }

    /**
     * List audit logs with pagination and filters.
     */
    @Get()
    @ApiOperation({ summary: 'List Audit Logs (Admin)', operationId: 'listAuditLogs' })
    @ApiResponse({ status: 200, description: 'Paginated list of audit logs' })
    async list(
        @Query() query: QueryAuditLogsDto,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');

        const { page = 1, limit = 20, cursor } = query;
        const cursorToken = cursor?.trim() || null;
        const useCursorMode = cursorToken !== null;
        const decodedCursor = useCursorMode
            ? this.decodeCreatedAtCursor(cursorToken as string)
            : null;
        const skip = (page - 1) * limit;

        const where = this.buildWhereClause(query);
        const listWhere = useCursorMode
            ? this.buildCreatedAtCursorWhere(where, decodedCursor, 'desc')
            : where;

        const [data, total] = await Promise.all([
            this.prisma.dataChangeLog.findMany({
                where: listWhere,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                ...(useCursorMode ? {} : { skip }),
                take: useCursorMode ? limit + 1 : limit,
            }),
            this.prisma.dataChangeLog.count({ where }),
        ]);
        const hasMore = useCursorMode ? data.length > limit : page * limit < total;
        const window = useCursorMode ? data.slice(0, limit) : data;
        const nextCursor = useCursorMode && hasMore
            ? this.encodeCreatedAtCursor({
                id: window[window.length - 1]?.id,
                createdAt: window[window.length - 1]?.createdAt,
            })
            : null;

        return {
            data: window,
            meta: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                mode: useCursorMode ? 'cursor' : 'offset',
                cursor: cursorToken,
                nextCursor,
                hasMore,
            },
        };
    }

    /**
     * Get a single audit log entry.
     */
    @Get(':id')
    @ApiOperation({ summary: 'Get Audit Log Detail (Admin)', operationId: 'getAuditLog' })
    @ApiResponse({ status: 200, description: 'Audit log detail' })
    async detail(
        @Param('id') id: string,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');

        return this.prisma.dataChangeLog.findUnique({ where: { id } });
    }

    /**
     * Get all changes for a specific entity.
     */
    @Get('entity/:entityType/:entityId')
    @ApiOperation({ summary: 'Get Entity Change History (Admin)', operationId: 'getEntityHistory' })
    @ApiResponse({ status: 200, description: 'Change history for a specific entity' })
    async entityHistory(
        @Param('entityType') entityType: string,
        @Param('entityId') entityId: string,
        @Query('page') page: number = 1,
        @Query('limit') limit: number = 50,
        @Query('cursor') cursor: string = '',
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');

        const pageNum = Number(page);
        const limitNum = Number(limit);
        const skip = (pageNum - 1) * limitNum;
        const cursorToken = cursor?.trim() || null;
        const useCursorMode = cursorToken !== null;
        const decodedCursor = useCursorMode
            ? this.decodeCreatedAtCursor(cursorToken as string)
            : null;

        const where = { entityType, entityId };
        const listWhere = useCursorMode
            ? this.buildCreatedAtCursorWhere(where, decodedCursor, 'desc')
            : where;

        const [data, total] = await Promise.all([
            this.prisma.dataChangeLog.findMany({
                where: listWhere,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                ...(useCursorMode ? {} : { skip }),
                take: useCursorMode ? limitNum + 1 : limitNum,
            }),
            this.prisma.dataChangeLog.count({ where }),
        ]);
        const hasMore = useCursorMode ? data.length > limitNum : pageNum * limitNum < total;
        const window = useCursorMode ? data.slice(0, limitNum) : data;
        const nextCursor = useCursorMode && hasMore
            ? this.encodeCreatedAtCursor({
                id: window[window.length - 1]?.id,
                createdAt: window[window.length - 1]?.createdAt,
            })
            : null;

        return {
            data: window,
            meta: {
                total,
                page: pageNum,
                limit: limitNum,
                totalPages: Math.ceil(total / limitNum),
                mode: useCursorMode ? 'cursor' : 'offset',
                cursor: cursorToken,
                nextCursor,
                hasMore,
            },
        };
    }

    /**
     * Export audit logs as Excel.
     */
    @Get('export')
    @ApiOperation({ summary: 'Export Audit Logs (Admin)', operationId: 'exportAuditLogsAdmin' })
    @ApiResponse({ status: 200, description: 'Excel file download' })
    async export(
        @Query() query: QueryAuditLogsDto,
        @Res() res: Response,
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');

        const where = this.buildWhereClause(query);

        const columns = [
            { header: 'ID', key: 'id', width: 36 },
            { header: 'Timestamp', key: 'timestamp', width: 20 },
            { header: 'Action', key: 'action', width: 15 },
            { header: 'Entity Type', key: 'entityType', width: 25 },
            { header: 'Entity ID', key: 'entityId', width: 36 },
            { header: 'Event', key: 'event', width: 30 },
            { header: 'Actor Type', key: 'actorType', width: 12 },
            { header: 'Actor ID', key: 'actorId', width: 36 },
            { header: 'Risk Level', key: 'riskLevel', width: 12 },
            { header: 'Source', key: 'source', width: 12 },
            { header: 'Endpoint', key: 'endpoint', width: 40 },
            { header: 'Status', key: 'status', width: 12 },
            { header: 'Changed Fields', key: 'changedFields', width: 30 },
            { header: 'Reason', key: 'reason', width: 30 },
            { header: 'Before State', key: 'beforeState', width: 50 },
            { header: 'After State', key: 'afterState', width: 50 },
            { header: 'IP Address', key: 'ip', width: 15 },
        ];

        await this.excelService.streamExcelRows(
            res,
            this.iterateAuditExportRows(where),
            columns,
            'audit-logs-export',
        );
    }

    /**
     * Build Prisma where clause from query DTO.
     */
    private buildWhereClause(query: QueryAuditLogsDto): Prisma.DataChangeLogWhereInput {
        const where: Prisma.DataChangeLogWhereInput = {};

        if (query.entityType) where.entityType = query.entityType;
        if (query.entityId) where.entityId = query.entityId;
        if (query.action) where.action = query.action as ChangeType;
        if (query.actorId) where.actorId = query.actorId;
        if (query.actorType) where.actorType = query.actorType as ChangedByType;
        if (query.riskLevel) where.riskLevel = query.riskLevel as RiskLevel;
        if (query.source) where.source = query.source;

        if (query.dateFrom || query.dateTo) {
            where.createdAt = {};
            if (query.dateFrom) where.createdAt.gte = new Date(query.dateFrom);
            if (query.dateTo) where.createdAt.lte = new Date(query.dateTo);
        }

        if (query.search) {
            where.OR = [
                { event: { contains: query.search, mode: 'insensitive' } },
                { endpoint: { contains: query.search, mode: 'insensitive' } },
                { entityType: { contains: query.search, mode: 'insensitive' } },
            ];
        }

        return where;
    }

    private decodeCreatedAtCursor(cursor: string): { id: string; createdAt: Date } {
        try {
            const json = Buffer.from(cursor, 'base64url').toString('utf8');
            const parsed = JSON.parse(json) as { id?: string; createdAt?: string };
            if (!parsed.id || !parsed.createdAt) {
                throw new Error('missing cursor fields');
            }
            const createdAt = new Date(parsed.createdAt);
            if (Number.isNaN(createdAt.getTime())) {
                throw new Error('invalid cursor createdAt');
            }
            return { id: parsed.id, createdAt };
        } catch {
            throw new HttpException('Invalid cursor token', 400);
        }
    }

    private encodeCreatedAtCursor(cursor: { id?: string; createdAt?: Date }): string | null {
        if (!cursor.id || !cursor.createdAt) return null;
        return Buffer.from(
            JSON.stringify({
                id: cursor.id,
                createdAt: cursor.createdAt.toISOString(),
            }),
            'utf8',
        ).toString('base64url');
    }

    private buildCreatedAtCursorWhere(
        baseWhere: Prisma.DataChangeLogWhereInput,
        cursor: { id: string; createdAt: Date } | null,
        sortOrder: Prisma.SortOrder,
    ): Prisma.DataChangeLogWhereInput {
        if (!cursor) return baseWhere;
        const cursorWindow = sortOrder === 'asc'
            ? {
                OR: [
                    { createdAt: { gt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { gt: cursor.id } },
                ],
            }
            : {
                OR: [
                    { createdAt: { lt: cursor.createdAt } },
                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                ],
            };
        return {
            AND: [
                baseWhere,
                cursorWindow,
            ],
        };
    }

    private async *iterateAuditExportRows(where: Prisma.DataChangeLogWhereInput) {
        let cursor: { id: string; createdAt: Date } | null = null;
        const batchSize = 500;

        while (true) {
            const logs = await this.prisma.dataChangeLog.findMany({
                where: cursor
                    ? {
                        AND: [
                            where,
                            {
                                OR: [
                                    { createdAt: { lt: cursor.createdAt } },
                                    { createdAt: cursor.createdAt, id: { lt: cursor.id } },
                                ],
                            },
                        ],
                    }
                    : where,
                orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
                take: batchSize,
            });

            if (logs.length === 0) {
                return;
            }

            for (const log of logs) {
                yield {
                    id: log.id,
                    timestamp: log.createdAt,
                    action: log.action,
                    entityType: log.entityType,
                    entityId: log.entityId || '',
                    event: log.event || '',
                    actorType: log.actorType,
                    actorId: log.actorId || '',
                    riskLevel: log.riskLevel,
                    source: log.source || '',
                    endpoint: log.endpoint || '',
                    status: log.status,
                    changedFields: (log.changedFields || []).join(', '),
                    reason: log.reason || '',
                    beforeState: log.beforeState ? JSON.stringify(log.beforeState) : '',
                    afterState: log.afterState ? JSON.stringify(log.afterState) : '',
                    ip: log.ipAddress,
                };
            }

            const last = logs[logs.length - 1];
            cursor = { id: last.id, createdAt: last.createdAt };
        }
    }

    /**
     * Trigger manual cleanup of audit logs older than 30 days.
     */
    @Delete('cleanup')
    @ApiOperation({ summary: 'Cleanup Old Audit Logs (Admin)', operationId: 'cleanupAuditLogs' })
    @ApiResponse({ status: 200, description: 'Cleanup result with deleted count' })
    async cleanup(@CurrentUser() currentUser: CurrentUserData) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');
        return this.auditCleanupService.cleanup();
    }
}
