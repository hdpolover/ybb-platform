import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { SwitchApplicationCategoryCommand } from '../switch-application-category.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { ApplicationStatus } from '@core/entities/participant-application.entity';
import { hasTierPeriodEnded } from '@shared/utils/tier-period.util';

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

    // 2. Validate Status
    // Category switch is only allowed while application is still in draft/editing stage.
    if (application.status !== ApplicationStatus.DRAFT) {
       throw new BadRequestException('Cannot switch category after application has been submitted.');
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
    const overrideReason = command.overrideReason?.trim() || undefined;
    const canOverridePaymentLock = Boolean(actingAdminId && overrideReason);
    if ((hasLockedRegistrationInvoice || hasLockedRegistrationPayment) && !canOverridePaymentLock) {
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
    // Definition (must match the dashboard flag): among the active
    // registration_fee FF tiers, a tier exists AND every such tier is
    // configured with validity windows AND all those windows have ended
    // (per `hasTierPeriodEnded`, WIB end-of-day inclusive). A tier with no
    // validityPeriods counts as "not closed".
    //
    // Only ever blocks switching INTO fully_funded — switching to
    // self_funded must never be affected.
    const isFullyFundedClosed = (): boolean => {
      const now = new Date();
      const ffTiers = application.program.pricingTiers.filter(
        (tier) =>
          tier.isActive &&
          tier.deletedAt === null &&
          tier.feeType === 'registration_fee' &&
          tier.allowedCategories &&
          (tier.allowedCategories as unknown as string[]).includes('fully_funded'),
      );
      if (ffTiers.length === 0) {
        return false;
      }
      return ffTiers.every((tier) => {
        const periods = (tier as unknown as {
          validityPeriods?: { startDate: Date; endDate: Date }[];
        }).validityPeriods ?? [];
        return periods.length > 0 && periods.every((period) => hasTierPeriodEnded(period, now));
      });
    };

    if (targetCategory === 'fully_funded' && isFullyFundedClosed()) {
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

    // 6. Perform Switch (and auto-cancel) atomically.
    const updatedApplication = await this.prisma.$transaction(async (tx) => {
      if (cancellableInvoiceIds.length > 0) {
        await tx.applicationInvoice.updateMany({
          where: { id: { in: cancellableInvoiceIds } },
          data: { status: 'cancelled' },
        });
      }

      return tx.participantApplication.update({
        where: { id: applicationId },
        data: {
          applicationCategory: targetCategory,
          updatedAt: new Date(),
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
