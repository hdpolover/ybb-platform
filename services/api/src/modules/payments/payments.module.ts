import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { FilesModule } from '../files/files.module';
import { MonitoringModule } from '@shared/infrastructure/monitoring/monitoring.module';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { PaymentsController } from './presentation/payments.controller';
import { PaymentAdminController } from './presentation/payment-admin.controller';
import { PaymentEventsController } from './presentation/payment-events.controller';
import { WebhooksController } from './presentation/webhooks.controller';
import { PaymentRepository } from './infrastructure/persistence/payment.repository';
import { ListUserPaymentsHandler } from './application/queries/handlers/list-user-payments.handler';
import { GetPaymentDetailHandler } from './application/queries/handlers/get-payment-detail.handler';
import { CreateIntentHandler } from './application/commands/handlers/create-intent.handler';
import { ProcessPaymentHandler } from './application/commands/handlers/process-payment.handler';

@Module({
    imports: [
        CqrsModule,
        AuthModule,
        FilesModule,
        MonitoringModule,
        HttpModule,
        ConfigModule,
    ],
    controllers: [PaymentsController, PaymentAdminController, PaymentEventsController, WebhooksController],
    providers: [
        {
            provide: 'IPaymentRepository',
            useClass: PaymentRepository,
        },
        PaymentRepository,
        ListUserPaymentsHandler,
        GetPaymentDetailHandler,
        CreateIntentHandler,
        ProcessPaymentHandler,
    ],
    exports: ['IPaymentRepository'],
})
export class PaymentsModule { }
