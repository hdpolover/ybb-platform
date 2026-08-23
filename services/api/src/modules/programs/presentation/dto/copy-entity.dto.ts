// services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

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
