import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { CreateRegistrationPaymentIntentCommand } from '../create-registration-payment-intent.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
// We might need to fetch Program to get the exact price from Pricing Tier
// Assuming `programRepository` exists or we fetch via helper
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class CreateRegistrationPaymentIntentHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly paymentClient: PaymentGrpcClient,
    private readonly prisma: PrismaService, // Direct access for simpler PricingTier check
  ) {}

  async execute(command: CreateRegistrationPaymentIntentCommand): Promise<any> {
    const { applicationId, userId } = command;

    // 1. Get Application
    const application = await this.applicationRepository.findById(applicationId);
    if (!application) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    if (application.participantId !== userId) {
        throw new BadRequestException('Unauthorized to pay for this application');
    }

    // 2. Check if Fully Funded (No payment needed)
    if (application.applicationCategory === ApplicationCategory.FULLY_FUNDED) {
         throw new BadRequestException('No registration payment required for fully funded applications.');
    }

    // 3. Determine Amount
    let amount = 0;
    let currency = 'IDR';

    if (application.pricingTierId) {
        // Fetch pricing tier
        const tier = await this.prisma.programPricingTier.findUnique({
            where: { id: application.pricingTierId }
        });
        if (tier) {
            amount = Number(tier.price);
            currency = tier.currency || 'IDR';
        }
    }

    // Fallback or default logic if no tier selected?
    if (amount <= 0) {
        // Fallback for logic where maybe pricing tier is not set yet but default fee exists?
        // For now, fail safe
        throw new BadRequestException('Pricing tier not selected or invalid amount.');
    }
    
    // 4. Create Intent via Payment Service
    const metadata = {
        payment_category: 'registration',
        program_id: application.programId,
        application_id: application.id
    };

    const intent = await this.paymentClient.createIntent({
        user_id: userId,
        amount: amount,
        currency: currency,
        reference_type: 'application',
        reference_id: application.id,
        metadata: metadata
    });

    return intent;
  }
}
