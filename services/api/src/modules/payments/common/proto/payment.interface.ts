import { Observable } from 'rxjs';

// --- CreateIntent ---
export interface ItemDetail {
  id: string;
  name: string;
  price: number;
  quantity: number;
  brand?: string;
  category?: string;
  merchant_name?: string;
}

export interface CreateIntentRequest {
  user_id: string;
  participant_id?: string;
  amount: number;
  currency: string;
  reference_type: string;
  reference_id: string;
  metadata?: Record<string, string>;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  description?: string;
  item_details?: ItemDetail[];
  exchange_rate?: number;
}

export interface CreateIntentResponse {
  intent_id: string;
  client_secret?: string;
  status: string;
}

// --- GetPaymentMethods ---
export interface GetPaymentMethodsRequest {
  amount: number;
  currency: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  category: string;
  image_url: string;
  estimated_fee: number;
  is_surcharge: boolean;
}

export interface GetPaymentMethodsResponse {
  methods: PaymentMethod[];
}

// --- ProcessPayment ---
export interface ProcessPaymentRequest {
  intent_id: string;
  payment_method_id: string;
  gateway_token?: string;
  payment_details?: { details_json?: string };
}

export interface ProcessPaymentAction {
  type: string;
  url?: string;
  qr_string?: string;
}

export interface ProcessPaymentResponse {
  status: string;
  transaction_id: string;
  action?: ProcessPaymentAction;
  metadata?: Record<string, string>;
}

// Optional gRPC metadata forwarded by @nestjs/microservices to the underlying
// grpc-js client call. Typed loosely as `unknown` to avoid pulling @grpc/grpc-js
// into this proto-shape file.
type GrpcMeta = unknown;

export interface PaymentService {
  CreateIntent(req: CreateIntentRequest, metadata?: GrpcMeta): Observable<CreateIntentResponse>;
  GetPaymentMethods(req: GetPaymentMethodsRequest, metadata?: GrpcMeta): Observable<GetPaymentMethodsResponse>;
  ProcessPayment(req: ProcessPaymentRequest, metadata?: GrpcMeta): Observable<ProcessPaymentResponse>;
  GetIntentsByReference(req: GetIntentsByReferenceRequest, metadata?: GrpcMeta): Observable<GetIntentsByReferenceResponse>;
  SubmitManualPayment(req: SubmitManualPaymentRequest, metadata?: GrpcMeta): Observable<SubmitManualPaymentResponse>;
  VerifyManualPayment(req: VerifyManualPaymentRequest, metadata?: GrpcMeta): Observable<VerifyManualPaymentResponse>;

  // Admin Methods
  AdminCreatePaymentMethod(req: AdminCreatePaymentMethodRequest, metadata?: GrpcMeta): Observable<AdminCreatePaymentMethodResponse>;
  AdminUpdatePaymentMethod(req: AdminUpdatePaymentMethodRequest, metadata?: GrpcMeta): Observable<AdminUpdatePaymentMethodResponse>;
  AdminDeletePaymentMethod(req: AdminDeletePaymentMethodRequest, metadata?: GrpcMeta): Observable<AdminDeletePaymentMethodResponse>;
  AdminGetPaymentMethod(req: AdminGetPaymentMethodRequest, metadata?: GrpcMeta): Observable<AdminGetPaymentMethodResponse>;
  AdminListPaymentMethods(req: AdminListPaymentMethodsRequest, metadata?: GrpcMeta): Observable<AdminListPaymentMethodsResponse>;
  AdminListPayments(req: AdminListPaymentsRequest, metadata?: GrpcMeta): Observable<AdminListPaymentsResponse>;
}

export interface SubmitManualPaymentRequest {
    intent_id: string;
    proof_file_id?: string;
    proof_file_url?: string;
    details?: string;
}

export interface SubmitManualPaymentResponse {
    status: string;
    transaction_id: string;
}

export interface VerifyManualPaymentRequest {
    transaction_id: string;
    status: string; // "SUCCESS", "FAILED"
    admin_id: string;
    reason?: string;
}

export interface VerifyManualPaymentResponse {
    status: string;
}

export interface GetIntentsByReferenceRequest {
  reference_type: string;
  reference_id: string;
}

export interface PaymentIntent {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  status: string; // "REQUIRES_PAYMENT_METHOD", "PROCESSING", "SUCCEEDED", "CANCELED"
  created_at: string;
  reference_type: string;
  reference_id: string;
  metadata: { [key: string]: string };
}

export interface GetIntentsByReferenceResponse {
  intents: PaymentIntent[];
}

export interface FeeConfig {
  fixed_fee: number;
  percentage_fee: number;
  min_fee: number;
  currency: string;
  is_surcharge: boolean;
}

export interface AdminPaymentMethod {
  id: string;
  name: string;
  type: string;
  code: string;
  is_active: boolean;
  display_name: string;
  description: string;
  icon: string;
  gateway_name: string;
  gateway_type: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions: string;
  requires_proof: boolean;
  admin_instructions: string;
  config?: FeeConfig;
  sort_order: number;
}

export interface AdminCreatePaymentMethodRequest {
  name: string;
  type: string;
  code: string;
  is_active: boolean;
  display_name: string;
  description: string;
  icon: string;
  gateway_name: string;
  gateway_type: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions: string;
  requires_proof: boolean;
  admin_instructions: string;
  config?: FeeConfig;
  sort_order: number;
}

export interface AdminCreatePaymentMethodResponse {
  id: string;
}

export interface AdminUpdatePaymentMethodRequest {
  id: string;
  name: string;
  type: string;
  code: string;
  is_active: boolean;
  display_name: string;
  description: string;
  icon: string;
  gateway_name: string;
  gateway_type: string;
  bank_name: string;
  account_number: string;
  account_name: string;
  instructions: string;
  requires_proof: boolean;
  admin_instructions: string;
  config?: FeeConfig;
  sort_order: number;
}

export interface AdminUpdatePaymentMethodResponse {
  id: string;
}

export interface AdminDeletePaymentMethodRequest {
  id: string;
}

export interface AdminDeletePaymentMethodResponse {
  success: boolean;
}

export interface AdminGetPaymentMethodRequest {
  id: string;
}

export interface AdminGetPaymentMethodResponse {
  method: AdminPaymentMethod;
}

export interface AdminListPaymentMethodsRequest {}

export interface AdminListPaymentMethodsResponse {
  methods: AdminPaymentMethod[];
}

export interface AdminListPaymentsRequest {
  page: number;
  limit: number;
  user_id?: string;
  program_id?: string;
  status?: string;
  from_date?: string;
  to_date?: string;
}

export interface AdminListPaymentsResponse {
  payments: PaymentIntent[];
  total: number;
  page: number;
  total_pages: number;
}
