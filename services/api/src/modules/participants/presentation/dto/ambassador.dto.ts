import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsPhoneNumber, IsOptional } from 'class-validator';

export class ApplyAmbassadorDto {
    @ApiProperty({ description: 'Program ID to apply for', example: 'uuid' })
    @IsUUID()
    programId: string;

    @ApiProperty({ description: 'Full Name', example: 'John Doe' })
    @IsString()
    fullName: string;

    @ApiPropertyOptional({ description: 'Phone Number', example: '+123456789' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Institution/University', example: 'Harvard' })
    @IsOptional()
    @IsString()
    institution?: string;
}

export class AmbassadorDashboardDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    referralCode: string;

    @ApiProperty()
    totalReferrals: number;

    @ApiProperty()
    successfulReferrals: number;

    @ApiProperty()
    isActive: boolean;

    @ApiPropertyOptional()
    programName?: string;

    @ApiPropertyOptional({ description: 'The unique share link for this ambassador for this program' })
    shareLink?: string;
}
