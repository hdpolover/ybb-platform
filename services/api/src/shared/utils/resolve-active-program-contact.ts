// services/api/src/shared/utils/resolve-active-program-contact.ts
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { resolveActiveProgram } from './active-program-resolver';

export interface ProgramContactInfo {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
}

type ContactOnlyProgram = {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
};

const CONTACT_SELECT = {
    contactEmail: true,
    contactPhone: true,
    contactWhatsapp: true,
    contactAddress: true,
} as const;

/**
 * Resolves contact info for a brand-only call site (no specific
 * ParticipantApplication/Program already in scope) by finding "the active
 * program" for the brand and reading its contact fields.
 *
 * THIN WRAPPER over the shared resolver in `active-program-resolver.ts`
 * (Phase 3 resolver addendum — see
 * .superpowers/sdd/2026-08-24-program-content-copy-phase-3/resolver-addendum.md,
 * ruling P3-R1 amended). This deliberately does NOT retype the
 * where/orderBy predicate — an inlined duplicate of that query is exactly
 * how the backfill (Task 12) and this read path would silently drift apart
 * about which program owns a brand's contact details. Only the `select` is
 * local to this file, since every call site needs different columns.
 *
 * Runs the full 3-rule fallback (published+active -> most recent
 * non-deleted program -> null), NOT just rule 1 — so brand-only consumers
 * (forgot-password, support ticket notifications) resolve the SAME program
 * settings.strategy.ts resolves for the brand's own public landing page
 * contact info, including for brands that only recover via rule 2 (e.g.
 * Vietnam Youth Summit: published, inactive; Korea Youth Summit:
 * unpublished, active). Resolving only rule 1 here would reintroduce the
 * exact bug the addendum exists to close for those brands.
 *
 * Returns all-null fields rather than throwing when the brand has no
 * resolvable program at all (rule 3) — every caller of this function
 * already treated a missing/undefined contact field as an acceptable,
 * optional case before this phase.
 */
export async function resolveActiveProgramContact(
    prisma: PrismaService,
    brandId: string,
): Promise<ProgramContactInfo> {
    const { program } = await resolveActiveProgram<ContactOnlyProgram>(
        (args) => prisma.program.findFirst({ ...args, select: CONTACT_SELECT }),
        brandId,
    );

    return {
        contactEmail: program?.contactEmail ?? null,
        contactPhone: program?.contactPhone ?? null,
        contactWhatsapp: program?.contactWhatsapp ?? null,
        contactAddress: program?.contactAddress ?? null,
    };
}
