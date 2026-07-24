import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsUUID, IsString, IsPhoneNumber, IsOptional, IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
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

// Admin-facing creation/update DTOs for AmbassadorAdminController.
// These replace inline @Body() object-literal types: an inline TS type erases to
// `Object` at runtime, so Nest's ValidationPipe (whitelist/forbidNonWhitelisted/
// transform) silently skips validation for that param entirely. See
// ambassador-admin.controller.ts create()/update().
export class CreateAmbassadorAdminDto {
    @ApiProperty({ description: 'Ambassador email', example: 'jane@example.com' })
    @IsEmail()
    email: string;

    @ApiProperty({ description: 'Full name', example: 'Jane Doe' })
    @IsString()
    @IsNotEmpty()
    @MaxLength(255)
    fullName: string;

    @ApiProperty({ description: 'Program ID the ambassador is attached to', example: 'uuid' })
    @IsUUID()
    programId: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+6281234567890' })
    @IsOptional()
    @IsString()
    @MaxLength(25)
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Institution/University', example: 'Harvard' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    institution?: string;

    // Validated against the Prisma Gender enum by the controller's
    // assertValidGender() (kept there for its clean custom error message),
    // not by a class-validator @IsEnum here.
    @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female'] })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ description: 'Internal admin notes' })
    @IsOptional()
    @IsString()
    notes?: string;
}

export class UpdateAmbassadorAdminDto {
    @ApiPropertyOptional({ description: 'Full name', example: 'Jane Doe' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    fullName?: string;

    @ApiPropertyOptional({ description: 'Phone number', example: '+6281234567890' })
    @IsOptional()
    @IsString()
    @MaxLength(25)
    phoneNumber?: string;

    @ApiPropertyOptional({ description: 'Institution/University', example: 'Harvard' })
    @IsOptional()
    @IsString()
    @MaxLength(255)
    institution?: string;

    @ApiPropertyOptional({ description: 'Gender', enum: ['male', 'female'] })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ description: 'Internal admin notes' })
    @IsOptional()
    @IsString()
    notes?: string;
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

export class ReferralCodeValidationDto {
    @ApiProperty({ description: 'Always true; an unknown or inactive code returns 404.' })
    valid: boolean;
}

export class ReferralAttributionDto {
    @ApiProperty({ description: 'True when the code resolves to an active ambassador' })
    valid: boolean;

    @ApiProperty({
        description: 'Display name of the referring ambassador, or null when the code is unknown, inactive, deleted, or belongs to another program',
        nullable: true,
        example: 'Jane Ambassador',
    })
    referredByName: string | null;
}
