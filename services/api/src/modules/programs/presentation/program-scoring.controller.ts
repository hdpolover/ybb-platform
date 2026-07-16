import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
  ParseEnumPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringStage } from '@prisma/client';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import {
  UpsertScoringRubricDto,
  ScoringRubricsResponseDto,
  RubricDto,
} from './dto/scoring-rubric.dto';

@ApiTags('Scoring Rubrics')
@Controller('programs')
export class ProgramScoringController {
  constructor(
    private readonly getScoringRubricsHandler: GetScoringRubricsHandler,
    private readonly upsertScoringRubricHandler: UpsertScoringRubricHandler,
  ) {}

  @Get(':programId/scoring-rubrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get scoring rubrics for a program (application and interview stages)' })
  async getScoringRubrics(
    @Param('programId') programId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage, { optional: true })) stage?: ScoringStage,
  ): Promise<ScoringRubricsResponseDto> {
    return this.getScoringRubricsHandler.execute(new GetScoringRubricsQuery(programId, stage));
  }

  @Put(':programId/scoring-rubrics/:stage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert the full rubric for a stage (super admin only)' })
  async upsertScoringRubric(
    @Param('programId') programId: string,
    @Param('stage') stageParam: string,
    @Body() dto: UpsertScoringRubricDto,
  ): Promise<RubricDto> {
    const stage = stageParam as ScoringStage;
    if (stage !== ScoringStage.application && stage !== ScoringStage.interview) {
      throw new BadRequestException(`Invalid stage "${stageParam}". Must be "application" or "interview".`);
    }

    // The DTO already validates fractions (0-1 range).
    // The frontend API client is responsible for any percentage-to-fraction conversion.
    return this.upsertScoringRubricHandler.execute(
      new UpsertScoringRubricCommand(programId, stage, {
        name: dto.name,
        description: dto.description,
        categories: dto.categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          weight: cat.weight,
          order: cat.order,
          criteria: cat.criteria.map((crit) => ({
            id: crit.id,
            name: crit.name,
            description: crit.description,
            weight: crit.weight,
            maxScore: crit.maxScore,
            order: crit.order,
          })),
        })),
      }),
    );
  }
}
