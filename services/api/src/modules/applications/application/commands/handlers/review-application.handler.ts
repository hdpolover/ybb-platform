import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { ReviewApplicationCommand } from '../review-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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
    private readonly referralFunnel: ReferralFunnelService,
    private readonly prisma: PrismaService,
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

    const reviewerNotes = this.buildReviewerNotes(command);
    if (command.status === ApplicationStatus.ACCEPTED && command.approvalMode === 'ambassador') {
      await this.assertAmbassadorAcceptanceAllowed(command.applicationId);
    }

    // Apply review based on status
    switch (command.status) {
      case ApplicationStatus.ACCEPTED:
        application.accept(command.reviewerId, reviewerNotes);
        break;

      case ApplicationStatus.REJECTED:
        application.reject(command.reviewerId, reviewerNotes);
        break;

      case ApplicationStatus.WAITLISTED:
        application.waitlist();
        application.reviewedBy = command.reviewerId;
        application.reviewedAt = new Date();
        application.reviewerNotes = reviewerNotes;
        break;

      case ApplicationStatus.INTERVIEW_SCHEDULED:
        application.scheduleInterview();
        application.reviewedBy = command.reviewerId;
        application.reviewedAt = new Date();
        application.reviewerNotes = reviewerNotes;
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
      reviewerNotes || 'Application reviewed',
    );

    // ========================================
    // CRITICAL: Use Transaction for Atomicity
    // Application update and related operations must succeed together
    // ========================================
    const updated = await this.applicationRepository.update(application);

    if (command.status === ApplicationStatus.ACCEPTED && command.approvalMode) {
      await this.applyAcceptanceMode(command.applicationId, command.approvalMode);
    }
    // Note: Repository should implement transaction support internally
    // For multi-repository operations, wrap in controller or use application service

    // Invalidate portal cache for the participant
    // When admin reviews, the participant should see status change immediately
    await this.invalidateParticipantCache(application.participantId);

    // Advance referral funnel on acceptance
    if (command.status === ApplicationStatus.ACCEPTED) {
      await this.referralFunnel.advanceToAccepted(application.participantId, application.programId);
    }

    // Return DTO
    return this.applicationMapper.toDto(updated);
  }

  private buildReviewerNotes(command: ReviewApplicationCommand): string | undefined {
    if (command.status !== ApplicationStatus.ACCEPTED || !command.approvalMode) {
      return command.reviewerNotes;
    }

    const suffix =
      command.approvalMode === 'ambassador'
        ? 'Accepted as ambassador'
        : 'Accepted as participant';

    if (!command.reviewerNotes?.trim()) {
      return suffix;
    }

    return `${command.reviewerNotes.trim()} (${suffix})`;
  }

  private async assertAmbassadorAcceptanceAllowed(applicationId: string): Promise<void> {
    const lockedInvoiceCount = await this.prisma.applicationInvoice.count({
      where: {
        applicationId,
        status: {
          in: ['processing', 'paid'],
        },
      },
    });

    if (lockedInvoiceCount > 0) {
      throw new BadRequestException(
        'Cannot accept this application as ambassador while a payment is processing or already paid.',
      );
    }
  }

  private async applyAcceptanceMode(
    applicationId: string,
    approvalMode: 'participant' | 'ambassador',
  ): Promise<void> {
    if (approvalMode === 'participant') {
      await this.prisma.participantApplication.update({
        where: { id: applicationId },
        data: { ticketStatus: 'regular' },
      });
      return;
    }

    await this.prisma.$transaction([
      this.prisma.participantApplication.update({
        where: { id: applicationId },
        data: {
          ticketStatus: 'ambassador',
          registrationPaymentStatus: 'cancelled',
        },
      }),
      this.prisma.applicationInvoice.updateMany({
        where: {
          applicationId,
          status: {
            in: ['unpaid', 'failed', 'cancelled'],
          },
        },
        data: {
          status: 'cancelled',
          rejectionReason: 'Accepted as ambassador',
        },
      }),
    ]);
  }

  /**
   * Invalidate portal cache for participant when their application is reviewed
   */
  private async invalidateParticipantCache(participantId: string): Promise<void> {
    try {
      // Fetch participant to get userId for cache invalidation
      const participant = await this.prisma.participant.findUnique({
        where: { id: participantId },
        select: { userId: true }
      });

      if (!participant) return;

      const userId = participant.userId;
      const keys = [
        CACHE_KEYS.PORTAL_DASHBOARD(userId),
        CACHE_KEYS.PORTAL_DOCUMENTS(userId),
        CACHE_KEYS.PARTICIPANT_PROFILE(userId),
        CACHE_KEYS.PARTICIPANT_STATS(participantId),
        CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
      ];
      const patterns = [
        `portal:submissions:${userId}:*`,
        `portal:submission-detail:${userId}:*`,
        `portal:payments:${userId}:*`,
      ];

      await Promise.all([
        ...keys.map((key) => this.cacheService.invalidateKey(key)),
        ...patterns.map((p) => this.cacheService.invalidateByPattern(p)),
      ]);
    } catch (error) {
      // Log but don't throw - cache invalidation failures shouldn't break the review
      console.error(`Failed to invalidate cache for participant ${participantId}:`, error);
    }
  }
}
