// services/api/src/modules/readiness/presentation/dto/create-override.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsISO8601, IsOptional, IsString, IsUUID, MaxLength, MinLength } from 'class-validator';

export class CreateOverrideDto {
  @ApiProperty({ enum: ['brand', 'program'] })
  @IsIn(['brand', 'program'])
  subjectType: 'brand' | 'program';

  @ApiProperty()
  @IsUUID()
  subjectId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(100)
  ruleId: string;

  // A required, substantive reason is the whole point of the audit trail. Ten
  // characters is enough to stop "ok" without demanding an essay.
  @ApiProperty({ minLength: 10 })
  @IsString()
  @MinLength(10)
  @MaxLength(1000)
  reason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsISO8601()
  expiresAt?: string;
}
