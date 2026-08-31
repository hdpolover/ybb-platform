// services/api/src/modules/landing/strategies/registration-editions.util.ts
//
// Shared "currently-relevant program editions" builder (MEYS 6th/7th
// concurrent-active-programs bug: a brand can have more than one
// published+active program with open registration at once). Extracted from
// home.strategy.ts so programs.strategy.ts's `registration_info` section can
// carry the SAME `programs[]` array/shape instead of re-implementing the
// query, guidebook resolution and status/date mapping a second time.
import { Prisma, ProgramResource } from '@prisma/client';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';
import { ACTIVE_PROGRAM_ORDER_BY } from '@shared/utils/active-program-resolver';

/** Shared shape for a program's pricing tiers, reused by a single-program
 * `registration_types`/`pricing_tiers` field and by each entry in a
 * `programs` edition array. */
export type PricingTierForRegistrationSection = {
  id: string;
  name: string;
  description: string | null;
  price: unknown;
  currency: string;
  feeType: string;
  allowedCategories: string[];
  benefits: string[];
  requirements: string[];
  validityPeriods?: { startDate: Date; endDate: Date }[];
};

export function mapPricingTiersToRegistrationTypes(tiers: PricingTierForRegistrationSection[] | undefined) {
  return (tiers ?? []).map((tier) => ({
    id: tier.id,
    name: tier.name,
    description: tier.description,
    price: tier.price,
    currency: tier.currency,
    fee_type: tier.feeType,
    allowed_categories: tier.allowedCategories,
    benefits: tier.benefits,
    requirements: tier.requirements,
    validity_periods: tier.validityPeriods?.map((vp) => ({
      start_date: vp.startDate,
      end_date: vp.endDate,
    })) ?? [],
  }));
}

/** Prisma include shared by every "currently-relevant editions" query, so a
 * `.findMany` result is always shaped for `buildRegistrationEditions` below. */
export const OPEN_REGISTRATION_PROGRAMS_INCLUDE = {
  pricingTiers: {
    where: { isActive: true, deletedAt: null },
    orderBy: { order: 'asc' },
    include: {
      validityPeriods: {
        orderBy: { startDate: 'asc' },
      },
    },
  },
  resources: {
    where: { isActive: true, isPublic: true },
    take: 5,
    orderBy: [{ order: 'asc' }, { createdAt: 'asc' }],
  },
} satisfies Prisma.ProgramInclude;

export type OpenRegistrationProgram = Prisma.ProgramGetPayload<{
  include: typeof OPEN_REGISTRATION_PROGRAMS_INCLUDE;
}>;

/** Every currently-relevant edition for a brand: filtered on close date only
 * (not open date) so an edition whose registration hasn't opened yet still
 * shows up as (closed) instead of vanishing. Ordered soonest-close-first,
 * nulls (no bound) last, tie-broken with the same ordering
 * active-program-resolver.ts uses everywhere else. */
export function fetchOpenRegistrationPrograms(prisma: PrismaService, brandId: string, now: Date) {
  return prisma.program.findMany({
    where: {
      brandId,
      deletedAt: null,
      isPublished: true,
      isActive: true,
      status: 'published',
      OR: [{ registrationCloseDate: null }, { registrationCloseDate: { gte: now } }],
    },
    orderBy: [{ registrationCloseDate: { sort: 'asc', nulls: 'last' } }, ...ACTIVE_PROGRAM_ORDER_BY],
    include: OPEN_REGISTRATION_PROGRAMS_INCLUDE,
  });
}

export async function resolveEditionGuidebooks(prisma: PrismaService, resources: ProgramResource[]) {
  return Promise.all(
    (resources ?? []).map(async (resource) => {
      const activeUrl = resource.sourceType === 'link' ? resource.linkUrl : resource.fileUrl;
      const resolvedUrl = activeUrl ? await resolveMaskedFileUrl(prisma, activeUrl) : null;
      return {
        id: resource.id,
        title: resource.title,
        type: resource.type,
        url: resolvedUrl ?? (resource.sourceType === 'link' ? resource.linkUrl : resource.fileUrl),
      };
    }),
  );
}

