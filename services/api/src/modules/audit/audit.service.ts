import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';
import { DataChangeLogService } from '../../shared/services/data-change-log.service';
import { ChangeType, ChangedByType } from '@prisma/client';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly dataChangeLogService: DataChangeLogService,
  ) { }

  /**
   * Log an event from RabbitMQ into the DataChangeLog table.
   * Absorbs the old AuditLog behavior with richer schema.
   */
  async logEvent(pattern: string, data: Record<string, unknown>) {
    try {
      // Extract common fields if they exist in the payload
      const entityId = data.id || data.payment_id || data.user_id || data.order_id || null;
      let entityType: string = 'Unknown';

      if (pattern.startsWith('user.')) entityType = 'User';
      if (pattern.startsWith('payment.')) entityType = 'ApplicationInvoice';
      if (pattern.startsWith('system.')) entityType = 'System';
      if (pattern.startsWith('program.')) entityType = 'Program';

      // Safely serialize payload
      const payload = JSON.parse(JSON.stringify(data));
      const metadata = (data['metadata'] ?? {}) as Record<string, unknown>;

      await this.dataChangeLogService.log({
        entityType,
        entityId: entityId ? String(entityId) : undefined,
        action: ChangeType.create,
        afterState: payload,
        actorType: ChangedByType.system,
        actorId: (metadata['user_id'] ?? data['userId'] ?? undefined) as string | undefined,
        source: 'rabbitmq',
        event: pattern,
        ipAddress: (metadata['ip_address'] ?? undefined) as string | undefined,
        userAgent: (metadata['user_agent'] ?? undefined) as string | undefined,
        status: 'SUCCESS',
      });

      this.logger.log(`Data change log created for event: ${pattern}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      const stack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to create data change log for ${pattern}: ${message}`, stack);
      // We do not throw here to prevent crashing the consumer loop
    }
  }
}
