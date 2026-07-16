import {
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  IsEnum,
  IsNotEmpty,
  ValidateNested,
  ArrayMaxSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { HelpAssetDto, HELP_ASSETS_MAX } from './help-asset.dto';

export enum FormFieldType {
  TEXT = 'text',
  TEXTAREA = 'textarea',
  SELECT = 'select',
  RADIO = 'radio',
  CHECKBOX = 'checkbox',
  FILE = 'file',
  DATE = 'date',
  EMAIL = 'email',
  PHONE = 'phone',
  URL = 'url',
}

export class CreateApplicationFormFieldDto {
  @ApiPropertyOptional({ description: 'Form section identifier' })
  @IsOptional()
  @IsString()
  section?: string;

  @ApiPropertyOptional({ description: 'Custom-field storage key. Required when source=custom. Ignored when source=system.' })
  @IsOptional()
  @IsString()
  fieldName?: string;

  @ApiProperty({ description: 'Label displayed to the user' })
  @IsString()
  @IsNotEmpty()
  label!: string;

  @ApiPropertyOptional({ description: 'Placeholder text' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text / tooltip' })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiPropertyOptional({ description: 'Optional supporting media URL shown with the field' })
  @IsOptional()
  @IsString()
  mediaUrl?: string;

  @ApiPropertyOptional({ description: 'Alt text for the supporting media' })
  @IsOptional()
  @IsString()
  mediaAlt?: string;

  @ApiPropertyOptional({
    description: `Structured guidance items shown with the field (example links, tutorial videos, downloadable templates). Max ${HELP_ASSETS_MAX}.`,
    type: [HelpAssetDto],
  })
  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HelpAssetDto)
  @ArrayMaxSize(HELP_ASSETS_MAX)
  helpAssets?: HelpAssetDto[];

  @ApiProperty({ enum: FormFieldType, description: 'Type of the input field' })
  @IsEnum(FormFieldType)
  fieldType!: FormFieldType;

  @ApiPropertyOptional({ description: 'Is this field required?' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({
    description:
      'Options for select/radio/checkbox (raw JSON). Supports string arrays and label/value object arrays.',
  })
  @IsOptional()
  options?: unknown;

  @ApiPropertyOptional({ description: 'Validation rules (JSON)' })
  @IsOptional()
  validationRules?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Default value' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ description: 'Order of the field' })
  @IsOptional()
  @IsNumber()
  order?: number;

  @ApiPropertyOptional({ description: "Field source: 'system' | 'custom'. Defaults to 'custom'." })
  @IsOptional()
  @IsString()
  source?: 'system' | 'custom';

  @ApiPropertyOptional({ description: 'When source=system, the system catalog key this field references.' })
  @IsOptional()
  @IsString()
  systemFieldKey?: string;
}
