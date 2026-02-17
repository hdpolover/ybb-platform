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
     * If not provided, the full entity will be snapshotted.
     */
    selectFields?: Record<string, boolean>;
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
