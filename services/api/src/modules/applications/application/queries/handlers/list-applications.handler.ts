import { Injectable, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { ListApplicationsQuery } from '../list-applications.query';
import { ApplicationListResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';

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
  ) {}

  async execute(query: ListApplicationsQuery): Promise<ApplicationListResponseDto> {
    let result: { applications: any[]; total: number };

    // Route to appropriate repository method based on filters
    if (query.filters.brandId) {
      result = await this.applicationRepository.findByBrand(
        query.filters.brandId,
        {
          programId: query.filters.programId,
          status: query.filters.status,
          limit: query.filters.limit,
          offset: query.filters.offset,
        },
      );
    } else if (query.filters.programId) {
      result = await this.applicationRepository.findByProgram(
        query.filters.programId,
        {
          status: query.filters.status,
          search: query.filters.search,
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

    return {
      applications: result.applications.map(app => this.applicationMapper.toDto(app)),
      total: result.total,
      page: query.filters.offset ? Math.floor(query.filters.offset / (query.filters.limit || 10)) + 1 : 1,
      limit: query.filters.limit,
    };
  }
}
