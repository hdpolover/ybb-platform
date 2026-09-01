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
  // Correlation key for the per-recipient send log: services/notification
  // echoes this back on loa.batch.send_result so the API can match an
  // outcome to the row it wrote at release time without trusting the email
  // address (which the user can change between release and delivery).
  participantId: string;
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

// ─── loa.batch.send_result ────────────────────────────────────────────────────
// Emitted by services/notification after it has attempted the LOA-ready email
// for every recipient in one loa.batch.released message, and consumed by the
// API's LoaSendResultsController.
//
// It reports outcomes rather than writing them directly because
// services/notification has no database access at all (no Prisma or pg
// dependency in its package.json) — it only sends email. Bolting a second
// Prisma client onto it would create a second writer to the API's database;
// this keeps the API the single owner of its own schema, mirroring how
// in-app notifications are already written API-side in
// ReleaseLoaBatchHandler.createInAppNotifications.

export interface LoaBatchSendResult {
  participantId: string;
  // Present on success when the provider returned one (Resend `data.id`,
  // nodemailer `messageId`); null when the transport reported no id.
  providerMessageId: string | null;
  // Null on success. Truncated by the emitter — see MAX_SEND_ERROR_LENGTH.
  error: string | null;
}

export interface LoaBatchSendResultsPayload {
  batchId: string;
  programId: string;
  results: LoaBatchSendResult[];
}
