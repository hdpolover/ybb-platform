import { IsString, IsNumber, IsOptional, IsNotEmpty, IsObject, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateIntentDto {
  @ApiProperty({ example: 50000, description: 'Amount to charge' })
  @IsNumber()
  @Min(1)
  amount: number;

  @ApiProperty({ example: 'IDR', description: 'Currency code' })
  @IsString()
  @IsNotEmpty()
  currency: string;

  @ApiProperty({ example: 'application', description: 'Context of payment' })
  @IsString()
  @IsNotEmpty()
  reference_type: string;

  @ApiProperty({ example: 'app_123', description: 'External ID reference' })
  @IsString()
  @IsNotEmpty()
  reference_id: string;

  @ApiProperty({ example: 'uuid-beneficiary', required: false, description: 'Beneficiary ID' })
  @IsString()
  @IsOptional()
  participant_id?: string;

  @ApiProperty({ example: { program: 'YBB 2024' }, required: false, description: 'Arbitrary metadata' })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, string>;
}

export class SubmitManualPaymentDto {
    @ApiProperty({ description: 'Payment Intent ID' })
    @IsString()
    @IsNotEmpty()
    intent_id: string;

    @ApiProperty({ description: 'Proof File URL (from File Service)' })
    @IsString()
    @IsNotEmpty()
    proof_file_url: string;

    @ApiProperty({ description: 'Proof File ID (from File Service)', required: false })
    @IsString()
    @IsOptional()
    proof_file_id?: string;

    @ApiProperty({ description: 'User notes/details', required: false })
    @IsString()
    @IsOptional()
    details?: string;
}

export class VerifyManualPaymentDto {
    @ApiProperty({ description: 'Verification Status', enum: ['SUCCESS', 'FAILED'] })
    @IsString()
    @IsNotEmpty()
    status: string;

    @ApiProperty({ description: 'Rejection reason', required: false })
    @IsString()
    @IsOptional()
    reason?: string;
}
