/**
 * Shared type for RabbitMQ event payloads.
 *
 * T defaults to Record<string, unknown> for generic wildcard handlers.
 * Specific handlers should narrow T to the exact payload shape.
 */
export interface RmqEventPayload<T = Record<string, unknown>> {
  event?: string;
  timestamp?: string;
  data?: T;
  [key: string]: unknown;
}

export interface PaymentSucceededPayload {
  intent_id?: string;
  transaction_id?: string;
  amount?: number;
  currency?: string;
  user_id?: string;
  reference_type?: string;
  reference_id?: string;
}

export interface UserRegisteredPayload {
  user_id?: string;
  email?: string;
  brand_id?: string;
}

export interface LoaBatchReleasedRecipient {
  userId: string;
  email: string;
  fullName: string;
}

// Batch-level, not per-recipient: one release batch belongs to exactly one
// program, which belongs to exactly one brand, so there's nothing to
// disambiguate per recipient.
export interface LoaBatchReleasedBrand {
  name: string | null;
  websiteUrl: string | null;
}

export interface LoaBatchReleasedPayload {
  batchId: string;
  programId: string;
  programName: string;
  batchName: string;
  recipients: LoaBatchReleasedRecipient[];
  brand: LoaBatchReleasedBrand | null;
}
