import { Injectable } from '@nestjs/common';
import { ApplicationCategory } from '@core/entities/participant-application.entity';
import { PrismaReadService } from '@shared/infrastructure/prisma/prisma-read.service';
import { RegistrationFeeMismatchesQuery } from '../registration-fee-mismatches.query';
import {
  RegistrationFeeMismatchListResponseDto,
  RegistrationFeeMismatchRowDto,
} from '../../dto/registration-fee-mismatch-response.dto';

/**
 * Registration Fee Mismatches Handler
 *
 * Application Layer - Query Handler
 *
 * Finds applications whose paid/processing registration_fee invoice was
 * issued under a pricing tier category that no longer matches the
 * application's current category (an admin switched fully_funded <->
 * self_funded after the fee was paid; the invoice is deliberately left
 * untouched). The result set is expected to be small (a reconciliation
 * exception list, not a bulk report), so the category comparison is done
 * in-memory after a single scoped invoice fetch rather than attempted as a
 * correlated SQL condition.
 */
@Injectable()
export class RegistrationFeeMismatchesHandler {
  constructor(private readonly readPrisma: PrismaReadService) {}

  async execute(query: RegistrationFeeMismatchesQuery): Promise<RegistrationFeeMismatchListResponseDto> {
    const invoices = await this.readPrisma.applicationInvoice.findMany({
      where: {
        status: { in: ['paid', 'processing'] },
        pricingTier: { feeType: 'registration_fee' },
        application: { programId: query.programId, deletedAt: null },
      },
      select: {
        id: true,
        status: true,
        amount: true,
        currency: true,
        paidAt: true,
        pricingTier: { select: { allowedCategories: true } },
        application: {
          select: {
            id: true,
            applicationCategory: true,
            participant: {
              select: { fullName: true, user: { select: { email: true } } },
            },
          },
        },
      },
    });

    const mismatches = invoices.filter((invoice) => {
      const category = invoice.application.applicationCategory;
      return category != null && !invoice.pricingTier.allowedCategories.includes(category);
    });

    const total = mismatches.length;
    const page = mismatches.slice(query.offset, query.offset + query.limit);

    // Current price for each present category, looked up once (not per row).
    const currentTiers = await this.readPrisma.programPricingTier.findMany({
      where: {
        programId: query.programId,
        feeType: 'registration_fee',
        isActive: true,
        deletedAt: null,
      },
      select: { price: true, currency: true, allowedCategories: true },
    });
    const tierByCategory = new Map<string, { price: number; currency: string }>();
    for (const tier of currentTiers) {
      for (const category of tier.allowedCategories) {
        // First active tier wins if more than one tier lists the same category —
        // matches how the rest of the pricing module treats "the" tier for a category.
        if (!tierByCategory.has(category)) {
          tierByCategory.set(category, { price: Number(tier.price), currency: tier.currency });
        }
      }
    }

    const rows: RegistrationFeeMismatchRowDto[] = page.map((invoice) => {
      const currentCategory = invoice.application.applicationCategory as ApplicationCategory;
      const currentTier = tierByCategory.get(currentCategory) ?? null;
      const amountPaid = Number(invoice.amount);
      return {
        applicationId: invoice.application.id,
        participantFullName: invoice.application.participant?.fullName ?? '',
        participantEmail: invoice.application.participant?.user?.email ?? null,
        currentCategory,
        // A tier is expected to list exactly one category in practice; falling
        // back to the raw list join keeps this readable even if that ever changes.
        invoicedCategory: (invoice.pricingTier.allowedCategories[0] ?? currentCategory) as ApplicationCategory,
        invoiceId: invoice.id,
        invoiceStatus: invoice.status,
        amountPaid,
        currency: invoice.currency,
        paidAt: invoice.paidAt,
        currentTierPrice: currentTier?.price ?? null,
        difference: currentTier ? currentTier.price - amountPaid : null,
      };
    });

    return { rows, total };
  }
}
