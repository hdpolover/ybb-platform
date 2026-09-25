import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { SwitchApplicationCategoryCommand } from '../switch-application-category.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { getCategoryRegistrationPhase } from '@shared/utils/tier-period.util';
import { PaymentStatus, Prisma } from '@prisma/client';

// Non-draft statuses eligible for the admin status-lock override (see step 2
// below). Judgement call: WITHDRAWN and REJECTED are deliberately excluded —
// both are terminal outcomes where the application is no longer live for
// this program, so reassigning its category is meaningless (WITHDRAWN) or
// re-opens a decision that has already been made (REJECTED). SUBMITTED,
// UNDER_REVIEW, INTERVIEW_SCHEDULED, WAITLISTED and ACCEPTED are all still
// "in flight" for the program, so an admin fixing a miscategorised applicant
// at any of those stages is a legitimate exception (the driving case is a
// paid, SUBMITTED applicant). There is no soft-delete/cancelled status on
// ParticipantApplication in this schema, so nothing further to exclude there.
const ADMIN_STATUS_OVERRIDE_ELIGIBLE_STATUSES = new Set<string>([
  ApplicationStatus.SUBMITTED,
  ApplicationStatus.UNDER_REVIEW,
  ApplicationStatus.INTERVIEW_SCHEDULED,
  ApplicationStatus.WAITLISTED,
  ApplicationStatus.ACCEPTED,
]);

