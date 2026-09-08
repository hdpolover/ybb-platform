// services/api/src/modules/readiness/presentation/dto/readiness-report.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { RuleStatus, ReadinessSeverity } from '../../domain/readiness-rule.types';

export class RuleFixDto {
  @ApiProperty()
  label: string;

  @ApiProperty()
  href: string;
}

export class RuleResultDto {
  @ApiProperty()
  ruleId: string;

  @ApiProperty({ enum: ['BLOCKER', 'WARNING', 'INFO'] })
  severity: ReadinessSeverity;

  @ApiProperty({ enum: ['pass', 'fail', 'overridden', 'unknown'] })
  status: RuleStatus;

  @ApiProperty()
  title: string;

  @ApiProperty()
  symptom: string;

  @ApiProperty({ type: RuleFixDto })
  fix: RuleFixDto;

  @ApiProperty({ required: false })
  overrideReason?: string;

  @ApiProperty({ required: false })
  overrideExpired?: boolean;
}

export class ReadinessReportDto {
  @ApiProperty({ type: [RuleResultDto] })
  results: RuleResultDto[];

  @ApiProperty()
  blockerCount: number;

  @ApiProperty()
  warningCount: number;

  @ApiProperty()
  unknownCount: number;

  @ApiProperty()
  isReady: boolean;

  @ApiProperty()
  evaluatedAt: Date;
}
