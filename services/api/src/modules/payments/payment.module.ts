import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { AuthModule } from '../auth/auth.module';
import { PaymentGrpcClient } from './infrastructure/services/payment-grpc.client';
import { PaymentController } from './infrastructure/presentation/payment.controller';

@Global()
@Module({
  imports: [
    AuthModule,
    ClientsModule.registerAsync([
      {
        name: 'PAYMENT_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => ({
          transport: Transport.GRPC,
          options: {
            package: 'payment',
            // Use __dirname to locate proto file relative to the module in both dev (src) and prod (dist)
            protoPath: join(__dirname, '../../common/proto/payment_service.proto'),
            url: configService.get('PAYMENT_GRPC_URL') || 'host.docker.internal:50053',
            loader: {
              keepCase: true,
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PaymentController],
  providers: [PaymentGrpcClient],
  exports: [PaymentGrpcClient],
})
export class PaymentModule {}
