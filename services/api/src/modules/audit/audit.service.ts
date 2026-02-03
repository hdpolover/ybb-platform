import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../shared/infrastructure/prisma/prisma.service';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async logEvent(pattern: string, data: any) {
    try {
      // Extract common fields if they exist in the payload
      const entityId = data.id || data.payment_id || data.user_id || data.order_id || null;
      let entityType: string | null = null;
      
      if (pattern.startsWith('user.')) entityType = 'User';
      if (pattern.startsWith('payment.')) entityType = 'Payment';
      if (pattern.startsWith('system.')) entityType = 'System';
      if (pattern.startsWith('program.')) entityType = 'Program';

      // Safely serialize payload
      const payload = JSON.parse(JSON.stringify(data));

      await this.prisma.auditLog.create({
        data: {
            event: pattern,
            payload: payload,
            entityType: entityType,
            entityId: entityId ? String(entityId) : null,
            actorId: data.metadata?.user_id || data.userId || null,
            ipAddress: data.metadata?.ip_address || null,
            userAgent: data.metadata?.user_agent || null,
            status: 'SUCCESS' // Assumed success if we received it
        }
      });
      
      this.logger.log(`Audit log created for event: ${pattern}`);
    } catch (error) {
      this.logger.error(`Failed to create audit log for ${pattern}: ${error.message}`, error.stack);
      // We do not throw here to prevent crashing the consumer loop
    }
  }
}
