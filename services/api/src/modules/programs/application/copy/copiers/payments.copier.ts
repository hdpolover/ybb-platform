// services/api/src/modules/programs/application/copy/copiers/payments.copier.ts
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { parseTemplateItems } from '../template-payload.schemas';

// `description` (unlike `benefits`/`requirements`, which are plain
// newline-separated textareas — see PaymentOptionActions.tsx) is edited
// with the Tiptap rich-text editor (rich-text-editor.tsx) and can embed
// `<img src="...">` pointing at the source brand's storage. Mirrors
// form-fields.copier.ts's hasExternalMedia — the shared copy dialog shows a
// cross-brand caveat when any selected item flags this.
const EXTERNAL_MEDIA_PATTERN = /<(img|iframe|video)\b/i;

type TemplateValidityPeriod = { startDate: string; endDate: string; description: string | null };
type TemplateItem = {
  name: string;
  description: string | null;
  price: number;
  currency: string;
  usdPrice: number | null;
  idrPrice: number | null;
  capacity: number | null;
  benefits: string[];
  requirements: string[];
  feeType: string;
  allowedCategories: string[];
  icon: string | null;
  isActive: boolean;
  validityPeriods: TemplateValidityPeriod[];
};

// Extracted for applyTemplate's replace path only — copy()'s own inline
// version (above the loop in copy()) is left untouched per this plan's
// constraint not to alter existing copy()/countFor()/preview() behaviour.
// Both bodies implement the identical check: replacing soft-deletes the
// TARGET's current live tiers, which does not trip a Postgres FK error, so a
// paid invoice/application would otherwise silently end up pointing at an
// inactive, soft-deleted tier. That risk is a property of the soft-delete
// mutation itself, not of where the new tier data came from (a live source
// program vs. a stored template) — so applyTemplate's replace needs the
// exact same guard as copy()'s replace, checked before any mutation.
async function refuseIfTiersInUse(tx: PrismaTx, targetProgramId: string): Promise<void> {
  const existingTierIds = (
    await tx.programPricingTier.findMany({ where: { programId: targetProgramId, deletedAt: null }, select: { id: true } })
  ).map((t) => t.id);
  if (existingTierIds.length === 0) return;
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
      hasExternalMedia: t.description !== null && EXTERNAL_MEDIA_PATTERN.test(t.description),
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

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let tiers = await this.prisma.programPricingTier.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: { validityPeriods: true },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      tiers = tiers.filter((t) => idSet.has(t.id));
    }
    // soldCount/currentCount are deliberately not exported — they're live
    // usage counters, not content, exactly as copy() never carries them
    // forward either.
    const items: TemplateItem[] = tiers.map((t) => ({
      name: t.name,
      description: t.description,
      price: Number(t.price),
      currency: t.currency,
      usdPrice: t.usdPrice === null ? null : Number(t.usdPrice),
      idrPrice: t.idrPrice === null ? null : Number(t.idrPrice),
      capacity: t.capacity,
      benefits: t.benefits,
      requirements: t.requirements,
      feeType: t.feeType,
      allowedCategories: t.allowedCategories,
      icon: t.icon,
      isActive: t.isActive,
      validityPeriods: t.validityPeriods.map((p) => ({
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        description: p.description,
      })),
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];

    // Same failure mode copy() guards against — duplicated rather than
    // shared, per this plan's Global Constraints (Payments doesn't route
    // through copyScopedRows/applyScopedTemplate, so it can't inherit their
    // built-in guard for free).
    if (mode === 'replace' && items.length === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
      });
    }
    if (items.length === 0) {
      return { created: 0, skipped: 0, replaced: 0 };
    }

    let replaced = 0;
    if (mode === 'replace') {
      // See refuseIfTiersInUse's comment: the soft-delete below carries the
      // exact same in-use risk as copy()'s replace path.
      await refuseIfTiersInUse(tx, targetProgramId);
      const result = await tx.programPricingTier.updateMany({
        where: { programId: targetProgramId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      replaced = result.count;
    }

    const existingTiers =
      mode === 'append'
        ? await tx.programPricingTier.findMany({ where: { programId: targetProgramId, deletedAt: null }, select: { name: true, order: true } })
        : [];
    const existingNames = new Set(existingTiers.map((t) => t.name));
    const baseOrder = existingTiers.reduce((max, t) => Math.max(max, t.order), -1) + 1;

    let created = 0;
    let skipped = 0;
    let placed = 0;
    for (const item of items) {
      if (existingNames.has(item.name)) {
        skipped += 1;
        continue;
      }
      // Same reset-vs-copy split as copy(): soldCount/currentCount are live
      // counters and always start at zero; capacity is content and is
      // carried through verbatim.
      const newTier = await tx.programPricingTier.create({
        data: {
          programId: targetProgramId,
          name: item.name,
          description: item.description,
          price: item.price,
          currency: item.currency,
          usdPrice: item.usdPrice,
          idrPrice: item.idrPrice,
          capacity: item.capacity,
          currentCount: 0,
          benefits: item.benefits,
          requirements: item.requirements,
          feeType: item.feeType as never,
          allowedCategories: item.allowedCategories as never,
          icon: item.icon,
          soldCount: 0,
          isActive: item.isActive,
          order: baseOrder + placed,
        },
      });
      // Remap: each period must attach to the newly created tier's id, not
      // any id carried in the template payload.
      for (const period of item.validityPeriods) {
        await tx.pricingTierValidityPeriod.create({
          data: {
            pricingTierId: newTier.id,
            startDate: new Date(period.startDate),
            endDate: new Date(period.endDate),
            description: period.description,
          },
        });
      }
      existingNames.add(item.name);
      created += 1;
      placed += 1;
    }
    return { created, skipped, replaced };
  }
}
