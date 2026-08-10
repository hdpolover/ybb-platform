// services/api/src/modules/programs/application/queries/handlers/get-scoring-rubric-versions.handler.ts
import { Injectable, Inject } from '@nestjs/common';
import { IScoringRubricRepository } from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { GetScoringRubricVersionsQuery } from '../get-scoring-rubric-versions.query';
import { RubricVersionSummaryDto } from '../../../presentation/dto/scoring-rubric.dto';
import { resolveProgramId } from './get-scoring-rubrics.handler';

@Injectable()
export class GetScoringRubricVersionsHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
    @Inject('IProgramRepository')
    private readonly programRepo: IProgramRepository,
    private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetScoringRubricVersionsQuery): Promise<RubricVersionSummaryDto[]> {
    const programId = await resolveProgramId(this.programRepo, query.programId);
    const versions = await this.repo.findRubricHistory(programId, query.stage);

    if (versions.length === 0) return [];

    const schemaIds = versions.map((v) => v.id);
    const createdByIds = [
      ...new Set(versions.map((v) => v.createdById).filter((id): id is string => id !== null)),
    ];

    // One grouped count over ApplicationReview for the whole version list, not one query per version.
    const [admins, submittedCounts] = await Promise.all([
      createdByIds.length > 0
        ? this.prisma.admin.findMany({
            where: { id: { in: createdByIds } },
            select: { id: true, fullName: true },
          })
        : Promise.resolve<{ id: string; fullName: string }[]>([]),
      this.prisma.applicationReview.groupBy({
        by: ['schemaId'],
        where: { schemaId: { in: schemaIds }, status: 'submitted' },
        _count: { _all: true },
      }),
    ]);

    const nameById = new Map(admins.map((a) => [a.id, a.fullName]));
    const submittedSchemaIds = new Set(
      submittedCounts.filter((c) => c._count._all > 0).map((c) => c.schemaId),
    );

    return versions.map((v) => ({
      version: v.version,
      isActive: v.isActive,
      createdAt: v.createdAt.toISOString(),
      createdByName: v.createdById ? nameById.get(v.createdById) ?? null : null,
      hasSubmittedReviews: submittedSchemaIds.has(v.id),
    }));
  }
}
