import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { SubmitApplicationCommand } from '../submit-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

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
    private readonly metricsService: MetricsService,
    private readonly paymentClient: PaymentGrpcClient,
    private readonly cacheService: CacheService,
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

    // --- CHECK PAYMENT STATUS ---
    // Rule: Participant must have successfully PAID the 'registration' fee for this application
    // Exception: 'fully_funded' applicants do not pay registration fees.
    
    const isFullyFunded = application.applicationCategory === ApplicationCategory.FULLY_FUNDED;

    if (!isFullyFunded) {
      const payments = await this.paymentClient.getIntentsByReference({
        reference_type: 'application',
        reference_id: application.id,
      });

      // Check for any SUCCEEDED registration payment
      const hasPaidRegistration = payments.intents.some(intent => 
        intent.status === 'SUCCEEDED'
        && intent.metadata?.['payment_category'] === 'registration'
      );

      if (!hasPaidRegistration) {
         throw new BadRequestException('Registration fee must be paid (or verified) before submission.');
      }
    }

    // Submit application
    application.submit();
    application.addStatusToHistory(application.status, command.participantId, 'Application submitted');

    // Save to database
    const updated = await this.applicationRepository.update(application);

    // Record metric
    this.metricsService.applicationSubmittedTotal.inc({ brand: application.applicationCategory || 'unknown' });

    // Invalidate participant latest app cache
    if (updated.participant?.userId) {
      await this.invalidateParticipantCache(updated.participant.userId, application.participantId);
    }

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }

  private async invalidateParticipantCache(userId: string, participantId: string): Promise<void> {
    try {
      await this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId));
    } catch (error) {
      console.error(`Failed to invalidate cache for participant ${participantId}:`, error);
    }
  }
}
