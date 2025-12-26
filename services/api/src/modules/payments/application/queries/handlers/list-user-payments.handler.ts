import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject } from '@nestjs/common';
import { ListUserPaymentsQuery } from '../list-user-payments.query';
import { IPaymentRepository } from '@core/interfaces/repositories/payment.repository.interface';
import { PaymentResponseDto } from '@modules/payments/presentation/dto/payment.dto';

@QueryHandler(ListUserPaymentsQuery)
export class ListUserPaymentsHandler implements IQueryHandler<ListUserPaymentsQuery> {
    constructor(
        @Inject('IPaymentRepository')
        private readonly paymentRepository: IPaymentRepository,
    ) { }

    async execute(query: ListUserPaymentsQuery): Promise<PaymentResponseDto[]> {
        const { userId } = query;
        const payments = await this.paymentRepository.findByUserId(userId);

        return payments.map(payment => ({
            id: payment.id,
            applicationId: payment.applicationId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            paymentType: payment.paymentType,
            paymentMethod: payment.paymentMethod,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt!,
        }));
    }
}
