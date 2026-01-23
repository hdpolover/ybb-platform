import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IPaymentRepository } from '@core/interfaces/repositories/payment.repository.interface';
import { Payment } from '@core/entities/payment.entity';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
    private readonly paymentServiceUrl: string;
    private readonly logger = new Logger(PaymentRepository.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.paymentServiceUrl = this.configService.get<string>(
            'PAYMENT_SERVICE_URL',
            'http://payment-service:8080',
        );
    }

    async findByUserId(userId: string): Promise<Payment[]> {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/v1/payments`, {
                    params: { user_id: userId },
                }),
            );
            
            if (!Array.isArray(data)) {
                return [];
            }

            return data.map(this.mapToEntity);
        } catch (error) {
            this.logger.error(`Error fetching payments for user ${userId}`, error);
            // Fallback: return empty array so frontend doesn't crash
            return [];
        }
    }

    async findById(id: string): Promise<Payment | null> {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/v1/payments/${id}`),
            );
            return this.mapToEntity(data);
        } catch (error) {
            this.logger.error(`Error fetching payment ${id}`, error);
            return null;
        }
    }

    private mapToEntity(dto: any): Payment {
        // Safe access to metadata
        const metadata = dto.metadata || {};
        const applicationId = metadata.application_id || metadata.applicationId || '';
        
        // Infer dates
        const paidAt = dto.status === 'SUCCEEDED' ? new Date(dto.updated_at) : undefined;

        // Infer payment method from transactions or metadata
        // Assuming the API returns an optional 'latest_transaction' or similar in the expanded view
        const paymentMethod = dto.latest_transaction?.payment_method_code || 'N/A';
        const paymentType = dto.latest_transaction?.is_manual ? 'MANUAL' : 'AUTOMATIC';

        return new Payment(
            dto.id,
            dto.user_id,
            applicationId,
            Number(dto.amount),
            dto.currency || 'IDR',
            dto.status,
            paymentType, 
            paymentMethod,
            paidAt,
            new Date(dto.created_at),
            new Date(dto.updated_at),
        );
    }
}
