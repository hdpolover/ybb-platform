// services/api/scripts/strip-migrated-brand-metadata-keys.ts
/**
 * strip-migrated-brand-metadata-keys.ts
 *
 * Phase 3 Task 21 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Removes every Brand.metadata key that this phase migrated elsewhere, now
 * that Tasks 11-12's backfills, Tasks 15-16's read switch, and Task 18's
 * verification are all confirmed:
 *   - To Program.landingContent (Task 12): benefits, features, promo_cta,
 *     moments_shorts, further_information, payment_info, participant_demographics
 *   - To PlatformSetting (Task 12): impact_stats
 *   - To typed Brand columns (Task 11): tagline, objectives, coreValues
 *   - Deleted without migration (spec: "no brand has it set" in production):
 *     program_objectives
 *
 * Leaves untouched: section_background, recognition, apple_icon_url,
 * favicon_url, partners_canva_url, affiliateCommission — all Brand-owned,
 * per the spec's ownership split.
 *
 * DRY RUN by default. Prints a bucketed summary and writes a full backup
 * JSON of every brand's metadata BEFORE stripping to ./backups/ (on top of,
 * not instead of, Task 10's earlier full dump — this one captures state
 * immediately before the strip, closer to the point of no return).
 * Pass --apply to actually strip.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register scripts/strip-migrated-brand-metadata-keys.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/strip-migrated-brand-metadata-keys.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Production execution, after Task 20's
 * admin UI cutover has shipped, is a separate human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';

const KEYS_TO_STRIP = [
    'benefits', 'features', 'promo_cta', 'moments_shorts', 'further_information', 'payment_info', 'participant_demographics',
    'impact_stats',
    'tagline', 'objectives', 'coreValues',
    'program_objectives',
] as const;

export function stripMigratedKeys(metadata: Record<string, unknown> | null): { stripped: Record<string, unknown>; removedKeys: string[] } {
    const source = metadata ?? {};
    const removedKeys = KEYS_TO_STRIP.filter((key) => key in source);
    const stripped = Object.fromEntries(Object.entries(source).filter(([key]) => !(KEYS_TO_STRIP as readonly string[]).includes(key)));
    return { stripped, removedKeys };
}

/* istanbul ignore next -- exercised by dry-run inspection, not a DB-backed Jest test (see Global Constraints) */
async function main(): Promise<void> {
    loadEnv({ path: join(__dirname, '..', '.env') });
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
    }

    const APPLY = process.argv.includes('--apply');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log(`[strip-migrated-brand-metadata-keys] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

        const brands = await prisma.brand.findMany({ where: { deletedAt: null }, select: { id: true, name: true, metadata: true } });

        const plans = brands.map((b) => {
            const { stripped, removedKeys } = stripMigratedKeys(b.metadata as Record<string, unknown> | null);
            return { brandId: b.id, brandName: b.name, stripped, removedKeys };
        });

        const withRemovals = plans.filter((p) => p.removedKeys.length > 0);
        console.log(`[strip-migrated-brand-metadata-keys] ${withRemovals.length}/${plans.length} brand(s) have keys to strip.`);
        console.table(withRemovals.map((p) => ({ brand: p.brandName, removedKeys: p.removedKeys.join(', ') })));

        if (withRemovals.length === 0) {
            console.log('[strip-migrated-brand-metadata-keys] nothing to do.');
            return;
        }

        const backupDir = join(__dirname, 'backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `strip-migrated-brand-metadata-keys-${stamp}.json`);
        writeFileSync(
            backupPath,
            JSON.stringify(
                brands.map((b) => ({ brandId: b.id, brandName: b.name, metadataBeforeStrip: b.metadata })),
                null,
                2,
            ),
        );
        console.log(`[strip-migrated-brand-metadata-keys] backup written: ${backupPath}`);

        if (!APPLY) {
            console.log('[strip-migrated-brand-metadata-keys] DRY RUN complete. Re-run with --apply to strip the keys above.');
            return;
        }

        await prisma.$transaction(
            withRemovals.map((p) =>
                prisma.brand.update({ where: { id: p.brandId }, data: { metadata: p.stripped as Prisma.InputJsonValue } }),
            ),
        );
        console.log(`[strip-migrated-brand-metadata-keys] stripped keys from ${withRemovals.length} brand(s).`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[strip-migrated-brand-metadata-keys] FAILED:', err);
        process.exitCode = 1;
    });
}
