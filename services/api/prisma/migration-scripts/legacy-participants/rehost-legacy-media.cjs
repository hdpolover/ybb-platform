/* eslint-disable */
/**
 * Legacy participant media rehost — copies files that currently live on the legacy
 * storage host (storage.ybbfoundation.com, referenced by participants.picture_url /
 * .resume_url, participant_agreement_letters.file_link, participant_program_documents.file_url)
 * into the new platform's own object storage, ahead of the legacy host's shutdown, AS
 * NATIVE FILE-SERVICE UPLOADS — same object-key layout, same `files` row, same
 * participant url representation a real upload through the app would produce. See
 * README.md "Legacy media rehost" for the full design and the verification run.
 *
 * Input is the manifest CSV produced by migrate-legacy-participants.cjs's media-rehost
 * step (columns: table,legacy_id,url,parent_legacy_id). This script never touches
 * legacy MySQL except read-only lookups (the optional --program filter, and resolving
 * new-Postgres ids for the destination key/DB rows) and never deletes anything at the
 * source — it only copies bytes forward and mints the matching metadata rows.
 *
 * New storage: S3-compatible (MinIO client SDK in Python, see
 * services/file/app/infrastructure/storage/minio_storage.py) against DigitalOcean
 * Spaces in production (services/file/.env.example: MINIO_ENDPOINT=sgp1.digitalocean
 * spaces.com, MINIO_BUCKET, MINIO_REGION, public host MINIO_PUBLIC_ENDPOINT=
 * cdn.ybbhub.com). This script reuses those exact MINIO_* env var names verbatim —
 * they are what ops will find on the live file-service container's env, so a VPS run
 * can copy them across unchanged (see "Running on the VPS" below). No aws-sdk/minio
 * npm dependency is added: neither services/api nor services/file's Node code has one,
 * so SigV4 signing and the PUT/HEAD/GET calls below are implemented with Node's
 * built-in https/http/crypto only, same as the version this replaces. `pg`, `mysql2`
 * and `uuid` are already services/api dependencies (see package.json) and are reused
 * as-is — no new dependency added for the deterministic id either.
 *
 * ---------------------------------------------------------------------------------
 * Object key convention — NATIVE, not a side namespace (fixed from the prior version
 * of this script, which wrote to `legacy/<table>/<legacyId>/<basename>`, a key no
 * read-time code recognises). Verified against
 * services/file/app/application/services/file_path_service.py `get_storage_path`:
 *
 *   Program-scoped file (agreement letters, program documents — both are per
 *   *application*, i.e. per legacy `participants` per-registration row):
 *     {env}/{brandId}/programs/{programId}/participants/{participantId}/{category}/{fileId}.{ext}
 *
 *   User-scoped file (profile picture, resume — both live on the `Participant`
 *   profile, which is 1:1 with a `User`, not per-program):
 *     {env}/{brandId}/users/{userId}/{category}/{fileId}.{ext}
 *
 * `fileId` is a deterministic uuidv5 (not `crypto.randomUUID()`, which is random and
 * would break idempotency) seeded from `${table}:${legacyId}:${url}`, so a re-run
 * always recomputes the exact same id/key. `{category}` and public/private placement
 * (verified against services/api/src/shared/utils/private-file-key.ts and
 * services/file/app/application/commands/handlers/upload_file_handler.py
 * PUBLIC_CATEGORIES — never invented):
 *
 *   participants.picture_url                  -> `avatars`        (user-scoped)
 *   participants.resume_url                    -> `documents`      (user-scoped)
 *   participant_agreement_letters.file_link     -> `signed-copies`  (program-scoped;
 *                                                   matches upload-signed-copy.handler.ts's
 *                                                   own bucket for a participant's signed
 *                                                   agreement letter)
 *   participant_program_documents.file_url      -> `documents`      (program-scoped)
 *
 * None of these four are in upload_file_handler.py's PUBLIC_CATEGORIES list, so a
 * native upload to any of them is written with no public-read ACL (private) — this
 * script mirrors that exactly (it never sets a public ACL on any object it writes).
 * `documents`/`signed-copies` are additionally in the *presign* allowlist
 * (private-file-key.ts PRIVATE_CATEGORIES) — a participant document/signed letter is
 * served only via a fresh presigned URL, gated on a matching `files` row existing at
 * that storage_path (get_presigned_url_internal_handler.py calls
 * `file_repository.find_by_storage_path` and 404s if it's missing) — this is why step
 * 2 below (the `files` row) is not optional bookkeeping, it's required for the private
 * categories to be readable at all. `avatars` is private-ACL but NOT in the presign
 * allowlist, so it is served as a plain CDN url with no signing.
 *
 * ---------------------------------------------------------------------------------
 * Steps this script performs per manifest row, in --apply mode, after a successful
 * byte copy (or a confirmed-matching existing object):
 *   1. Compute the native key + deterministic file id (above).
 *   2. Upsert a matching row into the FILE SERVICE's own `files` table (its own
 *      Postgres database, `FILE_DATABASE_URL` — a DIFFERENT database from the API's
 *      own `DATABASE_URL`; see services/file/prisma/schema.prisma for the column
 *      list this mirrors exactly: id, filename, original_filename, file_type,
 *      mime_type, file_size, storage_path (unique), bucket (the PHYSICAL bucket —
 *      MINIO_BUCKET — not the category), user_id, brand_id, metadata, status='READY').
 *      `ON CONFLICT (id) DO NOTHING` — id and storage_path are both derived from the
 *      same deterministic seed, so this is idempotent without a second uniqueness path.
 *   3. For participants.picture_url/resume_url ONLY: write the resolved CDN-style
 *      public url (same representation `FileDto`/`get_public_url` produces for a real
 *      upload: `https://{MINIO_PUBLIC_ENDPOINT}/{key}`) onto
 *      `participants.profile_picture_url` / `.resume_url`, but ONLY when that column
 *      is currently NULL — never overwrite a value a participant set natively after
 *      the historical import.
 *   4. Agreement letters and program documents have NO target row to write into yet:
 *      `migrate-legacy-participants.cjs` does not create `participant_documents` rows
 *      for them (out of this script's scope — see its README section and the
 *      "Known gap" note below). Bytes are still rehosted and the `files` row is still
 *      created (both idempotent, both cheap to do now), so a future pass that DOES
 *      create those rows can link them by `legacy_id` without re-touching storage.
 *
 * Context resolution (new-Postgres ids) needed for the key and for step 3/4 above
 * comes from `DATABASE_URL` (the API's own database — brands/programs/users/
 * participants/participant_applications, all already resolved the same way
 * migrate-legacy-participants.cjs resolves them). A manifest row whose legacy id
 * doesn't resolve to an already-migrated row (migration hasn't been --applied for
 * that program yet) is written to the retry CSV with an actionable error instead of
 * silently skipped.
 *
 * CLI:
 *   node rehost-legacy-media.cjs --dry-run --manifest legacy-media-manifest.csv --env production [--program <legacyProgramId>] [--limit N] [--concurrency 8] [--rate 4] [--breaker 15] [--retry-csv path.csv]
 *   node rehost-legacy-media.cjs --apply    --manifest legacy-media-manifest.csv --env production [--program <legacyProgramId>] [--limit N] [--concurrency 8] [--rate 4] [--breaker 15] [--retry-csv path.csv]
 *
 * --env (default production -> `prod`, matching file_path_service.py's prefix_map;
 * also accepts development->dev, staging->staging) sets the {env} path segment.
 * --source-dir <path> reads bytes from a local mirror of the legacy storage docroot
 * instead of HTTP (see "Running on the VPS" below) — preferred whenever available.
 * --source-host (default storage.ybbfoundation.com, comma-separated) — only URLs on
 * these hosts are fetched; third-party links (resume_url is mostly Google Drive/Docs/
 * LinkedIn) and malformed values are counted and skipped, never downloaded. Ignored
 * when --source-dir is given (nothing is fetched over HTTP in that mode).
 * --rate caps legacy-host requests/sec across all workers (default 4); --breaker
 * aborts the run after N consecutive connection-level failures (default 15), dumping
 * the remaining rows into the retry CSV instead of marking thousands of rows failed
 * against a banned IP. Both are no-ops in --source-dir mode.
 *
 * --dry-run (default): resolves keys and ids, HEADs (or stats, in --source-dir mode)
 *   the source and the destination object, reports what WOULD happen. No source body
 *   is ever read in dry-run, and no Postgres write is ever issued in dry-run.
 * --apply: required to write. Streams the source body -> new storage, verifies size +
 *   MD5 (S3/MinIO single-part ETag) after upload, skips objects already present with a
 *   matching size, upserts the `files` row and the participant url column (see above),
 *   and appends any failure to --retry-csv (same table/legacy_id/url/parent_legacy_id
 *   columns plus `error`) instead of throwing — the batch always keeps going.
 *
 * ---------------------------------------------------------------------------------
 * Running on the VPS (real cutover, not part of this task's verification):
 *
 * The intended real run is `ssh ybb-vps`, plain `node` (not necessarily inside a
 * container with this script's dependencies pre-installed beyond what's already
 * vendored under services/api/node_modules — `pg`, `mysql2`, `uuid` are all already
 * there; nothing else is required), reading from a local mirror of the legacy
 * storage docroot at `/root/legacy-storage/storage.ybbfoundation.com/` (the owner's
 * cPanel export; `https://storage.ybbfoundation.com/<path>` maps 1:1 onto that
 * directory + `<path>` — pass it as `--source-dir /root/legacy-storage/storage.ybbfoundation.com`),
 * and writing to the REAL DigitalOcean Spaces bucket using the file-service
 * container's own env. Get those values with (read-only, never printed/logged by
 * this script or committed anywhere):
 *
 *   docker exec <file-service-container> env | grep -E '^MINIO_|^DATABASE_URL'
 *
 * `MINIO_ENDPOINT/MINIO_ACCESS_KEY/MINIO_SECRET_KEY/MINIO_BUCKET/MINIO_REGION/
 * MINIO_SECURE/MINIO_PUBLIC_ENDPOINT` feed this script's S3 client and public-url
 * builder unchanged (same names, see s3ConfigFromEnv/publicUrlFor below); the file
 * service's own `DATABASE_URL` value is what this script's `FILE_DATABASE_URL` env
 * var must be set to (a DIFFERENT variable name on purpose — this script also needs
 * the API's own `DATABASE_URL` open at the same time, so the two can't share a name).
 * This task did NOT run against the real VPS storage mirror or the real Spaces
 * bucket — see "Verification done" below for what was actually exercised
 * (localstack, throwaway Postgres, synthetic + real-legacy-host bytes).
 */
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const http = require('http');
const mysql = require('mysql2/promise');
const { Pool } = require('pg');
const { v5: uuidv5 } = require('uuid');

