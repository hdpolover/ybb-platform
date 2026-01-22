import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateDeletionRequestDto {
    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reason?: string;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    reasonCategory?: string;
}

export enum DeletionRequestReviewAction {
    APPROVE = 'approve',
    REJECT = 'reject'
}

export class ReviewDeletionRequestDto {
    @ApiProperty({ enum: DeletionRequestReviewAction })
    @IsEnum(DeletionRequestReviewAction)
    @IsNotEmpty()
    action: DeletionRequestReviewAction;

    @ApiPropertyOptional()
    @IsOptional()
    @IsString()
    notes?: string;
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

    @ApiPropertyOptional()
    reviewedAt?: Date;

    @ApiPropertyOptional()
    reviewedBy?: string;

    @ApiPropertyOptional()
    reviewNotes?: string;
}
