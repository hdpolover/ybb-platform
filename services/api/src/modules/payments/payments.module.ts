import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentsController } from './presentation/payments.controller';
import { PaymentRepository } from './infrastructure/persistence/payment.repository';
import { ListUserPaymentsHandler } from './application/queries/handlers/list-user-payments.handler';
import { GetPaymentDetailHandler } from './application/queries/handlers/get-payment-detail.handler';

@Module({
    imports: [CqrsModule, AuthModule],
    controllers: [PaymentsController],
    providers: [
        PrismaService,
        {
            provide: 'IPaymentRepository',
            useClass: PaymentRepository,
        },
        PaymentRepository,
        ListUserPaymentsHandler,
        GetPaymentDetailHandler,
    ],
    exports: ['IPaymentRepository'],
})
export class PaymentsModule { }
