import {
    Controller,
    Get,
    Delete,
    Param,
    Query,
    Res,
    UseGuards,
    UnauthorizedException,
    Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { ExcelService } from '../../shared/infrastructure/excel/excel.service';
import { JwtAuthGuard } from '../auth/infrastructure/guards/jwt-auth.guard';
import { CurrentUser, CurrentUserData } from '../../shared/decorators/current-user.decorator';
import { QueryAuditLogsDto } from './dto/query-audit-logs.dto';
import { AuditCleanupService } from './audit-cleanup.service';
import { Prisma, DataChangeLog, ChangeType, ChangedByType, RiskLevel } from '@prisma/client';

@ApiTags('audit')
@Controller('admin/audit-logs')
@UseGuards(JwtAuthGuard)
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

        const { page = 1, limit = 20 } = query;
        const skip = (page - 1) * limit;

        const where = this.buildWhereClause(query);

        const [data, total] = await Promise.all([
            this.prisma.dataChangeLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: limit,
            }),
            this.prisma.dataChangeLog.count({ where }),
        ]);

        return {
            data,
            meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
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
        @CurrentUser() currentUser: CurrentUserData,
    ) {
        if (!currentUser.adminId) throw new UnauthorizedException('Admin access required');

        const skip = (Number(page) - 1) * Number(limit);

        const where = { entityType, entityId };

        const [data, total] = await Promise.all([
            this.prisma.dataChangeLog.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                skip,
                take: Number(limit),
            }),
            this.prisma.dataChangeLog.count({ where }),
        ]);

        return {
            data,
            meta: { total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) },
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

        const logs = await this.prisma.dataChangeLog.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 5000,
        });

        const data = logs.map((log: DataChangeLog) => ({
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
        }));

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

        await this.excelService.streamExcel(res, data, columns, 'audit-logs-export');
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
