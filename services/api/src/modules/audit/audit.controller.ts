import { Controller, Logger } from '@nestjs/common';
import { Ctx, EventPattern, Payload, RmqContext } from '@nestjs/microservices';
import { AuditService } from './audit.service';

@Controller()
export class AuditController {
  private readonly logger = new Logger(AuditController.name);

  constructor(private readonly auditService: AuditService) {}

  // Listen to ALL events (wildcard is handled by the Queue Binding in RabbitMQ)
  // NestJS EventPattern matching acts on the client-side filtering, 
  // but if we want to catch *everything* that lands in the queue, 
  // we usually need a catch-all or specific patterns.
  // Since we bound the queue to '#' in init_rabbitmq.py, this queue receives EVERYTHING.
  // However, NestJS's RMQ Server expects us to register handlers for specific patterns.
  // There isn't a native "catch all" decorator in NestJS microservices unless we override the strategy
  // OR we just register the patterns we know exist.
  
  // For now, let's register the known high-level wildcards or common events.
  // Note: NestJS RabbitMQ 'EventPattern' usually asserts a binding. 
  // Since we did manual binding, we just need to ensure the pattern matches what arrives.
  
  // Strategy: We can't easily use a "*" wildcard in the Decorator to catch multiple different routing keys 
  // unless we use a custom strategy. 
  // BUT, since we are using `audit_log_queue`, and that queue receives `user.verify-email`, `payment.succeeded`, etc.
  // The NestJS deserializer will see `pattern: "user.verify-email"`.
  // If we don't have a handler for "user.verify-email", NestJS discards it.
  
  // WORKAROUND: We will list the top-level wildcards we care about, OR 
  // we rely on the fact that we can just list specific events.
  // Adding a few common ones as a starting point.
  
  @EventPattern('user.*')
  async handleUserEvents(@Payload() data: any, @Ctx() context: RmqContext) {
    const pattern = context.getPattern(); 
    await this.auditService.logEvent(pattern, data);
  }

  @EventPattern('payment.*')
  async handlePaymentEvents(@Payload() data: any, @Ctx() context: RmqContext) {
    const pattern = context.getPattern();
    await this.auditService.logEvent(pattern, data);
  }

  @EventPattern('system.*')
  async handleSystemEvents(@Payload() data: any, @Ctx() context: RmqContext) {
    const pattern = context.getPattern();
    await this.auditService.logEvent(pattern, data);
  }
  
  @EventPattern('program.*')
  async handleProgramEvents(@Payload() data: any, @Ctx() context: RmqContext) {
    const pattern = context.getPattern();
    await this.auditService.logEvent(pattern, data);
  }
}
