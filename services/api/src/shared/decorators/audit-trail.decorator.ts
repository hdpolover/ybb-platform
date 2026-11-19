import { SetMetadata } from '@nestjs/common';
import { ChangeType, RiskLevel } from '@prisma/client';

export const AUDIT_TRAIL_KEY = 'audit_trail';

export interface AuditTrailMetadata {
    /**
     * The entity type being modified (e.g., 'ParticipantApplication', 'ApplicationInvoice').
     */
    entityType: string;

    /**
     * The type of change (create, update, delete, status_change, bulk_update).
     */
    action: ChangeType;

    /**
     * Override the auto-classified risk level (optional).
     */
    riskLevel?: RiskLevel;

    /**
     * The request param key that holds the entity ID (default: 'id').
     * For example, if the route is `:applicationId`, set this to 'applicationId'.
     */
    idParam?: string;

    /**
     * Optional list of fields to include in the before/after snapshot.
     * If not provided, high-volume entity types (e.g. ParticipantApplication,
     * ApplicationInvoice) use a built-in default field selection defined in
     * AuditTrailInterceptor.DEFAULT_ENTITY_SELECTS to limit snapshot cost.
     * All other entity types will snapshot the full entity row.
     */
    selectFields?: Record<string, boolean>;

    /**
     * Request-body keys to record under `afterState.request`. The interceptor
     * otherwise logs only the response, so a route whose response omits what the
     * admin asked for (e.g. approve vs reject) would lose it. Allowlist only:
     * never name a field that can carry a secret. Values still pass through the
     * key-based redaction in DataChangeLogService.
     */
    bodyFields?: string[];

    /**
     * Query-string keys to record under `afterState.request`, for GET routes
     * (exports) that have no body. Same allowlist rules as bodyFields: never name
     * a free-text or secret-bearing key.
     */
    queryFields?: string[];
}

/**
 * Decorator to enable automatic audit trail logging on a controller method.
 *
 * Usage:
 * ```
 * @Patch(':id/status')
 * @AuditTrail({
 *   entityType: 'ParticipantApplication',
 *   action: ChangeType.status_change,
 * })
 * async updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) { ... }
 * ```
 */
export const AuditTrail = (metadata: AuditTrailMetadata) =>
    SetMetadata(AUDIT_TRAIL_KEY, metadata);
