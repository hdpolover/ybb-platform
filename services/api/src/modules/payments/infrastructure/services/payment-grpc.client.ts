import { Injectable, Inject, OnModuleInit, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { ClientGrpc } from '@nestjs/microservices';
import { ConfigService } from '@nestjs/config';
import { Metadata, status as GrpcStatus } from '@grpc/grpc-js';
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

  // Bounds every unary call so a hung/unreachable Go payment service surfaces as
  // DEADLINE_EXCEEDED (mapped to 504 below) instead of hanging the request forever.
  private deadline(): { deadline: Date } {
    return { deadline: new Date(Date.now() + 15000) };
  }

  // Maps gRPC errors from the Go payment service to NestJS HttpException so the
  // controller surfaces a meaningful HTTP status and message instead of a generic
  // 500 "Internal server error" that hides the actual failure (e.g. invalid
  // payment method, gateway not configured, idempotency conflict).
  private rethrowAsHttp(error: unknown, action: string): never {
    const grpcError = error as { code?: number; details?: string; message?: string; stack?: string };
    const detail = grpcError.details || grpcError.message || `Payment service ${action} failed`;
    this.logger.error(`Failed to ${action}: ${detail}`, grpcError.stack);

    const httpStatus = mapGrpcCodeToHttpStatus(grpcError.code);
    throw new HttpException({ message: detail, action, grpcCode: grpcError.code }, httpStatus);
  }

  async getIntentsByReference(req: GetIntentsByReferenceRequest): Promise<GetIntentsByReferenceResponse> {
    try {
      return await lastValueFrom(this.paymentService.GetIntentsByReference(req, this.metadata(), this.deadline()));
    } catch (error) {
      this.rethrowAsHttp(error, 'get intents by reference');
    }
  }

  async submitManualPayment(req: SubmitManualPaymentRequest): Promise<SubmitManualPaymentResponse> {
    try {
        return await lastValueFrom(this.paymentService.SubmitManualPayment(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'submit manual payment');
    }
  }

  async verifyManualPayment(req: VerifyManualPaymentRequest): Promise<VerifyManualPaymentResponse> {
      try {
          return await lastValueFrom(this.paymentService.VerifyManualPayment(req, this.metadata(), this.deadline()));
      } catch (error) {
          this.rethrowAsHttp(error, 'verify manual payment');
      }
  }

  async createIntent(req: CreateIntentRequest): Promise<CreateIntentResponse> {
      try {
          const normalizedReq: CreateIntentRequest = {
            ...req,
            ...(req.exchange_rate !== undefined ? { exchangeRate: req.exchange_rate } : {}),
            ...(req.exchangeRate !== undefined ? { exchange_rate: req.exchangeRate } : {}),
          };
          return await lastValueFrom(this.paymentService.CreateIntent(normalizedReq, this.metadata(), this.deadline()));
      } catch (error) {
          this.rethrowAsHttp(error, 'create payment intent');
      }
  }

  async getPaymentMethods(req: GetPaymentMethodsRequest): Promise<GetPaymentMethodsResponse> {
    try {
        return await lastValueFrom(this.paymentService.GetPaymentMethods(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'get payment methods');
    }
  }

  async processPayment(req: ProcessPaymentRequest): Promise<ProcessPaymentResponse> {
      try {
          const resp = await lastValueFrom(this.paymentService.ProcessPayment(req, this.metadata(), this.deadline()));
          return resp;
      } catch (error) {
          this.rethrowAsHttp(error, 'process payment');
      }
  }

  // Admin Methods
  async adminCreatePaymentMethod(req: AdminCreatePaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminCreatePaymentMethod(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'create payment method');
    }
  }

  async adminUpdatePaymentMethod(req: AdminUpdatePaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminUpdatePaymentMethod(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'update payment method');
    }
  }

  async adminDeletePaymentMethod(req: AdminDeletePaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminDeletePaymentMethod(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'delete payment method');
    }
  }

  async adminGetPaymentMethod(req: AdminGetPaymentMethodRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminGetPaymentMethod(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'get payment method');
    }
  }

  async adminListPaymentMethods(req: AdminListPaymentMethodsRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminListPaymentMethods(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'list payment methods');
    }
  }

  async adminListPayments(req: AdminListPaymentsRequest) {
    try {
        return await lastValueFrom(this.paymentService.AdminListPayments(req, this.metadata(), this.deadline()));
    } catch (error) {
        this.rethrowAsHttp(error, 'list payments');
    }
  }
}

function mapGrpcCodeToHttpStatus(code: number | undefined): number {
  switch (code) {
    case GrpcStatus.INVALID_ARGUMENT: return HttpStatus.BAD_REQUEST;            // 400
    case GrpcStatus.NOT_FOUND: return HttpStatus.NOT_FOUND;                      // 404
    case GrpcStatus.ALREADY_EXISTS: return HttpStatus.CONFLICT;                  // 409
    case GrpcStatus.PERMISSION_DENIED: return HttpStatus.FORBIDDEN;              // 403
    case GrpcStatus.UNAUTHENTICATED: return HttpStatus.UNAUTHORIZED;             // 401
    case GrpcStatus.RESOURCE_EXHAUSTED: return HttpStatus.TOO_MANY_REQUESTS;     // 429
    case GrpcStatus.FAILED_PRECONDITION: return HttpStatus.PRECONDITION_FAILED;  // 412
    case GrpcStatus.UNAVAILABLE: return HttpStatus.SERVICE_UNAVAILABLE;          // 503
    case GrpcStatus.DEADLINE_EXCEEDED: return HttpStatus.GATEWAY_TIMEOUT;        // 504
    case GrpcStatus.INTERNAL: return HttpStatus.INTERNAL_SERVER_ERROR;           // 500
    default: return HttpStatus.BAD_GATEWAY;                                       // 502 — downstream service issue
  }
}
