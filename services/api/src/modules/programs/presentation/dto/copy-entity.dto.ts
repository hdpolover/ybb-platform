// services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class CopyEntityDto {
  @ApiProperty({ description: 'Program to copy items FROM.' })
  @IsUUID()
  sourceProgramId!: string;

  @ApiPropertyOptional({
    description: 'Specific source item ids to copy. Omit to copy all.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itemIds?: string[];

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({
    description: "Must be true when mode='replace' to guard against accidental data loss.",
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class ApplyTemplateEntityDto {
  @ApiProperty({ description: 'ContentTemplate id to apply.' })
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({ description: "Must be true when mode='replace' to guard against accidental data loss." })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}

export class CloneEntityInputDto {
  @ApiProperty({ description: "A registered ProgramCopier.key, e.g. 'faqs'." })
  @IsString()
  key!: string;

  @ApiProperty({ enum: ['append', 'replace'] })
  @IsIn(['append', 'replace'])
  mode!: 'append' | 'replace';
}

export class CloneFromProgramDto {
  @ApiProperty({ description: 'Program to clone content FROM. Same-brand only is enforced by the frontend picker; the API only requires it to differ from the target.' })
  @IsUUID()
  sourceProgramId!: string;

  @ApiProperty({ type: [CloneEntityInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloneEntityInputDto)
  entities!: CloneEntityInputDto[];

  @ApiPropertyOptional({ description: "Must be true if ANY entity in `entities` uses mode='replace'." })
  @IsOptional()
  @IsBoolean()
  confirmReplace?: boolean;
}
