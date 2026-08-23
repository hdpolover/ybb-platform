// services/api/src/modules/programs/application/copy/copiers/payments.copier.ts
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';

/**
 * The only two-level copier: ProgramPricingTier has child
 * PricingTierValidityPeriod rows, so `copyScopedRows` (single-table) can't
 * express it. Tiers are inserted first, each new tier's generated id is
 * captured, and its validity periods are then inserted against that new id
 * — never the source tier's id.
 */
@Injectable()
export class PaymentsCopier implements ProgramCopier {
  readonly key = 'payments';
  readonly label = 'Payment Options';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programPricingTier.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const tiers = await this.prisma.programPricingTier.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return tiers.map((t) => ({
      id: t.id,
      label: t.name,
      meta: `${t.currency} ${t.price.toString()}`,
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const { sourceProgramId, targetProgramId, itemIds, mode } = input;

    let sourceTiers = await tx.programPricingTier.findMany({
      where: { programId: sourceProgramId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: { validityPeriods: true },
    });

    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      sourceTiers = sourceTiers.filter((tier) => idSet.has(tier.id));
    }

    // Mirrors copy-scoped-rows.ts's guard: replace unconditionally
    // soft-deletes every current target tier before inserting. If the
    // (possibly itemIds-filtered) source is empty, that soft-delete would
    // destroy the target's tiers with nothing to replace them — thrown here,
    // before any mutation. Append mode is unaffected: an empty source there
    // is a legitimate no-op, handled below.
    if (mode === 'replace' && sourceTiers.length === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
      });
    }

    if (sourceTiers.length === 0) {
      return { created: 0, skipped: 0, replaced: 0 };
    }

    let replaced = 0;
    if (mode === 'replace') {
      // Same failure mode ParticipationCategoriesCopier guards against
      // (Task 4 / participation-categories.copier.ts's beforeReplace): unlike
      // the hard-delete path (program-content.repository.ts:263-265), the
      // soft-delete below does NOT trip a Postgres FK error — it silently
      // succeeds and leaves paid invoices / applications pointing at an
      // inactive, soft-deleted tier. Money surface, so this is checked
      // before any mutation, using the TARGET's current live tier ids (not
      // the source's — the source's ids are irrelevant to what's about to
      // be soft-deleted).
      const existingTierIds = (
        await tx.programPricingTier.findMany({
          where: { programId: targetProgramId, deletedAt: null },
          select: { id: true },
        })
      ).map((t) => t.id);

      if (existingTierIds.length > 0) {
        // ApplicationInvoice.pricingTierId is required (non-null); a live
        // invoice always references a real tier. ParticipantApplication.
        // pricingTierId is optional at the schema level, but a non-null
        // value on a live application is just as real a reference as an
        // invoice's — optionality only means the column *can* be empty, not
        // that a populated value is any less load-bearing. So both are
        // treated identically: either one blocks the replace.
        const [invoiceCount, applicationCount] = await Promise.all([
          tx.applicationInvoice.count({ where: { pricingTierId: { in: existingTierIds } } }),
          tx.participantApplication.count({ where: { pricingTierId: { in: existingTierIds } } }),
        ]);
        const referencedCount = invoiceCount + applicationCount;
        if (referencedCount > 0) {
          throw new ConflictException({
            code: 'pricing_tier_in_use',
            message: `Cannot replace: ${referencedCount} invoice(s)/application(s) still reference the current payment tiers. Use append mode instead, or reassign those records first.`,
          });
        }
      }

      const result = await tx.programPricingTier.updateMany({
        where: { programId: targetProgramId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      replaced = result.count;
    }

    const existingTiers =
      mode === 'append'
        ? await tx.programPricingTier.findMany({
            where: { programId: targetProgramId, deletedAt: null },
            select: { name: true, order: true },
          })
        : [];
    const existingNames = new Set(existingTiers.map((t) => t.name));
    const baseOrder = existingTiers.reduce((max, t) => Math.max(max, t.order), -1) + 1;

    let created = 0;
    let skipped = 0;
    let placed = 0;

    for (const tier of sourceTiers) {
      if (existingNames.has(tier.name)) {
        skipped += 1;
        continue;
      }

      // soldCount/currentCount are live usage counters, not content — a
      // copied tier always starts at zero regardless of how much the source
      // tier sold. capacity IS content (a configured limit, "0 or null =
      // unlimited") and is copied verbatim.
      const newTier = await tx.programPricingTier.create({
        data: {
          programId: targetProgramId,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          currency: tier.currency,
          usdPrice: tier.usdPrice,
          idrPrice: tier.idrPrice,
          capacity: tier.capacity,
          currentCount: 0,
          benefits: tier.benefits,
          requirements: tier.requirements,
          feeType: tier.feeType,
          allowedCategories: tier.allowedCategories,
          icon: tier.icon,
          soldCount: 0,
          isActive: tier.isActive,
          order: baseOrder + placed,
        },
      });

      // Remap: each period must attach to the newly created tier's id, not
      // the source tier's id (which belongs to the source program and may
      // not even exist in the target program's foreign-key space).
      for (const period of tier.validityPeriods) {
        await tx.pricingTierValidityPeriod.create({
          data: {
            pricingTierId: newTier.id,
            startDate: period.startDate,
            endDate: period.endDate,
            description: period.description,
          },
        });
      }

      existingNames.add(tier.name);
      created += 1;
      placed += 1;
    }

    // `created` counts tiers only — the top-level rows the user selected —
    // consistent with the other copiers, where periods are dependent detail
    // rows rather than independently selectable items.
    return { created, skipped, replaced };
  }
}
