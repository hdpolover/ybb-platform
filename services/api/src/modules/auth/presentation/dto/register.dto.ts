import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, IsIn, IsEnum, Matches } from 'class-validator';
import { ApplicationCategory } from '@prisma/client';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class RegisterDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'A valid email address for the new account.'
  })
  @NormalizeEmail()
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
  // Kept in sync with ybb-program-next/lib/auth/passwordRules.ts. The previous
  // pattern rejected passwords whose only special character was a leading "."
  // (".Password" failed while "Password." passed), which no stated rule covers.
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[\d\W]).+$/, {
    message: 'Password must contain uppercase, lowercase, number/special character',
  })
  password?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the program category (brand scope). Optional if the "x-brand-domain" header is provided.',
    required: false
  })
  @IsUUID()
  @IsOptional()
  brandId?: string;

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
  // '' must behave like "not provided" — @IsOptional() only skips null/undefined.
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @IsOptional()
  referralCode?: string;

  @ApiProperty({
    example: 'fully_funded',
    description: 'The category of registration (e.g. self_funded, fully_funded). Validates against available program options.',
    required: false,
    enum: ApplicationCategory
  })
  @IsEnum(ApplicationCategory)
  @IsOptional()
  applicationCategory?: ApplicationCategory;
}
