import { ConsumerDeserializer, IncomingEvent, IncomingRequest } from '@nestjs/microservices';

/**
 * Deserializer that lets NestJS @EventPattern handlers consume messages
 * published by foreign services that don't wrap payloads in the NestJS
 * `{ pattern, data }` envelope (e.g., the Go payment service).
 *
 * NestJS expects the incoming message to contain a `pattern` field. When a
 * foreign publisher only sends the raw payload, the framework logs
 * "An unsupported event was received... Pattern: undefined" and nacks it.
 *
 * This deserializer derives the pattern from the AMQP routing key (or the
 * `eventType` field in the payload as a fallback) so events route correctly
 * to handlers like `@EventPattern('payment.succeeded')`.
 */
export class RoutingKeyDeserializer implements ConsumerDeserializer {
  deserialize(value: unknown, options?: Record<string, unknown>): IncomingRequest | IncomingEvent {
    const raw = this.parse(value);

    // Already in NestJS envelope form — pass through.
    if (raw && typeof raw === 'object' && 'pattern' in raw) {
      return raw as IncomingRequest | IncomingEvent;
    }

    const routingKey = this.extractRoutingKey(options);
    // The Go payment service emits PaymentEvent with a `type` field
    // (e.g. "payment.succeeded"). Other publishers may use eventType / event_type.
    const r = raw as { type?: string; eventType?: string; event_type?: string };
    const fromBody = r?.type ?? r?.eventType ?? r?.event_type;

    return {
      pattern: routingKey ?? fromBody ?? '',
      data: raw,
    } as IncomingEvent;
  }

  private parse(value: unknown): unknown {
    if (Buffer.isBuffer(value)) {
      try { return JSON.parse(value.toString('utf8')); }
      catch { return value.toString('utf8'); }
    }
    if (typeof value === 'string') {
      try { return JSON.parse(value); }
      catch { return value; }
    }
    return value;
  }

  private extractRoutingKey(options?: Record<string, unknown>): string | undefined {
    if (!options) return undefined;
    // @nestjs/microservices passes the AMQP fields as second arg in newer versions
    // and as nested `properties.headers` / `fields.routingKey` in raw amqplib payloads.
    const fields = (options as { fields?: { routingKey?: string } }).fields;
    if (fields?.routingKey) return fields.routingKey;
    const properties = (options as { properties?: { headers?: Record<string, unknown> } }).properties;
    const headerKey = properties?.headers?.['x-routing-key'];
    if (typeof headerKey === 'string') return headerKey;
    return undefined;
  }
}
