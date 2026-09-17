/**
 * cleanup-phantom-edition-drafts.ts
 *
 * One-off remediation for the MEYS 6th/7th login bug. Until 5441a62a, every
 * login carried the brand's currently-open program (the BFF attaches it), and
 * ensureProgramApplication CREATED a draft application on it for anyone who did
 * not already have one. Once two editions overlapped, every returning 6th
 * participant who logged in silently got an empty 7th-edition draft. Those
 * phantoms still exist: they put a second program in the participant's
 * switcher, they were what the login response pinned the dashboard to, and
 * they inflate the 7th's applicant numbers. 5441a62a stopped new ones; this
 * removes the ones already made.
 *
 * WHAT COUNTS AS A PHANTOM (every condition must hold, re-checked inside the
 * DELETE so a participant who starts filling one in between the dry run and
 * --apply is left alone):
 *   - live (deleted_at IS NULL), status 'draft', no submission_date, not withdrawn
 *   - never edited: last_edited_at IS NULL
 *   - no pricing tier, participation category, or referral code chosen
 *   - registration AND program payment status both 'unpaid'
 *   - personal_data / essay_answers / uploaded_files empty ({}), document_files /
 *     requirement_files empty or null, status_history empty or null
 *   - no motivation letter, achievements, experiences, twibbon link
 *   - no score / review / reviewer, no post-payment follow-up sent
 *   - no row in ANY table that references the application: application_invoices,
 *     participant_documents, application_reviews, application_assessments,
 *     application_edit_history, participant_awards (every FK to
 *     participant_applications in prisma/schema), plus payment_outbox_events
 *     whose aggregate_id is the application (a loose, non-FK reference)
 *   - the participant holds ANOTHER live application in the SAME brand that was
 *     created EARLIER. This is what makes it a phantom rather than a genuine
 *     first registration someone simply has not started yet.
 *
 * submission_reminder_logs is the one loose-reference table that is NOT a
 * disqualifier: the deadline cron writes a row for every unsubmitted draft, so
 * a phantom having been nagged says nothing about the participant. Those rows
 * are backed up and deleted with their application (there is no FK to cascade).
 *
 * WHY A HARD DELETE: ParticipantApplication has @@unique([participantId,
 * programId]), and PrismaService's soft-delete extension hides rows with
 * deleted_at set. A soft-deleted phantom would be invisible to
 * ensureProgramApplication's existence check, so the participant's first
 * DELIBERATE registration for that edition would hit the unique constraint and
 * fail. The row is empty by construction (see above) and fully backed up.
 *
 * SAFETY:
 *   - DRY RUN by default: prints counts per brand/program + a sample, writes a
 *     FULL JSON backup of every matching row to ./backups/. No changes.
 *   - --apply deletes inside one transaction, re-checking every condition, and
 *     writes a second backup of exactly what was deleted.
 *   - Afterwards it busts the affected participants' portal caches in Redis
 *     (same keys CacheService.invalidatePortalCache clears) when REDIS_HOST /
 *     REDIS_PASSWORD are set; otherwise it prints the key patterns to clear.
 *
 * ARGS:
 *   --apply                  execute (default is dry run)
 *   --brand=<uuid|slug>      limit to one brand
 *   --program=<uuid>         limit to phantoms on one program (e.g. MEYS 7th)
 *   With neither, every brand is scanned; only brands where some participant
 *   holds an older application in the same brand can match, by the criteria.
 *
 * USAGE (local, from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node scripts/cleanup-phantom-edition-drafts.ts --brand=meys
 *   npx ts-node scripts/cleanup-phantom-edition-drafts.ts --brand=meys --apply
 *
 * RUNNING IN PRODUCTION (a human-approved step; never from an agent session).
 * This script only needs pg + ioredis + dotenv, all production dependencies of
 * the API image, and deliberately does NOT bootstrap Nest (AppModule does not
 * start inside the prod container - see docs/handoff-2026-08-25-1828.md):
 *   1. Compile locally:
 *        npx tsc scripts/cleanup-phantom-edition-drafts.ts --outDir /tmp/phantom \
 *          --target es2021 --module commonjs --esModuleInterop --skipLibCheck
 *   2. scp /tmp/phantom/cleanup-phantom-edition-drafts.js ybb-vps:/tmp/
 *   3. On the VPS, find the API container (docker ps | grep ybb-platform-api)
 *      and copy the script into /app, where node_modules resolves:
 *        docker cp /tmp/cleanup-phantom-edition-drafts.js <api>:/app/cleanup-phantom-edition-drafts.js
 *      Backups are then written to /app/backups inside the container.
 *   4. Dry run; the container already has DATABASE_URL and REDIS_* set:
 *        docker exec -w /app <api> node cleanup-phantom-edition-drafts.js --brand=<meys-slug>
 *      Read the counts, then copy the backup out BEFORE applying:
 *        docker cp <api>:/app/backups/. ./phantom-backups/
 *   5. docker exec -w /app <api> node cleanup-phantom-edition-drafts.js --brand=<meys-slug> --apply
 *      and copy the apply-time backup out the same way.
 *   To cross-check the count first without the script, the same predicate can be
 *   run read-only through psql:
 *     docker exec ybb-platform-api-yeghdi-postgres-api-1 psql -U ybb_api_user -d ybb_platform_db
 *   If Redis is unreachable from the script, clear the printed patterns with
 *   redis-cli --scan --pattern ... | xargs redis-cli del inside the platform's
 *   redis container (ybb-platform-redis-service-omv9vw.1.*, NOT the ybb-redis decoy).
 */
