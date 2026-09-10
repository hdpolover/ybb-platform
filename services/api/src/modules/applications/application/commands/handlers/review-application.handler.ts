import { Injectable, Logger, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { ApplicationStatus, ApplicationUpdateField } from '@core/entities/participant-application.entity';
import { ReviewApplicationCommand } from '../review-application.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { ReferralFunnelService } from '@modules/participants/application/services/referral-funnel.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { buildParticipantDocumentsUrl } from '@modules/payments/application/utils/participant-dashboard-url.util';
import { PrismaTransactionClient } from '@shared/types/prisma-transaction.type';
import { PaymentStatus } from '@prisma/client';

/**
 * Review Application Handler
 * 
 * Application Layer - Command Handler
 * Handles business logic for reviewing applications (accept/reject/waitlist)
 */
@Injectable()
export class ReviewApplicationHandler {
  private readonly logger = new Logger(ReviewApplicationHandler.name);

  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly applicationMapper: ApplicationMapper,
    private readonly cacheService: CacheService,
    private readonly referralFunnel: ReferralFunnelService,
    private readonly prisma: PrismaService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
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

    // Add to status history
    application.addStatusToHistory(
      command.status,
      command.reviewerId,
      reviewerNotes || 'Application reviewed',
    );

    // ========================================
    // CRITICAL: Use Transaction for Atomicity (audit M111)
    //
    // The review-status write and applyAcceptanceMode's side effects used to
    // be two separate, non-transactional statements. Between them, a payment
    // webhook could land and flip registrationPaymentStatus to paid/processing
    // - the ambassador branch of applyAcceptanceMode then unconditionally
    // overwrote it back to 'cancelled', silently discarding a real payment
    // (see assertAmbassadorAcceptanceAllowed above: it makes the SAME check
    // up front, but that read-then-later-write gap is exactly the race).
    //
    // applyAcceptanceModeTx is pure DB writes - no gRPC/HTTP/email call in
    // either branch (verified by reading it) - so, unlike a call to the
    // payment gateway, it is safe to hold inside one interactive transaction
    // alongside the review update. Do NOT extend this pattern to a handler
    // whose side effect makes network I/O; that would hold a DB
    // connection/lock for the duration of an external call.
    // ========================================
    const reviewFields: ApplicationUpdateField[] = [
      'status',
      'statusHistory',
      'reviewedBy',
      'reviewedAt',
      'reviewerNotes',
    ];
    const reviewPatch = this.applicationMapper.toPrismaUpdate(application, reviewFields);

    const updatedRow = await this.prisma.$transaction(async (tx) => {
      const row = await tx.participantApplication.update({
        where: { id: application.id },
        data: reviewPatch,
      });

      if (command.status === ApplicationStatus.ACCEPTED && command.approvalMode) {
        await this.applyAcceptanceModeTx(tx, command.applicationId, command.approvalMode);
      }

      return row;
    });

    const updated = this.applicationMapper.toDomain(updatedRow);

    // Invalidate portal cache for the participant
    // When admin reviews, the participant should see status change immediately
    await this.invalidateParticipantCache(application.participantId);

    // Advance referral funnel on acceptance
    if (command.status === ApplicationStatus.ACCEPTED) {
      await this.referralFunnel.advanceToAccepted(application.participantId, application.programId);

      // Fire-and-forget: notification.application_accepted only fires on a
      // genuine transition INTO accepted. canReview() (checked above, before
      // the switch) already excludes an application that is already
      // ACCEPTED, so this branch can never re-fire on a re-review of an
      // already-accepted application. Not awaited, and the method itself
      // swallows every error, so a notification failure can never fail the
      // review action that just committed.
      void this.emitApplicationAcceptedNotification(command.applicationId);
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

  private async applyAcceptanceModeTx(
    tx: PrismaTransactionClient,
    applicationId: string,
    approvalMode: 'participant' | 'ambassador',
  ): Promise<void> {
    if (approvalMode === 'participant') {
      await tx.participantApplication.update({
        where: { id: applicationId },
        data: { ticketStatus: 'regular' },
      });
      return;
    }

    // ticketStatus reflects the reviewer's decision and always applies.
    await tx.participantApplication.update({
      where: { id: applicationId },
      data: { ticketStatus: 'ambassador' },
    });

    // registrationPaymentStatus is the one field a payment webhook can be
    // writing concurrently (M111). updateMany's WHERE re-checks that status
    // hasn't already moved to paid/processing since assertAmbassadorAcceptanceAllowed's
    // read; if it has, this is a 0-row no-op instead of stomping a real
    // payment back to 'cancelled'. The invoice cancellation below is
    // unaffected either way - it already excludes paid/processing invoices.
    const guarded = await tx.participantApplication.updateMany({
      where: {
        id: applicationId,
        registrationPaymentStatus: { notIn: [PaymentStatus.paid, PaymentStatus.processing] },
      },
      data: { registrationPaymentStatus: 'cancelled' },
    });

    if (guarded.count === 0) {
      this.logger.warn(
        `Ambassador acceptance for application ${applicationId}: registrationPaymentStatus left untouched - ` +
          'a payment was already paid/processing (webhook race). ticketStatus was still set to ambassador.',
      );
    }

    await tx.applicationInvoice.updateMany({
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
    });
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
        CACHE_KEYS.PARTICIPANT_PROFILE(userId),
        CACHE_KEYS.PARTICIPANT_STATS(participantId),
        CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
      ];

      await Promise.all([
        this.cacheService.invalidatePortalCache(userId),
        ...keys.map((key) => this.cacheService.invalidateKey(key)),
      ]);
    } catch (error) {
      // Log but don't throw - cache invalidation failures shouldn't break the review
      console.error(`Failed to invalidate cache for participant ${participantId}:`, error);
    }
  }

  /**
   * Best-effort emit of notification.application_accepted. Everything here —
   * the lookup and the publish — is inside one try/catch: this runs after
   * the review has already been committed, so nothing it does may ever
   * surface back to the caller as a failure.
   */
  private async emitApplicationAcceptedNotification(applicationId: string): Promise<void> {
    try {
      const record = await this.prisma.participantApplication.findUnique({
        where: { id: applicationId },
        select: {
          program: {
            select: {
              name: true,
              brandId: true,
              contactEmail: true,
              contactAddress: true,
              brand: { include: { settings: true } },
            },
          },
          participant: {
            select: { fullName: true, user: { select: { email: true } } },
          },
        },
      });

      const email = record?.participant?.user?.email;
      if (!record || !email) {
        this.logger.warn(
          `[application_accepted] skipping application ${applicationId}: no email on file`,
        );
        return;
      }

      const rawBrand = record.program?.brand ?? null;
      const brandPayload = rawBrand
        ? {
            name: rawBrand.name,
            primaryColor: rawBrand.primaryColor,
            logoUrl: rawBrand.logoUrl,
            websiteUrl: rawBrand.websiteUrl,
            contactEmail: record.program?.contactEmail ?? null,
            contactAddress: record.program?.contactAddress ?? null,
            socialMediaLinks: rawBrand.socialMediaLinks,
            settings: rawBrand.settings
              ? {
                  footerNavigation: rawBrand.settings.footerNavigation,
                  supportEmail: rawBrand.settings.supportEmail,
                }
              : null,
          }
        : null;

      await this.rabbitmqProducer.emit('notification.application_accepted', {
        email,
        customer_name: record.participant?.fullName ?? 'Participant',
        program_name: record.program?.name ?? '',
        application_id: applicationId,
        documents_url: buildParticipantDocumentsUrl(rawBrand),
        brand: brandPayload,
      });
    } catch (error) {
      this.logger.error(
        `[application_accepted] failed to emit for application ${applicationId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
