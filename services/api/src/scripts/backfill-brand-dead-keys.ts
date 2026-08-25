// services/api/src/scripts/backfill-brand-dead-keys.ts
/**
 * backfill-brand-dead-keys.ts
 *
 * Phase 3 Task 11 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Finishes the migration prisma/seeds/internal/migrate-brands.ts started:
 * objectives -> Brand.vision, coreValues -> Brand.mission, tagline -> the
 * Brand.tagline column. Targets exactly Korea Youth Summit, Vietnam Youth
 * Summit, and Youth Academic Forum per the spec's audit — every other
 * brand's metadata has none of these three keys and is a no-op.
 *
 * Does NOT touch Brand.metadata — the dead keys are left in place until
 * Task 21 strips them, after the read switch and verification confirm
 * nothing regressed.
 *
 * DRY RUN by default. Prints a bucketed summary and writes a full backup
 * JSON of every planned write to services/api/scripts/backups/ (the same
 * gitignored, PII-excluded directory Task 10's dump and
 * revert-unpaid-submissions.ts use) before mutating anything. Pass --apply
 * to actually perform the backfill.
 *
 * Lives under src/scripts/ (not the top-level scripts/) so its pure
 * planning functions are covered by this repo's jest config (rootDir:
 * "src" — a spec file outside src/ is never discovered), matching the
 * existing src/scripts/backfill-orphaned-cancellations.ts precedent.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-brand-dead-keys.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register src/scripts/backfill-brand-dead-keys.ts --apply    # execute
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
import { PrismaClient } from '@prisma/client';

// ─── Pure logic (unit-tested in backfill-brand-dead-keys.spec.ts) ──────────

export interface BrandDeadKeysSnapshot {
    brandId: string;
    brandName: string;
    metadata: Record<string, unknown> | null;
    currentVision: string | null;
    currentMission: string | null;
    currentTagline: string | null;
}

export interface BrandDeadKeysBackfillPlan {
    brandId: string;
    brandName: string;
    vision?: string;
    mission?: string;
    tagline?: string;
    skippedReason?: string;
}

// The one known corruption: UTF-8 bullet bytes (E2 80 A2) decoded as
// Latin-1/cp1252 produce this exact three-character sequence. Targeted
// string replace, not a blanket Buffer.from(text, 'latin1').toString('utf8')
// re-decode of the whole string — the spec confirms the corruption is
// confined to the bullet character, so a targeted fix can't mangle any
// correctly-encoded text elsewhere in the same string the way a blanket
// re-decode risks doing (see the "clean string with other non-ASCII
// characters" spec case: a literal substring replace can only ever touch
// this exact sequence, so it is provably incapable of corrupting anything
// that doesn't contain it).
const MOJIBAKE_BULLET = 'â€¢';

export function fixMojibakeBullets(text: string): string {
    return text.split(MOJIBAKE_BULLET).join('•');
}

function readTrimmedStringKey(metadata: Record<string, unknown>, key: string): string | undefined {
    const raw = metadata[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function planBrandDeadKeysBackfill(snapshot: BrandDeadKeysSnapshot): BrandDeadKeysBackfillPlan | null {
    const metadata = snapshot.metadata ?? {};
    const objectives = readTrimmedStringKey(metadata, 'objectives');
    const coreValues = readTrimmedStringKey(metadata, 'coreValues');
    const tagline = readTrimmedStringKey(metadata, 'tagline');

    if (objectives === undefined && coreValues === undefined && tagline === undefined) {
        return null; // nothing to backfill for this brand
    }

    const plan: BrandDeadKeysBackfillPlan = { brandId: snapshot.brandId, brandName: snapshot.brandName };

    // Never overwrite a typed column that already has content — it may have
    // been set directly through the admin UI since this metadata key was
    // written, and this backfill's job is to fill a gap, not clobber a
    // newer value.
    if (objectives !== undefined && !snapshot.currentVision) {
        plan.vision = fixMojibakeBullets(objectives);
    }
    if (coreValues !== undefined && !snapshot.currentMission) {
        plan.mission = coreValues;
    }
    if (tagline !== undefined && !snapshot.currentTagline) {
        plan.tagline = tagline;
    }

    if (plan.vision === undefined && plan.mission === undefined && plan.tagline === undefined) {
        return {
            brandId: snapshot.brandId,
            brandName: snapshot.brandName,
            skippedReason: 'typed columns already populated; metadata key(s) present but would be overwritten, not applied',
        };
    }

    return plan;
}

// ─── DB-touching wrapper ─────────────────────────────────────────────────

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
        console.log(`[backfill-brand-dead-keys] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

        const brands = await prisma.brand.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, metadata: true, vision: true, mission: true, tagline: true },
        });

        const plans = brands
            .map((b) =>
                planBrandDeadKeysBackfill({
                    brandId: b.id,
                    brandName: b.name,
                    metadata: b.metadata as unknown as Record<string, unknown> | null,
                    currentVision: b.vision,
                    currentMission: b.mission,
                    currentTagline: b.tagline,
                }),
            )
            .filter((p): p is BrandDeadKeysBackfillPlan => p !== null);

        const writable = plans.filter((p) => !p.skippedReason);
        const skipped = plans.filter((p) => p.skippedReason);
        const noOpBrandNames = brands
            .map((b) => b.name)
            .filter((name) => !plans.some((p) => p.brandName === name));

        // Every brand gets an explicit line in the log — no brand may vanish
        // from the report silently (this project's signature defect class).
        console.log(
            `[backfill-brand-dead-keys] ${brands.length} brand(s) scanned -> ${writable.length} to backfill, ` +
            `${skipped.length} skipped (already populated), ${noOpBrandNames.length} no-op (no dead keys in metadata).`,
        );
        console.table(
            brands.map((b) => {
                const plan = plans.find((p) => p.brandId === b.id);
                const outcome = !plan ? 'no-op (no dead keys)' : plan.skippedReason ? `skipped: ${plan.skippedReason}` : 'to backfill';
                return {
                    brand: b.name,
                    outcome,
                    vision: plan && !plan.skippedReason ? (plan.vision ? 'set' : '-') : '-',
                    mission: plan && !plan.skippedReason ? (plan.mission ? 'set' : '-') : '-',
                    tagline: plan && !plan.skippedReason ? (plan.tagline ? 'set' : '-') : '-',
                };
            }),
        );

        if (writable.length === 0) {
            console.log('[backfill-brand-dead-keys] nothing to do.');
            return;
        }

        // Backups land in the top-level services/api/scripts/backups/ directory
        // (gitignored, PII-excluded) alongside Task 10's dump, regardless of
        // this script's own location under src/scripts/.
        const backupDir = join(__dirname, '..', '..', 'scripts', 'backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `backfill-brand-dead-keys-${stamp}.json`);
        writeFileSync(backupPath, JSON.stringify({ writable, skipped }, null, 2));
        console.log(`[backfill-brand-dead-keys] backup written: ${backupPath}`);

        if (!APPLY) {
            console.log('[backfill-brand-dead-keys] DRY RUN complete. Re-run with --apply to write the columns above.');
            return;
        }

        await prisma.$transaction(
            writable.map((p) =>
                prisma.brand.update({
                    where: { id: p.brandId },
                    data: {
                        ...(p.vision !== undefined && { vision: p.vision }),
                        ...(p.mission !== undefined && { mission: p.mission }),
                        ...(p.tagline !== undefined && { tagline: p.tagline }),
                    },
                }),
            ),
        );
        console.log(`[backfill-brand-dead-keys] backfilled ${writable.length} brand(s).`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    runScript().catch((err) => {
        console.error('[backfill-brand-dead-keys] FAILED:', err);
        process.exitCode = 1;
    });
}
