import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { SwitchApplicationCategoryCommand } from '../switch-application-category.command';
import { ApplicationResponseDto } from '../../dto/application-response.dto';
import { ApplicationMapper } from '@modules/applications/infrastructure/mappers/application.mapper';
import { ApplicationStatus } from '@core/entities/participant-application.entity';

@Injectable()
export class SwitchApplicationCategoryHandler {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicationMapper: ApplicationMapper,
  ) {}

  async execute(command: SwitchApplicationCategoryCommand): Promise<ApplicationResponseDto> {
    const { applicationId, targetCategory } = command;

    // 1. Fetch Application with Invoices and Program Info
    const application = await this.prisma.participantApplication.findUnique({
      where: { id: applicationId },
      include: {
        invoices: true,
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
    // "Participants also cant switch categories if they've already submitted their applications."
    // Assuming 'DRAFT' is the only safe status locally in the enum import.
    // We check against the string or enum. Prisma returns strings often but let's be safe.
    if (application.status !== ApplicationStatus.DRAFT) {
       throw new BadRequestException('Cannot switch category after application has been submitted.');
    }

    // 3. Validate Payments
    // "when payment attemps/invoices exist, category switch is still possible if none is successful."
    const successfulPaymentStatus = 'paid'; // defined in PaymentStatus enum

    const hasSuccessfulInvoice = application.invoices.some(inv => inv.status === successfulPaymentStatus);
    const hasSuccessfulRegistrationPayment = application.registrationPaymentStatus === successfulPaymentStatus;

    if (hasSuccessfulInvoice || hasSuccessfulRegistrationPayment) {
      throw new BadRequestException('Cannot switch category because a successful payment exists.');
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

    // 6. Return Response
    return this.applicationMapper.toDto(this.applicationMapper.toDomain(updatedApplication));
  }
}
