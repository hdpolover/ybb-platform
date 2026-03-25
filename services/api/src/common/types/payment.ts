// Shared TypeScript types for Payment entities

export enum PaymentStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
  CANCELLED = 'cancelled',
}

export enum PaymentMethod {
  CREDIT_CARD = 'credit_card',
  DEBIT_CARD = 'debit_card',
  BANK_TRANSFER = 'bank_transfer',
  PAYPAL = 'paypal',
  STRIPE = 'stripe',
}

export interface Payment {
  id: string;
  userId: string;
  applicationId: string;
  amount: number;
  currency: string;
  status: PaymentStatus;
  paymentMethod: PaymentMethod;
  stripePaymentIntentId?: string;
  metadata?: Record<string, unknown>;
  paidAt?: Date;
  refundedAt?: Date;
  refundAmount?: number;
  refundReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreatePaymentDto {
  userId: string;
  applicationId: string;
  amount: number;
  currency: string;
  paymentMethod: PaymentMethod;
  metadata?: Record<string, unknown>;
}

export interface ProcessPaymentDto {
  paymentId: string;
  stripePaymentIntentId: string;
}

export interface RefundPaymentDto {
  paymentId: string;
  amount: number;
  reason: string;
}

export interface PaymentWithDetails extends Payment {
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
  application: {
    id: string;
    programId: string;
    programTitle: string;
  };
}