// Fixed, arbitrary constant — never changes across runs (that's the whole point of a
// uuidv5 namespace: same namespace + same name string = same uuid every time, forever).
// Generated once for this migration; has no other meaning.
const LEGACY_MEDIA_UUID_NAMESPACE = '6cf50843-b6e6-4d1e-8c3e-2b9a6a2b6a90';

// ---------- CLI ----------

function parseArgs(argv) {
  const args = argv.slice(2);
  const flag = (name) => args.includes(name);
  const value = (name, fallback) => {
    const i = args.indexOf(name);
    return i >= 0 ? args[i + 1] : fallback;
  };
  const apply = flag('--apply');
  const envPrefixMap = { development: 'dev', staging: 'staging', production: 'prod' };
  const envName = value('--env', 'production');
  if (!envPrefixMap[envName]) {
    throw new Error(`--env must be one of ${Object.keys(envPrefixMap).join(', ')}, got '${envName}'`);
  }
  return {
    apply,
    dryRun: !apply,
    manifestPath: value('--manifest', null),
    retryCsvPath: value('--retry-csv', null),
    program: value('--program', null),
    limit: value('--limit', null) ? Number(value('--limit', null)) : null,
    concurrency: Number(value('--concurrency', '8')),
    envPrefix: envPrefixMap[envName],
    sourceDir: value('--source-dir', null),
    // Legacy host requests/sec cap. The cPanel firewall on storage.ybbfoundation.com
    // started resetting connections from our IP after ~1.5-2.5K HEADs at concurrency 20
    // with no pacing (observed 2026-09-25) — never run this unthrottled. No-op when
    // --source-dir is given (nothing is fetched over HTTP in that mode).
    rate: Number(value('--rate', '4')),
    // Consecutive connection-level failures before the run aborts (remaining rows -> retry CSV).
    breakerThreshold: Number(value('--breaker', '15')),
    // Comma-separated allowlist of hosts whose files get rehosted; anything else is skipped (never fetched).
    sourceHosts: new Set(
      String(value('--source-host', 'storage.ybbfoundation.com'))
        .split(',')
        .map((h) => h.trim().toLowerCase())
        .filter(Boolean),
    ),
  };
}

