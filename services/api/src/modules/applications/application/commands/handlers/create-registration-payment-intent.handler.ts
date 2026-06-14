import { Injectable, NotFoundException, BadRequestException, Inject } from '@nestjs/common';
import { IApplicationRepository } from '@core/interfaces/repositories/application.repository.interface';
import { CreateRegistrationPaymentIntentCommand } from '../create-registration-payment-intent.command';
import { APPLICATION_REPOSITORY } from '@modules/applications/infrastructure/tokens';
import { PaymentGrpcClient } from '@modules/payments/infrastructure/services/payment-grpc.client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

@Injectable()
export class CreateRegistrationPaymentIntentHandler {
  constructor(
    @Inject(APPLICATION_REPOSITORY)
    private readonly applicationRepository: IApplicationRepository,
    private readonly paymentClient: PaymentGrpcClient,
    private readonly prisma: PrismaService,
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

    // 2. Determine Amount
    let amount = 0;
    let currency = 'IDR';

    if (application.pricingTierId) {
        const tier = await this.prisma.programPricingTier.findUnique({
            where: { id: application.pricingTierId }
        });
        if (tier) {
            amount = Number(tier.price);
            currency = tier.currency || 'IDR';
        }
    }

    if (amount <= 0) {
        throw new BadRequestException('Pricing tier not selected or invalid amount.');
    }

    // 4. Get exchange rate snapshot from the program configuration
    const program = await this.prisma.program.findUnique({
        where: { id: application.programId },
        select: {
            usdInIdr: true,
        },
    });

    const exchangeRate = program?.usdInIdr ? Number(program.usdInIdr) : undefined;

    // 5. Create Intent via Payment Service (with exchange rate snapshot)
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
        metadata: metadata,
        exchange_rate: exchangeRate,
    });

    return intent;
  }
}
