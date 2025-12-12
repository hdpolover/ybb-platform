import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { Inject, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { GetPaymentDetailQuery } from '../get-payment-detail.query';
import { IPaymentRepository } from '@core/interfaces/repositories/payment.repository.interface';
import { PaymentResponseDto } from '@modules/payments/presentation/dto/payment.dto';

@QueryHandler(GetPaymentDetailQuery)
export class GetPaymentDetailHandler implements IQueryHandler<GetPaymentDetailQuery> {
    constructor(
        @Inject('IPaymentRepository')
        private readonly paymentRepository: IPaymentRepository,
    ) { }

    async execute(query: GetPaymentDetailQuery): Promise<PaymentResponseDto> {
        const { id, userId } = query;
        const payment = await this.paymentRepository.findById(id);

        if (!payment) {
            throw new NotFoundException('Payment not found');
        }

        if (payment.userId !== userId) {
            throw new UnauthorizedException('You do not have access to this payment');
        }

        return {
            id: payment.id,
            applicationId: payment.applicationId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            paymentType: payment.paymentType,
            paymentMethod: payment.paymentMethod,
            paidAt: payment.paidAt,
            createdAt: payment.createdAt!,
        };
    }
}
