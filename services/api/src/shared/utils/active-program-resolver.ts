// services/api/src/shared/utils/active-program-resolver.ts
/**
 * Shared "resolve the active program for a brand" logic (Phase 3 resolver
 * addendum — see
 * .superpowers/sdd/2026-08-24-program-content-copy-phase-3/resolver-addendum.md,
 * ruling P3-R1 amended). Binds Tasks 12, 13, 15 and 16.
 *
 * Two of the 8 live brands (Vietnam Youth Summit, Korea Youth Summit) hold
 * real contact/landing data on a program that fails the historical
 * `isPublished === true && isActive === true` predicate every contact/
 * landing read path used before this addendum. Fixing only one call site
 * (e.g. the backfill) writes the data somewhere a reader never looks — this
 * module is the SINGLE exported source of the predicate + ordering +
 * fallback so every call site that decides "which program owns this
 * brand's contact/landing content" resolves the same program, not a
 * silently-drifted copy of the query.
 *
 * Resolution order:
 *   1. isPublished && isActive, most recent by year desc, createdAt desc,
 *      id asc — unchanged from every call site's behavior before this
 *      addendum, so no currently-working brand changes behavior.
 *   2. Fallback: the most recent non-deleted program regardless of
 *      isPublished/isActive, same ordering. Recovers Vietnam Youth Summit
 *      (published, inactive) and Korea Youth Summit (unpublished, active).
 *   3. null when the brand has no non-deleted programs at all.
 *
 * `id` is the final tiebreak solely so a tie between two programs sharing a
 * year and createdAt resolves identically across every call site and every
 * run/process — not a change to which program wins in the non-tied case.
 *
 * Deliberately OUT OF SCOPE: get-auth-context.handler.ts:55 (participant
 * auth context — a different question, with its own known
 * resolveActiveProgramId/availableIds[0] bug in the participant portal). Do
 * not repoint it onto this resolver; see the addendum for the full
 * reasoning.
 */
import { Prisma } from '@prisma/client';

/** Deterministic ordering shared by every rule below. */
export const ACTIVE_PROGRAM_ORDER_BY: Prisma.ProgramOrderByWithRelationInput[] = [
    { year: 'desc' },
    { createdAt: 'desc' },
    { id: 'asc' },
];

type ActiveProgramFindFirstArgs = {
    where: Prisma.ProgramWhereInput;
    orderBy: Prisma.ProgramOrderByWithRelationInput[];
};

/** Rule 1: published + active, most recent first. */
export function activeProgramQuery(brandId: string): ActiveProgramFindFirstArgs {
    return {
        where: { brandId, deletedAt: null, isPublished: true, isActive: true },
        orderBy: ACTIVE_PROGRAM_ORDER_BY,
    };
}

/** Rule 2 fallback: any non-deleted program, most recent first. */
export function anyProgramFallbackQuery(brandId: string): ActiveProgramFindFirstArgs {
    return {
        where: { brandId, deletedAt: null },
        orderBy: ACTIVE_PROGRAM_ORDER_BY,
    };
}

export type ActiveProgramResolutionRule = 1 | 2 | 3;

export interface ActiveProgramResolution<T> {
    program: T | null;
    rule: ActiveProgramResolutionRule;
}

/**
 * Runs the 3-rule fallback through an injected `findFirst`, so each caller
 * binds its own Prisma client/transaction and `select` — the builders above
 * return only `{ where, orderBy }`, deliberately leaving `select`/`include`
 * to the caller (settings.strategy.ts, home.strategy.ts, this backfill, and
 * resolveActiveProgramContact all need different columns).
 */
export async function resolveActiveProgram<T>(
    findFirst: (args: ActiveProgramFindFirstArgs) => Promise<T | null>,
    brandId: string,
): Promise<ActiveProgramResolution<T>> {
    const viaRule1 = await findFirst(activeProgramQuery(brandId));
    if (viaRule1) return { program: viaRule1, rule: 1 };

    const viaRule2 = await findFirst(anyProgramFallbackQuery(brandId));
    if (viaRule2) return { program: viaRule2, rule: 2 };

    return { program: null, rule: 3 };
}

/** Human-readable label for dry-run logging — e.g. "fallback rule 2". */
export function describeActiveProgramRule(rule: ActiveProgramResolutionRule): string {
    switch (rule) {
        case 1:
            return 'rule 1';
        case 2:
            return 'fallback rule 2';
        case 3:
            return 'no program found';
    }
}
