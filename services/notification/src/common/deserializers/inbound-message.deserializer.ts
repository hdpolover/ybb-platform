import { ConsumerDeserializer, IncomingRequest } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

export class InboundMessageDeserializer implements ConsumerDeserializer {
    private readonly logger = new Logger(InboundMessageDeserializer.name);

    deserialize(value: any, options?: Record<string, any>): IncomingRequest {
        try {
            let parsedValue: any;

            // 1. Handle RMQ Message Object (value.content is Buffer)
            if (value && value.content && Buffer.isBuffer(value.content)) {
                parsedValue = JSON.parse(value.content.toString());
            }
            // 2. Handle direct Buffer (unlikely for RMQ but good fallback)
            else if (Buffer.isBuffer(value)) {
                parsedValue = JSON.parse(value.toString());
            }
            // 3. Handle object/string
            else {
                parsedValue = value;
            }

            // 4. Check if it's already a NestJS formatted message
            if (parsedValue && parsedValue.pattern) {
                return parsedValue;
            }

            // 5. If it's a standard event (e.g. from Go Payment Service)
            // We expect a 'type' field to map to the pattern (routing key)
            if (parsedValue && parsedValue.type) {
                this.logger.debug(`Adapting external event: ${parsedValue.type}`);
                return {
                    pattern: parsedValue.type,
                    data: parsedValue,
                    id: parsedValue.id || 'external-event',
                };
            }

            // 6. Fallback
            return parsedValue;
        } catch (error) {
            this.logger.error('Failed to deserialize message', error);
            // Return a safe object to prevent crashing
            return { pattern: undefined, data: undefined, id: 'error' };
        }
    }
}
