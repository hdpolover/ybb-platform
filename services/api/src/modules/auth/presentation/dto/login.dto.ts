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
  programCategoryId?: string;
}
