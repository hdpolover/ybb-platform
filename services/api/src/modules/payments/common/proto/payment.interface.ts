import { Observable } from 'rxjs';

export interface PaymentService {
  CreateIntent(req: any): Observable<any>;
  GetPaymentMethods(req: any): Observable<any>;
  ProcessPayment(req: any): Observable<any>;
  GetIntentsByReference(req: GetIntentsByReferenceRequest): Observable<GetIntentsByReferenceResponse>;
  SubmitManualPayment(req: SubmitManualPaymentRequest): Observable<SubmitManualPaymentResponse>;
  VerifyManualPayment(req: VerifyManualPaymentRequest): Observable<VerifyManualPaymentResponse>;
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
