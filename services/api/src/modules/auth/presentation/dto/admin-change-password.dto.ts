// services/api/src/modules/auth/presentation/dto/admin-change-password.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { PASSWORD_PATTERN, PASSWORD_PATTERN_MESSAGE } from './reset-password.dto';

// bcrypt only reads the first 72 bytes; cap the input so a huge body never reaches the hasher.
const MAX_PASSWORD_LENGTH = 128;

export class AdminChangePasswordDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_PASSWORD_LENGTH)
  currentPassword: string;

  @ApiProperty({ minLength: 8, description: 'Same rules as the reset-password flow' })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(MAX_PASSWORD_LENGTH)
  @Matches(PASSWORD_PATTERN, { message: PASSWORD_PATTERN_MESSAGE })
  newPassword: string;
}
