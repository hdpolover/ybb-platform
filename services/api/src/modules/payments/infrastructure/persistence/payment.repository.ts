import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { IPaymentRepository } from '@core/interfaces/repositories/payment.repository.interface';
import { Payment } from '@core/entities/payment.entity';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
    private readonly paymentServiceUrl: string;
    private readonly paymentServiceInternalKey: string;
    private readonly logger = new Logger(PaymentRepository.name);

    constructor(
        private readonly httpService: HttpService,
        private readonly configService: ConfigService,
    ) {
        this.paymentServiceUrl = this.configService.get<string>(
            'PAYMENT_SERVICE_URL',
            'http://payment-service:8080',
        );
        this.paymentServiceInternalKey = this.configService.get<string>(
            'PAYMENT_SERVICE_INTERNAL_KEY',
            '',
        );
    }

    async findByUserId(userId: string): Promise<Payment[]> {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/api/v1/payments/user/${userId}`, {
                    headers: this.buildInternalHeaders(),
                }),
            );

            const payments = Array.isArray(data?.payments) ? data.payments : [];
            if (payments.length === 0) {
                return [];
            }

            return payments.map((paymentDto: any) => this.mapToEntity(paymentDto));
        } catch (error) {
            this.logger.error(`Error fetching payments for user ${userId}`, error);
            // Fallback: return empty array so frontend doesn't crash
            return [];
        }
    }

    async findById(id: string): Promise<Payment | null> {
        try {
            const { data } = await firstValueFrom(
                this.httpService.get(`${this.paymentServiceUrl}/api/v1/payments/${id}`, {
                    headers: this.buildInternalHeaders(),
                }),
            );
            return this.mapToEntity(data);
        } catch (error) {
            this.logger.error(`Error fetching payment ${id}`, error);
            return null;
        }
    }

    private mapToEntity(dto: any): Payment {
        const metadata = this.parseMetadata(dto.metadata);
        const transactions = Array.isArray(dto.transactions) ? dto.transactions : [];
        const latestTransaction = transactions.length > 0 ? transactions[transactions.length - 1] : undefined;
        const applicationId = dto.reference_id || metadata.application_id || metadata.applicationId || '';
        const paidAt = dto.status === 'SUCCEEDED' ? new Date(dto.updated_at) : undefined;
        const paymentMethod = latestTransaction?.payment_method_id || 'N/A';
        const paymentType = this.inferPaymentType(latestTransaction);

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

    private parseMetadata(metadata: unknown): Record<string, any> {
        if (!metadata) {
            return {};
        }

        if (typeof metadata === 'string') {
            try {
                return JSON.parse(metadata);
            } catch {
                return {};
            }
        }

        if (typeof metadata === 'object') {
            return metadata as Record<string, any>;
        }

        return {};
    }

    private inferPaymentType(latestTransaction?: any): string {
        if (!latestTransaction) {
            return 'AUTOMATIC';
        }

        const methodId = String(latestTransaction.payment_method_id || '').toLowerCase();
        const status = String(latestTransaction.status || '').toUpperCase();
        const hasProof = Boolean(latestTransaction.proof_file_url);

        if (
            hasProof ||
            status === 'NEEDS_REVIEW' ||
            status === 'REJECTED' ||
            methodId.includes('manual') ||
            methodId.includes('transfer')
        ) {
            return 'MANUAL';
        }

        return 'AUTOMATIC';
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
