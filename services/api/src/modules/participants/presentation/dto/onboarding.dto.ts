import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsDateString, IsEnum, IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsEnglishName, IsEnglishText } from '@shared/validators/english-text.validator';
import { KNOWLEDGE_SOURCES } from '../../../metadata/metadata.constants';

export enum Gender {
  male = 'male',
  female = 'female',
}

export class OnboardingDto {
    @ApiProperty({ example: 'John Doe', description: 'Full name of the participant' })
    @IsString()
    @IsNotEmpty()
    @IsEnglishName()
    fullName: string;

    @ApiProperty({ example: 'male', enum: Gender, description: 'Gender of the participant' })
    @IsEnum(Gender)
    @IsNotEmpty()
    gender: Gender;

    @ApiProperty({ example: 'ID', description: 'Origin country ISO Code (e.g. ID, US)' })
    @IsString()
    @IsNotEmpty()
    @IsEnglishText()
    originCountry: string;

    @ApiProperty({ example: 'Jakarta', description: 'Origin city' })
    @IsString()
    @IsNotEmpty()
    @IsEnglishText()
    originCity: string;

    @ApiProperty({ example: '2000-01-01', description: 'Date of birth (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    birthDate: string;

    @ApiProperty({ example: 'Instagram', description: 'Where did you hear about us?' })
    @IsString()
    @IsNotEmpty()
    @IsEnglishText()
    @IsIn(KNOWLEDGE_SOURCES)
    knowledgeSource: string;

    @ApiPropertyOptional({ example: 'K9X2M4P1', description: 'Referral code from an ambassador' })
    // '' must behave like "not provided": @IsOptional() only skips null/undefined,
    // so an empty string would hit any future stricter validators on this field.
    // Also DROP (never reject) a code longer than the DB column (VarChar(20)):
    // referral is optional and best-effort, so an oversized/corrupted code (e.g. a
    // stale cookie-injected value) must be treated as "no referral" rather than a
    // 400, which would otherwise block onboarding entirely.
    @Transform(({ value }) => {
        if (typeof value !== 'string') return value;
        const trimmed = value.trim();
        // Return the TRIMMED value, not the original: a 20-char code padded with
        // whitespace passes the length check but would still overflow VarChar(20)
        // on write, which is the very 500 this guard exists to prevent.
        return trimmed === '' || trimmed.length > 20 ? undefined : trimmed;
    })
    @IsString()
    @IsOptional()
    referralCode?: string;
}
