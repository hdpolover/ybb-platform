// src/modules/programs/presentation/resend-webhook.controller.ts
import {
  BadRequestException,
  Controller,
  HttpCode,
  Logger,
  Post,
  RawBodyRequest,
  Req,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Request } from 'express';
import { Public } from '../../../shared/decorators/public.decorator';
import { verifySvixSignature } from '../../../shared/utils/svix-signature';
import {
  LOA_DELIVERY_STATUS,
  LoaBatchRecipientSendRepository,
  LoaDeliveryStatus,
} from '../infrastructure/persistence/loa-batch-recipient-send.repository';

const EVENT_STATUS: Record<string, LoaDeliveryStatus> = {
  'email.delivered': LOA_DELIVERY_STATUS.DELIVERED,
  'email.bounced': LOA_DELIVERY_STATUS.BOUNCED,
  'email.complained': LOA_DELIVERY_STATUS.COMPLAINED,
  'email.delivery_delayed': LOA_DELIVERY_STATUS.DELAYED,
};

interface ResendEvent {
  type?: unknown;
  created_at?: unknown;
  data?: { email_id?: unknown; created_at?: unknown; bounce?: { type?: unknown; subType?: unknown } };
}

const header = (req: Request, name: string): string | undefined => {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
};

/**
 * Resend (Svix) delivery webhooks. Authenticated only by the signature, so no
 * JWT guard; throttling is skipped because Svix retries any non-2xx and a
 * release of ~1k letters produces a burst of events from one source.
 */
@ApiTags('Webhooks')
@Controller('webhooks/resend')
@Public()
@SkipThrottle({ short: true, medium: true, long: true, default: true })
export class ResendWebhookController {
  private readonly logger = new Logger(ResendWebhookController.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly recipientSendRepo: LoaBatchRecipientSendRepository,
  ) {}

  @Post()
  @HttpCode(200)
  @ApiOperation({ summary: 'Resend delivery/bounce webhook for LOA emails' })
  async handle(@Req() req: RawBodyRequest<Request>): Promise<{ received: true }> {
    const secret = this.configService.get<string>('RESEND_WEBHOOK_SECRET');
    if (!secret) {
      this.logger.error('RESEND_WEBHOOK_SECRET is not set; refusing Resend webhook (fail closed)');
      throw new ServiceUnavailableException('Webhook not configured');
    }
    if (!req.rawBody) {
      throw new BadRequestException('Missing request body');
    }

    const valid = verifySvixSignature({
      secret,
      id: header(req, 'svix-id'),
      timestamp: header(req, 'svix-timestamp'),
      signature: header(req, 'svix-signature'),
      rawBody: req.rawBody,
    });
    if (!valid) {
      this.logger.warn('Rejected Resend webhook with invalid or stale signature');
      throw new UnauthorizedException('Invalid signature');
    }

    let event: ResendEvent;
    try {
      event = JSON.parse(req.rawBody.toString('utf8')) as ResendEvent;
    } catch {
      throw new BadRequestException('Malformed JSON');
    }

    const status = typeof event.type === 'string' ? EVENT_STATUS[event.type] : undefined;
    const emailId = event.data?.email_id;
    // Other email types share the Resend account; anything we don't track is a 200.
    if (!status || typeof emailId !== 'string') return { received: true };

    const bounce = event.data?.bounce;
    const bounceType =
      status === LOA_DELIVERY_STATUS.BOUNCED && typeof bounce?.type === 'string'
        ? [bounce.type, bounce.subType].filter((part) => typeof part === 'string' && part).join('/')
        : null;

    const matched = await this.recipientSendRepo.applyDeliveryEvent({
      emailId,
      status,
      occurredAt: this.eventTime(event),
      bounceType,
    });
    this.logger.log(`Resend ${event.type as string} email=${emailId} matched=${matched}`);
    return { received: true };
  }

  private eventTime(event: ResendEvent): Date {
    for (const raw of [event.created_at, event.data?.created_at]) {
      const parsed = typeof raw === 'string' ? new Date(raw) : null;
      if (parsed && !Number.isNaN(parsed.getTime())) return parsed;
    }
    return new Date();
  }
}
