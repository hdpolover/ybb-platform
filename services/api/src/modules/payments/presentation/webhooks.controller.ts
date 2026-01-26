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
import { HttpService } from '@nestjs/axios';
import { Request, Response } from 'express';
import { firstValueFrom } from 'rxjs';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('Webhooks')
@Controller('webhooks/payment')
export class WebhooksController {
    private readonly logger = new Logger(WebhooksController.name);
    private readonly paymentServiceUrl: string;

    constructor(
        private readonly configService: ConfigService,
        private readonly httpService: HttpService,
    ) {
        this.paymentServiceUrl = this.configService.get<string>('PAYMENT_SERVICE_URL') || '';
        if (!this.paymentServiceUrl) {
            this.logger.warn('PAYMENT_SERVICE_URL is not defined');
        }
    }

    @Post(':gateway')
    @ApiOperation({ summary: 'Handle payment gateway webhooks' })
    @ApiResponse({ status: 200, description: 'Webhook processed' })
    async handleWebhook(
        @Param('gateway') gateway: string,
        @Req() req: Request,
        @Res() res: Response,
    ) {
        this.logger.log(`Received webhook for gateway: ${gateway}`);

        if (!this.paymentServiceUrl) {
            throw new HttpException('Payment Service Not Configured', HttpStatus.SERVICE_UNAVAILABLE);
        }

        const targetUrl = `${this.paymentServiceUrl}/api/v1/payments/webhook/${gateway}`;
        
        try {
            // Forward the request to Payment Service
            // We pass data and headers (excluding host/connection specific ones ideally)
            const { data, status, headers } = await firstValueFrom(
                this.httpService.post(targetUrl, req.body, {
                    headers: {
                        ...req.headers,
                        // Override host to avoid confusion if necessary, 
                        // but usually axios handles Host header.
                        // Important: Forward auth or signature headers
                        host: undefined, 
                        'content-length': undefined,
                    } as any,
                })
            );

            this.logger.log(`Forwarded webhook to ${targetUrl}, Status: ${status}`);
            return res.status(status).json(data);

        } catch (error: any) {
            this.logger.error(`Failed to forward webhook to ${targetUrl}`, error.message);
            
            if (error.response) {
                return res.status(error.response.status).json(error.response.data);
            }
            
            return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
                error: 'Failed to forward webhook',
                details: error.message,
            });
        }
    }
}
