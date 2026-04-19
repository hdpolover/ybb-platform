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
import { Type } from 'class-transformer';

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

  @ApiPropertyOptional({ type: 'array', items: { type: 'object' } })
  @IsOptional()
  options?: unknown[];

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
