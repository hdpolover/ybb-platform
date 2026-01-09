import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, IsUUID, MinLength, IsArray, IsOptional } from 'class-validator';

export class RegisterAdminDto {
  @ApiProperty({
    example: 'admin@example.com',
    description: 'The business email address for the admin account.'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    minLength: 8,
    description: 'The password for the admin account.'
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({
    example: 'John Doe',
    description: 'The full name of the administrator.'
  })
  @IsString()
  @IsNotEmpty()
  fullName: string;

  @ApiProperty({
    example: 'secret-key-123',
    description: 'The system secret key required to authorize admin registration.'
  })
  @IsString()
  @IsNotEmpty()
  secretKey: string;

  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The primary Program Category ID (home tenant) for this account.'
  })
  @IsUUID()
  @IsNotEmpty()
  programCategoryId: string;

  @ApiProperty({
    example: 'super_admin',
    description: 'The role slug to assign (e.g., "super_admin", "program_coordinator").'
  })
  @IsString()
  @IsNotEmpty()
  role: string;

  @ApiProperty({
    example: ['123e4567-e89b-12d3-a456-426614174000'],
    description: 'A list of additional Program Category IDs to grant multi-tenant access to.',
    required: false,
    type: [String]
  })
  @IsArray()
  @IsUUID('4', { each: true })
  @IsOptional()
  additionalCategoryIds?: string[];
}
