import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { SubmitApplicationCommand } from '../submit-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';

/**
 * Submit Application Handler
 * 
 * Application Layer - Command Handler
 * Handles business logic for submitting applications
 */
@Injectable()
export class SubmitApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
  ) {}

  async execute(command: SubmitApplicationCommand): Promise<ApplicationResponseDto> {
    // Find application
    const application = await this.applicationRepository.findById(command.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    // Authorization: verify participant owns this application
    if (application.participantId !== command.participantId) {
      throw new BadRequestException('Unauthorized to submit this application');
    }

    // Business rule: Can only submit drafts
    if (!application.canSubmit()) {
      throw new BadRequestException(
        `Cannot submit application in ${application.status} status`,
      );
    }

    // TODO: Add validation - check required fields are filled
    // if (!application.motivationLetter || !application.achievements) {
    //   throw new BadRequestException('Missing required fields');
    // }

    // Submit application
    application.submit();
    application.addStatusToHistory(application.status, command.participantId, 'Application submitted');

    // Save to database
    const updated = await this.applicationRepository.update(application);

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }
}
