import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class ApplyFormTemplateDto {
  @ApiProperty({ description: 'Template to apply.' })
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({
    description: 'Required true when mode=replace to guard against accidents.',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