// ---------- CSV (manifest in, retry out) ----------

function csvEscape(value) {
  const s = String(value ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// Minimal RFC4180 CSV parser — good enough for the manifest's own simple csvEscape output
// (table,legacy_id,url,parent_legacy_id; no embedded newlines expected in practice, but
// quoted fields with escaped quotes are still handled correctly).
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (c === '\r') {
      // skip, \n handles the row break
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.length > 1 || (r.length === 1 && r[0] !== ''));
}

function readManifest(manifestPath) {
  const text = fs.readFileSync(manifestPath, 'utf8');
  const rows = parseCsv(text);
  const [header, ...data] = rows;
  const idx = {
    table: header.indexOf('table'),
    legacy_id: header.indexOf('legacy_id'),
    url: header.indexOf('url'),
    // Optional: absent on an older manifest (pre parent_legacy_id). Only required for
    // participant_agreement_letters.file_link / participant_program_documents.file_url
    // rows — resolveContext() throws a clear error if one of those rows needs it and
    // it's missing, rather than silently resolving the wrong participant.
    parent_legacy_id: header.indexOf('parent_legacy_id'),
  };
  if (idx.table < 0 || idx.legacy_id < 0 || idx.url < 0) {
    throw new Error(`Manifest ${manifestPath} is missing table/legacy_id/url columns (got: ${header.join(',')})`);
  }
  return data
    .filter((r) => r[idx.url])
    .map((r) => ({
      table: r[idx.table],
      legacyId: r[idx.legacy_id],
      url: r[idx.url],
      parentLegacyId: idx.parent_legacy_id >= 0 ? r[idx.parent_legacy_id] || null : null,
    }));
}

// Appends each failure as it happens (header written lazily on the first one), so a
// killed/crashed run still leaves a complete retry CSV for everything that failed so far.
// A clean run leaves no file behind; any stale file from a previous run at this path is removed.
class RetryCsvWriter {
  constructor(retryCsvPath) {
    this.path = retryCsvPath;
    this.count = 0;
    fs.rmSync(this.path, { force: true });
  }
  add(row, error) {
    const message = error instanceof Error ? error.message : String(error);
    if (this.count === 0) fs.writeFileSync(this.path, 'table,legacy_id,url,parent_legacy_id,error\n');
    fs.appendFileSync(
      this.path,
      [row.table, row.legacyId, row.url, row.parentLegacyId, message].map(csvEscape).join(',') + '\n',
    );
    this.count++;
  }
}

// ---------- Concurrency limiter (~15 lines, no dependency) ----------

function createLimiter(concurrency) {
  let active = 0;
  const queue = [];
  const runNext = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn()
      .then(resolve, reject)
      .finally(() => {
        active--;
        runNext();
      });
  };
  return (fn) =>
    new Promise((resolve, reject) => {
      queue.push({ fn, resolve, reject });
      runNext();
    });
}

// ---------- Category / key convention (native — see file header) ----------

// Mirrors upload_file_handler.py PUBLIC_CATEGORIES verbatim. None of the four
// categories this script writes to are in this list (verified), so every object this
// script uploads is written with no public-read ACL, exactly like a native upload to
// those same categories. Kept as a real allowlist (not hardcoded to "always private")
// so the behavior stays correct if a future category is added to this script.
const PUBLIC_CATEGORIES = new Set([
  'gallery', 'programs', 'banners', 'assets', 'partners', 'sponsors', 'speakers',
  'content', 'announcements', 'faq', 'payment_icons', 'payment-methods', 'payment_methods',
  'brands', 'brands/logos', 'brands/banners', 'brands/sponsor-logos',
  'programs/banners', 'programs/logos', 'programs/thumbnails',
]);

// table -> { category, scope }. `scope` decides which FilePathService context applies:
// 'user' = {env}/{brand}/users/{user}/{category}/{file} (profile fields, not per-program);
// 'program-participant' = {env}/{brand}/programs/{program}/participants/{participant}/{category}/{file}
// (per-application documents). Verified against private-file-key.ts PRIVATE_CATEGORIES
// (documents, signed-copies) and upload-signed-copy.handler.ts's own 'signed-copies'
// bucket for a participant's signed agreement letter — never invented.
const CATEGORY_BY_TABLE = {
  'participants.picture_url': { category: 'avatars', scope: 'user' },
  'participants.resume_url': { category: 'documents', scope: 'user' },
  'participant_agreement_letters.file_link': { category: 'signed-copies', scope: 'program-participant' },
  'participant_program_documents.file_url': { category: 'documents', scope: 'program-participant' },
};

// Mirrors FilePathService.MAX_EXTENSION_LENGTH (file_path_service.py) exactly.
const MAX_EXTENSION_LENGTH = 10;

function basenameFromUrl(url) {
  try {
    const u = new URL(url);
    const last = decodeURIComponent(u.pathname.split('/').filter(Boolean).pop() || '');
    return last || 'file';
  } catch {
    const last = url.split('/').filter(Boolean).pop() || 'file';
    return last.split('?')[0] || 'file';
  }
}

/** Deterministic file id: same (table, legacyId, url) always -> same uuid, forever. */
function deterministicFileId(table, legacyId, url) {
  return uuidv5(`${table}:${legacyId}:${url}`, LEGACY_MEDIA_UUID_NAMESPACE);
}

