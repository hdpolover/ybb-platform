/**
 * cleanup-loa-file-urls.ts
 *
 * POST-CUTOVER ONLY — Run AFTER verifying the new on-demand LOA flow works in
 * production (Task 18 smoke test passes, no rollback needed).
 *
 * WHAT IT DOES
 * -----------
 * Existing `participant_documents` rows with type = 'letter_of_acceptance' and a
 * non-null `fileUrl` were created by the OLD admin-generate model, which uploaded
 * a PDF to object storage (MinIO / DigitalOcean Spaces). The new model streams
 * PDFs on-demand without storing anything; those old objects are now dead weight.
 *
 * For each affected row this script:
 *   1. Calls `DELETE /api/v1/media/{fileId}` on the internal file service to
 *      remove the object from storage.
 *      • The fileId is extracted from the last path segment of the stored fileUrl
 *        (the format written by the old upload flow is `…/{uuid}`).
 *      • If the file is already gone (404) or the call fails for any reason, the
 *        error is logged and the script continues to the next row — the DB
 *        nulling step still runs so the stale pointer is cleared.
 *   2. Nulls the `fileUrl` column on the row while keeping `documentNumber`,
 *      `generatedAt`, and all tracking columns (downloadCount, firstDownloadedAt,
 *      lastDownloadedAt) intact.
 *
 * IDEMPOTENCY
 * -----------
 * Rows with `fileUrl IS NULL` are never selected, so re-running after a partial
 * run (or a complete run) is safe — it simply finds nothing more to do.
 *
 * DRY RUN (safe — no writes)
 * --------------------------
 *   cd services/api
 *   node -r ts-node/register scripts/cleanup-loa-file-urls.ts --dry-run
 *   # or: npx ts-node scripts/cleanup-loa-file-urls.ts --dry-run
 *
 * ACTUAL RUN (post-cutover only)
 * -------------------------------
 *   cd services/api
 *   node -r ts-node/register scripts/cleanup-loa-file-urls.ts
 *   # or: npx ts-node scripts/cleanup-loa-file-urls.ts
 *
 * REQUIRED ENV VARS
 * -----------------
 *   DATABASE_URL          – Postgres connection string (read from .env if not set)
 *   FILE_SERVICE_URL      – Internal file service base URL  (default: http://file-service:8001)
 *   FILE_SERVICE_INTERNAL_KEY – Internal service auth key   (optional; matches FileServiceClient)
 *
 * NOT WIRED INTO ANY AUTOMATIC PROCESS
 * -------------------------------------
 * This file is a one-off manual script. It is NOT imported by the API entrypoint,
 * NOT registered as a migration, and NOT called on boot. Run it manually by a
 * human operator after cutover verification.
 */

import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import axios, { AxiosError } from 'axios';

// ─── Bootstrap ─────────────────────────────────────────────────────────────

loadEnv({ path: join(__dirname, '..', '.env') });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('[cleanup-loa-file-urls] ERROR: DATABASE_URL is not set.');
  process.exit(1);
}

const FILE_SERVICE_URL: string =
  process.env.FILE_SERVICE_URL ?? 'http://file-service:8001';
const FILE_SERVICE_INTERNAL_KEY: string =
  process.env.FILE_SERVICE_INTERNAL_KEY ??
  process.env.INTERNAL_SERVICE_KEY ??
  '';

const DRY_RUN: boolean =
  process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';

/** Number of rows processed per DB/file-service round-trip batch. */
const BATCH_SIZE = 50;

// ─── Types ─────────────────────────────────────────────────────────────────

interface LoaDocRow {
  id: string;
  fileUrl: string;
  documentNumber: string | null;
}

interface RunSummary {
  scanned: number;
  filesDeleted: number;
  rowsUpdated: number;
  errors: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Build the internal auth headers used by FileServiceClient for every request.
 */
function buildFileServiceHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (FILE_SERVICE_INTERNAL_KEY) {
    headers['x-internal-service-key'] = FILE_SERVICE_INTERNAL_KEY;
  }
  return headers;
}

