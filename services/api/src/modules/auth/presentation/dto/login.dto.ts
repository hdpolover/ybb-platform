import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'user@example.com',
    description: 'The registered email address of the user.'
  })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'The user\'s password.'
  })
  @IsString()
  @IsNotEmpty()
  password: string;

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
    description: 'The UUID of the current program context. When provided, login can auto-link the participant to this program if registration is open.',
    required: false,
  })
  @IsUUID()
  @IsOptional()
  programId?: string;

  @ApiProperty({
    example: 'iys-2026',
    description: 'The slug of the current program context. Used when a program UUID is not provided.',
    required: false,
  })
  @IsString()
  @IsOptional()
  programSlug?: string;
}
