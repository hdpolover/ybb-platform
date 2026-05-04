import { Module, Global } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { join } from 'path';
import { existsSync } from 'fs';
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

          const explicitGrpcUrl = configService.get<string>('PAYMENT_GRPC_URL')?.trim();
          const paymentServiceUrl = configService.get<string>('PAYMENT_SERVICE_URL')?.trim();
          let inferredGrpcUrl: string | undefined;

          if (paymentServiceUrl) {
            try {
              const normalized = paymentServiceUrl.includes('://')
                ? paymentServiceUrl
                : `http://${paymentServiceUrl}`;
              const parsed = new URL(normalized);
              if (parsed.hostname) {
                inferredGrpcUrl = `${parsed.hostname}:50053`;
              }
            } catch {
              inferredGrpcUrl = undefined;
            }
          }

          return {
            transport: Transport.GRPC,
            options: {
              package: 'payment',
              protoPath: protoPath,
              url: explicitGrpcUrl || inferredGrpcUrl || 'payment-service:50053',
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
  controllers: [PaymentController],
  providers: [PaymentGrpcClient],
  exports: [PaymentGrpcClient],
})
export class PaymentModule {}
