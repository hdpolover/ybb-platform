import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Reflector } from '@nestjs/core';
import { ChangeType, ChangedByType } from '@prisma/client';
import { PrismaService } from '../infrastructure/prisma/prisma.service';
import { DataChangeLogService } from '../services/data-change-log.service';
import { AUDIT_TRAIL_KEY, AuditTrailMetadata } from '../decorators/audit-trail.decorator';

/**
 * Interceptor that automatically captures before/after state for audited endpoints.
 *
 * Flow:
 * 1. Read @AuditTrail() metadata from the handler
 * 2. If present and action is update/delete/status_change → fetch "before" state from DB
 * 3. After handler completes → capture "after" state from the response
 * 4. Write DataChangeLog entry asynchronously (fire-and-forget)
 */
@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditTrailInterceptor.name);

    constructor(
        private readonly reflector: Reflector,
        private readonly prisma: PrismaService,
        private readonly dataChangeLogService: DataChangeLogService,
    ) { }

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<any>> {
        const metadata = this.reflector.get<AuditTrailMetadata>(
            AUDIT_TRAIL_KEY,
            context.getHandler(),
        );

        // No @AuditTrail decorator → pass through
        if (!metadata) {
            return next.handle();
        }

        const request = context.switchToHttp().getRequest();
        const { entityType, action, riskLevel, idParam, selectFields } = metadata;

        // Extract entity ID from route params
        const paramKey = idParam || 'id';
        const entityId: string | undefined = request.params?.[paramKey];

        // Extract actor info from JWT user
        const user = request.user;
        const actorId = user?.adminId || user?.userId || null;
        const actorType = user?.adminId
            ? ChangedByType.admin
            : user?.userId
                ? ChangedByType.participant
                : ChangedByType.system;

        // Build endpoint string
        const endpoint = `${request.method} ${request.route?.path || request.url}`;
        const httpMethod = request.method;
        const ipAddress = request.ip || request.headers?.['x-forwarded-for'] || null;
        const userAgent = request.headers?.['user-agent'] || null;

        // --- Fetch "before" state (only for updates/deletes/status_changes) ---
        let beforeState: Record<string, any> | null = null;
        const actionsNeedingBeforeState: ChangeType[] = [ChangeType.update, ChangeType.delete, ChangeType.status_change];
        if (entityId && actionsNeedingBeforeState.includes(action)) {
            beforeState = await this.fetchEntityState(entityType, entityId, selectFields);
        }

        // --- Execute the handler ---
        return next.handle().pipe(
            tap(async (responseData) => {
                try {
                    // Extract the "after" state from the response
                    // The TransformInterceptor wraps responses in { statusCode, message, data }
                    let afterState: Record<string, any> | null = null;

                    if (action === ChangeType.delete) {
                        // For deletes, the after state is null (entity was deleted)
                        afterState = null;
                    } else if (responseData) {
                        // Try to extract from transformed response shape
                        afterState = responseData?.data || responseData;
                        // Ensure it's a plain object
                        if (typeof afterState !== 'object' || Array.isArray(afterState)) {
                            afterState = { value: afterState };
                        }
                    }

                    // Write the log entry asynchronously
                    await this.dataChangeLogService.logWithDiff({
                        entityType,
                        entityId,
                        action,
                        beforeState: beforeState ?? undefined,
                        afterState: afterState ?? undefined,
                        actorType,
                        actorId,
                        source: 'http',
                        endpoint,
                        httpMethod,
                        ipAddress,
                        userAgent,
                        ...(riskLevel ? { riskLevel } : {}),
                    });
                } catch (error) {
                    this.logger.error(
                        `AuditTrailInterceptor failed for ${entityType}/${entityId}: ${error.message}`,
                        error.stack,
                    );
                    // Never throw — audit failures must not break the response
                }
            }),
        );
    }

    /**
     * Fetch the current state of an entity from the database.
     * Uses Prisma's dynamic model access to generically query any model.
     */
    private async fetchEntityState(
        entityType: string,
        entityId: string,
        selectFields?: Record<string, boolean>,
    ): Promise<Record<string, any> | null> {
        try {
            // Convert PascalCase entity type to camelCase for Prisma model access
            const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
            const model = (this.prisma as any)[modelName];

            if (!model) {
                this.logger.warn(`Prisma model not found for entity type: ${entityType}`);
                return null;
            }

            const result = await model.findUnique({
                where: { id: entityId },
                ...(selectFields ? { select: selectFields } : {}),
            });

            return result;
        } catch (error) {
            this.logger.warn(
                `Failed to fetch before-state for ${entityType}/${entityId}: ${error.message}`,
            );
            return null;
        }
    }
}
