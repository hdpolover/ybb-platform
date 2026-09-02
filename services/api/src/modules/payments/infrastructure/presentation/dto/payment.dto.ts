import { IsString, IsOptional, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

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

export class AdminListPaymentsDto {
    @ApiProperty({ description: 'Page number', required: false, default: 1 })
    @IsOptional()
    page?: number;

    @ApiProperty({ description: 'Items per page', required: false, default: 10 })
    @IsOptional()
    limit?: number;

    @ApiProperty({ description: 'Filter by User ID', required: false })
    @IsString()
    @IsOptional()
    user_id?: string;

    @ApiProperty({ description: 'Filter by Program ID', required: false })
    @IsString()
    @IsOptional()
    program_id?: string;

    @ApiProperty({ description: 'Filter by Status', required: false })
    @IsString()
    @IsOptional()
    status?: string;

    @ApiProperty({ description: 'From Date (ISO)', required: false })
    @IsString()
    @IsOptional()
    from_date?: string;

    @ApiProperty({ description: 'To Date (ISO)', required: false })
    @IsString()
    @IsOptional()
    to_date?: string;
}