/** Mirrors FilePathService.build_storage_filename exactly (extension clamp included). */
function storageFilename(fileId, basename) {
  const dot = basename.lastIndexOf('.');
  if (dot < 0) return fileId;
  const ext = basename.slice(dot + 1).toLowerCase().slice(0, MAX_EXTENSION_LENGTH);
  return ext ? `${fileId}.${ext}` : fileId;
}

/** Mirrors FilePathService.get_storage_path's two branches this script ever needs. */
function buildNativeKey({ envPrefix, brandId, category, filename, scope, userId, programId, participantId }) {
  const root = `${envPrefix}/${brandId}`;
  if (scope === 'program-participant') {
    return `${root}/programs/${programId}/participants/${participantId}/${category}/${filename}`;
  }
  return `${root}/users/${userId}/${category}/${filename}`;
}

// Mirrors UploadFileHandler.resolve_content_type's extension fallback (extended with
// gif/webp/xls/xlsx, the rest of File's own ALLOWED_IMAGE_TYPES/ALLOWED_DOCUMENT_TYPES).
const CONTENT_TYPE_BY_EXTENSION = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
const GENERIC_CONTENT_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream']);

function resolveContentType(reportedContentType, basename) {
  const reported = String(reportedContentType || '').split(';')[0].trim().toLowerCase();
  if (!GENERIC_CONTENT_TYPES.has(reported)) return reported;
  const ext = basename.includes('.') ? basename.split('.').pop().toLowerCase() : '';
  return CONTENT_TYPE_BY_EXTENSION[ext] || reported || 'application/octet-stream';
}

/** Mirrors UploadFileHandler.execute's file_type derivation exactly. */
function deriveFileType(contentType) {
  if (contentType.startsWith('image/')) return 'image';
  if (contentType === 'application/pdf') return 'document';
  if (
    contentType === 'application/msword' ||
    contentType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return 'document';
  }
  if (
    contentType === 'application/vnd.ms-excel' ||
    contentType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ) {
    return 'spreadsheet';
  }
  return 'other';
}

/** Mirrors MinIOStorage.get_public_url exactly: {proto}://{MINIO_PUBLIC_ENDPOINT}/{key}. */
function publicUrlFor(key) {
  const endpoint = process.env.MINIO_PUBLIC_ENDPOINT || process.env.MINIO_ENDPOINT;
  const secure = String(process.env.MINIO_PUBLIC_SECURE ?? process.env.MINIO_SECURE ?? 'true').toLowerCase() !== 'false';
  const proto = secure ? 'https' : 'http';
  return `${proto}://${endpoint}/${key.replace(/^\/+/, '')}`;
}

// ---------- New-Postgres context resolution (DATABASE_URL — the API's own database) ----------

/**
 * Resolves the new-Postgres ids needed to build a native key + write the participant
 * column, for one manifest row. Returns null (never throws) when nothing matches yet
 * — e.g. migrate-legacy-participants.cjs hasn't been --applied for that program yet —
 * so the caller can report it as an actionable retry-csv row instead of a crash.
 */
async function resolveContext(pgApi, row) {
  const { table, legacyId, parentLegacyId } = row;
  const mapping = CATEGORY_BY_TABLE[table];
  if (!mapping) return null;

  if (mapping.scope === 'user') {
    const r = await pgApi.query(
      `SELECT p.id AS participant_id, p.user_id, u.brand_id
       FROM participants p JOIN users u ON u.id = p.user_id
       WHERE p.legacy_id = $1`,
      [Number(legacyId)],
    );
    if (!r.rows.length) return null;
    const { participant_id, user_id, brand_id } = r.rows[0];
    return { ...mapping, brandId: brand_id, userId: user_id, participantId: participant_id, programId: null };
  }

  // scope === 'program-participant': legacyId is the letter's/document's OWN id
  // (matches the future ParticipantDocument.legacyId), not the participant's — the
  // participant/application context comes from parentLegacyId instead (see
  // migrate-legacy-participants.cjs recordMedia() and the file header above).
  if (!parentLegacyId) {
    throw new Error(
      `${table} row (legacy_id=${legacyId}) has no parent_legacy_id — re-generate the manifest with the ` +
        `current migrate-legacy-participants.cjs (adds the parent_legacy_id column)`,
    );
  }
  const r = await pgApi.query(
    `SELECT pa.program_id, pa.participant_id, u.brand_id
     FROM participant_applications pa
     JOIN participants p ON p.id = pa.participant_id
     JOIN users u ON u.id = p.user_id
     WHERE pa.legacy_id = $1`,
    [Number(parentLegacyId)],
  );
  if (!r.rows.length) return null;
  const { program_id, participant_id, brand_id } = r.rows[0];
  return { ...mapping, brandId: brand_id, userId: null, participantId: participant_id, programId: program_id };
}

// ---------- Tiny dependency-free S3 (SigV4) client ----------
// Path-style requests only (https://{endpoint}/{bucket}/{key}) — works against MinIO
// and DigitalOcean Spaces (compatibility mode) alike; matches how a local MinIO
// container is addressed in the --apply smoke test.

function s3ConfigFromEnv(prefix = 'MINIO') {
  const endpoint = process.env[`${prefix}_ENDPOINT`];
  const accessKey = process.env[`${prefix}_ACCESS_KEY`];
  const secretKey = process.env[`${prefix}_SECRET_KEY`];
  const bucket = process.env[`${prefix}_BUCKET`];
  const region = process.env[`${prefix}_REGION`] || 'us-east-1';
  const secure = String(process.env[`${prefix}_SECURE`] ?? 'true').toLowerCase() !== 'false';
  if (!endpoint || !accessKey || !secretKey || !bucket) {
    throw new Error(
      `Missing new-storage config: ${prefix}_ENDPOINT/${prefix}_ACCESS_KEY/${prefix}_SECRET_KEY/${prefix}_BUCKET must all be set`,
    );
  }
  const [hostname, portStr] = endpoint.split(':');
  const port = portStr ? Number(portStr) : secure ? 443 : 80;
  return { endpoint, hostname, port, accessKey, secretKey, bucket, region, secure };
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}
function hmac(key, msg) {
  return crypto.createHmac('sha256', key).update(msg, 'utf8').digest();
}
function signingKey(secretKey, dateStamp, region) {
  const kDate = hmac('AWS4' + secretKey, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, 's3');
  return hmac(kService, 'aws4_request');
}
function awsUriEncode(segment) {
  return encodeURIComponent(segment).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
}
function canonicalPath(rawPath) {
  return '/' + rawPath.split('/').filter((s) => s.length > 0).map(awsUriEncode).join('/');
}

