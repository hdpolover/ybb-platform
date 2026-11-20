import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export const DELETION_REASON_CATEGORIES = [
    'no_longer_interested',
    'not_accepted_or_cannot_attend',
    'too_many_emails',
    'privacy_concern',
    'duplicate_account',
    'cost',
    'bad_experience',
    'other',
] as const;

export const DELETION_REASON_MAX_LENGTH = 500;

export class CreateDeletionRequestDto {
    @ApiPropertyOptional({ maxLength: DELETION_REASON_MAX_LENGTH, description: 'Optional free text. May contain personal data the participant typed; retained for product improvement.' })
    @IsOptional()
    @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
    @IsString()
    @MaxLength(DELETION_REASON_MAX_LENGTH)
    reason?: string;

    @ApiPropertyOptional({ enum: DELETION_REASON_CATEGORIES })
    @IsOptional()
    @IsIn(DELETION_REASON_CATEGORIES)
    reasonCategory?: string;
}

export enum DeletionRequestReviewAction {
    APPROVE = 'approve',
    REJECT = 'reject'
}

export class ReviewDeletionRequestDto {
    @ApiProperty({ enum: DeletionRequestReviewAction, description: 'On a request already auto-scheduled (status "approved"), REJECT now means admin-initiated cancellation - it restores the account. APPROVE on an already-scheduled request is a no-op error; it only still does something on a legacy "pending" row.' })
    @IsEnum(DeletionRequestReviewAction)
    @IsNotEmpty()
    action: DeletionRequestReviewAction;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;
}

export class CancelDeletionRequestDto {
    @ApiProperty({ description: 'The deletion request id, from the cancellation link.' })
    @IsString()
    @IsNotEmpty()
    requestId: string;

    @ApiProperty({ description: 'The raw cancellation token, from the cancellation link.' })
    @IsString()
    @IsNotEmpty()
    token: string;
}

export class DeletionRequestConsequencesDto {
    @ApiProperty({ description: 'Whether the account has at least one paid invoice. Deletion is NOT blocked by this - it is informational only, since the financial ledger is retained regardless.' })
    hasPaidInvoice: boolean;

    @ApiProperty()
    paidInvoiceCount: number;

    @ApiProperty({ description: 'Whether the account has an application in any non-draft state. Deletion is NOT blocked by this.' })
    hasNonDraftApplication: boolean;

    @ApiProperty()
    nonDraftApplicationCount: number;
}

export class DeletionRequestResponseDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    userId: string;

    @ApiProperty()
    status: string;

    @ApiPropertyOptional()
    reason?: string;

    @ApiPropertyOptional()
    reasonCategory?: string;

    @ApiProperty()
    createdAt: Date;

    @ApiPropertyOptional({ description: 'When this account will be anonymised, ~30 days from the request. Cancellable up until then via the emailed link.' })
    scheduledDeletionDate?: Date;

    @ApiPropertyOptional({ type: DeletionRequestConsequencesDto })
    consequences?: DeletionRequestConsequencesDto;

    @ApiPropertyOptional()
    reviewedAt?: Date;

    @ApiPropertyOptional()
    reviewedBy?: string;

    @ApiPropertyOptional()
    reviewNotes?: string;
}
