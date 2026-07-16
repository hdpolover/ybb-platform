import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class ResendVerificationDto {
  @ApiProperty({ example: 'user@example.com' })
  @NormalizeEmail()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'uuid-of-brand', required: false })
  @IsOptional()
  @IsString()
  brandId?: string;
}