/** Whether an edition's registration is currently open, given `now`. Shared
 * by `buildRegistrationEditions` and `resolveEditionSlug` so both agree on
 * which edition is "running". */
export function editionStatus(
  program: Pick<OpenRegistrationProgram, 'isActive' | 'registrationOpenDate' | 'registrationCloseDate'>,
  now: Date,
): 'open' | 'closed' {
  return program.isActive &&
    (!program.registrationOpenDate || program.registrationOpenDate <= now) &&
    (!program.registrationCloseDate || program.registrationCloseDate >= now)
    ? 'open'
    : 'closed';
}

/** Maps `fetchOpenRegistrationPrograms` results to the `programs[]` edition
 * shape (program_id, program_name, program_slug, year, status,
 * registration_dates, registration_types, guidelines). Each entry's own
 * `status` still checks the open date too, unlike the findMany's where
 * clause above — a program whose registration hasn't started yet is
 * included in the list (so it doesn't disappear) but renders as closed. */
export async function buildRegistrationEditions(
  prisma: PrismaService,
  editionPrograms: OpenRegistrationProgram[],
  now: Date,
) {
  const guidelinesByProgramId = new Map(
    await Promise.all(
      editionPrograms.map(async (p) => [p.id, await resolveEditionGuidebooks(prisma, p.resources)] as const),
    ),
  );

  return editionPrograms.map((editionProgram) => ({
    program_id: editionProgram.id,
    program_name: editionProgram.name,
    program_slug: editionProgram.slug,
    year: editionProgram.year,
    status: editionStatus(editionProgram, now),
    registration_dates: {
      open: editionProgram.registrationOpenDate?.toISOString() ?? null,
      close: editionProgram.registrationCloseDate?.toISOString() ?? null,
    },
    // The event dates, so a signup screen can tell two similarly named
    // editions apart (MEYS 6th runs Dec 2026, MEYS 7th Mar 2027). Already
    // loaded by the findMany above, so this costs no extra query.
    program_dates: {
      start: editionProgram.startDate?.toISOString() ?? null,
      end: editionProgram.endDate?.toISOString() ?? null,
    },
    registration_types: mapPricingTiersToRegistrationTypes(editionProgram.pricingTiers),
    guidelines: guidelinesByProgramId.get(editionProgram.id) ?? [],
  }));
}

/** Picks the edition slug a /programs request should render, WITHOUT paying
 * for buildRegistrationEditions' guidebook resolution — this only needs to
 * exist to build the RESOLVED cache key up front, before either the
 * persisted-snapshot or the strategy's own cache is consulted (see MEYS 6th/
 * 7th concurrent-active-programs bug: the cache key must reflect the
 * resolved edition, or one edition's page can be served for another).
 * `requestedSlug` wins when it matches a currently-relevant edition; else
 * the running edition with the closest deadline (soonest-close-first order
 * from `fetchOpenRegistrationPrograms`); else the newest by year. Returns
 * null only when the brand has no currently-relevant editions at all — an
 * unmatched/malformed slug never errors, it just falls through to the
 * default. */
export async function resolveEditionSlug(
  prisma: PrismaService,
  brandId: string,
  requestedSlug: string | undefined,
  now: Date,
): Promise<string | null> {
  const editions = await fetchOpenRegistrationPrograms(prisma, brandId, now);
  if (editions.length === 0) return null;

  if (requestedSlug) {
    const match = editions.find((edition) => edition.slug === requestedSlug);
    if (match) return match.slug;
  }

  const openEdition = editions.find((edition) => editionStatus(edition, now) === 'open');
  if (openEdition) return openEdition.slug;

  return editions.reduce((newest, edition) => (edition.year > newest.year ? edition : newest), editions[0]).slug;
}
