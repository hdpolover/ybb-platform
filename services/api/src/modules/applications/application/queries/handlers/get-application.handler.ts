import { Injectable, NotFoundException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { GetApplicationQuery } from '../get-application.query';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '@shared/constants/cache-keys';

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
    private readonly cacheService: CacheService,
  ) { }

  async execute(query: GetApplicationQuery): Promise<ApplicationResponseDto> {
    // Only cache if not including relations (simpler caching)
    const cacheKey = query.includeRelations
      ? null
      : CACHE_KEYS.APPLICATION(query.applicationId);

    // Check cache first (if applicable)
    if (cacheKey) {
      const cached = await this.cacheService.get<ApplicationResponseDto>(cacheKey);
      if (cached) {
        return cached;
      }
    }

    // Fetch from database
    const application = await this.applicationRepository.findById(query.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${query.applicationId} not found`);
    }

    const dto = this.applicationMapper.toDto(application, query.includeRelations);

    // Cache for 2 minutes (if applicable)
    if (cacheKey) {
      await this.cacheService.set(cacheKey, dto, CACHE_TTL.SHORT);
    }

    return dto;
  }
}

