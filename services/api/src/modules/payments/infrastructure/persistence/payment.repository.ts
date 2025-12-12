import { Injectable } from '@nestjs/common';
import { IPaymentRepository } from '@core/interfaces/repositories/payment.repository.interface';
import { Payment } from '@core/entities/payment.entity';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class PaymentRepository implements IPaymentRepository {
    constructor(private readonly prisma: PrismaService) { }

    async findByUserId(userId: string): Promise<Payment[]> {
        const payments = await this.prisma.payment.findMany({
            where: { userId },
            orderBy: { createdAt: 'desc' },
        });
        return payments.map(this.mapToEntity);
    }

    async findById(id: string): Promise<Payment | null> {
        const payment = await this.prisma.payment.findUnique({
            where: { id },
        });
        return payment ? this.mapToEntity(payment) : null;
    }

    private mapToEntity(prismaPayment: any): Payment {
        return new Payment(
            prismaPayment.id,
            prismaPayment.userId,
            prismaPayment.applicationId,
            Number(prismaPayment.amount), // Convert Decimal to number
            prismaPayment.currency,
            prismaPayment.status,
            prismaPayment.paymentType,
            prismaPayment.paymentMethod ?? undefined,
            prismaPayment.paidAt ?? undefined,
            prismaPayment.createdAt,
            prismaPayment.updatedAt,
        );
    }
}
