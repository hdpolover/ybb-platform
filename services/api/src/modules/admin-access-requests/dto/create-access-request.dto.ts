// services/api/src/modules/admin-access-requests/dto/create-access-request.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsEmail, IsIn, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';
import { ADMIN_DIVISION_KEYS } from '../admin-divisions';

const trim = () => Transform(({ value }) => (typeof value === 'string' ? value.trim() : value));

export class CreateAccessRequestDto {
  @ApiProperty({ minLength: 2, maxLength: 100 })
  @trim()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName: string;

  @ApiProperty()
  @NormalizeEmail()
  @IsEmail()
  @MaxLength(255)
  email: string;

  @ApiPropertyOptional({ maxLength: 30 })
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(30)
  whatsapp?: string;

  @ApiProperty({ enum: ADMIN_DIVISION_KEYS })
  @IsIn(ADMIN_DIVISION_KEYS)
  division: string;

  @ApiProperty({ type: [String], maxItems: 30 })
  @IsArray()
  @ArrayMaxSize(30)
  @IsUUID('all', { each: true })
  programIds: string[];

  @ApiPropertyOptional({ maxLength: 1000 })
  @IsOptional()
  @trim()
  @IsString()
  @MaxLength(1000)
  note?: string;

  // Accepted for contract compatibility; TurnstileGuard reads it (header or this field).
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2048)
  turnstileToken?: string;
}
