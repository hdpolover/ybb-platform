import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { UpdateApplicationCommand } from '../update-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';

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
      application.applicationCategory = command.updates.applicationCategory as any;
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

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }
}
