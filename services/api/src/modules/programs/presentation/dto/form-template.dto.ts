import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { Transform, Type, plainToInstance } from 'class-transformer';

// Field option choice. Shape evidenced by the live producers:
// OptionsRepeater.tsx / SystemFieldFormModal.tsx always send { label, value }
// objects. Legacy plain strings are also real (see
// get-application-form-fields.handler.ts normalizeOptions(), which reads
// historical rows of this same shape), so this stays a union rather than a
// single strict class.
export class FormFieldOptionDto {
  @ApiProperty()
  @IsString()
  label: string;

  @ApiProperty()
  @IsString()
  value: string;
}

// Converts each array element without letting class-transformer's implicit
// conversion reconstruct object elements as `new Array()` (options is
// declared `unknown[]`, so there is no element type for it to build from
// without this). Strings pass through untouched.
//
// Reads from `obj[key]` rather than destructuring `value`: class-transformer
// runs the implicit design:type conversion BEFORE invoking @Transform, so by
// the time a callback receives `value` it is already the corrupted
// `new Array()` result. `obj[key]` is the untouched source property and is
// the only way a @Transform callback can see the real payload here.
function toFieldOptions({ obj, key }: { obj: Record<string, unknown>; key: string }): unknown {
  const value = obj[key];
  if (!Array.isArray(value)) return value;
  return value.map((item) =>
    typeof item === 'string' || item === null || typeof item !== 'object' || Array.isArray(item)
      ? item
      : plainToInstance(FormFieldOptionDto, item),
  );
}

export class TemplateFieldInputDto {
  @ApiProperty({ enum: ['system', 'custom'] })
  @IsString()
  source!: 'system' | 'custom';

  @ApiPropertyOptional({ description: 'Required when source=system.' })
  @IsOptional()
  @IsString()
  systemFieldKey?: string;

  @ApiPropertyOptional({ description: 'Required when source=custom.' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  label?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ description: '{ label, value } choices, or legacy plain strings', type: [FormFieldOptionDto] })
  @IsOptional()
  @Transform(toFieldOptions)
  options?: Array<string | FormFieldOptionDto>;

  @ApiPropertyOptional()
  @IsOptional()
  validationRules?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  section?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  labelOverride?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  helpTextOverride?: string;
}

export class CreateFormTemplateDto {
  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiProperty({ type: [TemplateFieldInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldInputDto)
  fields!: TemplateFieldInputDto[];
}

export class UpdateFormTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(64)
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    type: [TemplateFieldInputDto],
    description: 'If provided, replaces all fields.',
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => TemplateFieldInputDto)
  fields?: TemplateFieldInputDto[];
}

export class FormTemplateFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() source!: string;
  @ApiProperty() systemFieldKey!: string | null;
  @ApiProperty() name!: string | null;
  @ApiProperty() label!: string | null;
  @ApiProperty() type!: string | null;
  @ApiProperty() section!: string;
  @ApiProperty() isRequired!: boolean;
  @ApiProperty() order!: number;
  @ApiProperty() labelOverride!: string | null;
  @ApiProperty() helpTextOverride!: string | null;
}

export class FormTemplateSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string | null;
  @ApiProperty() category!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() fieldCount!: number;
  @ApiProperty() updatedAt!: Date;
}

export class FormTemplateDetailDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string | null;
  @ApiProperty() category!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({ type: [FormTemplateFieldDto] }) fields!: FormTemplateFieldDto[];
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}
