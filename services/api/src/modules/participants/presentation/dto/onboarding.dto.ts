import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OnboardingDto {
    @ApiProperty({ example: 'John Doe', description: 'Full name of the participant' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiPropertyOptional({ example: 'Male', description: 'Gender of the participant' })
    @IsString()
    @IsOptional()
    gender?: string;

    @ApiProperty({ example: 'Indonesia', description: 'Origin country / Nationality' })
    @IsString()
    @IsNotEmpty()
    originCountry: string;

    @ApiPropertyOptional({ example: 'Jakarta', description: 'Origin city' })
    @IsString()
    @IsOptional()
    originCity?: string;

    @ApiPropertyOptional({ example: 'Student', description: 'Current occupation' })
    @IsString()
    @IsOptional()
    occupation?: string;

    @ApiPropertyOptional({ example: 'University of Indonesia', description: 'Institution or Company' })
    @IsString()
    @IsOptional()
    institution?: string;

    @ApiProperty({ example: 'Instagram', description: 'Where did you hear about us?' })
    @IsString()
    @IsNotEmpty()
    knowledgeSource: string;

    @ApiPropertyOptional({ example: 'K9X2M4P1', description: 'Referral code from an ambassador' })
    @IsString()
    @IsOptional()
    referralCode?: string;
}
