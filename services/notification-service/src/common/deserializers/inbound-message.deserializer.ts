import { ConsumerDeserializer, IncomingRequest } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

export class InboundMessageDeserializer implements ConsumerDeserializer {
    private readonly logger = new Logger(InboundMessageDeserializer.name);

    deserialize(value: any, options?: Record<string, any>): IncomingRequest {
        try {
            // 1. If it's a Buffer, convert to JSON object
            const parsedValue = Buffer.isBuffer(value)
                ? JSON.parse(value.toString())
                : value;

            // 2. Check if it's already a NestJS formatted message
            if (parsedValue && parsedValue.pattern) {
                return parsedValue;
            }

            // 3. If it's a standard event (e.g. from Go Payment Service)
            // We expect a 'type' field to map to the pattern (routing key)
            if (parsedValue && parsedValue.type) {
                this.logger.debug(`Adapting external event: ${parsedValue.type}`);
                return {
                    pattern: parsedValue.type,
                    data: parsedValue,
                    id: parsedValue.id || 'external-event',
                };
            }

            // 4. Fallback: Return as is (might fail if pattern is missing)
            return parsedValue;
        } catch (error) {
            this.logger.error('Failed to deserialize message', error);
            return { pattern: undefined, data: undefined, id: 'error' };
        }
    }
}