function signRequest({ method, host, canonicalUri, region, accessKey, secretKey, payloadHash, extraHeaders }) {
  const amzDate = new Date().toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const headers = { host, 'x-amz-date': amzDate, 'x-amz-content-sha256': payloadHash, ...extraHeaders };
  const sortedKeys = Object.keys(headers).sort((a, b) => a.toLowerCase().localeCompare(b.toLowerCase()));
  const canonicalHeaders = sortedKeys.map((k) => `${k.toLowerCase()}:${String(headers[k]).trim()}\n`).join('');
  const signedHeaders = sortedKeys.map((k) => k.toLowerCase()).sort().join(';');
  const canonicalRequest = [method, canonicalUri, '', canonicalHeaders, signedHeaders, payloadHash].join('\n');
  const credentialScope = `${dateStamp}/${region}/s3/aws4_request`;
  const stringToSign = ['AWS4-HMAC-SHA256', amzDate, credentialScope, sha256Hex(Buffer.from(canonicalRequest))].join(
    '\n',
  );
  const signature = crypto.createHmac('sha256', signingKey(secretKey, dateStamp, region)).update(stringToSign).digest('hex');
  const authorization = `AWS4-HMAC-SHA256 Credential=${accessKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  return { headers: { ...headers, Authorization: authorization } };
}

function s3Request(config, method, key, { extraHeaders = {}, payloadHash = sha256Hex(Buffer.alloc(0)), contentLength } = {}) {
  const mod = config.secure ? https : http;
  const rawPath = `/${config.bucket}/${key}`;
  const uri = canonicalPath(rawPath);
  const host = config.port === (config.secure ? 443 : 80) ? config.hostname : `${config.hostname}:${config.port}`;
  const headerExtras = { ...extraHeaders };
  if (contentLength != null) headerExtras['content-length'] = String(contentLength);
  const { headers } = signRequest({
    method,
    host,
    canonicalUri: uri,
    region: config.region,
    accessKey: config.accessKey,
    secretKey: config.secretKey,
    payloadHash,
    extraHeaders: headerExtras,
  });
  const req = mod.request({ hostname: config.hostname, port: config.port, method, path: uri, headers });
  return req;
}

function awaitResponse(req) {
  return new Promise((resolve, reject) => {
    req.on('error', reject);
    req.on('response', (res) => resolve(res));
  });
}

async function s3Head(config, key) {
  const req = s3Request(config, 'HEAD', key);
  req.end();
  const res = await awaitResponse(req);
  res.resume(); // drain, HEAD has no body
  if (res.statusCode === 404) return null;
  if (res.statusCode >= 300) throw new Error(`S3 HEAD ${key} -> HTTP ${res.statusCode}`);
  return {
    size: Number(res.headers['content-length'] || 0),
    etag: (res.headers['etag'] || '').replace(/"/g, ''),
  };
}

// Bucket-level request: same signer, but the canonical path is just /{bucket} (no key).
function s3BucketRequest(config, method) {
  const bucketOnlyConfig = { ...config, bucket: '' };
  return s3Request(bucketOnlyConfig, method, config.bucket);
}

async function s3EnsureBucket(config) {
  const req = s3BucketRequest(config, 'HEAD');
  req.end();
  const res = await awaitResponse(req);
  res.resume();
  if (res.statusCode === 404) {
    const createReq = s3BucketRequest(config, 'PUT');
    createReq.end();
    const createRes = await awaitResponse(createReq);
    createRes.resume();
    if (createRes.statusCode >= 300) throw new Error(`S3 create bucket ${config.bucket} -> HTTP ${createRes.statusCode}`);
  } else if (res.statusCode >= 300 && res.statusCode !== 403) {
    // 403 on HEAD bucket is common on managed S3 (no HeadBucket permission) — treat as "exists, unknown".
    throw new Error(`S3 HEAD bucket ${config.bucket} -> HTTP ${res.statusCode}`);
  }
}

/** Streams `readable` into the new storage at `key`, verifying byte count and MD5 against the PUT's ETag. */
async function s3PutStream(config, key, readable, { contentLength, contentType }) {
  const req = s3Request(config, 'PUT', key, {
    payloadHash: 'UNSIGNED-PAYLOAD',
    contentLength,
    extraHeaders: contentType ? { 'content-type': contentType } : {},
  });
  const md5 = crypto.createHash('md5');
  let bytes = 0;
  readable.on('data', (chunk) => {
    md5.update(chunk);
    bytes += chunk.length;
  });
  readable.pipe(req);
  const res = await awaitResponse(req);
  const body = await drain(res);
  if (res.statusCode >= 300) {
    throw new Error(`S3 PUT ${key} -> HTTP ${res.statusCode}: ${body.slice(0, 300)}`);
  }
  const etag = (res.headers['etag'] || '').replace(/"/g, '');
  const computedMd5 = md5.digest('hex');
  if (contentLength != null && bytes !== contentLength) {
    throw new Error(`Size mismatch after upload: expected ${contentLength} bytes, streamed ${bytes}`);
  }
  if (etag && etag !== computedMd5) {
    throw new Error(`Checksum mismatch after upload: ETag ${etag} != computed MD5 ${computedMd5}`);
  }
  return { size: bytes, etag: etag || computedMd5 };
}

function drain(stream) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    stream.on('error', reject);
  });
}

// ---------- Legacy HTTP fetch (source: storage.ybbfoundation.com) ----------

// Global pacing: every legacy request (HEAD or GET, across all workers) waits for its
// own slot, so --rate caps the host-wide request rate regardless of --concurrency.
let legacyRatePerSec = 4;
let nextLegacySlot = 0;
function setLegacyRate(rate) {
  legacyRatePerSec = rate > 0 ? rate : 4;
}
async function waitForLegacySlot() {
  const now = Date.now();
  const slot = Math.max(now, nextLegacySlot);
  nextLegacySlot = slot + 1000 / legacyRatePerSec;
  if (slot > now) await new Promise((r) => setTimeout(r, slot - now));
}

const CONNECTION_ERROR_CODES = new Set(['ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENETUNREACH', 'EPIPE', 'LEGACY_TIMEOUT']);

/** True for failures that mean "the host is not talking to us" (firewall/ban/outage), not "this one file is bad". */
function isConnectionFailure(err) {
  return Boolean(err && (CONNECTION_ERROR_CODES.has(err.code) || err.retryableStatus));
}

function legacyRequest(method, url, timeoutMs = 15000) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url); // throws on malformed manifest urls (e.g. 'https//name@mail.com') -> rejects
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      throw new Error(`Unsupported url protocol: ${parsed.protocol}`);
    }
    const mod = parsed.protocol === 'https:' ? https : http;
    const req = mod.request(parsed, { method, timeout: timeoutMs }, (res) => resolve(res));
    req.on('timeout', () => {
      const err = new Error(`Legacy ${method} timed out after ${timeoutMs}ms`);
      err.code = 'LEGACY_TIMEOUT';
      req.destroy(err);
    });
    req.on('error', reject);
    req.end();
  });
}

/** Paced request with exponential backoff on connection failures / 429 / 5xx. Other failures return immediately. */
async function legacyRequestWithRetry(method, url, timeoutMs, attempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) await new Promise((r) => setTimeout(r, 2000 * 4 ** (attempt - 1))); // 2s, 8s
    await waitForLegacySlot();
    try {
      const res = await legacyRequest(method, url, timeoutMs);
      if (res.statusCode === 429 || res.statusCode >= 500) {
        res.resume();
        lastErr = new Error(`Legacy ${method} -> HTTP ${res.statusCode}`);
        lastErr.retryableStatus = true;
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (!isConnectionFailure(err)) throw err;
    }
  }
  throw lastErr;
}

async function legacyHead(url) {
  const res = await legacyRequestWithRetry('HEAD', url, 8000);
  res.resume();
  return {
    statusCode: res.statusCode,
    contentType: res.headers['content-type'] || null,
    contentLength: res.headers['content-length'] != null ? Number(res.headers['content-length']) : null,
  };
}

/**
 * GET the legacy file. If Content-Length is known upfront the body streams straight
 * into the caller's sink; otherwise it spools to a temp file on disk (never buffered
 * fully in memory) so the size is known before the destination PUT starts.
 */
async function legacyGetToStream(url) {
  const res = await legacyRequestWithRetry('GET', url, 30000);
  if (res.statusCode >= 300) {
    res.resume();
    throw new Error(`Legacy GET ${url} -> HTTP ${res.statusCode}`);
  }
  const contentType = res.headers['content-type'] || 'application/octet-stream';
  const knownLength = res.headers['content-length'] != null ? Number(res.headers['content-length']) : null;
  if (knownLength != null) {
    return { readable: res, contentLength: knownLength, contentType, cleanup: () => {} };
  }
  const tmpPath = path.join(os.tmpdir(), `rehost-${crypto.randomUUID()}.bin`);
  await new Promise((resolve, reject) => {
    const ws = fs.createWriteStream(tmpPath);
    res.pipe(ws);
    res.on('error', reject);
    ws.on('error', reject);
    ws.on('finish', resolve);
  });
  const size = fs.statSync(tmpPath).size;
  return {
    readable: fs.createReadStream(tmpPath),
    contentLength: size,
    contentType,
    cleanup: () => fs.rmSync(tmpPath, { force: true }),
  };
}

// ---------- Local-disk fetch (--source-dir: the owner's cPanel storage export) ----------

/** `https://storage.ybbfoundation.com/<path>` -> `<sourceDir>/<path>` — 1:1, per the export layout. */
function localPathForUrl(sourceDir, url) {
  const u = new URL(url);
  const rel = decodeURIComponent(u.pathname).replace(/^\/+/, '');
  return path.join(sourceDir, rel);
}

async function localHead(sourceDir, url) {
  const p = localPathForUrl(sourceDir, url);
  try {
    const st = fs.statSync(p);
    return { statusCode: 200, contentType: resolveContentType(null, p), contentLength: st.size };
  } catch (err) {
    if (err.code === 'ENOENT') return { statusCode: 404, contentType: null, contentLength: null };
    throw err;
  }
}

async function localGetToStream(sourceDir, url) {
  const p = localPathForUrl(sourceDir, url);
  const st = fs.statSync(p); // ENOENT/EACCES etc. propagate to the caller as a row failure
  return {
    readable: fs.createReadStream(p),
    contentLength: st.size,
    contentType: resolveContentType(null, p),
    cleanup: () => {},
  };
}

// ---------- Optional --program filter (read-only legacy lookup) ----------

async function legacyIdsForProgram(programId) {
  const conn = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST,
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
  });
  try {
    await conn.query('SET SESSION TRANSACTION READ ONLY');
    const [participants] = await conn.query('SELECT id FROM participants WHERE program_id = ?', [programId]);
    const participantIds = new Set(participants.map((r) => String(r.id)));
    const [letters] = await conn.query(
      `SELECT al.id FROM participant_agreement_letters al JOIN participants p ON p.id = al.participant_id WHERE p.program_id = ?`,
      [programId],
    );
    const [docs] = await conn.query(
      `SELECT pd.id FROM participant_program_documents pd JOIN participants p ON p.id = pd.participant_id WHERE p.program_id = ?`,
      [programId],
    );
    return {
      'participants.picture_url': participantIds,
      'participants.resume_url': participantIds,
      'participant_agreement_letters.file_link': new Set(letters.map((r) => String(r.id))),
      'participant_program_documents.file_url': new Set(docs.map((r) => String(r.id))),
    };
  } finally {
    await conn.end();
  }
}

