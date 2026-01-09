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
    example: 'local',
    description: 'The authentication provider method.',
    required: false,
    default: 'local',
    enum: ['local', 'google', 'facebook', 'apple']
  })
  @IsString()
  @IsOptional()
  @IsIn(['local', 'google', 'facebook', 'apple'])
  provider?: string;

  @ApiProperty({
    example: '123456789',
    description: 'The unique user ID from the external provider (used for OAuth).',
    required: false
  })
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of a specific program to immediately register the user for (e.g., "IYS 2026").',
    required: false
  })
  @IsUUID()
  @IsOptional()
  programId?: string;
}
