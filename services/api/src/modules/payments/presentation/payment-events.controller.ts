import { Controller, Logger } from '@nestjs/common';
import { EventPattern, Payload } from '@nestjs/microservices';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';

@Controller()
export class PaymentEventsController {
    private readonly logger = new Logger(PaymentEventsController.name);

    constructor(private readonly metricsService: MetricsService) {}

    @EventPattern('payment.succeeded')
    async handlePaymentSucceeded(@Payload() data: any) {
        const start = Date.now();
        try {
            // Log basic info for debugging
            this.logger.debug(`Metrics: payment.succeeded event received`);
            
            const currency = data.currency || 'IDR';
            const method = data.payment_method || data.method || 'unknown'; 
            const amount = Number(data.amount) || 0;

            // Counter
            this.metricsService.paymentTotal.inc({
                currency,
                method,
                status: 'success'
            });

            // Histogram
            this.metricsService.paymentAmount.observe({
                currency,
                method,
                status: 'success'
            }, amount);
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.succeeded', 
                status: 'success' 
            }, duration);
        }
    }

    @EventPattern('payment.failed')
    async handlePaymentFailed(@Payload() data: any) {
        const start = Date.now();
        try {
            this.logger.debug(`Metrics: payment.failed event received`);
            
            const currency = data.currency || 'IDR';
            const method = data.payment_method || data.method || 'unknown';

            this.metricsService.paymentTotal.inc({
                currency,
                method,
                status: 'failed'
            });
        } finally {
            const duration = (Date.now() - start) / 1000;
            this.metricsService.jobProcessingDuration.observe({ 
                queue_name: 'payment.failed', 
                status: 'success' 
            }, duration);
        }
    }
}
