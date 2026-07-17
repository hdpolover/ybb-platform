import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, MinLength, Matches } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Password reset token received via email' })
  @IsString()
  @IsNotEmpty()
  token: string;

  @ApiProperty({ description: 'New password', minLength: 8 })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  // Kept in sync with ybb-program-next/lib/auth/passwordRules.ts. See the note
  // on RegisterDto.password for why the previous pattern was replaced.
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[\d\W]).+$/, {
    message: 'Password must contain uppercase, lowercase, number/special character',
  })
  password: string;
}
