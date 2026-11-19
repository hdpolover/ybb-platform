// src/modules/applications/application/helpers/pricing-tier-program.helper.ts
import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

/**
 * Rejects a pricing tier that is missing, soft-deleted or belongs to another
 * programme. The tier drives the application's fees, so a foreign tier id
 * silently bills the participant another programme's prices.
 */
export async function assertPricingTierInProgram(
  prisma: PrismaService,
  pricingTierId: string,
  programId: string,
): Promise<void> {
  const tier = await prisma.programPricingTier.findFirst({
    where: { id: pricingTierId, programId, deletedAt: null },
    select: { id: true },
  });

  if (!tier) {
    throw new BadRequestException(`Pricing tier ${pricingTierId} does not belong to this program.`);
  }
}
