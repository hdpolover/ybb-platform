import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export enum Gender {
  male = 'male',
  female = 'female',
}

export class OnboardingDto {
    @ApiProperty({ example: 'John Doe', description: 'Full name of the participant' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'male', enum: Gender, description: 'Gender of the participant' })
    @IsEnum(Gender)
    @IsNotEmpty()
    gender: Gender;

    @ApiProperty({ example: 'ID', description: 'Origin country ISO Code (e.g. ID, US)' })
    @IsString()
    @IsNotEmpty()
    originCountry: string;

    @ApiProperty({ example: 'Jakarta', description: 'Origin city' })
    @IsString()
    @IsNotEmpty()
    originCity: string;

    @ApiProperty({ example: '2000-01-01', description: 'Date of birth (YYYY-MM-DD)' })
    @IsDateString()
    @IsNotEmpty()
    birthDate: string;

    @ApiProperty({ example: 'Instagram', description: 'Where did you hear about us?' })
    @IsString()
    @IsNotEmpty()
    knowledgeSource: string;

    @ApiPropertyOptional({ example: 'K9X2M4P1', description: 'Referral code from an ambassador' })
    @IsString()
    @IsOptional()
    referralCode?: string;
}
