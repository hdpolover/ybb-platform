import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, timingSafeEqual } from 'crypto';
import { Request } from 'express';

@Injectable()
export class WebhookValidationService {
  private readonly logger = new Logger(WebhookValidationService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Validates a webhook request for the given gateway.
   * Returns true if valid, false if signature check fails.
   * Throws if the gateway secret is not configured (misconfiguration).
   */
  validate(gateway: string, req: Request): boolean {
    switch (gateway.toLowerCase()) {
      case 'midtrans':
        return this.validateMidtrans(req);
      case 'xendit':
        return this.validateXendit(req);
      default:
        this.logger.warn(`Unknown gateway "${gateway}" — rejecting webhook`);
        return false;
    }
  }

  /**
   * Midtrans notification signature:
   * SHA512(order_id + status_code + gross_amount + ServerKey)
   * Header: X-Signature-Key (case-insensitive lookup in NestJS)
   * Docs: https://docs.midtrans.com/docs/verifying-payment-status
   */
  private validateMidtrans(req: Request): boolean {
    const serverKey = this.configService.get<string>('MIDTRANS_SERVER_KEY', '');
    if (!serverKey) {
      this.logger.error('MIDTRANS_SERVER_KEY is not configured — webhook rejected');
      return false;
    }

    const signature = (req.headers['x-signature-key'] as string) || '';
    if (!signature) {
      this.logger.warn('Midtrans webhook missing X-Signature-Key header');
      return false;
    }

    const body = req.body as Record<string, string>;
    const orderId = body?.order_id ?? '';
    const statusCode = body?.status_code ?? '';
    const grossAmount = body?.gross_amount ?? '';

    const expected = createHash('sha512')
      .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
      .digest('hex');

    return this.timingSafeCompare(expected, signature);
  }

  /**
   * Xendit callback token validation.
   * Header: x-callback-token
   * Docs: https://developers.xendit.co/api-reference/#callback-headers
   */
  private validateXendit(req: Request): boolean {
    const webhookToken = this.configService.get<string>('XENDIT_WEBHOOK_TOKEN', '');
    if (!webhookToken) {
      this.logger.error('XENDIT_WEBHOOK_TOKEN is not configured — webhook rejected');
      return false;
    }

    const callbackToken = (req.headers['x-callback-token'] as string) || '';
    if (!callbackToken) {
      this.logger.warn('Xendit webhook missing x-callback-token header');
      return false;
    }

    return this.timingSafeCompare(webhookToken, callbackToken);
  }

  /**
   * Constant-time string comparison to prevent timing attacks.
   */
  private timingSafeCompare(a: string, b: string): boolean {
    if (a.length !== b.length) return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    return timingSafeEqual(bufA, bufB);
  }
}
