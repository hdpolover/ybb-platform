import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID, MinLength, IsIn } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'password123', minLength: 8, required: false })
  @IsString()
  @IsOptional()
  @MinLength(8)
  password?: string;

  @ApiProperty({ 
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Program Category ID (brand scope) - Optional if domain is provided in request header',
    required: false
  })
  @IsUUID()
  @IsOptional()
  programCategoryId?: string;

  @ApiProperty({
    example: 'local',
    description: 'Authentication provider: local (email/password), google, facebook, etc.',
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
    description: 'Provider user ID (for OAuth providers)',
    required: false
  })
  @IsString()
  @IsOptional()
  providerId?: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'Program ID to immediately register for (e.g. IYS 2026)',
    required: false
  })
  @IsUUID()
  @IsOptional()
  programId?: string;
}
