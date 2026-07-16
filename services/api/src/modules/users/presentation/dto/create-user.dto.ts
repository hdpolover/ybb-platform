import { IsEmail, IsString, MinLength, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class CreateUserDto {
  @ApiProperty({
    example: '123e4567-e89b-12d3-a456-426614174000',
    description: 'The UUID of the brand/program category.'
  })
  @IsString()
  @IsNotEmpty()
  brandId: string;

  @ApiProperty({
    example: 'john@example.com',
    description: 'The user\'s email address.'
  })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({
    example: 'Password123!',
    minLength: 8,
    description: 'The user\'s password (min 8 characters).'
  })
  @IsString()
  @MinLength(8)
  password: string;
}
