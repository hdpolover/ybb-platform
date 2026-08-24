// services/api/src/modules/programs/presentation/dto/content-template.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateContentTemplateDto {
  @ApiProperty({ description: "Must match a registered ProgramCopier.key, e.g. 'faqs'." })
  @IsString()
  entityType!: string;

  @ApiProperty({ description: 'Program to export the template payload from.' })
  @IsUUID()
  programId!: string;

  @ApiPropertyOptional({ description: 'Specific source item ids to export. Omit to export all.', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itemIds?: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateContentTemplateDto {
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
  @IsBoolean()
  isDefault?: boolean;
}

export class ContentTemplateSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string | null;
  @ApiProperty() entityType!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ContentTemplateDetailDto extends ContentTemplateSummaryDto {
  @ApiProperty({ description: 'The full stored TemplatePayload.' })
  payload!: { entityType: string; payloadVersion: number; items: Record<string, unknown>[] };
}
