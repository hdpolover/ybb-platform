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
/**
 * Who an audited action is attributed to.
 *
 * Exported for testing: the interceptor itself needs an ExecutionContext, a
 * reflector and a service to construct, which is a lot of scaffolding around one
 * branch - and this branch decides whether an action is traceable to the person
 * who performed it.
 *
 * An admin-impersonation session is a PARTICIPANT session by design: it carries
 * no adminId, because adminId grants admin identity elsewhere (admin-refresh
 * requires isAdmin + adminId + sid). That meant every action taken while
 * impersonating was recorded as the participant with no route back to the admin,
 * across 228 redeemed tickets as of 2026-09-04.
 *
 * So impersonatedByAdminId is checked FIRST. The participant is still
 * identifiable - they are the entity being acted on - and the ticket id ties the
 * action to one support session rather than merely to a person.
 */
export function resolveAuditActor(user: {
    adminId?: string;
    userId?: string;
    impersonatedByAdminId?: string;
} | undefined): { actorId: string | null; actorType: ChangedByType } {
    const impersonatorId = user?.impersonatedByAdminId;

    if (impersonatorId) {
        return { actorId: impersonatorId, actorType: ChangedByType.admin };
    }
    if (user?.adminId) {
        return { actorId: user.adminId, actorType: ChangedByType.admin };
    }
    if (user?.userId) {
        return { actorId: user.userId, actorType: ChangedByType.participant };
    }
    return { actorId: null, actorType: ChangedByType.system };
}

@Injectable()
export class AuditTrailInterceptor implements NestInterceptor {
    private readonly logger = new Logger(AuditTrailInterceptor.name);
    private static readonly DEFAULT_ENTITY_SELECTS: Record<string, Record<string, boolean>> = {
        ParticipantApplication: {
            id: true,
            participantId: true,
            programId: true,
            status: true,
            registrationPaymentStatus: true,
            programPaymentStatus: true,
            applicationCategory: true,
            pricingTierId: true,
            participationCategoryId: true,
            submittedAt: true,
            reviewedAt: true,
            reviewedBy: true,
            updatedAt: true,
            deletedAt: true,
        },
        ApplicationInvoice: {
            id: true,
            applicationId: true,
            pricingTierId: true,
            amount: true,
            currency: true,
            status: true,
            paidAt: true,
            externalIntentId: true,
            externalTransactionId: true,
            paymentMethod: true,
            updatedAt: true,
        },
    };

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
        const effectiveSelectFields = this.getEffectiveSelectFields(entityType, selectFields);

        // Extract entity ID from route params
        const paramKey = idParam || 'id';
        const entityId: string | undefined = request.params?.[paramKey];

        // Extract actor info from JWT user.
        //
        // An admin-impersonation session is a PARTICIPANT session by design - it
        // carries no adminId, because adminId grants admin identity elsewhere.
        // That meant every action taken while impersonating was recorded as the
        // participant with no route back to the admin who performed it, across
        // 228 redeemed tickets as of 2026-09-04.
        //
        // impersonatedByAdminId is checked FIRST so those actions attribute to
        // the admin, which is the whole point of an audit trail. The participant
        // is still identifiable - they are the entity being acted on - and the
        // ticket id is recorded so the action can be tied to one support
        // session rather than just to a person.
        const { actorId, actorType } = resolveAuditActor(request.user);

        // Build endpoint string
        const endpoint = `${request.method} ${request.route?.path || request.url}`;
        const httpMethod = request.method;
        const ipAddress = request.ip || request.headers?.['x-forwarded-for'] || null;
        const userAgent = request.headers?.['user-agent'] || null;

        // --- Fetch "before" state (only for updates/deletes/status_changes) ---
        let beforeState: Record<string, unknown> | null = null;
        const actionsNeedingBeforeState: ChangeType[] = [ChangeType.update, ChangeType.delete, ChangeType.status_change];
        if (entityId && actionsNeedingBeforeState.includes(action)) {
            beforeState = await this.fetchEntityState(entityType, entityId, effectiveSelectFields);
        }

        // --- Execute the handler ---
        return next.handle().pipe(
            tap(async (responseData) => {
                try {
                    // Extract the "after" state from the response
                    // The TransformInterceptor wraps responses in { statusCode, message, data }
                    let afterState: Record<string, unknown> | null = null;

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

                        if (afterState && effectiveSelectFields) {
                            afterState = this.pickSelectedFields(afterState, effectiveSelectFields);
                        }
                    }

                    // Write the log entry asynchronously
                    void this.dataChangeLogService.logWithDiff({
                        entityType,
                        entityId,
                        action,
                        beforeState: beforeState ?? undefined,
                        afterState: afterState ?? undefined,
                        actorType,
                        actorId: actorId ?? undefined,
                        source: 'http',
                        endpoint,
                        httpMethod,
                        ipAddress,
                        userAgent,
                        ...(riskLevel ? { riskLevel } : {}),
                    }).catch((error) => {
                        this.logger.error(
                            `AuditTrailInterceptor failed to persist log for ${entityType}/${entityId}: ${error.message}`,
                            error.stack,
                        );
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
    ): Promise<Record<string, unknown> | null> {
        try {
            // Convert PascalCase entity type to camelCase for Prisma model access
            const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
            const model = (this.prisma as unknown as Record<string, unknown>)[modelName] as { findUnique: (args: { where: { id: string }; select?: Record<string, boolean> }) => Promise<Record<string, unknown> | null> } | undefined;

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

    private getEffectiveSelectFields(
        entityType: string,
        selectFields?: Record<string, boolean>,
    ): Record<string, boolean> | undefined {
        if (selectFields && Object.keys(selectFields).length > 0) return selectFields;
        return AuditTrailInterceptor.DEFAULT_ENTITY_SELECTS[entityType];
    }

    private pickSelectedFields(
        source: Record<string, unknown>,
        selectFields: Record<string, boolean>,
    ): Record<string, unknown> {
        const picked: Record<string, unknown> = {};
        for (const [field, enabled] of Object.entries(selectFields)) {
            if (!enabled) continue;
            if (Object.prototype.hasOwnProperty.call(source, field)) {
                picked[field] = source[field];
            }
        }
        return picked;
    }
}
