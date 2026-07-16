import { InboundMessageDeserializer } from './inbound-message.deserializer';

describe('InboundMessageDeserializer', () => {
  let deserializer: InboundMessageDeserializer;

  beforeEach(() => {
    deserializer = new InboundMessageDeserializer();
  });

  it('should pass through NestJS formatted messages', () => {
    const msg = { pattern: 'test', data: { foo: 'bar' }, id: '1' };
    const result = deserializer.deserialize(msg);
    expect(result).toEqual(msg);
  });

  it('should transform standard JSON with "type" field (Go Style)', () => {
    const msg = {
      type: 'payment.succeeded',
      amount: 1000,
      currency: 'IDR',
      id: 'evt_123',
    };

    const result = deserializer.deserialize(msg);

    expect(result.pattern).toBe('payment.succeeded');
    expect(result.data).toEqual(msg);
    expect(result.id).toBe('evt_123');
  });

  it('should parse Buffer messages content', () => {
    const msg = { type: 'user.registered', email: 'test@ybb.com' };
    const buffer = Buffer.from(JSON.stringify(msg));

    const result = deserializer.deserialize(buffer);

    expect(result.pattern).toBe('user.registered');
    expect(result.data).toEqual(expect.objectContaining(msg));
  });

  it('should provide default ID if missing', () => {
    const msg = { type: 'simple.event' }; // No ID

    const result = deserializer.deserialize(msg);

    expect(result.id).toBe('external-event');
  });
});
