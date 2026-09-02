import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MinLength } from 'class-validator';

export class LinkLocalIdentityDto {
  @ApiProperty({
    example: 'password123',
    minLength: 8,
    description: 'The password to set for email & password sign-in on the current account.',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  // Kept in sync with RegisterDto and ybb-program-next/lib/auth/passwordRules.ts.
  @Matches(/^(?=.*[A-Z])(?=.*[a-z])(?=.*[\d\W]).+$/, {
    message: 'Password must contain uppercase, lowercase, number/special character',
  })
  password: string;
}
