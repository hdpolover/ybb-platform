// services/api/src/modules/applications/application/dto/application-review-response.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ScoringStage } from '@prisma/client';
import { RubricDto } from '@modules/programs/presentation/dto/scoring-rubric.dto';
import { GateState } from '@modules/scoring/domain/scoring-calculation';

export class ApplicationScoreItemDto {
  @ApiProperty()
  criterionId!: string;

  @ApiProperty()
  score!: number;

  @ApiPropertyOptional({ nullable: true })
  notes?: string | null;
}

export class ApplicationReviewResponseDto {
  @ApiPropertyOptional({ nullable: true, description: 'Null until the first draft is saved.' })
  id!: string | null;

  @ApiProperty()
  applicationId!: string;

  @ApiProperty({ enum: ScoringStage })
  stage!: ScoringStage;

  @ApiProperty({ description: 'The schema this review is pinned to (its own version once created, otherwise the current active one).' })
  schemaId!: string;

  @ApiProperty()
  schemaVersion!: number;

  @ApiProperty({ enum: ['draft', 'submitted'] })
  status!: 'draft' | 'submitted';

  @ApiProperty()
  totalScore!: number;

  @ApiPropertyOptional({ nullable: true })
  notes!: string | null;

  // Named scoreItems, NOT items, deliberately. The global TransformInterceptor treats any
  // response object with an `items` array as a paginated-list envelope and shreds it: the
  // array becomes `data` and every other field (rubric, gate, totalScore, ...) gets moved
  // into `meta`. That collision broke GET/PUT :applicationId/review in production. Do not
  // rename this back to `items` without also fixing the interceptor's heuristic.
  @ApiProperty({ type: () => ApplicationScoreItemDto, isArray: true })
  scoreItems!: ApplicationScoreItemDto[];

  @ApiProperty({ type: () => RubricDto })
  rubric!: RubricDto;

  @ApiProperty({ description: 'Whether this stage is scoreable right now, and why.' })
  gate!: GateState;

  @ApiProperty()
  hasNewerRubricVersion!: boolean;
}
