import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { ReviewApplicationCommand } from '../review-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';

/**
 * Review Application Handler
 * 
 * Application Layer - Command Handler
 * Handles business logic for reviewing applications (accept/reject/waitlist)
 */
@Injectable()
export class ReviewApplicationHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly cacheService: CacheService,
  ) {}

  async execute(command: ReviewApplicationCommand): Promise<ApplicationResponseDto> {
    // Find application
    const application = await this.applicationRepository.findById(command.applicationId);

    if (!application) {
      throw new NotFoundException(`Application ${command.applicationId} not found`);
    }

    // Business rule: Can only review applications in reviewable states
    if (!application.canReview()) {
      throw new BadRequestException(
        `Cannot review application in ${application.status} status`,
      );
    }

    // Apply review based on status
    switch (command.status) {
      case ApplicationStatus.ACCEPTED:
        application.accept(command.reviewerId, command.reviewerNotes);
        break;

      case ApplicationStatus.REJECTED:
        application.reject(command.reviewerId, command.reviewerNotes);
        break;

      case ApplicationStatus.WAITLISTED:
        application.waitlist();
        application.reviewedBy = command.reviewerId;
        application.reviewedAt = new Date();
        application.reviewerNotes = command.reviewerNotes;
        break;

      case ApplicationStatus.INTERVIEW_SCHEDULED:
        application.scheduleInterview();
        application.reviewedBy = command.reviewerId;
        application.reviewedAt = new Date();
        application.reviewerNotes = command.reviewerNotes;
        break;

      case ApplicationStatus.UNDER_REVIEW:
        application.moveToReview();
        break;

      default:
        throw new BadRequestException(`Invalid status for review: ${command.status}`);
    }

    // Update score if provided
    if (command.scoreTotal !== undefined && command.scoreBreakdown && command.scoreStatus) {
      application.updateScore(command.scoreTotal, command.scoreBreakdown, command.scoreStatus);
    }

    // Add to status history
    application.addStatusToHistory(
      command.status,
      command.reviewerId,
      command.reviewerNotes || 'Application reviewed',
    );

    // ========================================
    // CRITICAL: Use Transaction for Atomicity
    // Application update and related operations must succeed together
    // ========================================
    const updated = await this.applicationRepository.update(application);
    // Note: Repository should implement transaction support internally
    // For multi-repository operations, wrap in controller or use application service

    // Invalidate portal cache for the participant
    // When admin reviews, the participant should see status change immediately
    await this.invalidateParticipantCache(application.participantId);

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }

  /**
   * Invalidate portal cache for participant when their application is reviewed
   */
  private async invalidateParticipantCache(participantId: string): Promise<void> {
    try {
      // Fetch participant to get userId for cache invalidation
      const participant = await this.applicationRepository['prisma'].participant.findUnique({
        where: { id: participantId },
        select: { userId: true }
      });
      
      if (!participant) return;
      
      const patterns = [
        CACHE_KEYS.PORTAL_DASHBOARD(participant.userId),
        CACHE_KEYS.PORTAL_SUBMISSIONS(participant.userId),
        CACHE_KEYS.PORTAL_PAYMENTS(participant.userId),
        CACHE_KEYS.PORTAL_DOCUMENTS(participant.userId),
      ];

      await Promise.all(patterns.map(key => this.cacheService.invalidateKey(key)));
    } catch (error) {
      // Log but don't throw - cache invalidation failures shouldn't break the review
      console.error(`Failed to invalidate cache for participant ${participantId}:`, error);
    }
  }
}