@Injectable()
export class SwitchApplicationCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly applicationMapper: ApplicationMapper,
  ) {}

  async execute(command: SwitchApplicationCategoryCommand): Promise<ApplicationResponseDto> {
    const { applicationId, targetCategory } = command;

    // 1. Fetch Application with Invoices and Program Info
    const application = await this.prisma.participantApplication.findUnique({
      where: { id: applicationId },
      include: {
        invoices: {
          include: {
            pricingTier: {
              select: {
                feeType: true,
              },
            },
          },
        },
        program: {
          include: {
            pricingTiers: {
              include: {
                validityPeriods: { select: { startDate: true, endDate: true } },
              },
            },
          }
        },
        participant: {
          select: { userId: true },
        },
      }
    });

    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    // Ownership: a participant may only switch the category of their OWN
    // application. Without this, any authenticated user could switch another
    // participant's category by guessing the application id (IDOR).
    // An admin acting from the reviewer queue is not the applicant, so the
    // ownership rule cannot apply to them; without this branch the endpoint
    // 403s for every admin, which is what it did before.
    const actingAdminId = command.actingAdminId?.trim() || undefined;
    if (!actingAdminId && (!command.userId || application.participant?.userId !== command.userId)) {
      throw new ForbiddenException('You can only switch the category of your own application.');
    }

    // Shared admin-exception gate: every override below requires BOTH an
    // admin principal AND a non-empty stated reason. Participants can never
    // satisfy this (actingAdminId is only ever set for admin callers), so
    // participant behavior is unchanged regardless of what they pass as
    // overrideReason.
    const overrideReason = command.overrideReason?.trim() || undefined;
    const canAdminOverride = Boolean(actingAdminId && overrideReason);

    // 2. Validate Status
    // Category switch is only allowed while the application is still in the
    // draft/editing stage — a deliberate stakeholder rule for participants.
    // Admins get an audited exception: with a stated reason, they may switch
    // a non-draft application PROVIDED its status is one where a category
    // switch still makes sense (see ADMIN_STATUS_OVERRIDE_ELIGIBLE_STATUSES
    // above). Status itself is never changed by this handler — only category.
    if (application.status !== ApplicationStatus.DRAFT) {
      const statusEligibleForOverride = ADMIN_STATUS_OVERRIDE_ELIGIBLE_STATUSES.has(application.status);
      if (!canAdminOverride || !statusEligibleForOverride) {
        throw new BadRequestException(
          actingAdminId
            ? 'Cannot switch category after application has been submitted. Provide an overrideReason to switch anyway.'
            : 'Cannot switch category after application has been submitted.',
        );
      }
    }

    // 3. Validate Payments
    const switchLockedStatuses = new Set(['processing', 'paid']);
    const hasLockedRegistrationInvoice = application.invoices.some(
      (invoice) =>
        invoice.pricingTier?.feeType === 'registration_fee' &&
        switchLockedStatuses.has(String(invoice.status).toLowerCase()),
    );
    const hasLockedRegistrationPayment = switchLockedStatuses.has(
      String(application.registrationPaymentStatus ?? '').toLowerCase(),
    );

    // The applicants who most often need a category fix are exactly the ones
    // who already paid, so an admin may override this lock with a stated
    // reason. The paid invoice itself is deliberately left untouched: any
    // price difference between the two categories is a finance reconciliation,
    // not something this handler should silently resolve.
    if ((hasLockedRegistrationInvoice || hasLockedRegistrationPayment) && !canAdminOverride) {
      throw new BadRequestException(
        actingAdminId
          ? 'Cannot switch category while a registration fee payment is processing or already paid. Provide an overrideReason to switch anyway.'
          : 'Cannot switch category while a registration fee payment is processing or already paid.',
      );
    }

    // 4. Validate Target Category Eligibility
    // Check if switching to the same category
    if (application.applicationCategory === targetCategory) {
        throw new BadRequestException('Application is already in the target category.');
    }

    // "as long as both registration payment types are active." and "deleted ones dont count"
    const hasActiveRegistrationTier = (category: string) => {
      return application.program.pricingTiers.some(tier => 
        tier.isActive && 
        tier.deletedAt === null &&
        tier.feeType === 'registration_fee' &&
        tier.allowedCategories &&
        (tier.allowedCategories as unknown as string[]).includes(category)
      );
    };

    if (application.applicationCategory && !hasActiveRegistrationTier(application.applicationCategory)) {
      throw new BadRequestException(`Registration is not active for the current category: ${application.applicationCategory}`);
    }

    if (!hasActiveRegistrationTier(targetCategory)) {
      throw new BadRequestException(`The target category ${targetCategory} is not currently available for this program.`);
    }

    // Fully Funded "registration closed" guard.
    //
    // The rule lives in getCategoryRegistrationPhase, shared with signup, the
    // payment handlers and the dashboard flag, so "has Fully Funded closed"
    // has one answer everywhere. No programme dates are passed on purpose: a
    // tier with no validityPeriods keeps counting as "not closed" here, which
    // is what this guard has always done. 'upcoming' is likewise not blocked.
    //
    // Only ever blocks switching INTO fully_funded — switching to
    // self_funded must never be affected.
    //
    // Admin exception: same gate as above (admin + non-empty overrideReason).
    // This is the case that motivated this whole feature — a paid,
    // already-submitted applicant needs to move into fully_funded while the
    // window is closed — so it is deliberately overridable, unlike the
    // window-is-open check itself which has no override for anyone.
    const isFullyFundedClosed = (): boolean =>
      getCategoryRegistrationPhase(application.program.pricingTiers, 'fully_funded', new Date()) === 'closed';

    if (targetCategory === 'fully_funded' && isFullyFundedClosed() && !canAdminOverride) {
      throw new BadRequestException({
        message: 'Fully Funded registration has closed.',
        errorCode: 'FULLY_FUNDED_REGISTRATION_CLOSED',
      });
    }

    // 5. Auto-cancel any unpaid invoices on this application.
    //
    // Rationale: once the participant moves to a different category, any
    // outstanding `unpaid` invoice from the old category is no longer
    // actionable for them (the visible payment list filters by their current
    // category). Marking these `cancelled` keeps the historical record while
    // preventing them from appearing as outstanding obligations or being paid
    // accidentally.
    //
    // Invoices in `processing` or `paid` are intentionally NOT touched —
    // those are the same statuses that block the switch at step 3 above, so
    // by the time we reach this point there should be none. Defensive note:
    // we still scope the auto-cancel to status `unpaid` explicitly so any
    // unexpected race that resurfaces a processing/paid invoice doesn't
    // get clobbered.
    const cancellableInvoiceIds = application.invoices
      .filter((invoice) => String(invoice.status).toLowerCase() === 'unpaid')
      .map((invoice) => invoice.id);

    // Audit trail (requirement: every admin-initiated switch, not just the
    // exception path). `status` in the entry is deliberately the CURRENT
    // (unchanged) status — this handler only ever changes applicationCategory,
    // never status, and the history entry must not claim otherwise. Shape
    // matches ApplicationStatusHistoryEntry / addStatusToHistory used
    // elsewhere in this module (review/withdraw handlers).
    const fromCategory = application.applicationCategory ?? 'none';
    const statusHistoryEntry = actingAdminId
      ? {
          status: application.status,
          changedAt: new Date().toISOString(),
          changedBy: actingAdminId,
          reason: overrideReason
            ? `Category changed ${fromCategory} → ${targetCategory} by admin: ${overrideReason}`
            : `Category changed ${fromCategory} → ${targetCategory} by admin`,
        }
      : undefined;
    const existingStatusHistory = Array.isArray(application.statusHistory)
      ? (application.statusHistory as unknown[])
      : [];

    // 6. Perform Switch (and auto-cancel) atomically.
    const updatedApplication = await this.prisma.$transaction(async (tx) => {
      if (cancellableInvoiceIds.length > 0) {
        await tx.applicationInvoice.updateMany({
          // `status: 'unpaid'` belongs in the WHERE, not only in the filter that
          // built cancellableInvoiceIds. That filter ran against the snapshot
          // read at step 1, so a payment settling between that read and this
          // write — a webhook landing mid-request — would be flipped to
          // `cancelled` with the money already taken. The comment above always
          // claimed this scoping existed; until now it existed only in memory.
          // Re-asserting it here makes the database enforce it, and an invoice
          // that moved on is simply not matched (updateMany no-ops rather than
          // failing the switch).
          where: { id: { in: cancellableInvoiceIds }, status: PaymentStatus.unpaid },
          data: { status: 'cancelled' },
        });
      }

      return tx.participantApplication.update({
        where: { id: applicationId },
        data: {
          applicationCategory: targetCategory,
          updatedAt: new Date(),
          ...(statusHistoryEntry
            ? { statusHistory: [...existingStatusHistory, statusHistoryEntry] as Prisma.InputJsonValue }
            : {}),
        },
      });
    });

    await this.invalidateParticipantCache(application.participantId, command.userId);

    // 7. Return Response
    return this.applicationMapper.toDto(this.applicationMapper.toDomain(updatedApplication));
  }

  private async invalidateParticipantCache(participantId: string, fallbackUserId?: string): Promise<void> {
    try {
      let userId = fallbackUserId;
      if (!userId) {
        const participant = await this.prisma.participant.findUnique({
          where: { id: participantId },
          select: { userId: true },
        });
        userId = participant?.userId;
      }

      if (!userId) return;

      await Promise.all([
        this.cacheService.invalidateKeys([
          CACHE_KEYS.PORTAL_DASHBOARD(userId),
          CACHE_KEYS.PORTAL_SUBMISSIONS(userId),
          CACHE_KEYS.PORTAL_SUBMISSION_DETAIL(userId),
          CACHE_KEYS.PORTAL_PAYMENTS(userId),
          CACHE_KEYS.PARTICIPANT_LATEST_APP(participantId),
        ]),
        this.cacheService.invalidateByPatterns([
          `portal:submissions:${userId}:*`,
          `portal:submission-detail:${userId}:*`,
          `portal:payments:${userId}:*`,
          // PORTAL_DASHBOARD is keyed by (userId, programId?) too; the bare
          // key above only clears the `:latest` variant.
          `portal:dashboard:${userId}:*`,
        ]),
      ]);
    } catch {
      // Cache invalidation must never block category switch completion.
    }
  }
}
