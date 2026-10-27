// src/modules/programs/presentation/__tests__/resend-webhook.controller.spec.ts
import { createHmac } from 'crypto';
import { BadRequestException, ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { ResendWebhookController } from '../resend-webhook.controller';

const SECRET_BYTES = Buffer.from('resend-webhook-secret-bytes-0001');
const SECRET = `whsec_${SECRET_BYTES.toString('base64')}`;

function buildRequest(payload: unknown, opts: { secret?: Buffer; ageSeconds?: number; omitHeaders?: boolean } = {}) {
  const raw = Buffer.from(JSON.stringify(payload));
  const ts = String(Math.floor(Date.now() / 1000) - (opts.ageSeconds ?? 0));
  const sig = createHmac('sha256', opts.secret ?? SECRET_BYTES)
    .update(`msg_1.${ts}.${raw.toString('utf8')}`)
    .digest('base64');
  return {
    rawBody: raw,
    headers: opts.omitHeaders ? {} : { 'svix-id': 'msg_1', 'svix-timestamp': ts, 'svix-signature': `v1,${sig}` },
  } as never;
}

const event = (type: string, data: Record<string, unknown> = {}) => ({
  type,
  created_at: '2026-10-27T10:00:00.000Z',
  data: { email_id: 'em_1', ...data },
});

describe('ResendWebhookController', () => {
  let repo: { applyDeliveryEvent: jest.Mock };
  const build = (secret: string | undefined = SECRET) => {
    repo = { applyDeliveryEvent: jest.fn().mockResolvedValue(1) };
    return new ResendWebhookController({ get: () => secret } as never, repo as never);
  };

  it('fails closed with 503 when RESEND_WEBHOOK_SECRET is unset', async () => {
    const controller = build('');
    await expect(controller.handle(buildRequest(event('email.delivered')))).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(repo.applyDeliveryEvent).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature with 401 and writes nothing', async () => {
    const controller = build();
    const req = buildRequest(event('email.delivered'), { secret: Buffer.from('wrong-key') });
    await expect(controller.handle(req)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(repo.applyDeliveryEvent).not.toHaveBeenCalled();
  });

  it('rejects a stale timestamp with 401', async () => {
    const controller = build();
    await expect(controller.handle(buildRequest(event('email.delivered'), { ageSeconds: 600 }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('rejects missing svix headers with 401', async () => {
    const controller = build();
    await expect(controller.handle(buildRequest(event('email.delivered'), { omitHeaders: true }))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('400s when the raw body was not captured', async () => {
    const controller = build();
    await expect(controller.handle({ headers: {} } as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each([
    ['email.delivered', 'delivered'],
    ['email.bounced', 'bounced'],
    ['email.complained', 'complained'],
    ['email.delivery_delayed', 'delayed'],
  ])('maps %s to status %s keyed on data.email_id', async (type, status) => {
    const controller = build();
    await expect(controller.handle(buildRequest(event(type)))).resolves.toEqual({ received: true });
    expect(repo.applyDeliveryEvent).toHaveBeenCalledWith({
      emailId: 'em_1',
      status,
      occurredAt: new Date('2026-10-27T10:00:00.000Z'),
      bounceType: null,
    });
  });

  it('records bounce type and subtype', async () => {
    const controller = build();
    const req = buildRequest(event('email.bounced', { bounce: { type: 'Permanent', subType: 'General' } }));
    await controller.handle(req);
    expect(repo.applyDeliveryEvent).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'bounced', bounceType: 'Permanent/General' }),
    );
  });

  it('returns 200 and ignores event types it does not track', async () => {
    const controller = build();
    await expect(controller.handle(buildRequest(event('email.opened')))).resolves.toEqual({ received: true });
    expect(repo.applyDeliveryEvent).not.toHaveBeenCalled();
  });

  it('returns 200 when the email id matches no LOA row (other email types share the account)', async () => {
    const controller = build();
    repo.applyDeliveryEvent.mockResolvedValue(0);
    await expect(controller.handle(buildRequest(event('email.delivered')))).resolves.toEqual({ received: true });
  });
});