// ---------- Per-row processing ----------

/** Wraps a legacy-host call so connection-level failures feed the circuit breaker. */
async function trackLegacy(breaker, fn) {
  try {
    const result = await fn();
    breaker.consecutive = 0;
    return result;
  } catch (err) {
    if (isConnectionFailure(err)) {
      breaker.consecutive++;
      if (breaker.consecutive >= breaker.threshold && !breaker.tripped) {
        breaker.tripped = true;
        console.error(
          `Circuit breaker tripped after ${breaker.consecutive} consecutive connection failures — aborting remaining rows into the retry CSV.`,
        );
      }
    }
    throw err;
  }
}

/** Only URLs on an allowlisted legacy host are rehosted. resume_url is ~83% third-party links (Drive, Docs, LinkedIn, Canva) or junk. */
function sourceHostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return null;
  }
}

/** Upserts the file-service's own `files` row for a confirmed-present object. */
async function upsertFileRow(pgFile, { fileId, filename, originalFilename, fileType, mimeType, size, key, bucket, userId, brandId, programId, metadata }) {
  await pgFile.query(
    `INSERT INTO files (id, filename, original_filename, file_type, mime_type, file_size, storage_path, bucket, user_id, brand_id, program_id, metadata, uploaded_at, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb, now(), 'READY')
     ON CONFLICT (id) DO NOTHING`,
    [fileId, filename, originalFilename, fileType, mimeType, size, key, bucket, userId, brandId, programId, JSON.stringify(metadata)],
  );
}

