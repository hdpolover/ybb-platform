import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
import { AuthModule } from '../auth/auth.module';
import { PaymentGrpcClient } from './infrastructure/services/payment-grpc.client';
import { PaymentController } from './infrastructure/presentation/payment.controller';
import { PaymentAdminController } from './infrastructure/presentation/payment-admin.controller';

@Global()
@Module({
  imports: [
    AuthModule,
    ClientsModule.registerAsync([
      {
        name: 'PAYMENT_PACKAGE',
        imports: [ConfigModule],
        useFactory: (configService: ConfigService) => {
          // Resolve proto path dynamically to support both:
          // 1. Production/Docker with 'src' nested in 'dist' (dist/src/common/proto) -> ../../common/proto
          // 2. Local Dev with asset copy at root of 'dist' (dist/common/proto) -> ../../../common/proto
          const protoPathStats = [
             join(__dirname, '../../common/proto/payment_service.proto'),    // Standard Structure / Prod Fix
             join(__dirname, '../../../common/proto/payment_service.proto'),  // Nested Src Structure (Dev)
             join(process.cwd(), 'src/common/proto/payment_service.proto'),   // Direct Source (ts-node)
          ];

          const protoPath = protoPathStats.find(path => existsSync(path)) || protoPathStats[0];

          return {
            transport: Transport.GRPC,
            options: {
              package: 'payment',
              protoPath: protoPath,
              url: configService.get('PAYMENT_GRPC_URL') || 'host.docker.internal:50053',
              loader: {
                keepCase: true,
              },
            },
          };
        },
        inject: [ConfigService],
      },
    ]),
  ],
  controllers: [PaymentController, PaymentAdminController],
  providers: [PaymentGrpcClient],
  exports: [PaymentGrpcClient],
})
export class PaymentModule {}
