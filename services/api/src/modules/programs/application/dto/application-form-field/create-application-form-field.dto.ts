import { IsBoolean, IsNotEmpty, IsNumber, IsOptional, IsString, IsEnum, IsJSON } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

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
  @ApiProperty({ description: 'Database field name (key)' })
  @IsString()
  @IsNotEmpty()
  fieldName: string;

  @ApiProperty({ description: 'Label displayed to the user' })
  @IsString()
  @IsNotEmpty()
  label: string;

  @ApiPropertyOptional({ description: 'Placeholder text' })
  @IsOptional()
  @IsString()
  placeholder?: string;

  @ApiPropertyOptional({ description: 'Help text / tooltip' })
  @IsOptional()
  @IsString()
  helpText?: string;

  @ApiProperty({ enum: FormFieldType, description: 'Type of the input field' })
  @IsEnum(FormFieldType)
  fieldType: FormFieldType;

  @ApiPropertyOptional({ description: 'Is this field required?' })
  @IsOptional()
  @IsBoolean()
  isRequired?: boolean;

  @ApiPropertyOptional({ description: 'Options for select/radio/checkbox (JSON)', type: 'array', items: { type: 'string' } })
  @IsOptional()
  options?: any;

  @ApiPropertyOptional({ description: 'Validation rules (JSON)' })
  @IsOptional()
  validationRules?: any;

  @ApiPropertyOptional({ description: 'Default value' })
  @IsOptional()
  @IsString()
  defaultValue?: string;

  @ApiPropertyOptional({ description: 'Order of the field' })
  @IsOptional()
  @IsNumber()
  order?: number;
}
