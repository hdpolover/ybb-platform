import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  Matches,
  MaxLength,
} from 'class-validator';

export class CreateSystemFormFieldDto {
  @ApiProperty({
    description:
      'Internal key. Lowercase, digits, underscores; must start with a letter; max 64 chars.',
  })
  @IsString()
  @Matches(/^[a-z][a-z0-9_]{0,63}$/)
  @MaxLength(64)
  key!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  label!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  category!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(32)
  type!: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  defaultOptions?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;
}

export class UpdateSystemFormFieldDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(32)
  type?: string;

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  defaultOptions?: unknown[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;
}
