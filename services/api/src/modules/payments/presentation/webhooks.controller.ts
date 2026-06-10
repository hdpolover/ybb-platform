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

        if (!this.configService.get<string>('PAYMENT_SERVICE_URL')) {
            throw new HttpException('Payment Service Not Configured', HttpStatus.SERVICE_UNAVAILABLE);
        }

        const targetPath = `/api/v1/payments/webhook/${gateway}`;
        
        try {
            const { data, status } = await this.paymentServiceClient.post(targetPath, req.body, {
                headers: {
                    ...(req.headers as Record<string, string | undefined>),
                    ...this.buildInternalHeaders(),
                    host: undefined,
                    'content-length': undefined,
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

    private buildInternalHeaders(): Record<string, string> {
        if (!this.paymentServiceInternalKey) {
            return {};
        }

        return {
            'X-Internal-Service-Key': this.paymentServiceInternalKey,
        };
    }
}
