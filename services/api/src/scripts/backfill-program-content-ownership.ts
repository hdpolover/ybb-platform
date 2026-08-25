// services/api/src/scripts/backfill-program-content-ownership.ts
/**
 * backfill-program-content-ownership.ts
 *
 * Phase 3 Task 12 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md
 * and the resolver addendum,
 * .superpowers/sdd/2026-08-24-program-content-copy-phase-3/resolver-addendum.md).
 *
 * Backfills the program-owned half of the Brand/Program ownership split onto
 * each brand's active program:
 *   - Brand.contactEmail/contactPhone/contactWhatsapp/contactAddress ->
 *     Program.contactEmail/contactPhone/contactWhatsapp/contactAddress
 *   - Brand.metadata's 7 landing keys -> Program.landingContent
 *   - Brand.metadata.impact_stats (byte-identical on China/MEYS/Korea) -> a
 *     single PlatformSetting row, key 'impact_stats'
 *
 * DEVIATION FROM THE ORIGINAL TASK 12 BRIEF, per the resolver addendum
 * (which explicitly overrides this brief where they conflict): the brief's
 * first draft resolved "the active program" TWICE per brand — once using
 * settings.strategy.ts's orderBy (year/createdAt) for contact, once using
 * home.strategy.ts's orderBy (startDate) for landing content — because
 * those two read paths used different queries and could disagree. The
 * addendum instead mandates ONE shared resolver
 * (@shared/utils/active-program-resolver) used by every contact/landing
 * call site, contact and landing alike, including the future read-path
 * migrations (Tasks 15/16). Once those land, settings.strategy.ts and
 * home.strategy.ts read via the identical resolver, so backfilling contact
 * and landing content onto a single resolved program per brand is what
 * actually keeps the write and read paths in agreement -- resolving twice
 * here would instead re-introduce exactly the drift the addendum exists to
 * close. See the addendum for the full reasoning and the production data
 * (Vietnam Youth Summit, Korea Youth Summit) that makes the fallback
 * necessary.
 *
 * DRY RUN by default. Prints a per-brand outcome table (every brand gets an
 * explicit line -- applied / skipped-with-reason / unchanged -- a brand
 * silently missing from the report is this project's signature defect) plus
 * a full backup JSON of every planned write to
 * services/api/scripts/backups/ before mutating anything. Pass --apply to
 * actually perform the backfill.
 *
 * Idempotent: planContactBackfill/planLandingContentBackfill never overwrite
 * a Program field that already has a value, so a second run (after --apply)
 * sees the just-written values and reports them as already-populated /
 * merges landingContent onto itself -- no double-apply, no corruption.
 * impact_stats is a key-based upsert -- re-applying the same value is a
 * no-op write.
 *
 * Lives under src/scripts/ (not the top-level scripts/) so its pure
 * planning functions are covered by this repo's jest config (rootDir:
 * "src"), matching the existing
 * src/scripts/backfill-orphaned-cancellations.ts precedent.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-program-content-ownership.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-program-content-ownership.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Production execution is a separate
 * human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { PROGRAM_LANDING_CONTENT_KEYS } from '../modules/programs/application/copy/program-landing-content.constants';
import {
    resolveActiveProgram,
    describeActiveProgramRule,
    type ActiveProgramResolutionRule,
} from '../shared/utils/active-program-resolver';

// The message used whenever the shared resolver's rule 3 fires (the brand
// has no non-deleted programs at all). Identical string in both plan
// functions on purpose -- one skip vocabulary, not two that can drift.
const NO_RESOLVABLE_PROGRAM_REASON =
    'no resolvable program for this brand (resolver rule 3 -- brand has no non-deleted programs at all)';

// ─── Pure logic (unit-tested in backfill-program-content-ownership.spec.ts) ─

type ContactScalars = {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
};

export interface ContactBackfillInput {
    brandId: string;
    brandName: string;
    brand: ContactScalars;
    activeProgram: (ContactScalars & { id: string; name: string }) | null;
}

export interface ContactBackfillPlan {
    brandId: string;
    brandName: string;
    programId?: string;
    programName?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactAddress?: string;
    skippedReason?: string;
}

export function planContactBackfill(input: ContactBackfillInput): ContactBackfillPlan | null {
    const hasAnyContact =
        !!input.brand.contactEmail || !!input.brand.contactPhone || !!input.brand.contactWhatsapp || !!input.brand.contactAddress;
    if (!hasAnyContact) return null;

    if (!input.activeProgram) {
        return {
            brandId: input.brandId,
            brandName: input.brandName,
            skippedReason: NO_RESOLVABLE_PROGRAM_REASON,
        };
    }

    const plan: ContactBackfillPlan = {
        brandId: input.brandId,
        brandName: input.brandName,
        programId: input.activeProgram.id,
        programName: input.activeProgram.name,
    };

    // Never overwrite a program contact field that already has a value —
    // this backfill fills a gap, it does not clobber content a program may
    // already carry (e.g. from a prior manual entry or a copy-from-program
    // action run before this script executes).
    if (input.brand.contactEmail && !input.activeProgram.contactEmail) plan.contactEmail = input.brand.contactEmail;
    if (input.brand.contactPhone && !input.activeProgram.contactPhone) plan.contactPhone = input.brand.contactPhone;
    if (input.brand.contactWhatsapp && !input.activeProgram.contactWhatsapp) plan.contactWhatsapp = input.brand.contactWhatsapp;
    if (input.brand.contactAddress && !input.activeProgram.contactAddress) plan.contactAddress = input.brand.contactAddress;

    const wroteAnything =
        plan.contactEmail !== undefined || plan.contactPhone !== undefined || plan.contactWhatsapp !== undefined || plan.contactAddress !== undefined;
    if (!wroteAnything) {
        return {
            brandId: input.brandId,
            brandName: input.brandName,
            skippedReason: 'active program already has contact info for every field the brand carries',
        };
    }

    return plan;
}

export interface LandingContentBackfillInput {
    brandId: string;
    brandName: string;
    metadata: Record<string, unknown> | null;
    activeProgram: { id: string; name: string; landingContent: Record<string, unknown> } | null;
}

export interface LandingContentBackfillPlan {
    brandId: string;
    brandName: string;
    programId?: string;
    programName?: string;
    landingContent?: Record<string, unknown>;
    skippedReason?: string;
}

export function planLandingContentBackfill(input: LandingContentBackfillInput): LandingContentBackfillPlan | null {
    const metadata = input.metadata ?? {};
    const carried = Object.fromEntries(
        PROGRAM_LANDING_CONTENT_KEYS.map((key) => [key, metadata[key]]).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(carried).length === 0) return null; // {} metadata (Japan/World Youth Fest) or no landing keys at all

    if (!input.activeProgram) {
        return {
            brandId: input.brandId,
            brandName: input.brandName,
            skippedReason: NO_RESOLVABLE_PROGRAM_REASON,
        };
    }

    // Merge, don't replace — the target program's landingContent may already
    // carry keys (e.g. re-running this script after a partial --apply, or a
    // program that already had some sections entered through the admin UI).
    return {
        brandId: input.brandId,
        brandName: input.brandName,
        programId: input.activeProgram.id,
        programName: input.activeProgram.name,
        landingContent: { ...input.activeProgram.landingContent, ...carried },
    };
}

export interface ImpactStatsBackfillPlan {
    value: Record<string, unknown>;
    sourceBrands: string[];
    disagreement: boolean;
}

export function planImpactStatsBackfill(
    carriers: Array<{ brandName: string; value: Record<string, unknown> }>,
): ImpactStatsBackfillPlan | null {
    if (carriers.length === 0) return null;

    const first = carriers[0].value;
    const disagreement = carriers.some((c) => JSON.stringify(c.value) !== JSON.stringify(first));

    return {
        value: first,
        sourceBrands: carriers.map((c) => c.brandName),
        disagreement,
    };
}

// ─── DB-touching wrapper ─────────────────────────────────────────────────

interface ResolvedProgramRow {
    id: string;
    name: string;
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
    landingContent: Prisma.JsonValue;
}

/* istanbul ignore next -- exercised by dry-run inspection, not a DB-backed Jest test (see Global Constraints) */
async function runScript(): Promise<void> {
    loadEnv({ path: join(__dirname, '..', '..', '.env') });
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
    }

    const APPLY = process.argv.includes('--apply');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log(`[backfill-program-content-ownership] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

        const brands = await prisma.brand.findMany({
            where: { deletedAt: null },
            select: {
                id: true, name: true, metadata: true,
                contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true,
            },
            orderBy: { name: 'asc' },
        });

        const contactPlans: ContactBackfillPlan[] = [];
        const landingPlans: LandingContentBackfillPlan[] = [];
        const impactStatsCarriers: Array<{ brandName: string; value: Record<string, unknown> }> = [];
        const resolutionByBrand: Array<{ brandName: string; programName: string | null; rule: ActiveProgramResolutionRule }> = [];

        for (const brand of brands) {
            // ONE shared resolution per brand (per the resolver addendum —
            // see this file's header for why this deliberately differs from
            // the brief's original "resolve twice, once per orderBy" draft).
            const resolution = await resolveActiveProgram<ResolvedProgramRow>(
                (args) =>
                    prisma.program.findFirst({
                        ...args,
                        select: {
                            id: true, name: true,
                            contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true,
                            landingContent: true,
                        },
                    }),
                brand.id,
            );

            resolutionByBrand.push({
                brandName: brand.name,
                programName: resolution.program?.name ?? null,
                rule: resolution.rule,
            });
            console.log(
                `[backfill-program-content-ownership] ${brand.name} -> ${resolution.program?.name ?? 'NO PROGRAM'} ` +
                `(${describeActiveProgramRule(resolution.rule)})`,
            );

            const activeProgram = resolution.program;

            const contactPlan = planContactBackfill({
                brandId: brand.id,
                brandName: brand.name,
                brand: { contactEmail: brand.contactEmail, contactPhone: brand.contactPhone, contactWhatsapp: brand.contactWhatsapp, contactAddress: brand.contactAddress },
                activeProgram: activeProgram
                    ? {
                        id: activeProgram.id,
                        name: activeProgram.name,
                        contactEmail: activeProgram.contactEmail,
                        contactPhone: activeProgram.contactPhone,
                        contactWhatsapp: activeProgram.contactWhatsapp,
                        contactAddress: activeProgram.contactAddress,
                    }
                    : null,
            });
            if (contactPlan) contactPlans.push(contactPlan);

            const landingPlan = planLandingContentBackfill({
                brandId: brand.id,
                brandName: brand.name,
                metadata: brand.metadata as unknown as Record<string, unknown> | null,
                activeProgram: activeProgram
                    ? { id: activeProgram.id, name: activeProgram.name, landingContent: (activeProgram.landingContent as Record<string, unknown>) ?? {} }
                    : null,
            });
            if (landingPlan) landingPlans.push(landingPlan);

            const impactStats = (brand.metadata as unknown as Record<string, unknown> | null)?.impact_stats;
            if (impactStats && typeof impactStats === 'object') {
                impactStatsCarriers.push({ brandName: brand.name, value: impactStats as Record<string, unknown> });
            }
        }

        const impactStatsPlan = planImpactStatsBackfill(impactStatsCarriers);

        // ── Summary ──
        const writableContact = contactPlans.filter((p) => !p.skippedReason);
        const writableLanding = landingPlans.filter((p) => !p.skippedReason);
        const noResolvableProgramCount = [...contactPlans, ...landingPlans].filter(
            (p) => p.skippedReason === NO_RESOLVABLE_PROGRAM_REASON,
        ).length;

        console.log(`[backfill-program-content-ownership] contact: ${writableContact.length} program(s) to backfill, ${contactPlans.length - writableContact.length} skipped.`);
        console.table(writableContact.map((p) => ({ brand: p.brandName, program: p.programName, email: p.contactEmail ?? '-', phone: p.contactPhone ?? '-', whatsapp: p.contactWhatsapp ?? '-', address: p.contactAddress ? 'set' : '-' })));

        console.log(`[backfill-program-content-ownership] landing content: ${writableLanding.length} program(s) to backfill, ${landingPlans.length - writableLanding.length} skipped.`);
        console.table(writableLanding.map((p) => ({ brand: p.brandName, program: p.programName, keys: p.landingContent ? Object.keys(p.landingContent).join(', ') : '-' })));

        if (impactStatsPlan) {
            console.log(
                `[backfill-program-content-ownership] impact_stats: carried by ${impactStatsPlan.sourceBrands.join(', ')} — ` +
                `${impactStatsPlan.disagreement ? 'DISAGREE, using the first-seen value, VERIFY before --apply' : 'all agree'}.`,
            );
            console.log(JSON.stringify(impactStatsPlan.value, null, 2));
        } else {
            console.log('[backfill-program-content-ownership] impact_stats: no brand carries it — nothing to backfill to PlatformSetting.');
        }

        // Per-brand outcome — every brand gets an explicit row, so none can
        // silently vanish from the report.
        console.log('[backfill-program-content-ownership] per-brand outcome:');
        console.table(
            brands.map((brand) => {
                const resolved = resolutionByBrand.find((r) => r.brandName === brand.name);
                const contact = contactPlans.find((p) => p.brandId === brand.id);
                const landing = landingPlans.find((p) => p.brandId === brand.id);
                return {
                    brand: brand.name,
                    resolvedProgram: resolved?.programName ?? 'NONE',
                    rule: resolved ? describeActiveProgramRule(resolved.rule) : '-',
                    contact: !contact ? 'no contact data on brand' : contact.skippedReason ? `skipped: ${contact.skippedReason}` : 'to apply',
                    landing: !landing ? 'no landing keys in metadata' : landing.skippedReason ? `skipped: ${landing.skippedReason}` : 'to apply',
                };
            }),
        );

        console.log(
            `[backfill-program-content-ownership] resolver check: ${noResolvableProgramCount} skip(s) for ` +
            `"no resolvable program" across ${brands.length} brand(s) (addendum requires 0 for the 8 live brands).`,
        );

        const backupDir = join(__dirname, '..', '..', 'scripts', 'backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `backfill-program-content-ownership-${stamp}.json`);
        writeFileSync(backupPath, JSON.stringify({ resolutionByBrand, contactPlans, landingPlans, impactStatsPlan }, null, 2));
        console.log(`[backfill-program-content-ownership] backup written: ${backupPath}`);

        if (!APPLY) {
            console.log('[backfill-program-content-ownership] DRY RUN complete. Re-run with --apply to write the above.');
            return;
        }

        if (impactStatsPlan?.disagreement) {
            throw new Error(
                'impact_stats values disagree across brands — refusing to --apply. Resolve manually (this is exactly ' +
                'the kind of silent drift PlatformSetting exists to prevent going forward) and re-run.',
            );
        }

        await prisma.$transaction(async (tx) => {
            // Merge contact + landing writes per program — with one shared
            // resolution per brand, both plans (when present) target the
            // same program, so this is one update per program, not two.
            const programUpdates = new Map<string, Prisma.ProgramUpdateInput>();
            for (const p of writableContact) {
                const data = programUpdates.get(p.programId!) ?? {};
                programUpdates.set(p.programId!, {
                    ...data,
                    ...(p.contactEmail !== undefined && { contactEmail: p.contactEmail }),
                    ...(p.contactPhone !== undefined && { contactPhone: p.contactPhone }),
                    ...(p.contactWhatsapp !== undefined && { contactWhatsapp: p.contactWhatsapp }),
                    ...(p.contactAddress !== undefined && { contactAddress: p.contactAddress }),
                });
            }
            for (const p of writableLanding) {
                const data = programUpdates.get(p.programId!) ?? {};
                programUpdates.set(p.programId!, {
                    ...data,
                    landingContent: p.landingContent as Prisma.InputJsonValue,
                });
            }
            for (const [programId, data] of programUpdates) {
                await tx.program.update({ where: { id: programId }, data });
            }

            if (impactStatsPlan) {
                await tx.platformSetting.upsert({
                    where: { key: 'impact_stats' },
                    create: { key: 'impact_stats', value: impactStatsPlan.value as Prisma.InputJsonValue, updatedBy: null },
                    update: { value: impactStatsPlan.value as Prisma.InputJsonValue, updatedBy: null },
                });
            }
        });

        console.log(
            `[backfill-program-content-ownership] backfilled contact on ${writableContact.length} program(s), ` +
            `landing content on ${writableLanding.length} program(s)${impactStatsPlan ? ', and impact_stats on PlatformSetting' : ''}.`,
        );
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    runScript().catch((err) => {
        console.error('[backfill-program-content-ownership] FAILED:', err);
        process.exitCode = 1;
    });
}
