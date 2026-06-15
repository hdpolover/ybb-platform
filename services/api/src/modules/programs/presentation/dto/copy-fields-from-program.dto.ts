import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CopyFieldsFromProgramDto {
  @ApiProperty({ description: 'Program to copy fields FROM.' })
  @IsUUID()
  sourceProgramId!: string;

  @ApiPropertyOptional({
    description: 'Specific source field ids to copy. Omit to copy all active fields.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  fieldIds?: string[];

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({
    description: "Must be true when mode='replace' to guard against accidental field deletion.",
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