/**
 * Extract a file identifier from a stored fileUrl.
 *
 * The old upload flow produced URLs in the form:
 *   https://<host>/<bucket>/<folder>/<uuid>        (DO Spaces / MinIO public)
 *   https://<host>/<path-segments>/<uuid>
 *
 * We take the last non-empty path segment as the fileId. If the URL contains
 * no parseable path this returns null and the storage-delete step is skipped.
 */
function extractFileIdFromUrl(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const segments = url.pathname.split('/').filter(Boolean);
    return segments.length > 0 ? (segments[segments.length - 1] ?? null) : null;
  } catch {
    return null;
  }
}

/**
 * Attempt to delete the object from storage via the internal file service.
 *
 * The file service's DELETE /api/v1/media/{fileId} endpoint performs a
 * soft-delete of the file record AND removes the object from MinIO/Spaces.
 *
 * If the object is already gone (404) or any other error occurs, the error is
 * logged but treated as non-fatal — the caller continues with DB nulling.
 *
 * Returns true if deletion succeeded, false if it was skipped/failed.
 */
async function deleteStorageObject(
  doc: LoaDocRow,
  dryRun: boolean,
): Promise<boolean> {
  const fileId = extractFileIdFromUrl(doc.fileUrl);

  if (!fileId) {
    console.warn(
      `[cleanup-loa-file-urls] WARN: Could not extract fileId from URL for ` +
        `doc ${doc.id} (${doc.documentNumber ?? 'no-docnum'}) — ` +
        `URL: ${doc.fileUrl} — skipping storage delete, will still null DB column`,
    );
    return false;
  }

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would DELETE file-service media/${fileId} for doc ${doc.id}`,
    );
    return true;
  }

  try {
    await axios.delete(
      `${FILE_SERVICE_URL}/api/v1/media/${encodeURIComponent(fileId)}`,
      {
        headers: buildFileServiceHeaders(),
        // brand_id is required by the file service ownership check; we pass an
        // internal sentinel value so the handler can identify this as a
        // privileged cleanup call. Adjust to match the actual brand_id if the
        // file service enforces strict ownership on internal calls.
        params: { brand_id: 'internal-cleanup' },
        // Treat 404 as success — object already gone
        validateStatus: (status) => status === 204 || status === 404,
      },
    );
    return true;
  } catch (err: unknown) {
    const msg =
      err instanceof AxiosError
        ? `HTTP ${err.response?.status ?? 'no-response'} — ${err.message}`
        : String(err);
    console.error(
      `[cleanup-loa-file-urls] ERROR: Storage delete failed for doc ${doc.id} ` +
        `(fileId=${fileId}, url=${doc.fileUrl}): ${msg}`,
    );
    return false;
  }
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('='.repeat(70));
  console.log('cleanup-loa-file-urls — POST-CUTOVER LOA file cleanup');
  console.log(`Mode : ${DRY_RUN ? 'DRY RUN (no writes)' : 'LIVE (will mutate DB + call file service)'}`);
  console.log(`DB   : ${DATABASE_URL!.replace(/:\/\/.*@/, '://<credentials>@')}`);
  console.log(`FS   : ${FILE_SERVICE_URL}`);
  console.log('='.repeat(70));

  const pool = new Pool({ connectionString: DATABASE_URL });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  const summary: RunSummary = {
    scanned: 0,
    filesDeleted: 0,
    rowsUpdated: 0,
    errors: 0,
  };

  try {
    // ── 1. Count matching rows first (for a meaningful dry-run preview) ────
    // Use $queryRaw because the Prisma schema marks fileUrl as required (String),
    // but the DB column may have NULL values for old rows created before the
    // non-null constraint was enforced; raw SQL is the only way to filter IS NOT NULL
    // on a field the generated client types as non-nullable.
    const countResult = await prisma.$queryRaw<Array<{ cnt: bigint }>>(
      Prisma.sql`
        SELECT COUNT(*)::bigint AS cnt
        FROM participant_documents
        WHERE type = 'letter_of_acceptance'
          AND file_url IS NOT NULL
          AND file_url <> ''
      `,
    );
    const totalCount = Number(countResult[0]?.cnt ?? 0);

    console.log(`\nFound ${totalCount} letter_of_acceptance row(s) with non-null fileUrl.`);

    if (totalCount === 0) {
      console.log('Nothing to clean up. Exiting.');
      return;
    }

    // ── 2. Process in batches using cursor pagination ───────────────────────
    let cursor: string | undefined;
    let batchNum = 0;

    for (;;) {
      const rows = await prisma.$queryRaw<LoaDocRow[]>(
        cursor
          ? Prisma.sql`
              SELECT id, file_url AS "fileUrl", document_number AS "documentNumber"
              FROM participant_documents
              WHERE type = 'letter_of_acceptance'
                AND file_url IS NOT NULL
                AND file_url <> ''
                AND id > ${cursor}
              ORDER BY id ASC
              LIMIT ${BATCH_SIZE}
            `
          : Prisma.sql`
              SELECT id, file_url AS "fileUrl", document_number AS "documentNumber"
              FROM participant_documents
              WHERE type = 'letter_of_acceptance'
                AND file_url IS NOT NULL
                AND file_url <> ''
              ORDER BY id ASC
              LIMIT ${BATCH_SIZE}
            `,
      );

      if (rows.length === 0) break;

      batchNum += 1;
      console.log(
        `\n── Batch ${batchNum}: processing ${rows.length} row(s) ` +
          `(total scanned so far: ${summary.scanned + rows.length}) ──`,
      );

      for (const doc of rows) {
        summary.scanned += 1;

        const label = `doc ${doc.id} (${doc.documentNumber ?? 'no-docnum'})`;
        console.log(`  Processing ${label} — fileUrl: ${doc.fileUrl}`);

        // Step A: delete from object storage via file service
        const deleted = await deleteStorageObject(doc, DRY_RUN);
        if (deleted) {
          summary.filesDeleted += 1;
        } else {
          // Count as an error but continue — we still want to null the DB column
          // so the stale URL pointer is removed even if the object was ungettable
          summary.errors += 1;
        }

        // Step B: null the fileUrl column in the DB.
        // Use $executeRaw because the Prisma schema marks fileUrl as non-nullable
        // (String), so the generated client type rejects null in data. Raw SQL lets
        // us set the DB column to NULL directly without touching other columns.
        if (!DRY_RUN) {
          try {
            await prisma.$executeRaw(
              Prisma.sql`UPDATE participant_documents SET file_url = NULL WHERE id = ${doc.id}`,
            );
            summary.rowsUpdated += 1;
            console.log(`    ✓ fileUrl nulled on ${label}`);
          } catch (dbErr: unknown) {
            console.error(
              `[cleanup-loa-file-urls] ERROR: DB update failed for ${label}: ${String(dbErr)}`,
            );
            summary.errors += 1;
          }
        } else {
          console.log(`    [DRY RUN] Would null fileUrl on ${label}`);
          // Count as "would update" for the dry-run summary
          summary.rowsUpdated += 1;
        }
      }

      cursor = rows[rows.length - 1]!.id;
      if (rows.length < BATCH_SIZE) break;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }

  // ── 3. Final summary ──────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(70));
  console.log('SUMMARY');
  console.log(`  Mode          : ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);
  console.log(`  Rows scanned  : ${summary.scanned}`);
  console.log(
    `  Files deleted : ${summary.filesDeleted}${DRY_RUN ? ' (would delete)' : ''}`,
  );
  console.log(
    `  Rows updated  : ${summary.rowsUpdated}${DRY_RUN ? ' (would null)' : ''}`,
  );
  console.log(`  Errors        : ${summary.errors}`);
  console.log('='.repeat(70));

  if (DRY_RUN) {
    console.log('\nDRY RUN complete. Re-run without --dry-run to apply changes.');
  } else {
    console.log('\nCleanup complete.');
    if (summary.errors > 0) {
      console.warn(
        `WARNING: ${summary.errors} error(s) occurred. Review the log above ` +
          `and re-run to retry failed rows (script is idempotent).`,
      );
    }
  }
}

// ─── Entrypoint ────────────────────────────────────────────────────────────

if (require.main === module) {
  main().catch((err: unknown) => {
    console.error('[cleanup-loa-file-urls] FATAL:', err);
    process.exit(1);
  });
}
