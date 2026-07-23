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
    @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
    @IsString()
    @IsOptional()
    referralCode?: string;
}
