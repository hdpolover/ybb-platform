import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { SwitchApplicationCategoryCommand } from '../switch-application-category.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { ApplicationStatus } from '@core/entities/participant-application.entity';

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
            pricingTiers: true,
          }
        }
      }
    });

    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
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

    if (hasLockedRegistrationInvoice || hasLockedRegistrationPayment) {
      throw new BadRequestException(
        'Cannot switch category while a registration fee payment is processing or already paid.',
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

    // 5. Perform Switch
    const updatedApplication = await this.prisma.participantApplication.update({
      where: { id: applicationId },
      data: {
        applicationCategory: targetCategory,
        updatedAt: new Date(),
      }
    });

    await this.invalidateParticipantCache(application.participantId, command.userId);

    // 6. Return Response
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
        ]),
      ]);
    } catch {
      // Cache invalidation must never block category switch completion.
    }
  }
}
