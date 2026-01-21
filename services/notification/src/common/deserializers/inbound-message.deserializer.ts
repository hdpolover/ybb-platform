import { ConsumerDeserializer, IncomingRequest } from '@nestjs/microservices';
import { Logger } from '@nestjs/common';

export class InboundMessageDeserializer implements ConsumerDeserializer {
    private readonly logger = new Logger(InboundMessageDeserializer.name);

    deserialize(value: any, options?: Record<string, any>): IncomingRequest {
        // this.logger.log(`[Deserializer] RAW Message received`); // Commented out to reduce noise

        try {
            let parsedValue: any;
            
            // 1. Parse the JSON Content
            if (value && value.content && Buffer.isBuffer(value.content)) {
                try {
                    parsedValue = JSON.parse(value.content.toString());
                } catch (e) {
                    this.logger.error(`Error parsing JSON: ${e.message}`);
                    parsedValue = {};
                }
            } else if (Buffer.isBuffer(value)) {
                try {
                    parsedValue = JSON.parse(value.toString());
                } catch (e) {
                     parsedValue = {};
                }
            } else {
                parsedValue = value;
            }

            // 2. Check if it's already a NestJS formatted message (from another NestJS client)
            if (parsedValue && parsedValue.pattern) {
                return parsedValue;
            }

            // 3. Use Routing Key as Pattern (if available) - For Raw Pub/Sub
            if (value && value.fields && value.fields.routingKey) {
                // this.logger.log(`Using Routing Key as Pattern: ${value.fields.routingKey}`);
                return {
                    pattern: value.fields.routingKey,
                    data: parsedValue,
                    id: value.properties && value.properties.messageId ? value.properties.messageId : 'auto-id',
                };
            }

            // 4. Fallback: Check for 'type' field in the body
            if (parsedValue && parsedValue.type) {
                return {
                    pattern: parsedValue.type,
                    data: parsedValue,
                    id: parsedValue.id || 'external-event',
                };
            }

            // 5. Ultimate Fallback
            return parsedValue;
        } catch (error) {
            this.logger.error('Failed to deserialize message', error);
            return { pattern: undefined, data: undefined, id: 'error' };
        }
    }
}
