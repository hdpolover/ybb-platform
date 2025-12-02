import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { WithdrawApplicationCommand } from '../withdraw-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';

/**
 * Withdraw Application Handler
 * 
 * Application Layer - Command Handler
 * Handles business logic for withdrawing applications
 */
@Injectable()
export class WithdrawApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
  ) {}

  async execute(command: WithdrawApplicationCommand): Promise<ApplicationResponseDto> {
    // Find application
    const application = await this.applicationRepository.findById(command.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    // Business rule: Can only withdraw in certain statuses
    if (!application.canWithdraw()) {
      throw new BadRequestException(
        `Cannot withdraw application in ${application.status} status`,
      );
    }

    // Withdraw application
    application.withdraw(command.userId);
    application.addStatusToHistory(application.status, command.userId, 'Application withdrawn');

    // Save to database
    const updated = await this.applicationRepository.update(application);

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }
}
