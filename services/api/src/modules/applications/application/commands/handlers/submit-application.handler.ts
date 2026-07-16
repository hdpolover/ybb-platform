import { Injectable, NotFoundException, BadRequestException, Inject, Logger } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { SubmitApplicationCommand } from '../submit-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { RegistrationFeeGateService } from '@modules/payments/application/services/registration-fee-gate.service';

/**
 * Submit Application Handler
 *
 * Application Layer - Command Handler
 * Handles business logic for submitting applications (admin/internal path).
 *
 * Registration fee applies to ALL participants regardless of application
 * category (fully_funded AND self_funded — reimbursement model). The gate
 * is enforced via the shared RegistrationFeeGateService so this path and
 * the portal submit path cannot diverge.
 */
@Injectable()
export class SubmitApplicationHandler {
  private readonly logger = new Logger(SubmitApplicationHandler.name);

  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly metricsService: MetricsService,
    private readonly cacheService: CacheService,
    private readonly referralFunnel: ReferralFunnelService,
    private readonly registrationFeeGate: RegistrationFeeGateService,
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

    // Registration fee gate: applies to ALL categories (no fully_funded bypass).
    // Uses the shared service so portal and admin paths enforce identical rules.
    await this.registrationFeeGate.assertRegistrationFeePaid(application.id);

    // Submit application
    application.submit();
    application.addStatusToHistory(application.status, command.participantId, 'Application submitted');

    // ========================================
    // CRITICAL: Use Transaction for Atomicity
    // Ensures application update is atomic with status history
    // ========================================
    const updated = await this.applicationRepository.update(application);
    // Note: Repository layer handles transaction for status history updates

    // Record metric
    this.metricsService.applicationSubmittedTotal.inc({ brand: application.applicationCategory || 'unknown' });

    // Invalidate participant latest app cache
    await this.invalidateParticipantCache(application.participantId);

    // Advance referral funnel: → applied
    await this.referralFunnel.advanceToApplied(application.participantId, application.programId);

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }

  private async invalidateParticipantCache(participantId: string): Promise<void> {
    try {
      await this.cacheService.invalidateKey(CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId));
    } catch (error) {
      this.logger.error(`Failed to invalidate cache for participant ${participantId}:`, error);
    }
  }
}
