import { Injectable, Inject } from '@nestjs/common';
import { ParticipantApplication } from '@core/entities/participant-application.entity';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { ListApplicationsQuery } from '../list-applications.query';
import { ApplicationListResponseDto, ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { hasValue } from '@modules/portal/application/services/submission-progress.util';

/**
 * List Applications Handler
 *
 * Application Layer - Query Handler
 * Handles retrieval of application list with filters
 */
@Injectable()
export class ListApplicationsHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly readPrisma: PrismaReadService,
  ) {}

  async execute(query: ListApplicationsQuery): Promise<ApplicationListResponseDto> {
    let result: { applications: ParticipantApplication[]; total: number };
    // Multi-program brand-scoped listing needs essay requirements grouped
    // per programId (see computeEssayFilled below) instead of a single
    // program's required-essay list.
    let isBrandScoped = false;

    // Route to appropriate repository method based on filters
    if (query.filters.brandId) {
      isBrandScoped = true;
      result = await this.applicationRepository.findByBrand(
        query.filters.brandId,
        {
          programId: query.filters.programId,
          status: query.filters.status,
          category: query.filters.category,
          search: query.filters.search,
          country: query.filters.country,
          registrationPaymentStatus: query.filters.registrationPaymentStatus,
          programPaymentStatus: query.filters.programPaymentStatus,
          scoreStatus: query.filters.scoreStatus,
          sortBy: query.filters.sortBy,
          sortOrder: query.filters.sortOrder,
          startDate: query.filters.startDate,
          endDate: query.filters.endDate,
          limit: query.filters.limit,
          offset: query.filters.offset,
        },
      );
    } else if (query.filters.programId && query.filters.participantId) {
      const application = await this.applicationRepository.findByParticipantAndProgram(
        query.filters.participantId,
        query.filters.programId,
      );
      result = { applications: application ? [application] : [], total: application ? 1 : 0 };
    } else if (query.filters.programId) {
      result = await this.applicationRepository.findByProgram(
        query.filters.programId,
        {
          status: query.filters.status,
          category: query.filters.category,
          search: query.filters.search,
          country: query.filters.country,
          registrationPaymentStatus: query.filters.registrationPaymentStatus,
          programPaymentStatus: query.filters.programPaymentStatus,
          scoreStatus: query.filters.scoreStatus,
          sortBy: query.filters.sortBy,
          sortOrder: query.filters.sortOrder,
          startDate: query.filters.startDate,
          endDate: query.filters.endDate,
          limit: query.filters.limit,
          offset: query.filters.offset,
        },
      );
    } else if (query.filters.participantId) {
      const applications = await this.applicationRepository.findByParticipant(
        query.filters.participantId,
      );
      result = { applications, total: applications.length };
    } else {
      // Default to empty result if no filters provided
      result = { applications: [], total: 0 };
    }

    const dtos = result.applications.map(app => this.applicationMapper.toDto(app));
    await this.attachEssayFilled(dtos, result.applications, isBrandScoped);

    return {
      applications: dtos,
      total: result.total,
      page: query.filters.offset ? Math.floor(query.filters.offset / (query.filters.limit || 10)) + 1 : 1,
      limit: query.filters.limit,
    };
  }

  /**
   * Computes `essayFilled` per application and mutates it onto the already-built
   * DTOs, in place. Fetches each distinct program's required essays ONCE per
   * request (never per row) via a single `programEssay.findMany` grouped by
   * programId — correct even for the brand-scoped path where a page of results
   * can span multiple programs, because each app is matched against its own
   * program's required-essay set rather than a single shared one.
   *
   * "filled" / "partial" / "empty" mirrors submission-progress.util's essay
   * completeness rule via the shared `hasValue()` helper. A program with zero
   * defined essays maps to "filled" — there is nothing outstanding to fill, and
   * it keeps the field a clean 3-state enum matching the admin UI's badge states.
   */
  private async attachEssayFilled(
    dtos: ApplicationResponseDto[],
    applications: ParticipantApplication[],
    isBrandScoped: boolean,
  ): Promise<void> {
    if (applications.length === 0) return;

    const programIds = [...new Set(applications.map(app => app.programId))];

    // Guard against a brand-scoped result set that (in principle) spans an
    // unexpectedly large number of programs — this stays a small, once-per-request
    // lookup either way, but we don't want it silently growing unbounded.
    if (isBrandScoped && programIds.length > 200) {
      return;
    }

    let requiredEssaysByProgram: Map<string, string[]>;
    try {
      const essays = await this.readPrisma.programEssay.findMany({
        where: { programId: { in: programIds }, isActive: true, isRequired: true },
        select: { id: true, programId: true },
      });
      requiredEssaysByProgram = new Map();
      for (const essay of essays) {
        const list = requiredEssaysByProgram.get(essay.programId) ?? [];
        list.push(essay.id);
        requiredEssaysByProgram.set(essay.programId, list);
      }
    } catch {
      // If the essay lookup fails, don't fail the whole list request over a
      // display-only derived field — leave essayFilled unset on every row.
      return;
    }

    for (let i = 0; i < applications.length; i++) {
      const app = applications[i];
      const requiredEssayIds = requiredEssaysByProgram.get(app.programId) ?? [];
      dtos[i].essayFilled = this.computeEssayFilled(requiredEssayIds, app.essayAnswers);
    }
  }

  private computeEssayFilled(
    requiredEssayIds: string[],
    essayAnswers: Record<string, unknown>,
  ): 'filled' | 'partial' | 'empty' {
    if (requiredEssayIds.length === 0) return 'filled';

    const filledCount = requiredEssayIds.filter(id => hasValue(essayAnswers?.[id])).length;
    if (filledCount === 0) return 'empty';
    if (filledCount === requiredEssayIds.length) return 'filled';
    return 'partial';
  }
}
