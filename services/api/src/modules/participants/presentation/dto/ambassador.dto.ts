import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsPhoneNumber, IsOptional } from 'class-validator';
import { IsEnglishName, IsEnglishText } from '@shared/validators/english-text.validator';

export class ApplyAmbassadorDto {
    @ApiProperty({ description: 'Program ID to apply for', example: 'uuid' })
    @IsUUID()
    programId: string;

    @ApiProperty({ description: 'Full Name', example: 'John Doe' })
    @IsString()
    @IsEnglishName()
    fullName: string;

    @ApiPropertyOptional({ description: 'Phone Number', example: '+123456789' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Institution/University', example: 'Harvard' })
    @IsOptional()
    @IsString()
    @IsEnglishText()
    institution?: string;
}

export class AmbassadorDashboardDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    fullName: string;

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

    @ApiProperty({ type: () => [AmbassadorReferralDto] })
    referrals: AmbassadorReferralDto[];
}

export class AmbassadorReferralDto {
    @ApiProperty()
    id: string;

    @ApiProperty()
    participantId: string;

    @ApiProperty()
    participantName: string;

    @ApiProperty({ enum: ['referred', 'registered', 'applied', 'accepted', 'completed'] })
    status: string;

    @ApiProperty()
    referredAt: Date;

    @ApiPropertyOptional()
    registeredAt?: Date | null;

    @ApiPropertyOptional()
    appliedAt?: Date | null;

    @ApiPropertyOptional()
    acceptedAt?: Date | null;

    @ApiPropertyOptional()
    completedAt?: Date | null;

    @ApiPropertyOptional()
    daysToRegister?: number | null;

    @ApiPropertyOptional()
    daysToApply?: number | null;

    @ApiPropertyOptional()
    daysToAccept?: number | null;

    @ApiPropertyOptional()
    totalConversionDays?: number | null;
}

export class AmbassadorShareTokenResolutionDto {
    @ApiProperty()
    referralCode: string;
}