/** Writes the resolved CDN url onto the participant profile column, never overwriting a native value. */
async function updateParticipantColumn(pgApi, { participantId, column, url }) {
  const r = await pgApi.query(
    `UPDATE participants SET ${column} = $1, updated_at = now() WHERE id = $2 AND ${column} IS NULL`,
    [url, participantId],
  );
  return r.rowCount > 0;
}

async function processRow(row, { config, apply, retryWriter, stats, breaker, sourceHosts, envPrefix, sourceDir, pgApi, pgFile }) {
  if (!sourceDir) {
    const host = sourceHostOf(row.url);
    if (!host) {
      stats.skippedMalformed++;
      return;
    }
    if (!sourceHosts.has(host)) {
      stats.skippedExternal++;
      return;
    }
  }
  if (breaker.tripped) {
    stats.aborted++;
    retryWriter.add(row, 'aborted: legacy host stopped responding (circuit breaker tripped, likely firewall ban)');
    return;
  }

  let context;
  try {
    context = await resolveContext(pgApi, row);
  } catch (err) {
    stats.failed++;
    retryWriter.add(row, err);
    return;
  }
  if (!context) {
    stats.unresolved++;
    retryWriter.add(
      row,
      `no matching migrated row in Postgres yet (run migrate-legacy-participants.cjs --apply for this program first)`,
    );
    return;
  }

  const basename = basenameFromUrl(row.url);
  const fileId = deterministicFileId(row.table, row.legacyId, row.url);
  const filename = storageFilename(fileId, basename);
  const key = buildNativeKey({
    envPrefix,
    brandId: context.brandId,
    category: context.category,
    filename,
    scope: context.scope,
    userId: context.userId,
    programId: context.programId,
    participantId: context.participantId,
  });

  const doHead = (url) => (sourceDir ? localHead(sourceDir, url) : trackLegacy(breaker, () => legacyHead(url)));
  const doGet = (url) => (sourceDir ? localGetToStream(sourceDir, url) : trackLegacy(breaker, () => legacyGetToStream(url)));

  try {
    const existing = await s3Head(config, key);
    let finalMeta = null; // { contentType, size } of the object we know is now correctly in place

    // Apply + nothing at the key yet: go straight to GET (1 legacy request per file, not 2 —
    // the legacy host's firewall bans by request count). The GET's own Content-Length is the size check.
    if (apply && !existing) {
      const { readable, contentLength, contentType, cleanup } = await doGet(row.url);
      try {
        await s3PutStream(config, key, readable, { contentLength, contentType });
        stats.uploaded++;
        finalMeta = { contentType: resolveContentType(contentType, basename), size: contentLength };
      } finally {
        cleanup();
      }
    } else {
      // Dry-run (HEAD only, never a body), or an object already exists and needs a size comparison.
      const sourceMeta = await doHead(row.url);
      if (sourceMeta.statusCode >= 300) {
        throw new Error(`Source unreachable: HTTP ${sourceMeta.statusCode}`);
      }
      const sizeMatches = existing && (sourceMeta.contentLength == null || existing.size === sourceMeta.contentLength);

      if (!apply) {
        if (sizeMatches) stats.wouldSkip++;
        else stats.wouldUpload++;
        return;
      }
      if (sizeMatches) {
        stats.skipped++;
        finalMeta = { contentType: resolveContentType(sourceMeta.contentType, basename), size: existing.size };
      } else {
        // Present but wrong size (e.g. truncated earlier attempt): re-upload, overwriting our own key.
        const { readable, contentLength, contentType, cleanup } = await doGet(row.url);
        try {
          await s3PutStream(config, key, readable, { contentLength, contentType });
          stats.uploaded++;
          finalMeta = { contentType: resolveContentType(contentType, basename), size: contentLength };
        } finally {
          cleanup();
        }
      }
    }

    // Bytes are confirmed present at `key` — mint the metadata a native upload would have.
    // finalMeta is only null when we returned early above (dry-run); nothing past here runs then.
    await upsertFileRow(pgFile, {
      fileId,
      filename,
      originalFilename: basename,
      fileType: deriveFileType(finalMeta.contentType),
      mimeType: finalMeta.contentType,
      size: finalMeta.size,
      key,
      bucket: config.bucket,
      userId: context.userId,
      brandId: context.brandId,
      programId: context.programId,
      metadata: {
        legacy_migration: true,
        legacy_table: row.table,
        legacy_id: row.legacyId,
        context: context.scope === 'program-participant' ? 'program_participation' : 'user_global',
      },
    });
    stats.filesRowUpserted++;

    if (context.scope === 'user') {
      const column = context.category === 'avatars' ? 'profile_picture_url' : 'resume_url';
      const url = publicUrlFor(key);
      const wrote = await updateParticipantColumn(pgApi, { participantId: context.participantId, column, url });
      if (wrote) stats.columnWritten++;
      else stats.columnSkippedAlreadySet++;
    } else {
      // Agreement letters / program documents: no participant_documents row exists yet
      // for legacy data (migrate-legacy-participants.cjs doesn't create one — see README
      // "Known gap"). Bytes + files row are ready for that future pass to link by legacy_id.
      stats.columnSkippedNoTargetRow++;
    }
  } catch (err) {
    stats.failed++;
    retryWriter.add(row, err);
  }
}

