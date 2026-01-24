import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';
import { 
  PaymentService, 
  GetIntentsByReferenceRequest, 
  GetIntentsByReferenceResponse 
} from '../../common/proto/payment.interface';

@Injectable()
export class PaymentGrpcClient implements OnModuleInit {
  private paymentService: PaymentService;
  private readonly logger = new Logger(PaymentGrpcClient.name);

  constructor(@Inject('PAYMENT_PACKAGE') private client: ClientGrpc) {}

  onModuleInit() {
    this.paymentService = this.client.getService<PaymentService>('PaymentService');
  }

  async getIntentsByReference(req: GetIntentsByReferenceRequest): Promise<GetIntentsByReferenceResponse> {
    try {
      return await lastValueFrom(this.paymentService.GetIntentsByReference(req));
    } catch (error) {
      this.logger.error(`Failed to get intents by reference: ${error.message}`, error.stack);
      // Fallback: return empty list instead of crashing, or rethrow?
      // Rethrow is safer for critical checks
      throw error; 
    }
  }

  async submitManualPayment(req: any): Promise<any> {
    try {
        return await lastValueFrom(this.paymentService.SubmitManualPayment(req));
    } catch (error) {
        this.logger.error(`Failed to submit manual payment: ${error.message}`, error.stack);
        throw error;
    }
  }

  async verifyManualPayment(req: any): Promise<any> {
      try {
          return await lastValueFrom(this.paymentService.VerifyManualPayment(req));
      } catch (error) {
          this.logger.error(`Failed to verify manual payment: ${error.message}`, error.stack);
          throw error;
      }
  }

  async createIntent(req: any): Promise<any> {
      try {
          return await lastValueFrom(this.paymentService.CreateIntent(req));
      } catch (error) {
          this.logger.error(`Failed to create intent: ${error.message}`, error.stack);
          throw error;
      }
  }

  async getPaymentMethods(req: any): Promise<any> {
    try {
        return await lastValueFrom(this.paymentService.GetPaymentMethods(req));
    } catch (error) {
        this.logger.error(`Failed to get payment methods: ${error.message}`, error.stack);
        throw error;
    }
  }

  async processPayment(req: any): Promise<any> {
      try {
          return await lastValueFrom(this.paymentService.ProcessPayment(req));
      } catch (error) {
          this.logger.error(`Failed to process payment: ${error.message}`, error.stack);
          throw error;
      }
  }
}
