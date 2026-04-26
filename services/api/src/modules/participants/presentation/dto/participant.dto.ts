import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEmail, IsEnum, IsOptional, IsString, IsBoolean, IsUrl } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateParticipantProfileDto {
    @ApiPropertyOptional({ example: 'John Doe' })
    @IsOptional()
    @IsString()
    fullName?: string;

    @ApiPropertyOptional({ example: 'Johnny' })
    @IsOptional()
    @IsString()
    nickName?: string;

    @ApiPropertyOptional({ example: 'John' })
    @IsOptional()
    @IsString()
    displayName?: string;

    @ApiPropertyOptional({ example: '1995-05-20' })
    @IsOptional()
    @IsDateString()
    birthdate?: string;

    @ApiPropertyOptional({ example: 'Male' })
    @IsOptional()
    @IsString()
    gender?: string;

    @ApiPropertyOptional({ example: '+84' })
    @IsOptional()
    @IsString()
    phoneCountryCode?: string;

    @ApiPropertyOptional({ example: '912345678' })
    @IsOptional()
    @IsString()
    phoneNumber?: string;

    @ApiPropertyOptional({ example: 'Vietnam' })
    @IsOptional()
    @IsString()
    nationality?: string;

    @ApiPropertyOptional({ example: 'City' })
    @IsOptional()
    @IsString()
    currentCity?: string;

    @ApiPropertyOptional({ example: 'Country' })
    @IsOptional()
    @IsString()
    currentCountry?: string;

    @ApiPropertyOptional({ example: 'University of Technology' })
    @IsOptional()
    @IsString()
    institution?: string;

    @ApiPropertyOptional({ example: 'Computer Science' })
    @IsOptional()
    @IsString()
    major?: string;

    @ApiPropertyOptional({ example: 'Software Engineer' })
    @IsOptional()
    @IsString()
    occupation?: string;

    @ApiPropertyOptional({ example: 'john_doe_insta' })
    @IsOptional()
    @IsString()
    instagramUsername?: string;

    @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
    @IsOptional()
    @IsUrl()
    linkedinUrl?: string;

    @ApiPropertyOptional({ example: 'L' })
    @IsOptional()
    @IsString()
    tshirtSize?: string;

    @ApiPropertyOptional({ example: 'None' })
    @IsOptional()
    @IsString()
    dietaryRestrictions?: string;

    @ApiPropertyOptional({ example: 'None' })
    @IsOptional()
    @IsString()
    medicalConditions?: string;

    @ApiPropertyOptional({ example: 'Jane Doe', description: 'Emergency contact name' })
    @IsOptional()
    @IsString()
    emergencyContactName?: string;

    @ApiPropertyOptional({ example: 'Mother', description: 'Relation to emergency contact' })
    @IsOptional()
    @IsString()
    emergencyContactRelation?: string;

    @ApiPropertyOptional({ example: '62', description: 'Country code for emergency contact phone' })
    @IsOptional()
    @IsString()
    emergencyContactCountryCode?: string;

    @ApiPropertyOptional({ example: '81234567890', description: 'Emergency contact phone number' })
    @IsOptional()
    @IsString()
    emergencyContactPhone?: string;

    @ApiPropertyOptional({ example: 'https://cdn.ybbhub.com/participants/profile.jpg' })
    @IsOptional()
    @IsUrl()
    profilePictureUrl?: string;

    // Add other fields as needed based on schema
}

export class ParticipantResponseDto {
    @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
    id: string;

    @ApiProperty({ example: 'John Doe' })
    fullName: string;

    @ApiPropertyOptional({ example: 'Johnny' })
    nickName?: string;

    @ApiPropertyOptional({ example: 'John' })
    displayName?: string;

    @ApiPropertyOptional({ example: '1995-05-20' })
    birthdate?: Date;

    @ApiPropertyOptional({ example: 'Male' })
    gender?: string;

    // Contact
    @ApiPropertyOptional({ example: '+84' })
    phoneCountryCode?: string;

    @ApiPropertyOptional({ example: '912345678' })
    phoneNumber?: string;

    @ApiPropertyOptional({ example: true })
    phoneVerified?: boolean;

    // Location
    @ApiPropertyOptional({ example: 'Vietnam' })
    nationality?: string;

    @ApiPropertyOptional({ example: 'Hanoi' })
    currentCity?: string;

    @ApiPropertyOptional({ example: 'Vietnam' })
    currentCountry?: string;

    // Education/Work
    @ApiPropertyOptional({ example: 'University of Technology' })
    institution?: string;

    @ApiPropertyOptional({ example: 'Computer Science' })
    major?: string;

    @ApiPropertyOptional({ example: 'Software Engineer' })
    occupation?: string;

    // Social
    @ApiPropertyOptional({ example: 'john_doe' })
    instagramUsername?: string;

    @ApiPropertyOptional({ example: 'https://linkedin.com/in/johndoe' })
    linkedinUrl?: string;

    @ApiPropertyOptional({ example: 'https://cdn.ybbhub.com/participants/profile.jpg' })
    profilePictureUrl?: string;

    // Misc
    @ApiPropertyOptional({ example: 'L' })
    tshirtSize?: string;

    @ApiPropertyOptional({ example: 'Vegetarian' })
    dietaryRestrictions?: string;

    // Emergency Contact
    @ApiPropertyOptional({ example: 'Jane Doe' })
    emergencyContactName?: string;

    @ApiPropertyOptional({ example: 'Mother' })
    emergencyContactRelation?: string;

    @ApiPropertyOptional({ example: '62' })
    emergencyContactCountryCode?: string;

    @ApiPropertyOptional({ example: '81234567890' })
    emergencyContactPhone?: string;

    @ApiProperty({ example: 40 })
    profileCompletionPercentage: number;
}