// ---------- Main ----------

async function main() {
  const opts = parseArgs(process.argv);
  if (!opts.manifestPath) {
    throw new Error('--manifest <path> is required');
  }
  const manifestDir = path.dirname(path.resolve(opts.manifestPath));
  const retryCsvPath = opts.retryCsvPath || path.join(manifestDir, 'rehost-retry.csv');

  let rows = readManifest(opts.manifestPath);
  console.log(`Manifest: ${rows.length} rows from ${opts.manifestPath}`);

  if (opts.program) {
    const idsByTable = await legacyIdsForProgram(Number(opts.program));
    rows = rows.filter((r) => idsByTable[r.table]?.has(String(r.legacyId)));
    console.log(`--program ${opts.program}: ${rows.length} rows after filtering`);
  }
  if (opts.limit) {
    rows = rows.slice(0, opts.limit);
    console.log(`--limit ${opts.limit}: ${rows.length} rows`);
  }

  const config = s3ConfigFromEnv(); // resolved even in dry-run, for destination HEAD checks
  if (opts.apply) {
    await s3EnsureBucket(config);
  }

  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required (the API\'s own Postgres — brands/programs/users/participants/participant_applications)');
  }
  const pgApi = new Pool({ connectionString: process.env.DATABASE_URL });
  // FILE_DATABASE_URL is deliberately a different name from the file service's own
  // DATABASE_URL: this script needs the API's DATABASE_URL open at the same time, so
  // it copies the file-service container's DATABASE_URL value into this variable
  // instead (see file header "Running on the VPS"). Only required in --apply (the
  // files-row upsert is the only place it's used).
  let pgFile = null;
  if (opts.apply) {
    if (!process.env.FILE_DATABASE_URL) {
      throw new Error(
        "FILE_DATABASE_URL is required in --apply mode (copy the file-service container's own DATABASE_URL value into it)",
      );
    }
    pgFile = new Pool({ connectionString: process.env.FILE_DATABASE_URL });
  }

  if (path.resolve(retryCsvPath) === path.resolve(opts.manifestPath)) {
    throw new Error('--retry-csv must not be the same file as --manifest (re-running a retry CSV needs a new --retry-csv path)');
  }
  const retryWriter = new RetryCsvWriter(retryCsvPath);
  const stats = {
    wouldUpload: 0,
    wouldSkip: 0,
    uploaded: 0,
    skipped: 0,
    failed: 0,
    aborted: 0,
    unresolved: 0,
    skippedExternal: 0,
    skippedMalformed: 0,
    filesRowUpserted: 0,
    columnWritten: 0,
    columnSkippedAlreadySet: 0,
    columnSkippedNoTargetRow: 0,
  };
  const breaker = { consecutive: 0, threshold: Math.max(1, opts.breakerThreshold || 15), tripped: false };
  const limit = createLimiter(Math.max(1, opts.concurrency || 8));
  setLegacyRate(opts.rate);

  console.log(
    `Mode: ${opts.apply ? 'APPLY' : 'DRY-RUN'} | env=${opts.envPrefix} | concurrency=${opts.concurrency} | rate=${opts.rate}/s | source=${opts.sourceDir || 'HTTP'} | rows=${rows.length}`,
  );

  try {
    await Promise.all(
      rows.map((row) =>
        limit(() =>
          processRow(row, {
            config,
            apply: opts.apply,
            retryWriter,
            stats,
            breaker,
            sourceHosts: opts.sourceHosts,
            envPrefix: opts.envPrefix,
            sourceDir: opts.sourceDir,
            pgApi,
            pgFile,
          }),
        ),
      ),
    );
  } finally {
    await pgApi.end();
    if (pgFile) await pgFile.end();
  }

  if (!opts.sourceDir) {
    console.log(
      `skipped (not on ${[...opts.sourceHosts].join(',')}; third-party links, left as-is)=${stats.skippedExternal} skipped (malformed url)=${stats.skippedMalformed}`,
    );
  }
  console.log(`unresolved (no migrated Postgres row yet)=${stats.unresolved}`);

  console.log('--- Summary ---');
  if (opts.apply) {
    console.log(`uploaded=${stats.uploaded} skipped(existing)=${stats.skipped} failed=${stats.failed} aborted=${stats.aborted}`);
    console.log(
      `files-row upserted=${stats.filesRowUpserted} participant-column written=${stats.columnWritten} ` +
        `already-set(skipped)=${stats.columnSkippedAlreadySet} no-target-row-yet(agreement/document)=${stats.columnSkippedNoTargetRow}`,
    );
  } else {
    console.log(
      `would-upload=${stats.wouldUpload} would-skip(existing)=${stats.wouldSkip} unreachable/failed=${stats.failed} aborted=${stats.aborted}`,
    );
  }
  if (stats.failed + stats.aborted + stats.unresolved > 0) console.log(`Retry CSV: ${retryCsvPath}`);
  if (breaker.tripped) process.exitCode = 2;
}

module.exports = {
  parseArgs,
  parseCsv,
  readManifest,
  basenameFromUrl,
  deterministicFileId,
  storageFilename,
  buildNativeKey,
  resolveContentType,
  deriveFileType,
  publicUrlFor,
  resolveContext,
  createLimiter,
  s3ConfigFromEnv,
  s3Head,
  s3PutStream,
  s3EnsureBucket,
  legacyHead,
  legacyGetToStream,
  localPathForUrl,
  localHead,
  localGetToStream,
  setLegacyRate,
  isConnectionFailure,
  CATEGORY_BY_TABLE,
  PUBLIC_CATEGORIES,
};

if (require.main === module) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
