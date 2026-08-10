// services/api/src/modules/programs/presentation/program-scoring.controller.ts
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
import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
import { UserRole } from '@core/entities/user.entity';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { GetScoringRubricVersionsHandler } from '../application/queries/handlers/get-scoring-rubric-versions.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { GetScoringRubricVersionsQuery } from '../application/queries/get-scoring-rubric-versions.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import {
  UpsertScoringRubricDto,
  ScoringRubricsResponseDto,
  RubricDto,
  RubricVersionSummaryDto,
} from './dto/scoring-rubric.dto';

@ApiTags('Scoring Rubrics')
@Controller('programs')
export class ProgramScoringController {
  constructor(
    private readonly getScoringRubricsHandler: GetScoringRubricsHandler,
    private readonly getScoringRubricVersionsHandler: GetScoringRubricVersionsHandler,
    private readonly upsertScoringRubricHandler: UpsertScoringRubricHandler,
  ) {}

  private parseVersion(raw?: string): number | undefined {
    if (raw === undefined) return undefined;
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 1) {
      throw new BadRequestException('version must be a positive integer.');
    }
    return parsed;
  }

  private parseStage(stageParam: string): ScoringStage {
    if (stageParam !== ScoringStage.application && stageParam !== ScoringStage.interview) {
      throw new BadRequestException(`Invalid stage "${stageParam}". Must be "application" or "interview".`);
    }
    return stageParam;
  }

  @Get(':programId/scoring-rubrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get scoring rubrics for a program (application and interview stages)' })
  async getScoringRubrics(
    @Param('programId') programId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage, { optional: true })) stage?: ScoringStage,
    @Query('version') versionRaw?: string,
  ): Promise<ScoringRubricsResponseDto> {
    const version = this.parseVersion(versionRaw);
    return this.getScoringRubricsHandler.execute(new GetScoringRubricsQuery(programId, stage, version));
  }

  // NOTE: this literal-segment route MUST stay registered ahead of any
  // future ':programId/scoring-rubrics/:stage' GET route on this controller.
  // NestJS resolves same-method routes in registration order, and a
  // parameterized :stage route registered first would swallow "versions"
  // as its param value, silently mis-dispatching this endpoint. Today
  // there is no GET :stage route to collide with (the only :stage route
  // is the PUT below, a different HTTP method), but keep this one declared
  // before any GET :stage sibling if one is ever added.
  @Get(':programId/scoring-rubrics/versions')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List every version of a program/stage rubric, newest first, flagging versions with submitted reviews' })
  async getScoringRubricVersions(
    @Param('programId') programId: string,
    @Query('stage', new ParseEnumPipe(ScoringStage)) stage: ScoringStage,
  ): Promise<RubricVersionSummaryDto[]> {
    return this.getScoringRubricVersionsHandler.execute(
      new GetScoringRubricVersionsQuery(programId, stage),
    );
  }

  @Put(':programId/scoring-rubrics/:stage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Mint a new rubric version for a stage (super admin only)' })
  async upsertScoringRubric(
    @Param('programId') programId: string,
    @Param('stage') stageParam: string,
    @Body() dto: UpsertScoringRubricDto,
    @CurrentUser() user: CurrentUserData,
  ): Promise<RubricDto> {
    const stage = this.parseStage(stageParam);

    // createdById MUST come from the authenticated principal (JWT), never
    // from client-supplied body input, even if a client stuffs a
    // createdById field into the raw request body. UpsertScoringRubricDto
    // has no createdById property, so it cannot flow through dto.* here.
    return this.upsertScoringRubricHandler.execute(
      new UpsertScoringRubricCommand(
        programId,
        stage,
        {
          name: dto.name,
          description: dto.description,
          passThreshold: dto.passThreshold,
          categories: dto.categories.map((cat) => ({
            name: cat.name,
            description: cat.description,
            weight: cat.weight,
            order: cat.order,
            criteria: cat.criteria.map((crit) => ({
              name: crit.name,
              description: crit.description,
              weight: crit.weight,
              maxScore: crit.maxScore,
              order: crit.order,
            })),
          })),
        },
        user.userId,
      ),
    );
  }
}
