import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { GetApplicationQuery } from '../get-application.query';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';

/**
 * Get Application Handler
 * 
 * Application Layer - Query Handler
 * Handles retrieval of single application
 */
@Injectable()
export class GetApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
  ) {}

  async execute(query: GetApplicationQuery): Promise<ApplicationResponseDto> {
    const application = await this.applicationRepository.findById(query.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${query.applicationId} not found`);
    }

    return this.applicationMapper.toDto(application, query.includeRelations);
  }
}
