/**
 * 2026-08-25-fix-file-brand-attribution.ts
 *
 * One-off backfill: services/file's `files` table (program-scoped uploads) has
 * files.brand_id mis-stamped for rows where program_id IS NOT NULL. Root cause
 * (see fix/file-brand-attribution): FilesController.requestUploadUrl forced
 * brand_id from the uploader's JWT home brand instead of deriving it from the
 * program being uploaded to, so a multi-brand/super admin uploading to another
 * brand's program silently mis-stamped the file with their own home brand.
 * That code path is now fixed going forward; this script repairs the rows it
 * already wrote wrong.
 *
 * Known prod shape (verified 2026-08-25): 314 rows carry a program_id under
 * China's brand id — 202 of those are actually China's own (correct, left
 * alone), 112 are mis-stamped (Istanbul 62, MEYS 28, Korea 14, YAF 10).
 *
 * CROSS-DATABASE: the two facts this script joins live in DIFFERENT Postgres
 * databases, owned by different services — there is no FK between them:
 *   - files.program_id / files.brand_id            -> file service's own DB
 *     (ybb_files_db, container ybb-prod-postgres-file), via FILE_DATABASE_URL.
 *   - programs.id -> programs.brand_id (the source of truth for "which brand
 *     does this program belong to") -> api's DB (ybb_platform_db), via Prisma
 *     /DATABASE_URL, same as every other script in this directory.
 * We connect to both and join in application code (fetch program->brand map
 * from the api DB, then compare/update file rows in the file DB directly with
 * `pg`, since the file service's schema isn't part of this project's Prisma
 * client).
 *
 * Rows with program_id IS NULL are NOT in scope — there is no program to
 * derive the correct brand from, so they cannot be fixed by this script. They
 * are counted and reported, not touched.
 *
 * SAFETY: DRY RUN by default (read-only, prints a report, no writes). Pass
 * --apply to write. Idempotent: a row already matching its program's brand is
 * left untouched (whether or not it was ever wrong).
 *
 * USAGE (from services/api):
 *   FILE_DATABASE_URL=postgres://... npx ts-node scripts/2026-08-25-fix-file-brand-attribution.ts            # dry run
 *   FILE_DATABASE_URL=postgres://... npx ts-node scripts/2026-08-25-fix-file-brand-attribution.ts --apply    # execute
 *
 * FILE_DATABASE_URL is intentionally NOT stored in services/api/.env (this
 * service has no business writing to the file service's DB in normal
 * operation) — pass it explicitly, matching services/file/.env's own
 * DATABASE_URL value (see services/file/.env.example: postgresql://ybb_user:...@postgres-file:5432/ybb_files_db).
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(__dirname, '..', '.env') });

const apiConnectionString = process.env.DATABASE_URL;
if (!apiConnectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

const fileConnectionString = process.env.FILE_DATABASE_URL;
if (!fileConnectionString) {
    throw new Error(
        'FILE_DATABASE_URL is not set. Point it at the file service\'s Postgres ' +
        '(ybb_files_db) - see services/file/.env.example DATABASE_URL for the value to reuse.',
    );
}

const apiPool = new Pool({ connectionString: apiConnectionString });
const adapter = new PrismaPg(apiPool);
const prisma = new PrismaClient({ adapter });
const filePool = new Pool({ connectionString: fileConnectionString });

const APPLY = process.argv.includes('--apply');
const BATCH_SIZE = 500;

interface FileProgramRow {
    id: string;
    program_id: string;
    brand_id: string;
}

async function fetchProgramBrandMap(programIds: string[]): Promise<Map<string, string>> {
    const map = new Map<string, string>();
    for (let i = 0; i < programIds.length; i += BATCH_SIZE) {
        const chunk = programIds.slice(i, i + BATCH_SIZE);
        const programs = await prisma.program.findMany({
            where: { id: { in: chunk } },
            select: { id: true, brandId: true },
        });
        for (const program of programs) {
            map.set(program.id, program.brandId);
        }
    }
    return map;
}

async function main(): Promise<void> {
    console.log(`[fix-file-brand-attribution] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

    const { rows: programScopedFiles } = await filePool.query<FileProgramRow>(
        `SELECT id, program_id, brand_id
         FROM files
         WHERE program_id IS NOT NULL AND is_deleted = false`,
    );
    const { rows: nullProgramCountRows } = await filePool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM files WHERE program_id IS NULL AND is_deleted = false`,
    );
    const nullProgramCount = Number(nullProgramCountRows[0]?.count ?? 0);

    console.log(`[fix-file-brand-attribution] program-scoped files: ${programScopedFiles.length}`);
    console.log(
        `[fix-file-brand-attribution] files with NO program_id (not fixable by this script, left alone): ${nullProgramCount}`,
    );

    // program_id on the file row is a varchar copy of a Program uuid, not an FK —
    // some may reference a since-deleted/renamed program. Those are reported and
    // skipped rather than guessed at.
    const programIds = [...new Set(programScopedFiles.map((f) => f.program_id))];
    const brandByProgram = await fetchProgramBrandMap(programIds);

    let alreadyCorrect = 0;
    let unresolvableProgram = 0;
    const toUpdate: Array<{ id: string; currentBrandId: string; correctBrandId: string }> = [];

    for (const file of programScopedFiles) {
        const correctBrandId = brandByProgram.get(file.program_id);
        if (!correctBrandId) {
            unresolvableProgram += 1;
            continue;
        }
        if (correctBrandId === file.brand_id) {
            alreadyCorrect += 1;
            continue;
        }
        toUpdate.push({ id: file.id, currentBrandId: file.brand_id, correctBrandId });
    }

    console.log(`[fix-file-brand-attribution] already correctly attributed: ${alreadyCorrect}`);
    console.log(
        `[fix-file-brand-attribution] program_id does not resolve to any known Program (skipped, not touched): ${unresolvableProgram}`,
    );
    console.log(`[fix-file-brand-attribution] mis-attributed rows needing update: ${toUpdate.length}`);

    // Group by from->to brand pair, purely for a readable report.
    const byPair = new Map<string, number>();
    for (const row of toUpdate) {
        const key = `${row.currentBrandId} -> ${row.correctBrandId}`;
        byPair.set(key, (byPair.get(key) ?? 0) + 1);
    }
    for (const [pair, count] of byPair.entries()) {
        console.log(`[fix-file-brand-attribution]   ${pair}: ${count} row(s)`);
    }

    if (!APPLY) {
        console.log('[fix-file-brand-attribution] DRY RUN complete. Re-run with --apply to write.');
        return;
    }

    if (toUpdate.length === 0) {
        console.log('[fix-file-brand-attribution] nothing to update.');
        return;
    }

    // Per-row updates (not a single transaction): each write is independently
    // idempotent (re-running skips already-correct rows), so a partial failure
    // just means re-running the script picks up where it left off.
    let updated = 0;
    for (const row of toUpdate) {
        await filePool.query(`UPDATE files SET brand_id = $1, updated_at = now() WHERE id = $2`, [
            row.correctBrandId,
            row.id,
        ]);
        updated += 1;
    }
    console.log(`[fix-file-brand-attribution] updated ${updated} file row(s).`);
}

main()
    .catch((err) => {
        console.error('[fix-file-brand-attribution] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await apiPool.end();
        await filePool.end();
    });