import { join } from 'path';
import { writeFileSync, mkdirSync } from 'fs';
import { config as loadEnv } from 'dotenv';
import { Pool, PoolClient } from 'pg';
import Redis from 'ioredis';

// Load services/api/.env regardless of the directory the script is invoked
// from. A missing file is fine: in the container the env is already set.
loadEnv({ path: join(__dirname, '..', '.env') });

const LOG = '[cleanup-phantom-edition-drafts]';
const APPLY = process.argv.includes('--apply');

function readArg(name: string): string | undefined {
    const prefix = `--${name}=`;
    const hit = process.argv.find((arg) => arg.startsWith(prefix));
    const value = hit?.slice(prefix.length).trim();
    return value ? value : undefined;
}

const BRAND_ARG = readArg('brand');
const PROGRAM_ARG = readArg('program');

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

const pool = new Pool({ connectionString });

/**
 * The phantom predicate over alias `pa` (participant_applications) joined to
 * `p` (programs). $1 = brand id or NULL, $2 = program id or NULL.
 *
 * The json columns are `json`, not `jsonb`, so they are cast before comparing:
 * json has no equality operator, and a textual compare would miss '{ }'.
 */
const PHANTOM_PREDICATE = `
    pa.deleted_at IS NULL
    AND pa.status = 'draft'
    AND pa.submission_date IS NULL
    AND pa.withdrawn_at IS NULL
    AND pa.withdrawn_by IS NULL
    AND pa.last_edited_at IS NULL
    AND pa.pricing_tier_id IS NULL
    AND pa.participation_category_id IS NULL
    AND NULLIF(btrim(pa.referral_code), '') IS NULL
    AND pa.registration_payment_status = 'unpaid'
    AND pa.program_payment_status = 'unpaid'
    AND pa.personal_data::jsonb = '{}'::jsonb
    AND pa.essay_answers::jsonb = '{}'::jsonb
    AND pa.uploaded_files::jsonb = '{}'::jsonb
    AND (pa.document_files IS NULL OR pa.document_files::jsonb IN ('{}'::jsonb, '[]'::jsonb, 'null'::jsonb))
    AND (pa.requirement_files IS NULL OR pa.requirement_files::jsonb IN ('[]'::jsonb, '{}'::jsonb, 'null'::jsonb))
    AND (pa.status_history IS NULL OR pa.status_history::jsonb IN ('[]'::jsonb, 'null'::jsonb))
    AND NULLIF(btrim(pa.motivation_letter), '') IS NULL
    AND NULLIF(btrim(pa.achievements), '') IS NULL
    AND NULLIF(btrim(pa.experiences), '') IS NULL
    AND NULLIF(btrim(pa.twibbon_link), '') IS NULL
    AND pa.score_total IS NULL
    AND pa.score_breakdown IS NULL
    AND pa.score_status IS NULL
    AND pa.reviewed_by IS NULL
    AND pa.reviewed_at IS NULL
    AND NULLIF(btrim(pa.reviewer_notes), '') IS NULL
    AND pa.post_payment_followup_sent_at IS NULL
    AND NOT EXISTS (SELECT 1 FROM application_invoices x WHERE x.application_id = pa.id)
    AND NOT EXISTS (SELECT 1 FROM participant_documents x WHERE x.application_id = pa.id)
    AND NOT EXISTS (SELECT 1 FROM application_reviews x WHERE x.application_id = pa.id)
    AND NOT EXISTS (SELECT 1 FROM application_assessments x WHERE x.application_id = pa.id)
    AND NOT EXISTS (SELECT 1 FROM application_edit_history x WHERE x.application_id = pa.id)
    AND NOT EXISTS (SELECT 1 FROM participant_awards x WHERE x.application_id = pa.id)
    AND NOT EXISTS (SELECT 1 FROM payment_outbox_events x WHERE x.aggregate_id = pa.id::text)
    AND EXISTS (
        SELECT 1
        FROM participant_applications older
        JOIN programs op ON op.id = older.program_id
        WHERE older.participant_id = pa.participant_id
          AND older.id <> pa.id
          AND older.deleted_at IS NULL
          AND op.brand_id = p.brand_id
          AND older.created_at < pa.created_at
    )
    AND ($1::uuid IS NULL OR p.brand_id = $1::uuid)
    AND ($2::uuid IS NULL OR pa.program_id = $2::uuid)
`;

