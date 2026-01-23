import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'A valid email address for the new account.'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    minLength: 8,
    required: false,
    description: 'The password for local authentication. Optional if registering via an OAuth provider.'
  })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the program category (brand scope). Optional if the "x-brand-domain" header is provided.',
    required: false
  })
  @IsUUID()
  @IsOptional()
  programCategoryId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the authentication provider configuration (Local, Google, etc.).',
    required: true
  })
  @IsUUID()
  @IsNotEmpty()
  providerId: string;

  @ApiProperty({
    example: '123456789',
    description: 'The unique user ID from the external provider (Required for OAuth, e.g. Google sub).',
    required: false
  })
  @IsString()
  @IsOptional()
  providerUserId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of a specific program to immediately register the user for (e.g., "IYS 2026").',
    required: false
  })
  @IsUUID()
  @IsOptional()
  programId?: string;

  @ApiProperty({
    example: 'iys-2025',
    description: 'The slug of a specific program to immediately register the user for.',
    required: false
  })
  @IsString()
  @IsOptional()
  programSlug?: string;

  @ApiProperty({
    example: 'K9X2M4P1',
    description: 'Referral code from an ambassador.',
    required: false
  })
  @IsString()
  @IsOptional()
  referralCode?: string;
}
