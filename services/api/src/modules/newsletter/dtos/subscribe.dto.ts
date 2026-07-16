
import { IsEmail, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class SubscribeNewsletterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({ example: 'John Doe', description: 'User name', required: false })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiProperty({ example: 'footer', description: 'Source of subscription', required: false })
  @IsString()
  @IsOptional()
  source?: string;
}

export class UnsubscribeNewsletterDto {
  @ApiProperty({ example: 'user@example.com', description: 'User email address' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  email: string;
}
