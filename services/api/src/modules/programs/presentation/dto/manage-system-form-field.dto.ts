import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsString,
  IsBoolean,
  IsOptional,
  IsNumber,
  Matches,
  MaxLength,
} from 'class-validator';
import { Transform, plainToInstance } from 'class-transformer';

// Field option choice. Shape evidenced directly by the live producer,
// SystemFieldFormModal.tsx: `cleanedOptions = options.map((o) => ({ label:
// o.label.trim(), value: (o.value || o.label).trim() }))`. Legacy plain
// strings are also real (see get-application-form-fields.handler.ts
// normalizeOptions(), which reads historical rows of this same shape), so
// this stays a union rather than a single strict class.
export class SystemFormFieldOptionDto {
  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsString()
  value: string;
}

// Converts each array element without letting class-transformer's implicit
// conversion reconstruct object elements as `new Array()` (defaultOptions is
// declared `unknown[]`, so there is no element type for it to build from
// without this). Strings pass through untouched.
//
// Reads from `obj[key]` rather than destructuring `value`: class-transformer
// runs the implicit design:type conversion BEFORE invoking @Transform, so by
// the time a callback receives `value` it is already the corrupted
// `new Array()` result. `obj[key]` is the untouched source property and is
// the only way a @Transform callback can see the real payload here.
function toDefaultOptions({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const value = obj[key];
  if (!Array.isArray(value)) return value;
  return value.map((item) =>
    typeof item === 'string' || item === null || typeof item !== 'object' || Array.isArray(item)
      ? item
      : plainToInstance(SystemFormFieldOptionDto, item),
  );
}

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

  @ApiPropertyOptional({ description: '{ label, value } choices, or legacy plain strings', type: [SystemFormFieldOptionDto] })
  @IsOptional()
  @Transform(toDefaultOptions)
  defaultOptions?: Array<string | SystemFormFieldOptionDto>;

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

  @ApiPropertyOptional({ description: '{ label, value } choices, or legacy plain strings', type: [SystemFormFieldOptionDto] })
  @IsOptional()
  @Transform(toDefaultOptions)
  defaultOptions?: Array<string | SystemFormFieldOptionDto>;

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
