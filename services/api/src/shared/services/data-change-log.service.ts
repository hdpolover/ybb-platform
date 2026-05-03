import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { ChangeType, ChangedByType, RiskLevel, Prisma } from '@prisma/client';

const MAX_AUDIT_JSON_BYTES = 24_000;
const MAX_DEPTH = 4;
const MAX_ARRAY_ITEMS = 20;
const MAX_OBJECT_KEYS = 40;
const MAX_STRING_LENGTH = 500;
const REDACTED_KEY_PATTERN = /(password|token|secret|authorization|cookie|api[-_]?key)/i;

export interface CreateDataChangeLogDto {
    entityType: string;
    entityId?: string;
    action: ChangeType;
    changedFields?: string[];
    beforeState?: Record<string, unknown>;
    afterState?: Record<string, unknown>;
    actorType?: ChangedByType;
    actorId?: string;
    source?: string;
    endpoint?: string;
    httpMethod?: string;
    event?: string;
    ipAddress?: string;
    userAgent?: string;
    riskLevel?: RiskLevel;
    reason?: string;
    correlationId?: string;
    status?: string;
    errorMessage?: string;
}

@Injectable()
export class DataChangeLogService {
    private readonly logger = new Logger(DataChangeLogService.name);

    constructor(private readonly prisma: PrismaService) { }

    /**
     * Create a data change log entry.
     * Fire-and-forget — errors are logged but never thrown.
     */
    async log(dto: CreateDataChangeLogDto): Promise<void> {
        try {
            const beforeState = limitAuditJsonSize(sanitizeAuditValue(dto.beforeState));
            const afterState = limitAuditJsonSize(sanitizeAuditValue(dto.afterState));
            await this.prisma.dataChangeLog.create({
                data: {
                    entityType: dto.entityType,
                    entityId: dto.entityId ?? null,
                    action: dto.action,
                    changedFields: dto.changedFields ?? [],
                    beforeState: beforeState as Prisma.InputJsonValue | undefined,
                    afterState: afterState as Prisma.InputJsonValue | undefined,
                    actorType: dto.actorType ?? ChangedByType.system,
                    actorId: dto.actorId ?? null,
                    source: dto.source ?? null,
                    endpoint: dto.endpoint ?? null,
                    httpMethod: dto.httpMethod ?? null,
                    event: dto.event ?? null,
                    ipAddress: dto.ipAddress ?? null,
                    userAgent: dto.userAgent ?? null,
                    riskLevel: dto.riskLevel ?? RiskLevel.low,
                    reason: dto.reason ?? null,
                    correlationId: dto.correlationId ?? null,
                    status: dto.status ?? 'SUCCESS',
                    errorMessage: dto.errorMessage ?? null,
                },
            });
        } catch (error) {
            this.logger.error(
                `Failed to create data change log for ${dto.entityType}/${dto.entityId}: ${error.message}`,
                error.stack,
            );
            // Never throw — audit failures must not break business logic
        }
    }

    /**
     * Compute the list of fields that changed between two object snapshots.
     */
    computeChangedFields(
        before: Record<string, unknown> | null | undefined,
        after: Record<string, unknown> | null | undefined,
    ): string[] {
        if (!before || !after) return [];

        const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
        const changed: string[] = [];

        for (const key of allKeys) {
            if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) {
                changed.push(key);
            }
        }

        return changed;
    }

    /**
     * Determine risk level based on entity type and action.
     */
    classifyRisk(entityType: string, action: ChangeType): RiskLevel {
        const highRiskEntities = [
            'ParticipantApplication',
            'ApplicationInvoice',
            'ApplicationAssessment',
            'ApplicationReview',
            'ApplicationScoreItem',
            'ProgramPricingTier',
            'User',
            'Admin',
            'Program',
        ];

        const criticalActions: ChangeType[] = [ChangeType.delete, ChangeType.bulk_update];

        if (criticalActions.includes(action)) return RiskLevel.critical;
        if (highRiskEntities.includes(entityType) && action === ChangeType.status_change) return RiskLevel.high;
        if (highRiskEntities.includes(entityType)) return RiskLevel.medium;

        return RiskLevel.low;
    }

    /**
     * Log with automatic risk classification and field diff.
     */
    async logWithDiff(dto: Omit<CreateDataChangeLogDto, 'changedFields' | 'riskLevel'>): Promise<void> {
        const changedFields = this.computeChangedFields(dto.beforeState, dto.afterState);
        const riskLevel = this.classifyRisk(dto.entityType, dto.action);

        return this.log({
            ...dto,
            changedFields,
            riskLevel,
        });
    }
}

function sanitizeAuditValue(value: unknown, depth = 0): unknown {
    if (value === null || value === undefined) return value;
    if (depth >= MAX_DEPTH) return '[Truncated: max depth reached]';

    if (typeof value === 'string') {
        if (value.length <= MAX_STRING_LENGTH) return value;
        return `${value.slice(0, MAX_STRING_LENGTH)}...[truncated]`;
    }

    if (typeof value === 'number' || typeof value === 'boolean') return value;

    if (Array.isArray(value)) {
        const limited = value
            .slice(0, MAX_ARRAY_ITEMS)
            .map((item) => sanitizeAuditValue(item, depth + 1));
        if (value.length > MAX_ARRAY_ITEMS) {
            limited.push(`[... ${value.length - MAX_ARRAY_ITEMS} more items truncated]`);
        }
        return limited;
    }

    if (typeof value === 'object') {
        const entries = Object.entries(value as Record<string, unknown>);
        const limitedEntries = entries.slice(0, MAX_OBJECT_KEYS);
        const result: Record<string, unknown> = {};

        for (const [key, raw] of limitedEntries) {
            if (REDACTED_KEY_PATTERN.test(key)) {
                result[key] = '[Redacted]';
                continue;
            }
            result[key] = sanitizeAuditValue(raw, depth + 1);
        }

        if (entries.length > MAX_OBJECT_KEYS) {
            result.__truncated_keys__ = entries.length - MAX_OBJECT_KEYS;
        }

        return result;
    }

    return String(value);
}

function limitAuditJsonSize(value: unknown): unknown {
    if (value === undefined) return undefined;

    const asJson = JSON.stringify(value);
    if (asJson.length <= MAX_AUDIT_JSON_BYTES) {
        return value;
    }

    return {
        __truncated__: true,
        __original_size_bytes__: asJson.length,
        preview: asJson.slice(0, MAX_AUDIT_JSON_BYTES),
    };
}
