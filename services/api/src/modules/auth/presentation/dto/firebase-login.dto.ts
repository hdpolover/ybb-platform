import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApplicationCategory } from '@prisma/client';

export class FirebaseLoginDto {
  @ApiProperty({
    example: 'eyJhbGciOiJSUzI1NiIsImtpZCI6IjUyOGR...',
    description: 'The Firebase ID token obtained from the client SDK (e.g. Google Sign-In).'
  })
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the authentication provider (e.g. Google, Apple). If not provided, the server will attempt to resolve it from the Firebase token.',
    required: false
  })
  @IsUUID()
  @IsOptional()
  providerId?: string;

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
     description: '(Registration only) To automatically link new user with a specific program on first sign-in.',
     required: false
  })
  @IsUUID()
  @IsOptional()
  programId?: string;

  @ApiProperty({
    example: 'ybb-15',
    description: '(Registration only) To automatically link new user with a specific program slug on first sign-in.',
    required: false
  })
  @IsString()
  @IsOptional()
  programSlug?: string;

  @ApiProperty({
    example: 'K9X2M4P1',
    description: '(Registration only) Referral code to credit an ambassador on first sign-in.',
    required: false
  })
  // '' must behave like "not provided" — @IsOptional() only skips null/undefined.
  @Transform(({ value }) => (typeof value === 'string' && value.trim() === '' ? undefined : value))
  @IsString()
  @IsOptional()
  referralCode?: string;

  @ApiProperty({
    example: 'fully_funded',
    description: '(Registration only) The category of registration (e.g. self_funded, fully_funded). Validates against available program options.',
    required: false,
    enum: ApplicationCategory,
  })
  @IsEnum(ApplicationCategory)
  @IsOptional()
  applicationCategory?: ApplicationCategory;
}
