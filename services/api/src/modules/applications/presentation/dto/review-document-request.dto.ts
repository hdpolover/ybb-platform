// services/api/src/modules/applications/presentation/dto/review-document-request.dto.ts
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DocumentReviewAction } from '../../application/commands/review-document.command';

/**
 * Review Document Request DTO
 *
 * Presentation Layer - API Request DTO
 *
 * `note` is required for 'reject' and 'request_revision' (checked in the
 * handler, since it depends on `action`) and shown to the participant
 * verbatim. No length cap here beyond a sane upper bound: submission_note is
 * TEXT, not a length-constrained column.
 */
export class ReviewDocumentRequestDto {
  @ApiProperty({ enum: ['approve', 'reject', 'request_revision'] })
  @IsIn(['approve', 'reject', 'request_revision'])
  action: DocumentReviewAction;

  @ApiPropertyOptional({ description: 'Required for reject/request_revision. Shown to the participant verbatim.' })
  @IsOptional()
  @IsString()
  @MaxLength(5000)
  note?: string;
}
