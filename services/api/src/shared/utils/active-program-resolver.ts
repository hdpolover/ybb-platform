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
 *   0. isPublished && isActive AND registration is currently open (a null
 *      open/close date counts as open). Added because rule 1's `year desc`
 *      ordering picks a FUTURE program over the one actually taking
 *      registrations: set MEYS 2027 (registration opens September) active
 *      while MEYS 2026 is still open until December and every rule-1 caller
 *      silently switches to the program nobody can register for yet.
 *      Purely additive — it only changes the outcome when two or more
 *      programs pass rule 1, which is exactly the broken case. When it
 *      matches nothing (every window closed) rule 1 answers as before.
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
 * Deliberately still OUT OF SCOPE for the FULL resolver:
 * get-auth-context.handler.ts (participant auth context — a different
 * question, with its own known resolveActiveProgramId/availableIds[0] bug
 * in the participant portal). Do not repoint it onto resolveActiveProgram;
 * its rule 2 fallback would hand a program to brands that correctly get
 * null today, changing where new participants register. That handler does
 * reuse `openRegistrationProgramQuery` alone, which only re-orders among
 * programs it would already have picked from.
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

/**
 * Rule 0: published + active AND registration currently open, most recent
 * first. A null open or close date means "no bound", i.e. open — the same
 * reading every other registration gate in the codebase uses.
 */
export function openRegistrationProgramQuery(
    brandId: string,
    now: Date,
): ActiveProgramFindFirstArgs {
    return {
        where: {
            brandId,
            deletedAt: null,
            isPublished: true,
            isActive: true,
            // Two separate OR groups, so they must be nested under AND —
            // sibling `OR` keys would overwrite each other.
            AND: [
                { OR: [{ registrationOpenDate: null }, { registrationOpenDate: { lte: now } }] },
                { OR: [{ registrationCloseDate: null }, { registrationCloseDate: { gte: now } }] },
            ],
        },
        orderBy: ACTIVE_PROGRAM_ORDER_BY,
    };
}

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

export type ActiveProgramResolutionRule = 0 | 1 | 2 | 3;

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
    now: Date = new Date(),
): Promise<ActiveProgramResolution<T>> {
    const viaRule0 = await findFirst(openRegistrationProgramQuery(brandId, now));
    if (viaRule0) return { program: viaRule0, rule: 0 };

    const viaRule1 = await findFirst(activeProgramQuery(brandId));
    if (viaRule1) return { program: viaRule1, rule: 1 };

    const viaRule2 = await findFirst(anyProgramFallbackQuery(brandId));
    if (viaRule2) return { program: viaRule2, rule: 2 };

    return { program: null, rule: 3 };
}

/** Human-readable label for dry-run logging — e.g. "fallback rule 2". */
export function describeActiveProgramRule(rule: ActiveProgramResolutionRule): string {
    switch (rule) {
        case 0:
            return 'rule 0 (registration open)';
        case 1:
            return 'rule 1';
        case 2:
            return 'fallback rule 2';
        case 3:
            return 'no program found';
    }
}