interface CandidateRow {
    id: string;
    participant_id: string;
    user_id: string;
    program_id: string;
    program_name: string;
    brand_id: string;
    created_at: Date;
}

async function resolveBrandId(client: PoolClient): Promise<string | null> {
    if (!BRAND_ARG) return null;

    const { rows } = await client.query<{ id: string; name: string }>(
        UUID_RE.test(BRAND_ARG)
            ? 'SELECT id, name FROM brands WHERE id = $1::uuid'
            : 'SELECT id, name FROM brands WHERE slug = $1',
        [BRAND_ARG],
    );
    if (rows.length === 0) {
        throw new Error(`Brand '${BRAND_ARG}' not found (pass a brand uuid or slug).`);
    }
    console.log(`${LOG} brand: ${rows[0].name} (${rows[0].id})`);
    return rows[0].id;
}

function resolveProgramId(): string | null {
    if (!PROGRAM_ARG) return null;
    if (!UUID_RE.test(PROGRAM_ARG)) {
        throw new Error(`--program must be a program uuid, got '${PROGRAM_ARG}'.`);
    }
    return PROGRAM_ARG;
}

function writeBackup(label: string, payload: unknown): string {
    const backupDir = join(__dirname, 'backups');
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const path = join(backupDir, `cleanup-phantom-edition-drafts-${label}-${stamp}.json`);
    writeFileSync(path, JSON.stringify(payload, null, 2));
    return path;
}

/**
 * The portal read caches key on (userId, programId), including a `latest`
 * variant resolved without a programId - which may be the deleted phantom.
 * Same set CacheService.invalidatePortalCache clears, plus the two
 * participant-scoped keys PortalCacheService fills.
 */
function cachePatternsFor(userId: string, participantId: string): string[] {
    return [
        `portal:dashboard:${userId}:*`,
        `portal:documents:${userId}:*`,
        `portal:submissions:${userId}:*`,
        `portal:submission-detail:${userId}:*`,
        `portal:payments:${userId}:*`,
        `participant:stats:${participantId}`,
        `participant:latest-app:${participantId}`,
    ];
}

async function invalidateCaches(affected: Array<{ userId: string; participantId: string }>): Promise<void> {
    const patterns = affected.flatMap((a) => cachePatternsFor(a.userId, a.participantId));
    const host = process.env.REDIS_HOST;
    const password = process.env.REDIS_PASSWORD;

    if (!host || !password) {
        console.log(`${LOG} REDIS_HOST/REDIS_PASSWORD not set, caches NOT cleared. Clear these patterns manually:`);
        patterns.forEach((pattern) => console.log(`  ${pattern}`));
        return;
    }

    const redis = new Redis({
        host,
        port: Number(process.env.REDIS_PORT ?? 6379),
        password,
        lazyConnect: true,
        maxRetriesPerRequest: 2,
    });

    let deleted = 0;
    try {
        await redis.connect();
        for (const pattern of patterns) {
            // Exact keys need no SCAN; patterns are per user so each scan is small.
            if (!pattern.includes('*')) {
                deleted += await redis.del(pattern);
                continue;
            }
            let cursor = '0';
            do {
                const [next, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 200);
                cursor = next;
                if (keys.length > 0) deleted += await redis.del(...keys);
            } while (cursor !== '0');
        }
        console.log(`${LOG} cleared ${deleted} cached key(s) for ${affected.length} participant(s).`);
    } catch (err) {
        // The data change is already committed; a cache miss here only means
        // stale entries until their TTL (<= 15 min). Say so rather than fail.
        const msg = err instanceof Error ? err.message : String(err);
        console.warn(`${LOG} Redis invalidation failed (${msg}). Entries expire on TTL; to clear now, delete:`);
        patterns.forEach((pattern) => console.log(`  ${pattern}`));
    } finally {
        redis.disconnect();
    }
}

