// services/api/src/modules/auth/presentation/dto/admin-forgot-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, MaxLength } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

export class AdminForgotPasswordDto {
  @ApiProperty({ example: 'admin@example.com' })
  @NormalizeEmail()
  @IsEmail()
  @IsNotEmpty()
  @MaxLength(254)
  email: string;
}
