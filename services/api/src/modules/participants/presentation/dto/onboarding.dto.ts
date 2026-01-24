import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class OnboardingDto {
    @ApiProperty({ example: 'John Doe', description: 'Full name of the participant' })
    @IsString()
    @IsNotEmpty()
    fullName: string;

    @ApiProperty({ example: 'ID', description: 'Origin country ISO Code (e.g. ID, US)' })
    @IsString()
    @IsNotEmpty()
    originCountry: string;

    @ApiProperty({ example: 'Instagram', description: 'Where did you hear about us?' })
    @IsString()
    @IsNotEmpty()
    knowledgeSource: string;

    @ApiPropertyOptional({ example: 'K9X2M4P1', description: 'Referral code from an ambassador' })
    @IsString()
    @IsOptional()
    referralCode?: string;
}
