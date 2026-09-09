import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { UpdateApplicationCommand } from '../update-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { invalidateParticipantPortalCache } from '@shared/utils/invalidate-participant-portal-cache.util';

/**
 * Update Application Handler
 *
 * Application Layer - Command Handler
 * Handles business logic for updating applications
 */
@Injectable()
export class UpdateApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly cacheService: CacheService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(command: UpdateApplicationCommand): Promise<ApplicationResponseDto> {
    // Find application
    const application = await this.applicationRepository.findById(command.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    // Business rule: Can only edit drafts
    if (!application.canEdit()) {
      throw new BadRequestException(
        `Cannot edit application in ${application.status} status. Only drafts can be edited.`,
      );
    }

    // Apply updates
    if (command.updates.applicationCategory) {
      application.applicationCategory = command.updates.applicationCategory as ApplicationCategory;
    }
    if (command.updates.motivationLetter !== undefined) {
      application.motivationLetter = command.updates.motivationLetter;
    }
    if (command.updates.achievements !== undefined) {
      application.achievements = command.updates.achievements;
    }
    if (command.updates.experiences !== undefined) {
      application.experiences = command.updates.experiences;
    }
    if (command.updates.documents) {
      application.documents = command.updates.documents;
    }
    if (command.updates.requirementFiles) {
      application.requirementFiles = command.updates.requirementFiles;
    }
    if (command.updates.twibbonLink !== undefined) {
      application.twibbonLink = command.updates.twibbonLink;
    }
    if (command.updates.pricingTierId !== undefined) {
      application.pricingTierId = command.updates.pricingTierId;
    }

    // Save to database
    const updated = await this.applicationRepository.update(application);

    // This route (PUT /applications/:id) is admin-only, so the participant's
    // portal cache must be busted by looking up their real userId rather than
    // via the (removed) @CacheInvalidate(['portal:*:${userId}']) decorator,
    // which resolved to the acting admin's own JWT id and never matched a
    // real key (audit M103/M120). Without this, an admin edit to a draft
    // left the participant's portal showing stale data for the full TTL.
    await invalidateParticipantPortalCache(this.prisma, this.cacheService, application.participantId);

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }
}
