import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CqrsModule } from '@nestjs/cqrs';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { join } from 'path';
import { PaymentsController } from '../src/modules/payments/presentation/payments.controller';
import { CreateIntentHandler } from '../src/modules/payments/application/commands/handlers/create-intent.handler';
import { ProcessPaymentHandler } from '../src/modules/payments/application/commands/handlers/process-payment.handler';
import { PaymentGrpcClient } from '../src/modules/payments/infrastructure/services/payment-grpc.client';
import { JwtAuthGuard } from '../src/modules/auth/infrastructure/guards/jwt-auth.guard';
import { PaymentRepository } from '../src/modules/payments/infrastructure/persistence/payment.repository';

// Mock Repository to avoid DB connection
const mockPaymentRepository = {
  findMany: jest.fn(),
  findOne: jest.fn(),
};

describe('Payment Integration (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
            isGlobal: true,
            envFilePath: '.env.test', // Or just rely on defaults/mock
        }),
        CqrsModule,
        // We define the client manually here to ensure it uses the test config (localhost)
        ClientsModule.register([
            {
                name: 'PAYMENT_PACKAGE',
                transport: Transport.GRPC,
                options: {
                    package: 'payment',
                    protoPath: join(__dirname, '../src/modules/payments/common/proto/payment_service.proto'),
                    // Assuming Payment Service is running on localhost:50053 accessible from test runner
                    url: 'localhost:50053', 
                    loader: { keepCase: true },
                },
            },
        ]),
      ],
      controllers: [PaymentsController],
      providers: [
        CreateIntentHandler,
        ProcessPaymentHandler,
        PaymentGrpcClient,
        {
          provide: 'IPaymentRepository',
          useValue: mockPaymentRepository,
        },
        // Mock Command/Query Bus if needed? No, CqrsModule provides them.
        // We need QueryBus handlers if we accidentally trigger them, but we won't.
        {
            provide: PaymentRepository,
            useValue: mockPaymentRepository,
        }
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true }));
    
    // Mock user decorator
    app.use((req, res, next) => {
        req.user = { id: 'test-user-id' };
        next();
    });

    await app.init();
  }, 30000); // 30s timeout for gRPC connection

  afterAll(async () => {
    await app.close();
  });

  describe('POST /payments/intents', () => {
    it('should create a payment intent via gRPC', () => {
      const createDto = {
        amount: 150000,
        currency: 'IDR',
        reference_type: 'application',
        reference_id: 'app_12345',
        metadata: {
            test_run: 'true'
        }
      };

      return request(app.getHttpServer())
        .post('/payments/intents')
        .send(createDto)
        .expect(201)
        .expect((res) => {
            // We expect the gRPC service to return something like { intent_id: '...', client_secret: '...' }
            // If the Payment Service is NOT running, this will fail with 500
            console.log('Create Intent Response:', res.body);
            expect(res.body).toHaveProperty('intent_id');
        });
    });
  });

  describe('POST /payments/intents/:id/confirm', () => {
    it('should confirm a payment (charge) via gRPC', () => {
      const confirmDto = {
        payment_method_id: 'bca_va',
        payment_details: {
            customer_name: 'Test Tech',
        }
      };
        
      // We use a dummy ID here. If the Payment Service checks DB, this might fail with 404/Error
      // But we are testing "communication" logic.
      const intentId = 'test-intent-id';

      return request(app.getHttpServer())
        .post(`/payments/intents/${intentId}/confirm`)
        .send(confirmDto)
        .expect(201) // or 200 depending on implementation
        .expect((res) => {
            console.log('Confirm/Process Response:', res.body);
             // Expect transaction_id or status
        });
    });
  });
});
