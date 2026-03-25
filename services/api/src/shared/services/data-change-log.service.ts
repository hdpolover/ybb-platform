import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { ChangeType, ChangedByType, RiskLevel } from '@prisma/client';

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
            await this.prisma.dataChangeLog.create({
                data: {
                    entityType: dto.entityType,
                    entityId: dto.entityId ?? null,
                    action: dto.action,
                    changedFields: dto.changedFields ?? [],
                    beforeState: dto.beforeState ? JSON.parse(JSON.stringify(dto.beforeState)) : undefined,
                    afterState: dto.afterState ? JSON.parse(JSON.stringify(dto.afterState)) : undefined,
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
