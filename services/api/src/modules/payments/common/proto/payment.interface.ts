import { Observable } from 'rxjs';

export interface PaymentService {
  CreateIntent(req: any): Observable<any>;
  GetPaymentMethods(req: any): Observable<any>;
  ProcessPayment(req: any): Observable<any>;
  GetIntentsByReference(req: GetIntentsByReferenceRequest): Observable<GetIntentsByReferenceResponse>;
  SubmitManualPayment(req: SubmitManualPaymentRequest): Observable<SubmitManualPaymentResponse>;
  VerifyManualPayment(req: VerifyManualPaymentRequest): Observable<VerifyManualPaymentResponse>;

  // Admin Methods
  AdminCreatePaymentMethod(req: AdminCreatePaymentMethodRequest): Observable<AdminCreatePaymentMethodResponse>;
  AdminUpdatePaymentMethod(req: AdminUpdatePaymentMethodRequest): Observable<AdminUpdatePaymentMethodResponse>;
  AdminDeletePaymentMethod(req: AdminDeletePaymentMethodRequest): Observable<AdminDeletePaymentMethodResponse>;
  AdminGetPaymentMethod(req: AdminGetPaymentMethodRequest): Observable<AdminGetPaymentMethodResponse>;
  AdminListPaymentMethods(req: AdminListPaymentMethodsRequest): Observable<AdminListPaymentMethodsResponse>;
  AdminListPayments(req: AdminListPaymentsRequest): Observable<AdminListPaymentsResponse>;
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
