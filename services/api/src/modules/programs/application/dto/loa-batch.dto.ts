import { IsString, IsDateString, IsOptional, MinLength, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateLoaBatchDto {
  @IsString() name: string;
  @IsDateString() paymentFrom: string;
  @IsDateString() paymentTo: string;
}

export class UpdateLoaBatchDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsDateString() paymentFrom?: string;
  @IsOptional() @IsDateString() paymentTo?: string;
}

export class LoaBatchResponseDto {
  id: string;
  programId: string;
  name: string;
  paymentFrom: Date;
  paymentTo: Date;
  releasedAt: Date | null;
  eligibleCount: number;
  downloadedCount: number;
  createdAt: Date;
}

export class LoaDownloadResponseDto {
  participantName: string;
  email: string;
  batchName: string | null;
  documentNumber: string;
  firstDownloadedAt: Date | null;
  downloadCount: number;
}

// ─── Per-recipient LOA email audit ────────────────────────────────────────────

/**
 * What happened to a sent email after Resend accepted it (webhook-fed), plus
 * whether the participant has actually opened the letter. Shared by the batch
 * recipient list and the email search so both render the same badges.
 */
export class LoaDeliveryFieldsDto {
  deliveryStatus: 'delivered' | 'bounced' | 'complained' | 'delayed' | null;
  deliveredAt: Date | null;
  bouncedAt: Date | null;
  bounceType: string | null;
  complainedAt: Date | null;
  deliveryUpdatedAt: Date | null;
  /** participant_documents.download_count for this program's LOA; 0 = never. */
  downloadCount: number;
  firstDownloadedAt: Date | null;
}

export class LoaRecipientSendResponseDto extends LoaDeliveryFieldsDto {
  participantId: string;
  participantName: string;
  /** The address the email was actually addressed to, as of release time. */
  email: string;
  status: 'pending' | 'sent' | 'failed';
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  sentAt: Date | null;
}

export class LoaRecipientSendSummaryDto {
  total: number;
  pending: number;
  sent: number;
  failed: number;
  // Webhook-fed; counts of sent rows by what Resend reported afterwards.
  delivered: number;
  bounced: number;
  complained: number;
}

export class LoaBatchRecipientSendsResponseDto {
  batchId: string;
  /**
   * False for batches released before per-recipient logging existed. Their
   * outcomes were only ever written to container logs (~2 day retention) and
   * are unrecoverable, so the UI must say "not recorded" rather than "0 sent".
   */
  hasSendLog: boolean;
  summary: LoaRecipientSendSummaryDto;
  recipients: LoaRecipientSendResponseDto[];
  /**
   * Program-wide blind spot, not batch-scoped: submitted/accepted applicants
   * whose PAYMENT falls outside EVERY released batch window (the window is
   * matched against paidAt, not submittedAt — see
   * buildLoaEligibleApplicationWhere). They are silently never selected by
   * findEligibleRecipients — no email, no log line, no send row — so a
   * per-recipient log alone cannot surface them. This is the true total, not
   * the length of the capped list below.
   */
  uncoveredParticipantCount: number;
  /** Capped at 100, earliest submission first, so an admin can act on them. */
  uncoveredParticipants: UncoveredParticipantDto[];
  /**
   * How many of the uncovered would fall inside an existing UNRELEASED batch.
   * Coverage is deliberately computed against released batches only (an
   * unreleased batch notifies nobody), but a non-zero value here usually
   * means the admin believes they already released that batch.
   */
  coveredByUnreleasedBatchCount: number;
  /** Names of the unreleased batches involved; empty when the count is 0. */
  unreleasedBatchNames: string[];
}

export class UncoveredParticipantDto {
  applicationId: string;
  participantId: string;
  participantName: string;
  email: string;
  // Display context only ("when did this person apply") — coverage itself is
  // now decided by payment date, not this field. See uncoveredParticipantCount.
  submittedAt: Date | null;
}

// ─── Email search across a program's LOA sends ────────────────────────────────

export const LOA_SEND_SEARCH_MIN_LENGTH = 3;

export class SearchLoaSendsQueryDto {
  // Trim first so "  ab " can't slip past the minimum length.
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MinLength(LOA_SEND_SEARCH_MIN_LENGTH)
  @MaxLength(255)
  email: string;
}

export class LoaSendSearchResultDto extends LoaDeliveryFieldsDto {
  id: string;
  batchId: string;
  batchName: string;
  participantId: string;
  participantName: string;
  email: string;
  status: 'pending' | 'sent' | 'failed';
  providerMessageId: string | null;
  errorMessage: string | null;
  attemptCount: number;
  sentAt: Date | null;
}
