import {
    Controller,
    Post,
    Param,
    Req,
    Res,
    Logger,
    HttpException,
    HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request, Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { PaymentServiceHttpClient } from '../infrastructure/services/payment-service-http.client';

// Gateways registered in services/payment's GatewayFactory (see GetName() in
// internal/infrastructure/gateways/*.go). Anything else 400s before the path
// to the internal service is even built.
const ALLOWED_GATEWAYS = ['xendit', 'midtrans', 'paypal', 'stripe', 'manual'];

// Only what the Go handlers actually read: content-type to parse the body,
// and x-callback-token which payment_handler.go pulls off for Xendit
// verification. No other gateway implementation reads a header.
const FORWARDABLE_HEADERS = ['content-type', 'x-callback-token'];

@ApiTags('Webhooks')
@Controller('webhooks/payment')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);
    private readonly paymentServiceInternalKey: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly paymentServiceClient: PaymentServiceHttpClient,
    ) {
        this.paymentServiceInternalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
        if (!this.configService.get<string>('PAYMENT_SERVICE_URL')) {
            this.logger.warn('PAYMENT_SERVICE_URL is not defined');
        }
    }

    @Post(':gateway')
    @ApiOperation({ summary: 'Handle payment gateway webhooks' })
    @ApiResponse({ status: 200, description: 'Webhook processed' })
    @ApiResponse({ status: 400, description: 'Invalid or missing webhook signature' })
    @ApiResponse({ status: 503, description: 'Payment service not configured' })
    async handleWebhook(
        @Param('gateway') gateway: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        this.logger.log(`Received webhook for gateway: ${gateway}`);

        if (!ALLOWED_GATEWAYS.includes(gateway) || /[/%.]/.test(gateway)) {
            throw new HttpException('Unsupported gateway', HttpStatus.BAD_REQUEST);
        }

        if (!this.configService.get<string>('PAYMENT_SERVICE_URL')) {
            throw new HttpException('Payment Service Not Configured', HttpStatus.SERVICE_UNAVAILABLE);
        }

        const targetPath = `/api/v1/payments/webhook/${gateway}`;

        try {
            const { data, status } = await this.paymentServiceClient.post(targetPath, req.body, {
                headers: {
                    ...this.pickForwardableHeaders(req.headers as Record<string, string | undefined>),
                    ...this.buildInternalHeaders(),
                },
            });

            this.logger.log(`Forwarded webhook to payment service path ${targetPath}, Status: ${status}`);
            return res.status(status).json(data);

        } catch (error: unknown) {
            const err = error as { message?: string; response?: { status: number; data: unknown } };
            this.logger.error(`Failed to forward webhook to ${targetPath}: ${err.message}`);
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to forward webhook',
            });
        }
    }

    private pickForwardableHeaders(headers: Record<string, string | undefined>): Record<string, string> {
        const picked: Record<string, string> = {};
        for (const name of FORWARDABLE_HEADERS) {
            const value = headers[name];
            if (value !== undefined) {
                picked[name] = value;
            }
        }
        return picked;
    }

    private buildInternalHeaders(): Record<string, string> {
        if (!this.paymentServiceInternalKey) {
            return {};
        }

        return {
            'X-Internal-Service-Key': this.paymentServiceInternalKey,
        };
    }
}