async function main(): Promise<void> {
    console.log(`${LOG} mode: ${APPLY ? 'APPLY (will hard-delete matching drafts)' : 'DRY RUN (no changes)'}`);

    const client = await pool.connect();
    try {
        const brandId = await resolveBrandId(client);
        const programId = resolveProgramId();
        const params = [brandId, programId];

        const { rows: candidates } = await client.query<CandidateRow>(
            `SELECT pa.id, pa.participant_id, pt.user_id, pa.program_id, p.name AS program_name,
                    p.brand_id, pa.created_at
             FROM participant_applications pa
             JOIN programs p ON p.id = pa.program_id
             JOIN participants pt ON pt.id = pa.participant_id
             WHERE ${PHANTOM_PREDICATE}
             ORDER BY p.brand_id, pa.program_id, pa.created_at`,
            params,
        );

        if (candidates.length === 0) {
            console.log(`${LOG} nothing matches. Nothing to do.`);
            return;
        }

        const perProgram = new Map<string, { brandId: string; program: string; count: number }>();
        for (const row of candidates) {
            const entry = perProgram.get(row.program_id) ?? { brandId: row.brand_id, program: row.program_name, count: 0 };
            entry.count += 1;
            perProgram.set(row.program_id, entry);
        }
        console.log(`${LOG} ${candidates.length} phantom draft(s) match:`);
        console.table([...perProgram.entries()].map(([id, e]) => ({ brandId: e.brandId, programId: id, program: e.program, count: e.count })));

        const ids = candidates.map((c) => c.id);
        // Full rows, not just ids, so a restore is an INSERT away.
        const { rows: fullRows } = await client.query(
            'SELECT * FROM participant_applications WHERE id = ANY($1::uuid[])',
            [ids],
        );
        const { rows: reminderRows } = await client.query(
            'SELECT * FROM submission_reminder_logs WHERE application_id = ANY($1::uuid[])',
            [ids],
        );
        const backupPath = writeBackup(APPLY ? 'pre-apply' : 'dry-run', {
            args: { brand: BRAND_ARG ?? null, program: PROGRAM_ARG ?? null },
            participant_applications: fullRows,
            submission_reminder_logs: reminderRows,
        });
        console.log(`${LOG} backup written: ${backupPath}`);

        console.table(
            candidates.slice(0, 20).map((c) => ({
                applicationId: c.id,
                participantId: c.participant_id,
                program: c.program_name,
                createdAt: c.created_at.toISOString(),
            })),
        );
        if (candidates.length > 20) console.log(`${LOG} ...and ${candidates.length - 20} more (see backup).`);

        if (!APPLY) {
            console.log(`${LOG} DRY RUN complete. Re-run with --apply to delete the rows above.`);
            return;
        }

        await client.query('BEGIN');
        let deletedRows: Array<Record<string, unknown>>;
        let deletedReminders: Array<Record<string, unknown>>;
        try {
            // Lock and re-check under the full predicate: anything that stopped
            // qualifying since the SELECT above (a participant started filling
            // it in, an invoice appeared) drops out here.
            const { rows: locked } = await client.query<{ id: string }>(
                `SELECT pa.id
                 FROM participant_applications pa
                 JOIN programs p ON p.id = pa.program_id
                 WHERE pa.id = ANY($3::uuid[]) AND ${PHANTOM_PREDICATE}
                 FOR UPDATE OF pa`,
                [...params, ids],
            );
            const lockedIds = locked.map((row) => row.id);

            ({ rows: deletedReminders } = await client.query(
                'DELETE FROM submission_reminder_logs WHERE application_id = ANY($1::uuid[]) RETURNING *',
                [lockedIds],
            ));
            ({ rows: deletedRows } = await client.query(
                'DELETE FROM participant_applications WHERE id = ANY($1::uuid[]) RETURNING *',
                [lockedIds],
            ));
            await client.query('COMMIT');
        } catch (err) {
            await client.query('ROLLBACK');
            throw err;
        }

        const appliedPath = writeBackup('deleted', {
            participant_applications: deletedRows,
            submission_reminder_logs: deletedReminders,
        });
        console.log(
            `${LOG} deleted ${deletedRows.length} application(s) and ${deletedReminders.length} reminder log(s) ` +
            `(${candidates.length - deletedRows.length} stopped qualifying before the delete). Backup: ${appliedPath}`,
        );

        const deletedIds = new Set(deletedRows.map((row) => String(row.id)));
        const affected = new Map<string, { userId: string; participantId: string }>();
        for (const c of candidates) {
            if (deletedIds.has(c.id)) affected.set(c.participant_id, { userId: c.user_id, participantId: c.participant_id });
        }
        await invalidateCaches([...affected.values()]);
    } finally {
        client.release();
    }
}

main()
    .catch((err) => {
        console.error(`${LOG} FAILED:`, err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await pool.end();
    });
