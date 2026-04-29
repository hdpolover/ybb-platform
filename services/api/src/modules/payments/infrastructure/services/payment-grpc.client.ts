import { Injectable, Inject, OnModuleInit, Logger } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Metadata } from '@grpc/grpc-js';
import { lastValueFrom } from 'rxjs';
import {
  PaymentService,
  GetIntentsByReferenceRequest,
  GetIntentsByReferenceResponse,
  CreateIntentRequest,
  CreateIntentResponse,
  GetPaymentMethodsRequest,
  GetPaymentMethodsResponse,
  ProcessPaymentRequest,
  ProcessPaymentResponse,
  SubmitManualPaymentRequest,
  SubmitManualPaymentResponse,
  VerifyManualPaymentRequest,
  VerifyManualPaymentResponse,
  AdminCreatePaymentMethodRequest,
  AdminUpdatePaymentMethodRequest,
  AdminDeletePaymentMethodRequest,
  AdminGetPaymentMethodRequest,
  AdminListPaymentMethodsRequest,
  AdminListPaymentsRequest
} from '../../common/proto/payment.interface';

@Injectable()
export class PaymentGrpcClient implements OnModuleInit {
  private paymentService: PaymentService;
  private readonly logger = new Logger(PaymentGrpcClient.name);
  private readonly internalKey: string;

  constructor(
    @Inject('PAYMENT_PACKAGE') private client: ClientGrpc,
    private readonly configService: ConfigService,
  ) {
    this.internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
  }

  onModuleInit() {
    this.paymentService = this.client.getService<PaymentService>('PaymentService');
  }

  // Required by the Go service's InternalServiceKeyInterceptor — the gRPC server
  // rejects every call without this metadata header.
  private metadata(): Metadata {
    const md = new Metadata();
    if (this.internalKey) md.add('x-internal-service-key', this.internalKey);
    return md;
  }

  async getIntentsByReference(req: GetIntentsByReferenceRequest): Promise<GetIntentsByReferenceResponse> {
    try {
      return await lastValueFrom(this.paymentService.GetIntentsByReference(req, this.metadata()));
    } catch (error) {
      this.logger.error(`Failed to get intents by reference: ${error.message}`, error.stack);
      // Fallback: return empty list instead of crashing, or rethrow?
      // Rethrow is safer for critical checks
      throw error; 
    }
  }

  async submitManualPayment(req: SubmitManualPaymentRequest): Promise<SubmitManualPaymentResponse> {
    try {
        return await lastValueFrom(this.paymentService.SubmitManualPayment(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to submit manual payment: ${error.message}`, error.stack);
        throw error;
    }
  }

  async verifyManualPayment(req: VerifyManualPaymentRequest): Promise<VerifyManualPaymentResponse> {
      try {
          return await lastValueFrom(this.paymentService.VerifyManualPayment(req, this.metadata()));
      } catch (error) {
          this.logger.error(`Failed to verify manual payment: ${error.message}`, error.stack);
          throw error;
      }
  }

  async createIntent(req: CreateIntentRequest): Promise<CreateIntentResponse> {
      try {
          return await lastValueFrom(this.paymentService.CreateIntent(req, this.metadata()));
      } catch (error) {
          this.logger.error(`Failed to create intent: ${error.message}`, error.stack);
          throw error;
      }
  }

  async getPaymentMethods(req: GetPaymentMethodsRequest): Promise<GetPaymentMethodsResponse> {
    try {
        return await lastValueFrom(this.paymentService.GetPaymentMethods(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to get payment methods: ${error.message}`, error.stack);
        throw error;
    }
  }

  async processPayment(req: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
      try {
          const resp = await lastValueFrom(this.paymentService.ProcessPayment(req, this.metadata()));
          this.logger.log(`ProcessPayment response: ${JSON.stringify(resp)}`);
          return resp;
      } catch (error) {
          this.logger.error(`Failed to process payment: ${error.message}`, error.stack);
          throw error;
      }
  }

  // Admin Methods
  async adminCreatePaymentMethod(req: AdminCreatePaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminCreatePaymentMethod(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to create payment method: ${error.message}`, error.stack);
        throw error;
    }
  }

  async adminUpdatePaymentMethod(req: AdminUpdatePaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminUpdatePaymentMethod(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to update payment method: ${error.message}`, error.stack);
        throw error;
    }
  }

  async adminDeletePaymentMethod(req: AdminDeletePaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminDeletePaymentMethod(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to delete payment method: ${error.message}`, error.stack);
        throw error;
    }
  }

  async adminGetPaymentMethod(req: AdminGetPaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminGetPaymentMethod(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to get payment method: ${error.message}`, error.stack);
        throw error;
    }
  }

  async adminListPaymentMethods(req: AdminListPaymentMethodsRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminListPaymentMethods(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to list payment methods: ${error.message}`, error.stack);
        throw error;
    }
  }

  async adminListPayments(req: AdminListPaymentsRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminListPayments(req, this.metadata()));
    } catch (error) {
        this.logger.error(`Failed to list payments: ${error.message}`, error.stack);
        throw error;
    }
  }
}
