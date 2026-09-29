/* eslint-disable */
/**
 * Legacy participant/application/payment migration — raw-SQL ETL.
 *
 * Imports, per mapped legacy program: users, participants (profile), participant
 * applications, essay answers, scores, payments -> invoices, agreement letters /
 * program documents, and ambassador referrals.
 *
 * Raw SQL (pg + mysql2), never the generated Prisma client — see README.md
 * "Side-effect bypass". Idempotent via legacy_id upserts. Dry-run by default;
 * --apply is required to write. See README.md for the full field mapping,
 * status mapping, auth/password decision, and payment-isolation reasoning.
 */
const { Pool } = require('pg');
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const MAPPED_LEGACY_PROGRAM_IDS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 16, 17, 18, 20];

// legacy participant_statuses code tables (verified against
// AdvancedOptimizedParticipantExportModel.php — see README "Status mapping").
const GENERAL_STATUS = { PENDING: 0, UNDER_REVIEW: 1, APPROVED: 2, REJECTED: 3 };
const FORM_STATUS = { DRAFT: 0, SUBMITTED: 1, APPROVED: 2 };
const LEGACY_PAY_STATUS = { NOT_REQUIRED: 0, PENDING: 1, PAID: 2, FAILED: 3 };

function normEmail(e) {
  return String(e || '').trim().toLowerCase();
}
function isValidEmail(e) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(e || '').trim());
}
function md5(s) {
  return crypto.createHash('md5').update(s).digest('hex');
}

// BUG FIX (found via the prod-clone --apply on program 12): several legacy
// free-text columns have no length cap (MySQL TEXT/garbage-tolerant), but the
// matching new-prod columns are bounded `varchar(n)` -- an --apply hit
// `value too long for type character varying(500)` on `twibbon_link`
// (verified live: 79 rows across the mapped programs, some containing pasted
// HTML/rich-text markup up to 65,535 chars, e.g. browser-translate widget
// artifacts). Also verified live: `phone_number` (17 rows over 25 chars,
// garbage, not real phone numbers), `nationality` (594 rows over 100),
// `occupation` (49 rows over 100), `instagram_username`/`instagram_account`
// (20 rows over 50). `institution`/`major`/`nick_name`/`tshirt_size`/
// `education_level`/`knowledge_source`/`referral_code`/`full_name` were all
// verified to fit their column widths for every mapped program and are left
// as-is.
//
// `clampText`: truncates informational free-text fields to fit -- some
// (garbled) text is better than a hard crash, and these fields are display-
// only, never matched/validated against elsewhere.
// `nullIfOverLen`: used instead for fields where a truncated value would be
// actively wrong/misleading (a cut-off phone number or a cut-off URL is
// worse than no value) -- nulled and counted, same "known data-quality gap"
// precedent already used for `nationality_code` above.
function clampText(v, maxLen) {
  if (v == null) return null;
  const s = String(v);
  return s.length > maxLen ? s.slice(0, maxLen) : s;
}
// First non-blank trimmed name: primary participant, primary's legacy user,
// then any merged sibling (participant, then user).
function resolveLegacyFullName(primary, others) {
  for (const m of [primary, ...others]) {
    for (const v of [m.full_name, m.user_full_name]) {
      const t = v == null ? '' : String(v).trim();
      if (t) return t;
    }
  }
  return '';
}
function nullIfOverLen(v, maxLen) {
  if (v == null) return null;
  return String(v).length > maxLen ? null : v;
}

// BUG FIX (found via the prod-clone --apply, program 12, second crash after the
// varchar-overflow one above): `error: invalid input syntax for type timestamp
// with time zone: "0NaN-NaN-NaNT..."`. mysql2 parses a legacy zero/garbage
// date/datetime (verified live: 3 `payments.payment_date` rows with corrupted
// years like "0026-01-25", plus 5,750 `participants.birthdate` rows literally
// "0000-00-00") into a JS `Invalid Date` OBJECT, not `null` -- which is
// TRUTHY, so every `x || fallback` chain in this script silently kept the
// invalid Date instead of falling back, and pg's own date serializer has no
// validity check, so it emits that NaN-filled string straight into the SQL
// wire protocol. `safeDate` converts an invalid Date to real `null` so the
// existing `||` fallbacks behave as originally intended.
// Zero/garbage dates that are NOT Invalid Date: mysql2 turns a MySQL zero date
// ('0000-00-00') into a perfectly VALID Date of 1899-11-30 (verified on the
// real program-1 canary, which stored participants.birthdate = 1899-11-30),
// and a few legacy rows carry corrupted years such as '0026-01-25'. Nothing
// legitimate in legacy predates 1901, so anything earlier is a blank marker.
const MIN_PLAUSIBLE_LEGACY_DATE = new Date(1901, 0, 1).getTime();
function isPlausibleDate(d) {
  return !isNaN(d.getTime()) && d.getTime() >= MIN_PLAUSIBLE_LEGACY_DATE;
}
function safeDate(v) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  return isPlausibleDate(d) ? d : null;
}
// BUG FIX (found via the prod-clone --apply, program 10, fourth crash): `error:
// invalid byte sequence for encoding "UTF8": 0x00`. Postgres text/varchar
// columns can NEVER contain a literal NUL byte (a hard libpq/C-string
// limitation, not a length issue) -- verified live: 11 legacy rows across
// the mapped programs have an embedded 0x00 in `experiences`/`achievements`
// (raw text pasted from somewhere binary). `JSON.stringify` already escapes
// `\u0000` into a 6-character sequence (verified: no raw NUL byte survives
// it), so `personal_data`/`essay_answers` (JSONB) are unaffected even though
// 2,783 legacy essay answers also contain NUL bytes -- this guard is only
// needed for the three raw-text application columns
// (motivation_letter/achievements/experiences) that write `row.experiences`/
// `row.achievements` directly, unescaped.
function stripNul(v) {
  if (v == null) return null;
  return String(v).replace(/\u0000/g, '');
}
function stripNulCounted(v, stat) {
  if (v == null) return null;
  const s = String(v);
  const cleaned = s.replace(/\u0000/g, '');
  if (cleaned.length !== s.length && stat) { stat.nulBytesStripped++; }
  return cleaned;
}
// Counting variant for the two sites where real corrupted data was found
// live (birthdate, payment paid_at/created_at) -- `stat` is the enclosing
// per-program counters object, passed explicitly since this is a top-level
// function.
function safeDateCounted(v, stat) {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (!isPlausibleDate(d)) {
    if (stat) { stat.invalidLegacyDatesNulled++; }
    return null;
  }
  return d;
}

// Birthdates: human-plausible range on top of safeDate, and stored the way
// native rows store them -- 'YYYY-MM-DD'. The previous String(date) wrote
// "Thu Aug 13 2009 00:00:00 GMT+0000 (Coordinated Universal Time)" into
// personal_data.birthdate, which the portal/admin don't parse as a date.
// Built from LOCAL date parts because mysql2 constructs DATE values in the
// process's local timezone; toISOString() would shift the day off UTC.
const BIRTH_YEAR_MIN = 1920;
function legacyBirthdate(v, stat) {
  const d = safeDateCounted(v, stat);
  if (!d) return null;
  const y = d.getFullYear();
  if (y < BIRTH_YEAR_MIN || d.getTime() > Date.now()) { // 4 future birthdates in program 12 alone
    if (stat) { stat.invalidLegacyDatesNulled++; }
    return null;
  }
  const pad = (n) => String(n).padStart(2, '0');
  return `${y}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// statusMode: 'flatten' (default) collapses every historical decision outcome
// down to draft/submitted only -- prod has NEVER produced under_review/
// accepted/rejected natively (verified: see README "Status mapping"), and
// importing 'accepted' would newly light up LOA-download eligibility
// (loa-eligibility.service.ts, loa-release-batch.repository.ts: ELIGIBLE_
// APPLICATION_STATUSES includes 'accepted') and the public activity-toast
// feed (activity.mapper.ts ACTIVITY_SOURCE_STATUSES) for closed legacy
// programs -- neither gate has a time/program-active window, so an imported
// 'accepted' row is indistinguishable from a live one to those code paths.
// 'preserve' keeps the full legacy outcome mapping (only pass this once the
// owner has explicitly signed off on those consequences); either way the
// original legacy general_status outcome is always recorded in
// personalData.legacy_outcome so no information is lost.
function legacyOutcomeLabel(generalStatus) {
  switch (generalStatus) {
    case GENERAL_STATUS.APPROVED: return 'accepted';
    case GENERAL_STATUS.REJECTED: return 'rejected';
    case GENERAL_STATUS.UNDER_REVIEW: return 'under_review';
    default: return 'pending';
  }
}

function mapApplicationStatus(formStatus, generalStatus, statusMode) {
  if (formStatus === FORM_STATUS.DRAFT) return 'draft';
  if (statusMode === 'preserve') {
    // form submitted/approved: refine by decision
    if (generalStatus === GENERAL_STATUS.APPROVED) return 'accepted';
    if (generalStatus === GENERAL_STATUS.REJECTED) return 'rejected';
    if (generalStatus === GENERAL_STATUS.UNDER_REVIEW) return 'under_review';
  }
  return 'submitted'; // flatten mode, or general_status PENDING (0) with a submitted/approved form
}

// Legacy PENDING(1) means the payment was started/incomplete and never
// resolved -- it must NEVER map to 'processing'. 'processing' is not
// terminal: prod has a known event-sync drift where invoices stuck in
// 'processing' get picked up by payment-reconciliation.service.ts's
// reconcileProcessingInvoices scan. Every imported invoice must land in a
// status those reconcilers already ignore for rows with no external ids
// (external_intent_id/external_transaction_id are always left NULL on
// import -- see README "Payment isolation") AND that is terminal on its own
// semantics. PENDING -> 'unpaid' (nothing was ever completed, matches the
// PaymentStatus enum's own terminal non-paid states: unpaid/failed/refunded/
// cancelled -- 'processing' is deliberately excluded from that set here).
function mapLegacyPayStatus(code) {
  switch (code) {
    case LEGACY_PAY_STATUS.PAID: return 'paid';
    case LEGACY_PAY_STATUS.FAILED: return 'failed';
    case LEGACY_PAY_STATUS.PENDING: return 'unpaid';
    default: return 'unpaid';
  }
}

// What actually gets written for an invoice. Everything above (dedupe per tier,
// the application-column aggregate, the by-status report) keeps working on the
// mapped status; only the stored row differs. A legacy PENDING attempt that
// never completed is an abandoned checkout, so it is stored as 'cancelled'
// rather than 'unpaid': an 'unpaid' row reads as money still owed and raised a
// "Payment Required" alert on programs that closed years ago. The application's
// registration/program payment column still aggregates to 'unpaid', which is
// the truth (the fee was never paid). Keep LEGACY_ABANDONED_REASON in sync with
// the one-off backfill that converted the 2026-09-28 import.
const LEGACY_ABANDONED_REASON = 'Legacy import: checkout started on the old site, never completed.';
function storedInvoiceStatus(invoiceStatus) {
  return invoiceStatus === 'unpaid'
    ? { status: 'cancelled', rejectionReason: LEGACY_ABANDONED_REASON }
    : { status: invoiceStatus, rejectionReason: null };
}

// One legacy `payments` row's terminal status. `payments.status` int code
// mirrors payment_status semantics (0 not required/void, 1 pending, 2 paid,
// 3 failed) per the same admin-app export model.
function mapPaymentRowStatus(statusCode) {
  return mapLegacyPayStatus(statusCode);
}

// `program_pricing_tiers.fee_type` -> which application column a settled
// invoice counts against. registration_fee is its own column; every other
// fee type (program_fee_1/2, full_fee, custom_fee) rolls up into the single
// programPaymentStatus column -- the new schema has no per-tier payment
// status column, only registration vs "the program fee", matching the
// legacy program_payments.category split called out in README "Status
// mapping" (registration vs program_fee_1/program_fee_2).
function invoiceCategoryForFeeType(feeType) {
  return feeType === 'registration_fee' ? 'registration' : 'program';
}

// Aggregate several invoices' statuses for the same category (a participant
// can have several legacy payment attempts -- retries, a failed try followed
// by a successful one, etc.) into the single status the application column
// gets. paid beats failed beats unpaid: if the participant ever completed
// the fee, that's the truth for the category regardless of earlier failed
// attempts. Never produces 'processing' or 'refunded'/'cancelled' -- legacy
// payment_status has no equivalent codes for those (see mapLegacyPayStatus).
// FAILED attempts never reach this aggregate: they are skipped before invoice
// resolution (owner decision 2026-09-26, see the payments loop), so in practice
// it only ever combines 'unpaid' and 'paid'. 'failed' stays ranked for safety.
const PAYMENT_STATUS_RANK = { unpaid: 0, failed: 1, paid: 2 };
function combinePaymentStatus(a, b) {
  return (PAYMENT_STATUS_RANK[b] ?? 0) > (PAYMENT_STATUS_RANK[a] ?? 0) ? b : a;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;
  const programArgIdx = args.indexOf('--program');
  const onlyPrograms = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--program') onlyPrograms.push(Number(args[i + 1]));
  }
  const batchSizeIdx = args.indexOf('--batch-size');
  const batchSize = batchSizeIdx >= 0 ? Number(args[batchSizeIdx + 1]) : 500;
  const limitIdx = args.indexOf('--limit');
  const perProgramLimit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null; // cap rows/program (testing/slicing)
  const statusModeIdx = args.indexOf('--status-mode');
  const statusMode = statusModeIdx >= 0 ? args[statusModeIdx + 1] : 'flatten';
  if (!['flatten', 'preserve'].includes(statusMode)) {
    throw new Error(`--status-mode must be 'flatten' or 'preserve', got '${statusMode}'`);
  }
  const manifestIdx = args.indexOf('--manifest');
  const manifestPath = manifestIdx >= 0 ? args[manifestIdx + 1] : path.join(process.cwd(), 'legacy-media-manifest.csv');

  const programIds = (onlyPrograms.length ? onlyPrograms : MAPPED_LEGACY_PROGRAM_IDS)
    .filter((id) => MAPPED_LEGACY_PROGRAM_IDS.includes(id));

  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  // BUG FIX: Pool#query() checks out a *different* connection from the pool
  // on every call and releases it immediately afterwards, so `BEGIN READ
  // ONLY` issued via pgPool.query(...) would be committed/discarded on its
  // own connection and have zero effect on every subsequent query in this
  // script (each of which gets its own, unrelated connection). A read-only
  // transaction only means anything on a single, held connection. In
  // dry-run we check out one Client and keep every query on it for the
  // whole run so Postgres itself — not just script discipline — refuses
  // any stray write; in --apply we use the pool as before (each upsert is
  // its own short-lived, real read-write query, matching legacy-content).
  const pg = dryRun ? await pgPool.connect() : pgPool;
  const my = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST,
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
    charset: 'utf8mb4',
  });
  // HARD RULE: never write to legacy MySQL, ever (read-only regardless of --apply).
  await my.query('SET SESSION TRANSACTION READ ONLY');
  const mq = async (sql, p = []) => (await my.query(sql, p))[0];

  // HARD RULE: dry-run must never be able to write to Postgres even by accident.
  // In apply mode this is a real read-write session (each write below is its own
  // upsert, matching the legacy-content precedent); in dry-run, wrap the entire
  // session in an explicit read-only transaction so the Postgres server itself
  // rejects any stray write, not just script discipline.
  if (dryRun) {
    await pg.query('BEGIN READ ONLY');
  }

  // {table, id, url, parent} for the media-rehost manifest -- never downloaded here.
  // `parent` is only meaningful for participant_agreement_letters/participant_program_documents
  // (see below): it's the legacy `participants.id` (per-registration row) the letter/document
  // belongs to, which rehost-legacy-media.cjs needs to resolve the new program_id/participant_id
  // for the native storage key -- `legacy_id` on those two rows is the letter's/document's own
  // id, not the participant's, so it can't be used for that lookup on its own.
  const manifestRows = [];
  function recordMedia(table, legacyId, url, parentLegacyId = null) {
    if (url) manifestRows.push({ table, id: legacyId, url, parent: parentLegacyId });
  }

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}  Programs: ${programIds.join(',')}  Batch size: ${batchSize}  Status mode: ${statusMode}${perProgramLimit ? `  Limit/program: ${perProgramLimit}` : ''}`);

  // ---------- Preflight: fail fast (with a clear message) if the target Postgres
  // hasn't had migration 20260925130000_add_legacy_participant_migration_fields
  // applied yet, instead of a cryptic mid-run "column does not exist" once the
  // per-row loop is already underway. This script depends on legacy_id existing
  // on participant_applications, application_invoices, program_essays and
  // program_pricing_tiers.
  {
    const need = [
      ['participant_applications', 'legacy_id'],
      ['application_invoices', 'legacy_id'],
      ['program_essays', 'legacy_id'],
      ['program_pricing_tiers', 'legacy_id'],
    ];
    const r = await pg.query(
      `SELECT table_name, column_name FROM information_schema.columns
       WHERE table_name = ANY($1::text[]) AND column_name = 'legacy_id'`,
      [need.map(([t]) => t)],
    );
    const have = new Set(r.rows.map((row) => `${row.table_name}.${row.column_name}`));
    const missing = need.filter(([t, c]) => !have.has(`${t}.${c}`)).map(([t, c]) => `${t}.${c}`);
    if (missing.length) {
      if (dryRun) { await pg.query('ROLLBACK'); pg.release(); }
      await my.end();
      await pgPool.end();
      throw new Error(
        `Target Postgres is missing column(s): ${missing.join(', ')}. ` +
        `Migration 20260925130000_add_legacy_participant_migration_fields has not been ` +
        `applied to this database yet -- run 'prisma migrate deploy' there first ` +
        `(never hand-run DDL against prod; this must go through the normal deploy pipeline).`,
      );
    }
  }

  // ---------- Resolve brand/program legacy_id -> new id maps (read-only) ----------
  const brandByLegacyCategoryId = new Map();
  {
    const r = await pg.query(`SELECT id, legacy_id FROM brands WHERE legacy_id IS NOT NULL`);
    for (const row of r.rows) brandByLegacyCategoryId.set(row.legacy_id, row.id);
  }
  const programByLegacyId = new Map(); // legacy program id -> { id, brandId }
  {
    const r = await pg.query(`SELECT id, legacy_id, brand_id FROM programs WHERE legacy_id = ANY($1)`, [programIds]);
    for (const row of r.rows) programByLegacyId.set(row.legacy_id, { id: row.id, brandId: row.brand_id });
  }
  // Known program rows that don't exist in prod YET but have an already-committed,
  // not-yet-deployed Prisma migration that will create them (see
  // prisma/migrations/20260925150000_backfill_legacy_program_12_meys) --
  // legacy program 12 ("Middle East Youth Summit 2026") is the one case found so
  // far (verified: it's the only id in MAPPED_LEGACY_PROGRAM_IDS with no matching
  // `programs.legacy_id` row in prod). In DRY-RUN ONLY, simulate that migration
  // having already run so the report reflects true post-migration reality (its
  // 23,709 legacy participants would otherwise silently vanish from every count).
  // NEVER done in --apply: creating a program row is a reviewed schema-migration
  // decision (brand, publish/registration flags, description content), not
  // something this generic per-participant ETL should improvise on its own.
  const PENDING_PROGRAM_BACKFILLS = { 12: { brandLegacyId: 3 } };
  const missingPrograms = programIds.filter((id) => !programByLegacyId.has(id));
  if (missingPrograms.length) {
    for (const id of missingPrograms) {
      const backfill = PENDING_PROGRAM_BACKFILLS[id];
      if (dryRun && backfill && brandByLegacyCategoryId.has(backfill.brandLegacyId)) {
        console.warn(`NOTE: legacy program ${id} has no new-prod row yet, but migration 20260925150000 (already committed, not yet deployed) will create it -- simulating "would create program" for this dry-run.`);
        programByLegacyId.set(id, { id: `dry-run:program:${id}`, brandId: brandByLegacyCategoryId.get(backfill.brandLegacyId), _synthetic: true });
      } else {
        console.warn(`WARNING: no new-prod program found with legacy_id in [${id}] — skipping.`);
      }
    }
  }
  const activeProgramIds = programIds.filter((id) => programByLegacyId.has(id));

  // Pricing tiers per new program, matched by legacy_id when set, else by
  // (category + type) heuristic since program_payments were never content-migrated.
  const tiersByProgramId = new Map(); // new programId -> [{id, legacyId, feeType}]
  for (const { id: newProgramId, _synthetic } of programByLegacyId.values()) {
    // A dry-run-simulated program (see PENDING_PROGRAM_BACKFILLS above) has no real
    // uuid to query prod with yet -- it has zero real tiers/essays by definition
    // (the row doesn't exist), so skip the query rather than send a synthetic
    // string id into a uuid-typed WHERE clause.
    if (_synthetic) { tiersByProgramId.set(newProgramId, []); continue; }
    const r = await pg.query(
      `SELECT id, legacy_id, fee_type FROM program_pricing_tiers WHERE program_id = $1`,
      [newProgramId],
    );
    tiersByProgramId.set(newProgramId, r.rows);
  }

  // Essay question maps per new program, matched by legacy_id when set, else
  // by ordinal position (see README "essay matching").
  const essaysByProgramId = new Map(); // new programId -> [{id, legacyId, order}]
  for (const { id: newProgramId, _synthetic } of programByLegacyId.values()) {
    if (_synthetic) { essaysByProgramId.set(newProgramId, []); continue; }
    const r = await pg.query(
      `SELECT id, legacy_id, "order" FROM program_essays WHERE program_id = $1 ORDER BY "order" ASC, created_at ASC`,
      [newProgramId],
    );
    essaysByProgramId.set(newProgramId, r.rows);
  }

  // Legacy essay ordering, once per legacy program (was previously re-queried
  // on every single participant row inside the per-row loop below -- a
  // redundant MySQL round-trip per row since it only depends on
  // legacyProgramId, not on the row. Hoisting it here cuts one full
  // network round-trip per row at scale (see README "Runtime estimate").
  const legacyEssayOrderByProgramId = new Map(); // legacy programId -> [{id}]
  for (const legacyProgramId of activeProgramIds) {
    const r = await mq(`SELECT id FROM program_essays WHERE program_id = ? ORDER BY id ASC`, [legacyProgramId]);
    legacyEssayOrderByProgramId.set(legacyProgramId, r);
  }

  // Legacy `program_payments` (the fee definitions themselves, e.g. "Registration
  // Fee", "Program Fee Batch 1"), once per legacy program -- needed to synthesize a
  // historical pricing tier for a payment whose program_payment_id has no matching
  // `program_pricing_tiers.legacy_id` in new-prod. This is the common case, not the
  // exception: most legacy programs' fee definitions were never content-migrated
  // (only a handful of programs have `program_pricing_tiers.legacy_id` populated),
  // so requiring an exact current-tier match before importing a payment silently
  // dropped nearly all historical payment history (verified live: 27,149 of the
  // real run's payments hit `invoicesUnmatchedTier` this way). A historical payment
  // must import on its own legacy amount/currency/status regardless of whether a
  // *current* pricing tier happens to line up with it -- see "Invoice tier
  // synthesis" below.
  //
  // Loaded for ALL legacy programs, not just the ones in this run: a small number of
  // legacy payments reference a program_payment_id owned by a different legacy
  // program (verified 2026-09-26: one program-20 payment resolved in an all-programs
  // run but fell to invoicesUnmatchedTier under `--program 20`). Scoping this map to
  // activeProgramIds made per-program runs -- the planned apply mode -- drop it.
  // The table is tiny (fee definitions), so one unscoped query costs nothing.
  const legacyProgramPaymentsById = new Map(); // legacy program_payments.id -> {id, category, name, idrAmount, usdAmount}
  {
    const rows = await mq(
      `SELECT id, category, name, idr_amount, usd_amount FROM program_payments WHERE is_deleted = 0`,
    );
    for (const r of rows) {
      legacyProgramPaymentsById.set(r.id, {
        id: r.id, category: r.category, name: r.name, idrAmount: r.idr_amount, usdAmount: r.usd_amount,
      });
    }
  }

  // category -> PricingFeeType (verified live: legacy `program_payments.category` only
  // ever takes these three values -- see README "Invoice tier synthesis").
  function feeTypeForLegacyCategory(category) {
    if (category === 'registration') return 'registration_fee';
    if (category === 'program_fee_1') return 'program_fee_1';
    if (category === 'program_fee_2') return 'program_fee_2';
    return 'custom_fee';
  }

  // Resolve a payment's tier, creating a historical tier record when no current
  // `program_pricing_tiers.legacy_id` matches -- see "Invoice tier synthesis" in
  // README. Mutates `tiersByProgramId`'s in-memory list so a second payment in the
  // same run against the same legacy program_payment_id reuses the tier just
  // created/synthesized instead of creating (or "would create") a duplicate.
  // Tracks which legacy program_payment_ids were newly synthesized per program
  // (`stat.tiersSynthesized` is a *tier* count, not a payment count) via the Set
  // passed in by the caller.
  async function resolveOrCreateTier(newProgramId, legacyProgramPaymentId, synthesizedThisProgram) {
    const tiers = tiersByProgramId.get(newProgramId) || [];
    const existing = tiers.find((t) => t.legacy_id === legacyProgramPaymentId);
    if (existing) return existing;

    const legacyDef = legacyProgramPaymentsById.get(legacyProgramPaymentId);
    if (!legacyDef) return null; // truly orphaned: payment references a program_payment_id that no longer exists even in legacy

    const feeType = feeTypeForLegacyCategory(legacyDef.category);
    const isNewSynth = !synthesizedThisProgram.has(legacyProgramPaymentId);
    if (isNewSynth) synthesizedThisProgram.add(legacyProgramPaymentId);

    if (apply) {
      const ins = await pg.query(
        `INSERT INTO program_pricing_tiers
           (program_id, name, price, currency, fee_type, legacy_id, is_active, created_at, updated_at)
         VALUES ($1,$2,$3,'IDR',$4,$5,false,now(),now())
         ON CONFLICT (legacy_id) DO NOTHING
         RETURNING id, legacy_id, fee_type`,
        [newProgramId, legacyDef.name || `Historical: ${feeType}`, legacyDef.idrAmount || 0, feeType, legacyProgramPaymentId],
      );
      const tier = ins.rows.length
        ? ins.rows[0]
        : (await pg.query(`SELECT id, legacy_id, fee_type FROM program_pricing_tiers WHERE legacy_id = $1`, [legacyProgramPaymentId])).rows[0];
      tiers.push(tier);
      tiersByProgramId.set(newProgramId, tiers);
      return tier;
    }
    // dry-run: synthesize a virtual tier so downstream category/status aggregation
    // works identically to apply mode, without ever touching Postgres.
    const virtualTier = { id: `dry-run:tier:${legacyProgramPaymentId}`, legacy_id: legacyProgramPaymentId, fee_type: feeType, _synthetic: true };
    tiers.push(virtualTier);
    tiersByProgramId.set(newProgramId, tiers);
    return virtualTier;
  }

  // Legacy payments, once per legacy program (batched via the same
  // participants-join pattern as the agreement-letter/program-document
  // manifest queries above), never per-participant-row inside the loop.
  //
  // SCHEMA CAVEAT (be honest, don't guess silently): this session has no
  // working legacy MySQL credentials for live DESCRIBE/sampling (same
  // Column names below were VERIFIED directly against a live, read-only
  // `DESCRIBE` of `payments`/`xendit_payment`/`midtrans_payment` on the real
  // legacy DB this session (prior comment here claimed these were unverified
  // guesses -- they were, and two were WRONG, now fixed against real schema):
  // `payments` has NO `paid_at` column (real column is `payment_date`) and
  // NO `payment_method` column (that's `payment_method_id`, an FK we don't
  // need since we never carry gateway identity forward -- see below); it
  // does have `is_deleted`, now filtered like every other legacy table in
  // this script. `xendit_payment` has its own `payment_method` text column;
  // `midtrans_payment` has `payment_type` (no `payment_method` column at
  // all) -- both used only for the informational label, never for external
  // ids (external_transaction_id/external_intent_id are NEVER read from
  // them; every imported invoice leaves both NULL unconditionally, see
  // README "Payment isolation").
  const paymentsByParticipantId = new Map(); // legacy participants.id -> [{id, program_payment_id, amount, currency, status, paidAt, paymentMethod}]
  for (const legacyProgramId of activeProgramIds) {
    const rows = await mq(
      `SELECT pay.id, pay.participant_id, pay.program_payment_id, pay.amount, pay.currency, pay.status,
              pay.payment_date AS paid_at, pay.created_at,
              xp.payment_method AS xendit_payment_method, mp.payment_type AS midtrans_payment_type,
              xp.id AS xendit_id, mp.id AS midtrans_id
       FROM payments pay
       JOIN participants p ON p.id = pay.participant_id
       LEFT JOIN xendit_payment xp ON xp.payment_id = pay.id
       LEFT JOIN midtrans_payment mp ON mp.payment_id = pay.id
       WHERE p.program_id = ? AND pay.is_deleted = 0
       ORDER BY pay.created_at ASC, pay.id ASC`,
      [legacyProgramId],
    );
    for (const r of rows) {
      const list = paymentsByParticipantId.get(r.participant_id) || [];
      list.push({
        id: r.id,
        programPaymentId: r.program_payment_id,
        amount: r.amount,
        currency: r.currency || 'IDR',
        status: r.status,
        paidAt: r.paid_at,
        createdAt: r.created_at,
        paymentMethod: r.xendit_payment_method || r.midtrans_payment_type || (r.xendit_id ? 'xendit' : null) || (r.midtrans_id ? 'midtrans' : null) || null,
      });
      paymentsByParticipantId.set(r.participant_id, list);
    }
  }

  // Populated as applications are resolved (new or existing) in the per-row
  // loop below; used after that loop to attach agreement letters / program
  // documents (fetched once per program above) to the right application.
  const applicationIdByLegacyParticipantId = new Map();

  // ---------- Existing new-prod users, for email-match reporting ----------
  const counts = {};
  const bump = (k, n = 1) => (counts[k] = (counts[k] || 0) + n);
  const perProgram = {};

  for (const legacyProgramId of activeProgramIds) {
    const { id: newProgramId, brandId, _synthetic: programIsSynthetic } = programByLegacyId.get(legacyProgramId);
    const stat = {
      participants: 0, usersNew: 0, usersMatched: 0,
      participantsNew: 0, participantsReused: 0,
      appsNew: 0, appsSkippedExisting: 0, orphanNoStatus: 0, invalidEmail: 0, emptyName: 0, essayMismatchPrograms: 0,
      invoicesNew: 0, invoicesSkippedExisting: 0, invoicesUnmatchedTier: 0, invoicesSupersededUnpaid: 0, invoicesSkippedFailed: 0,
      tiersSynthesized: 0,
      documentsNew: 0, documentsSkippedExisting: 0, documentsUnmatchedApp: 0,
      // Same-email dedupe (owner decision 2026-09-26, see "Duplicate legacy
      // participant rows -- same-program email grouping" in README): rows folded
      // into another row's application (dupRowsMerged), and legacy_id matches
      // ignored because the matched user belongs to a different brand
      // (crossBrandLegacyUsers).
      dupRowsMerged: 0, crossBrandLegacyUsers: 0,
      // Overflow guards against bounded new-prod varchar columns (see
      // clampText/nullIfOverLen above) -- found via the prod-clone --apply.
      phoneOverflowNulled: 0, nationalityTruncated: 0, occupationTruncated: 0,
      instagramTruncated: 0, twibbonLinkOverflowNulled: 0,
      invalidLegacyDatesNulled: 0, nulBytesStripped: 0,
    };
    perProgram[legacyProgramId] = stat;
    const synthesizedTiersThisProgram = new Set(); // legacy program_payment_id -> already-created-or-would-create this run

    // Legacy participants for this program (one row = one registration).
    // --limit caps rows/program for local slice testing (idempotency reruns, etc.) --
    // never used against prod for the real dry-run report.
    const rows = await mq(
      `SELECT p.*, u.email AS user_email, u.full_name AS user_full_name, u.password AS user_password,
              u.is_verified AS user_is_verified, u.is_active AS user_is_active, u.is_deleted AS user_is_deleted,
              u.created_at AS user_created_at
       FROM participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.program_id = ? AND p.is_deleted = 0
       ORDER BY p.id ASC
       ${perProgramLimit ? `LIMIT ${Number(perProgramLimit)}` : ''}`,
      [legacyProgramId],
    );
    stat.participants = rows.length;

    // Agreement letters + program documents manifest rows -- once per program (joined
    // through participants), never per-row inside the loop below. Recorded unconditionally
    // (dry-run and apply alike, regardless of whether this run creates/reuses a Participant
    // profile) since these files are independent of the participant-profile dedupe logic --
    // same manifest-only, never-downloaded contract as the picture/resume rows above.
    const letters = await mq(
      `SELECT al.id, al.file_link, al.participant_id
       FROM participant_agreement_letters al
       JOIN participants p ON p.id = al.participant_id
       WHERE p.program_id = ? AND al.is_deleted = 0`,
      [legacyProgramId],
    );
    for (const letter of letters) {
      recordMedia('participant_agreement_letters.file_link', letter.id, letter.file_link, letter.participant_id);
    }
    const programDocs = await mq(
      `SELECT pd.id, pd.file_url, pd.participant_id
       FROM participant_program_documents pd
       JOIN participants p ON p.id = pd.participant_id
       WHERE p.program_id = ? AND pd.is_deleted = 0`,
      [legacyProgramId],
    );
    for (const doc of programDocs) {
      recordMedia('participant_program_documents.file_url', doc.id, doc.file_url, doc.participant_id);
    }

    // ---------- Batch-prefetch existing users/participants/applications for this
    // WHOLE program (one query each, not once per legacy row). MEASURED PROBLEM
    // (2026-09-26, prod clone): the per-row `SELECT ... WHERE lower(trim(email))=$1
    // AND brand_id=$2 LIMIT 1` had no matching index and seq-scanned the entire
    // `users` table on every single row -- ~88% sustained CPU on the clone; against
    // the live prod primary at 250k+ lookups that would degrade the site for hours.
    // Batching per-program (rather than fixed-size chunks) is strictly fewer round
    // trips for the same correctness -- the largest single program here is ~55K
    // rows, comfortably within a single `= ANY($1::type[])` array parameter. Pair
    // with the `idx_users_brand_lower_trim_email` CONCURRENTLY index (see migration
    // 20260926090000) so this query is an index scan, not just fewer seq scans.
    const rowEmails = [...new Set(rows.map((r) => normEmail(r.user_email)).filter(isValidEmail))];
    const rowLegacyUserIds = [...new Set(rows.map((r) => r.user_id))];
    const usersByEmail = new Map(); // normEmail -> {id, legacy_id}
    // legacy user id -> {id: new user id, brandId} -- brandId is required so a
    // legacy_id match can be rejected when it belongs to a DIFFERENT brand (legacy
    // users are brand-scoped via program_category_id, but users.legacy_id is
    // unique globally across brands -- see "crossBrandLegacyUsers" below).
    const usersByLegacyId = new Map();
    // Users are brand-scoped, not program-scoped: a dry-run-simulated program
    // (PENDING_PROGRAM_BACKFILLS) still carries its real brandId, so this lookup
    // must run for it too. Gating it on programIsSynthetic (as 2444f2cc did)
    // reported all 384 existing MEYS-brand matches for legacy program 12 as new.
    if (rowEmails.length) {
      const r = await pg.query(
        `SELECT id, legacy_id, lower(trim(email)) AS norm_email FROM users WHERE brand_id = $1 AND lower(trim(email)) = ANY($2::text[])`,
        [brandId, rowEmails],
      );
      for (const u of r.rows) usersByEmail.set(u.norm_email, { id: u.id, legacy_id: u.legacy_id });
    }
    if (rowLegacyUserIds.length) {
      // Unscoped by brand on purpose (a legacy_id is looked up before we know
      // which user it belongs to) -- callers below must check `.brandId` before
      // trusting a hit.
      const r = await pg.query(`SELECT id, legacy_id, brand_id FROM users WHERE legacy_id = ANY($1::int[])`, [rowLegacyUserIds]);
      for (const u of r.rows) usersByLegacyId.set(u.legacy_id, { id: u.id, brandId: u.brand_id });
    }
    // Participants for every user this program's rows could possibly already match --
    // a user created earlier in THIS run (brand-new) is intentionally absent from this
    // prefetch, which is correct: it cannot have a pre-existing participant profile.
    const candidateUserIds = [...new Set([...[...usersByEmail.values()].map((u) => u.id), ...[...usersByLegacyId.values()].map((u) => u.id)])];
    const participantsByUserId = new Map(); // userId -> participantId
    if (candidateUserIds.length) {
      const r = await pg.query(`SELECT id, user_id FROM participants WHERE user_id = ANY($1::uuid[])`, [candidateUserIds]);
      for (const p of r.rows) participantsByUserId.set(p.user_id, p.id);
    }
    // Already-migrated applications, keyed by the legacy `participants.id` this
    // migration's own `legacy_id` column stores.
    const appsByLegacyParticipantId = new Map();
    {
      const rowLegacyIds = rows.map((r) => r.id);
      const r = await pg.query(`SELECT id, legacy_id FROM participant_applications WHERE legacy_id = ANY($1::int[])`, [rowLegacyIds]);
      for (const a of r.rows) appsByLegacyParticipantId.set(a.legacy_id, a.id);
    }
    // Native (legacy_id IS NULL) duplicate applications for this program, scoped to
    // every participant this program's rows could already resolve to -- same
    // absent-for-brand-new-participants reasoning as above applies and is correct.
    const dupAppsByParticipantId = new Map();
    if (!programIsSynthetic) {
      const candidateParticipantIds = [...new Set([...participantsByUserId.values()])];
      if (candidateParticipantIds.length) {
        const r = await pg.query(
          `SELECT id, participant_id FROM participant_applications WHERE program_id = $1 AND participant_id = ANY($2::uuid[])`,
          [newProgramId, candidateParticipantIds],
        );
        for (const a of r.rows) dupAppsByParticipantId.set(a.participant_id, a.id);
      }
    }

    // ---------- Batch-fetch the latest participant_statuses row per legacy
    // participant -- needed both for group-primary selection (below) and for
    // status mapping. Previously a per-row MySQL round-trip inside the loop;
    // batching per-program removes that too (see "Perf fix" precedent above).
    const statusByParticipantId = new Map();
    {
      const ids = rows.map((r) => r.id);
      if (ids.length) {
        const latest = await mq(
          `SELECT ps1.participant_id, ps1.general_status, ps1.form_status
             FROM participant_statuses ps1
             JOIN (SELECT participant_id, MAX(id) AS max_id FROM participant_statuses
                     WHERE participant_id IN (?) GROUP BY participant_id) ps2
               ON ps1.participant_id = ps2.participant_id AND ps1.id = ps2.max_id`,
          [ids],
        );
        for (const r of latest) statusByParticipantId.set(r.participant_id, r);
      }
    }

    // ---------- Group legacy rows by normalized email (owner decision
    // 2026-09-26, see README "Duplicate legacy participant rows"): legacy has
    // the same person registered 2+ times within one program (3,961
    // (user_id, program_id) groups / 8,242 rows across the mapped programs,
    // verified live) -- the root cause of the prod-clone --apply crash on
    // `participants_user_id_key`. Brand is fixed per program, so grouping by
    // email alone is the correct key: one group -> one user, one participant
    // profile, ONE application. This also collapses same-brand duplicate-
    // email legacy USERS (19 groups: different legacy user ids, same email,
    // same brand) onto one new row, so neither case can reach two INSERTs
    // against users(email, brand_id) or participant_applications
    // (participant_id, program_id).
    const groupsByEmail = new Map(); // normEmail -> { members: [row,...] }
    for (const row of rows) {
      const email = normEmail(row.user_email);
      if (!isValidEmail(email)) { stat.invalidEmail++; bump('invalidEmail'); continue; }
      if (!row.full_name || !String(row.full_name).trim()) { stat.emptyName++; bump('emptyName'); }
      const g = groupsByEmail.get(email) || { members: [] };
      g.members.push(row);
      groupsByEmail.set(email, g);
    }

    // Deterministic primary-row pick within a group: non-draft (submitted)
    // beats draft; tie -> latest updated_at/created_at; tie -> highest id.
    // The primary row supplies the application's status/personal_data/essays;
    // every other member's id is recorded in
    // personal_data.legacy_merged_participant_ids and still contributes its
    // own payments/documents to the single resulting application.
    function pickPrimary(members) {
      return members.reduce((best, cur) => {
        if (!best) return cur;
        const bestSubmitted = (statusByParticipantId.get(best.id)?.form_status ?? FORM_STATUS.DRAFT) !== FORM_STATUS.DRAFT;
        const curSubmitted = (statusByParticipantId.get(cur.id)?.form_status ?? FORM_STATUS.DRAFT) !== FORM_STATUS.DRAFT;
        if (curSubmitted !== bestSubmitted) return curSubmitted ? cur : best;
        // safeDate: an Invalid Date object (see the safeDate comment above) is
        // truthy, so a raw `||` chain here would never fall through to a good
        // value and +invalidDate is NaN, making every comparison unstable.
        const bestTime = +(safeDate(best.updated_at) || safeDate(best.created_at) || new Date(0));
        const curTime = +(safeDate(cur.updated_at) || safeDate(cur.created_at) || new Date(0));
        if (curTime !== bestTime) return curTime > bestTime ? cur : best;
        return cur.id > best.id ? cur : best;
      }, null);
    }

    for (const group of groupsByEmail.values()) {
      const email = normEmail(group.members[0].user_email);
      const primary = pickPrimary(group.members);
      const others = group.members.filter((m) => m.id !== primary.id);
      const memberIds = group.members.map((m) => m.id);
      const row = primary; // downstream code (application/personal_data/essays/score) reads `row`
      // participants.full_name feeds the admin name search (trigram index), so a
      // blank primary name falls back to the primary's legacy users.full_name,
      // then to any merged sibling row's name, instead of landing as ''.
      const resolvedFullName = resolveLegacyFullName(primary, others);
      const birthdate = legacyBirthdate(row.birthdate, stat); // 'YYYY-MM-DD' or null; computed once so the counter isn't doubled
      if (others.length) { stat.dupRowsMerged += others.length; bump('dupRowsMerged', others.length); }

      // ---- User resolution (brand-scoped match) ----
      // Read from the per-program batch prefetch above -- no per-row SELECT.
      const existingUserMatch = usersByEmail.get(email);
      let userId;
      if (existingUserMatch) {
        userId = existingUserMatch.id;
        stat.usersMatched++;
        bump('usersMatched');
        if (apply && existingUserMatch.legacy_id == null) {
          // BUG FIX: guarded in SQL, not just JS -- `primary.user_id` (the legacy
          // id we're about to stamp on) may already be claimed by a DIFFERENT
          // existing user row (bug (c), found while fixing the real prod apply crash: "matched
          // existing user" UPDATE crashing on users.legacy_id's unique
          // constraint). The NOT EXISTS makes that a safe no-op instead.
          const upd = await pg.query(
            `UPDATE users SET legacy_id = $1 WHERE id = $2 AND legacy_id IS NULL
               AND NOT EXISTS (SELECT 1 FROM users u2 WHERE u2.legacy_id = $1)`,
            [primary.user_id, userId],
          );
          if (upd.rowCount) existingUserMatch.legacy_id = primary.user_id;
        }
      } else {
        // Check every group member's legacy user id against the legacy_id map.
        // Brand-scoped: a match belonging to a DIFFERENT brand must be ignored
        // (legacy users are brand-scoped via program_category_id, but
        // users.legacy_id is unique globally) -- attaching it here would
        // silently move the application onto the wrong brand's user (bug (b)
        // found while fixing the real prod apply crash).
        let legacyMatch = null;
        let crossBrandIgnored = false;
        for (const m of group.members) {
          const hit = usersByLegacyId.get(m.user_id);
          if (!hit) continue;
          if (hit.brandId === brandId) { legacyMatch = hit; break; }
          crossBrandIgnored = true;
        }
        if (legacyMatch) {
          userId = legacyMatch.id;
          stat.usersMatched++;
          bump('usersMatched');
        } else {
          if (crossBrandIgnored) { stat.crossBrandLegacyUsers++; bump('crossBrandLegacyUsers'); }
          stat.usersNew++;
          bump('usersNew');
          if (apply) {
            // crossBrandIgnored: primary.user_id is already claimed by another
            // brand's user -- writing it here would violate users.legacy_id's
            // global uniqueness (bug (c)'s INSERT-side twin). Create with
            // legacy_id NULL instead, guarded by ON CONFLICT (email, brand_id).
            const ins = crossBrandIgnored
              ? await pg.query(
                  `INSERT INTO users (email, brand_id, password_hash, email_verified, is_active, legacy_id, legacy_type, created_at, updated_at)
                   VALUES ($1,$2,NULL,$3,$4,NULL,'participant',$5,now())
                   ON CONFLICT (email, brand_id) DO UPDATE SET updated_at = now()
                   RETURNING id, legacy_id`,
                  [email, brandId, !!primary.user_is_verified, !!primary.user_is_active && !primary.user_is_deleted, safeDate(primary.user_created_at) || new Date()],
                )
              : await pg.query(
                  `INSERT INTO users (email, brand_id, password_hash, email_verified, is_active, legacy_id, legacy_type, created_at, updated_at)
                   VALUES ($1,$2,NULL,$3,$4,$5,'participant',$6,now())
                   ON CONFLICT (legacy_id) DO UPDATE SET updated_at = now()
                   RETURNING id, legacy_id`,
                  [email, brandId, !!primary.user_is_verified, !!primary.user_is_active && !primary.user_is_deleted, primary.user_id, safeDate(primary.user_created_at) || new Date()],
                );
            userId = ins.rows[0].id;
            // BUG FIX (the core one): keep every prefetch map current in-run.
            // Previously these three maps (usersByEmail/usersByLegacyId/
            // participantsByUserId) were built once before the loop and never
            // updated as rows were created in the same run, so a second legacy
            // row for the same person landed here again, got treated as
            // "new", and collided on participants_user_id_key / the
            // (participant_id, program_id) app unique index.
            usersByEmail.set(email, { id: userId, legacy_id: ins.rows[0].legacy_id });
            if (ins.rows[0].legacy_id != null) usersByLegacyId.set(ins.rows[0].legacy_id, { id: userId, brandId });
          }
        }
      }

      // ---- Participant profile (create once; never overwrite from a later program row) ----
      // Reused-vs-new is computed in BOTH dry-run and apply so the dry-run report reflects
      // reality: a userId that already existed (matched or previously-linked) may or may not
      // already have a Participant profile row; a brand-new user never does.
      let participantId = null;
      let participantIsNew = true;
      if (userId && participantsByUserId.has(userId)) {
        participantId = participantsByUserId.get(userId);
        participantIsNew = false;
      }
      if (participantIsNew) {
        stat.participantsNew++;
        bump('participantsNew');
      } else {
        stat.participantsReused++;
        bump('participantsReused');
      }
      if (apply && userId && participantIsNew) {
        // BUG FIX (found via the prod-clone --apply on program 12): clamp/null
        // legacy free-text values against their bounded new-prod varchar
        // columns -- see the `clampText`/`nullIfOverLen` comment above for
        // the verified-live overflow counts per field. Counted, never silent.
        const safePhone = nullIfOverLen(row.phone_number, 25);
        if (safePhone == null && row.phone_number) { stat.phoneOverflowNulled++; bump('phoneOverflowNulled'); }
        const safeNationality = clampText(row.nationality, 100);
        if (safeNationality && String(row.nationality || '').length > safeNationality.length) { stat.nationalityTruncated++; bump('nationalityTruncated'); }
        const safeOccupation = clampText(row.occupation, 100);
        if (safeOccupation && String(row.occupation || '').length > safeOccupation.length) { stat.occupationTruncated++; bump('occupationTruncated'); }
        const safeInstagram = clampText(row.instagram_account, 50);
        if (safeInstagram && String(row.instagram_account || '').length > safeInstagram.length) { stat.instagramTruncated++; bump('instagramTruncated'); }

        const ins = await pg.query(
          `INSERT INTO participants (user_id, full_name, nick_name, birthdate, gender, phone_country_code, phone_number,
             nationality, nationality_code, origin_address, current_address, institution, major, occupation,
             instagram_username, tshirt_size, education_level, knowledge_source, referral_code, legacy_id, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now())
           ON CONFLICT (legacy_id) DO NOTHING
           RETURNING id`,
          [
            userId, clampText(resolvedFullName, 255) || '', clampText(row.nickname, 100) || null, birthdate,
            mapGender(row.gender), row.country_code || null, safePhone || null,
            safeNationality || null, null /* legacy nationality_code is actually a phone dial code
              (e.g. "+234"), a duplicate of country_code, NOT an ISO country code -- verified
              live: every legacy row with nationality_code="+234" has nationality="Nigeria" and
              country_code="+234". It has no legitimate ISO-code data at all (also overflows the
              new column's varchar(3): 57,694 legacy rows are >3 chars, e.g. "+234"). Writing it
              through was both wrong and, for ~21% of rows, a hard INSERT failure. Left NULL until
              a real ISO code can be derived (e.g. from the free-text `nationality` name via a
              country-name lookup) -- open item, see README "Known data-quality gaps". */,
            row.origin_address || null,
            row.current_address || null, clampText(row.institution, 200) || null, clampText(row.major, 200) || null,
            safeOccupation || null, safeInstagram || null,
            clampText(row.tshirt_size, 10) || null, clampText(row.education_level, 100) || null,
            clampText(row.knowledge_source, 100) || null, clampText(row.ref_code_ambassador, 20) || null, row.id, safeDate(row.created_at) || new Date(),
          ],
        );
        participantId = ins.rows.length ? ins.rows[0].id : (await pg.query(`SELECT id FROM participants WHERE user_id=$1`, [userId])).rows[0].id;
        // BUG FIX: same in-run map-currency fix as users above, for
        // participants_user_id_key specifically (the exact constraint the real
        // prod --apply crashed on).
        participantsByUserId.set(userId, participantId);
        recordMedia('participants.picture_url', row.id, row.picture_url);
        recordMedia('participants.resume_url', row.id, row.resume_url);
      } else if (!apply && participantIsNew) {
        // dry-run: still worth manifesting the media URLs this row WOULD bring in.
        recordMedia('participants.picture_url', row.id, row.picture_url);
        recordMedia('participants.resume_url', row.id, row.resume_url);
      }

      // ---- Application resolution (per email-group = per program registration) ----
      // An application already exists if ANY group member id is an existing
      // participant_applications.legacy_id, OR a (participant_id, program_id)
      // app already exists (native or legacy) -- never insert a second app for
      // the same (participant, program). Invoice import (below) must still run
      // against an already-existing application on a re-run so a partial prior
      // run gets backfilled, not silently skipped forever.
      let applicationId = null;
      let isNewApplication = false;
      let existingAppId = null;
      for (const mid of memberIds) {
        const hit = appsByLegacyParticipantId.get(mid);
        if (hit) { existingAppId = hit; break; }
      }
      if (existingAppId) {
        applicationId = existingAppId;
        stat.appsSkippedExisting++;
        bump('appsSkippedExisting');
      } else if (participantId && !programIsSynthetic) {
        // Duplicate-guard: same participant already has an application for this program
        // natively (legacy_id IS NULL on that row -- someone who registered directly on the
        // new platform before/alongside this import). This must run in DRY-RUN too, not
        // just --apply -- a dry-run report that can't see native duplicates (e.g. the 125
        // legacy-program-18 emails already applied to the same mapped Korea Youth Summit
        // program) is wrong, not just conservative. Only skipped when `participantId` is
        // null (brand-new participant, dry-run, never inserted yet) or when the program
        // itself is a dry-run simulation (see PENDING_PROGRAM_BACKFILLS) -- a program that
        // doesn't exist yet in prod cannot possibly already have a native application
        // against it, and its id isn't a real uuid to query with.
        const dupAppId = dupAppsByParticipantId.get(participantId);
        if (dupAppId) {
          applicationId = dupAppId;
          stat.appsSkippedExisting++;
          bump('appsSkippedExisting');
        } else {
          isNewApplication = true;
        }
      } else {
        // dry-run, brand-new participant not yet created -- cannot already have a native
        // application for this program, so no duplicate check is possible or needed.
        isNewApplication = true;
      }

      // ---- Payments -> invoices: merged from EVERY group member (owner
      // decision: all rows folded into a group attach their payments to the
      // one resulting application), re-sorted chronologically since
      // paymentsByParticipantId is only sorted within a single legacy
      // participant id, not across several merged ones. See "Payment import"
      // in README.
      const paymentsForRow = memberIds
        .flatMap((mid) => paymentsByParticipantId.get(mid) || [])
        .sort((a, b) => (new Date(a.createdAt) - new Date(b.createdAt)) || (a.id - b.id));
      let registrationPaymentStatus = 'unpaid';
      let programPaymentStatus = 'unpaid';
      const invoiceInserts = [];
      for (const payment of paymentsForRow) {
        const invoiceStatus = mapPaymentRowStatus(payment.status);
        // Owner decision (2026-09-26): FAILED legacy attempts are not imported.
        // They are abandoned gateway attempts with no money moved (~21k of ~29k
        // legacy payments); importing them would bloat admin payment lists and
        // finance reports for no business value. Checked before tier resolution
        // so a failed-only fee never synthesizes a historical tier, and excluded
        // from the status aggregate so an application whose only attempt failed
        // lands at 'unpaid', consistent with the invoices that actually exist.
        // The raw legacy dump remains the archive of record for these rows.
        if (invoiceStatus === 'failed') {
          stat.invoicesSkippedFailed++;
          bump('invoicesSkippedFailed');
          continue;
        }
        // See "Invoice tier synthesis": resolves an existing content-migrated tier when
        // one exists, else creates (apply) / simulates (dry-run) a historical tier from
        // legacy `program_payments` so a payment is NEVER dropped just because its
        // program's fee definitions were never content-migrated -- only a truly orphaned
        // program_payment_id (deleted/missing even in legacy) is reported as unmatched.
        const tierCountBefore = synthesizedTiersThisProgram.size;
        const tier = await resolveOrCreateTier(newProgramId, payment.programPaymentId, synthesizedTiersThisProgram);
        if (synthesizedTiersThisProgram.size > tierCountBefore) { stat.tiersSynthesized++; bump('tiersSynthesized'); }
        if (!tier) {
          // Genuinely orphaned: payment.programPaymentId doesn't exist in legacy
          // program_payments either -- nothing to synthesize from, real data gap.
          stat.invoicesUnmatchedTier++;
          bump('invoicesUnmatchedTier');
          continue;
        }
        const category = invoiceCategoryForFeeType(tier.fee_type);
        if (category === 'registration') {
          registrationPaymentStatus = combinePaymentStatus(registrationPaymentStatus, invoiceStatus);
        } else {
          programPaymentStatus = combinePaymentStatus(programPaymentStatus, invoiceStatus);
        }
        invoiceInserts.push({ payment, tier, invoiceStatus });
      }
      // `application_invoices_application_tier_unpaid_key` (partial unique index on
      // (application_id, pricing_tier_id) WHERE status IN ('unpaid','processing') --
      // see migration 20260909100000_add_application_invoice_tier_unique_index, added
      // to stop concurrent ensure-invoice calls double-minting UNPAID rows) would
      // reject a second literal-'unpaid' invoice for the same tier. A legacy
      // participant can have several never-completed (PENDING) attempts for the same
      // fee, all of which map to 'unpaid' (see mapLegacyPayStatus) -- only the most
      // recent one per tier is actually inserted; the rest are real history but
      // carry no distinct settlement information (nothing was ever completed on any
      // of them), so they're reported, not silently dropped, and never written.
      // 'paid'/'failed' rows are NOT covered by that partial index (predicate is
      // 'unpaid'/'processing' only) so multiple of those per tier insert without
      // conflict, preserving real retry history for tiers that did eventually settle.
      {
        // paymentsForRow is ordered created_at/id ASC (see the payments query above),
        // so "keep the latest" means: for 'unpaid' rows, the LAST one seen per tier
        // wins -- overwrite the map entry rather than skip-on-first-seen, so an
        // earlier abandoned attempt never shadows a more recent one.
        const unpaidByTier = new Map();
        const nonUnpaid = [];
        for (const item of invoiceInserts) {
          if (item.invoiceStatus === 'unpaid') {
            if (unpaidByTier.has(item.tier.id)) {
              stat.invoicesSupersededUnpaid++;
              bump('invoicesSupersededUnpaid');
            }
            unpaidByTier.set(item.tier.id, item);
          } else {
            nonUnpaid.push(item);
          }
        }
        invoiceInserts.length = 0;
        invoiceInserts.push(...nonUnpaid, ...unpaidByTier.values());
      }

      // 109 legacy participants rows (across all programs) have no participant_statuses
      // row at all (orphans) — treated as draft/unpaid since there's nothing else to infer status from.
      // Read from the per-program batch prefetch (statusByParticipantId) above --
      // no per-row MySQL round-trip.
      const statusRow = statusByParticipantId.get(row.id);
      if (!statusRow) { stat.orphanNoStatus++; bump('orphanNoStatus'); }
      const formStatus = statusRow ? statusRow.form_status : FORM_STATUS.DRAFT;
      const generalStatus = statusRow ? statusRow.general_status : GENERAL_STATUS.PENDING;
      const appStatus = mapApplicationStatus(formStatus, generalStatus, statusMode);
      // Always recorded regardless of statusMode, so the real legacy decision outcome is
      // never lost even when the stored status is flattened to draft/submitted.
      const legacyOutcome = formStatus === FORM_STATUS.DRAFT ? null : legacyOutcomeLabel(generalStatus);

      if (isNewApplication) {
        // Essay answers, keyed against new program_essays.legacy_id when matched,
        // else by ordinal position, else a raw legacy-id fallback key.
        const essayRows = await mq(
          `SELECT program_essay_id, answer FROM participant_essays WHERE participant_id = ?`,
          [row.id],
        );
        const newEssays = essaysByProgramId.get(newProgramId) || [];
        const legacyEssayOrder = legacyEssayOrderByProgramId.get(legacyProgramId) || [];
        const essayAnswers = {};
        let essayMismatch = false;
        for (const er of essayRows) {
          const byLegacyId = newEssays.find((e) => e.legacy_id === er.program_essay_id);
          if (byLegacyId) {
            essayAnswers[byLegacyId.id] = er.answer;
            continue;
          }
          const posIdx = legacyEssayOrder.findIndex((le) => le.id === er.program_essay_id);
          if (posIdx >= 0 && newEssays[posIdx] && legacyEssayOrder.length === newEssays.length) {
            essayAnswers[newEssays[posIdx].id] = er.answer;
          } else {
            essayMismatch = true;
            essayAnswers[`legacy_essay_${er.program_essay_id}`] = er.answer;
          }
        }
        if (essayMismatch) { stat.essayMismatchPrograms = 1; }

        // Scores (denormalized onto the application; legacy has no per-application
        // separate row either — participants.score_total/score_status already is denormalized there).
        const scoreTotal = row.score_total != null ? row.score_total : null;
        const scoreStatus = mapScoreStatus(row.score_status);

        const personalData = {
          full_name: resolvedFullName || '',
          nationality: row.nationality || null,
          birthdate,
          phone_country_code: row.country_code || null,
          phone_number: row.phone_number || null,
          institution: row.institution || null,
          occupation: row.occupation || null,
          gender: mapGender(row.gender),
          // Preserves the real legacy decision outcome even when statusMode='flatten'
          // collapses `status` itself to draft/submitted (see mapApplicationStatus).
          legacy_outcome: legacyOutcome,
          legacy_import: true,
        };
        // Owner decision: record the OTHER legacy participant rows folded into
        // this same application (only when non-empty) so the merge is never
        // silent/lossy -- abs(each id) is a real legacy participants.id.
        if (others.length) personalData.legacy_merged_participant_ids = others.map((m) => m.id);

        stat.appsNew++;
        bump('appsNew');
        if (apply) {
          // BUG FIX (the actual crash on the prod-clone --apply, program 12):
          // `twibbon_link` has no length cap in legacy (79 rows across the
          // mapped programs exceed the new column's varchar(500), up to
          // 65,535 chars of pasted markup) -- a truncated URL is broken/
          // misleading, so null it instead and count it (see
          // nullIfOverLen/clampText comment above).
          const safeTwibbonLink = nullIfOverLen(row.twibbon_link, 500);
          if (safeTwibbonLink == null && row.twibbon_link) { stat.twibbonLinkOverflowNulled++; bump('twibbonLinkOverflowNulled'); }
          const insApp = await pg.query(
            `INSERT INTO participant_applications
               (program_id, participant_id, status, registration_payment_status, program_payment_status,
                application_category, personal_data, essay_answers, motivation_letter, achievements, experiences,
                twibbon_link, score_total, score_status, submission_date, legacy_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,now())
             ON CONFLICT (legacy_id) DO NOTHING
             RETURNING id`,
            [
              newProgramId, participantId, appStatus, registrationPaymentStatus, programPaymentStatus,
              mapCategory(row.category),
              JSON.stringify(personalData), JSON.stringify(essayAnswers),
              stripNulCounted(row.experiences, stat), stripNulCounted(row.achievements, stat), stripNulCounted(row.experiences, stat),
              safeTwibbonLink || null, scoreTotal, scoreStatus,
              formStatus !== FORM_STATUS.DRAFT ? (safeDate(row.updated_at) || safeDate(row.created_at)) : null,
              row.id, safeDate(row.created_at) || new Date(),
            ],
          );
          applicationId = insApp.rows.length
            ? insApp.rows[0].id
            : (await pg.query(`SELECT id FROM participant_applications WHERE legacy_id=$1`, [row.id])).rows[0].id;
          // Keep the batch prefetch maps current for the rest of THIS program's loop
          // (see the comment above `existingAppId`) -- closes the gap for the rare case
          // of a repeated legacy participant/application row within the same program.
          // Set for every group member id, not just the primary's: the real DB row's
          // legacy_id is the primary's id only, but in-run bookkeeping should still
          // resolve a same-run repeat of any merged member id from memory.
          for (const mid of memberIds) appsByLegacyParticipantId.set(mid, applicationId);
          if (participantId) dupAppsByParticipantId.set(participantId, applicationId);
        }
      } else if (apply && applicationId) {
        // Already-migrated application: backfill payment status computed above in case
        // an older script version (or a partial run) left it at the hardcoded default.
        await pg.query(
          `UPDATE participant_applications SET registration_payment_status = $1, program_payment_status = $2, updated_at = now() WHERE id = $3`,
          [registrationPaymentStatus, programPaymentStatus, applicationId],
        );
      }

      // Dry-run never inserts a real application row for a new application, so there's
      // no real id to key documents off of yet -- use a truthy placeholder purely so the
      // dry-run document counting below can still report "would attach" vs "no target app"
      // accurately; it is never used for an actual write (guarded by `if (!apply)` there).
      // Set for EVERY group member id: documents (agreement letters / program
      // documents) are keyed per legacy participant id and must attach to the
      // one merged application regardless of which row in the group they came
      // from (owner decision -- see README "Documents").
      const applicationIdForMap = applicationId || (dryRun && isNewApplication ? `dry-run:${row.id}` : null);
      if (applicationIdForMap) {
        for (const mid of memberIds) applicationIdByLegacyParticipantId.set(mid, applicationIdForMap);
      }

      // ---- Invoices themselves: one application_invoices row per legacy payment row. ----
      // By-final-status counts (paid/unpaid/failed -- 'processing' never appears, see
      // mapLegacyPayStatus) requested alongside the new/skipped counters so the report
      // shows what the imported payment HISTORY looks like, not just import mechanics.
      for (const { invoiceStatus } of invoiceInserts) {
        const key = `invoicesByStatus_${invoiceStatus}`;
        stat[key] = (stat[key] || 0) + 1;
        bump(key);
      }
      if (apply && applicationId) {
        for (const { payment, tier, invoiceStatus } of invoiceInserts) {
          const stored = storedInvoiceStatus(invoiceStatus);
          const ins = await pg.query(
            `INSERT INTO application_invoices
               (application_id, pricing_tier_id, amount, currency, status, rejection_reason, paid_at, payment_method, legacy_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now())
             ON CONFLICT (legacy_id) DO NOTHING
             RETURNING id`,
            [
              applicationId, tier.id, payment.amount, payment.currency, stored.status, stored.rejectionReason,
              invoiceStatus === 'paid' ? (safeDateCounted(payment.paidAt, stat) || safeDateCounted(payment.createdAt, stat)) : null,
              payment.paymentMethod, payment.id, safeDate(payment.createdAt) || new Date(), // counted above when used for paid_at; created_at fallback here reuses the same (already-checked) value
            ],
          );
          if (ins.rows.length) { stat.invoicesNew++; bump('invoicesNew'); }
          else { stat.invoicesSkippedExisting++; bump('invoicesSkippedExisting'); }
        }
      } else if (!apply) {
        // dry-run: report what would be created without an applicationId to attach to yet.
        stat.invoicesNew += invoiceInserts.length;
        bump('invoicesNew', invoiceInserts.length);
      }
    }

    // ---- Agreement letters / program documents -> participant_documents ----
    // Runs once per program, after every row above has resolved (or created) its
    // application, so `applicationIdByLegacyParticipantId` is fully populated for
    // this program's participants (letters/programDocs are keyed by the legacy
    // `participants.id`, i.e. `letter.participant_id`/`doc.participant_id` above,
    // matching how the media manifest already keys `parent_legacy_id`).
    for (const letter of letters) {
      const applicationId = applicationIdByLegacyParticipantId.get(letter.participant_id);
      if (!applicationId) {
        stat.documentsUnmatchedApp++;
        bump('documentsUnmatchedApp');
        continue;
      }
      if (!apply) { stat.documentsNew++; bump('documentsNew'); continue; }
      const ins = await pg.query(
        `INSERT INTO participant_documents (application_id, name, type, file_url, legacy_id, generated_at)
         VALUES ($1,$2,'agreement_letter',$3,$4,now())
         ON CONFLICT (legacy_id) DO NOTHING
         RETURNING id`,
        [applicationId, 'Agreement Letter', letter.file_link, letter.id],
      );
      if (ins.rows.length) { stat.documentsNew++; bump('documentsNew'); }
      else { stat.documentsSkippedExisting++; bump('documentsSkippedExisting'); }
    }
    for (const doc of programDocs) {
      const applicationId = applicationIdByLegacyParticipantId.get(doc.participant_id);
      if (!applicationId) {
        stat.documentsUnmatchedApp++;
        bump('documentsUnmatchedApp');
        continue;
      }
      if (!apply) { stat.documentsNew++; bump('documentsNew'); continue; }
      // 'complementary_document' matches the real DocumentType strings used elsewhere
      // in the app (create-update-program-content.dto.ts) -- NOT 'requirement', which
      // this migration's own README mapping table used before this was verified against
      // actual code; see README "Documents -- type value correction".
      //
      // legacy_id = -doc.id (negated), NOT doc.id: participant_documents.legacy_id is a
      // single table-wide unique column, but `participant_agreement_letters.id` and
      // `participant_program_documents.id` are two independent legacy auto-increment
      // sequences that both start at 1 -- inserting doc.id verbatim collided with the
      // letter of the same id and was silently treated as "already exists" (caught by
      // this session's own local apply test, see README "Local apply test"). Negation
      // keeps both sequences unique against each other and against every other
      // legacy_id-bearing table in this schema (which are all non-negative legacy ids),
      // and is trivially reversible (abs(legacy_id) recovers the real legacy row id).
      const ins = await pg.query(
        `INSERT INTO participant_documents (application_id, name, type, file_url, legacy_id, generated_at)
         VALUES ($1,$2,'complementary_document',$3,$4,now())
         ON CONFLICT (legacy_id) DO NOTHING
         RETURNING id`,
        [applicationId, 'Program Document', doc.file_url, -doc.id],
      );
      if (ins.rows.length) { stat.documentsNew++; bump('documentsNew'); }
      else { stat.documentsSkippedExisting++; bump('documentsSkippedExisting'); }
    }
  }

  // ---------- Duplicate email report (see README dedupe rules) ----------
  const dupSameBrand = await mq(
    `SELECT COUNT(*) n FROM (SELECT LOWER(TRIM(email)) e, program_category_id
       FROM users WHERE is_deleted = 0 GROUP BY e, program_category_id HAVING COUNT(*) > 1) x`,
  );
  const dupMultiBrand = await mq(
    `SELECT COUNT(*) n FROM (SELECT LOWER(TRIM(email)) e FROM users WHERE is_deleted = 0
       GROUP BY e HAVING COUNT(DISTINCT program_category_id) > 1) x`,
  );

  console.log('\n=== Per-program breakdown (users matched-existing vs new-to-create, participants reused vs new, applications new vs skipped-existing) ===');
  let totalUsersMatched = 0, totalUsersNew = 0, totalParticipantsReused = 0, totalParticipantsNew = 0, totalAppsNew = 0, totalAppsSkipped = 0;
  let totalInvoicesNew = 0, totalInvoicesSkipped = 0, totalInvoicesUnmatchedTier = 0, totalInvoicesSuperseded = 0, totalInvoicesSkippedFailed = 0, totalTiersSynthesized = 0;
  let totalDocumentsNew = 0, totalDocumentsSkipped = 0, totalDocumentsUnmatchedApp = 0;
  let totalDupRowsMerged = 0, totalCrossBrandLegacyUsers = 0;
  let totalPhoneOverflowNulled = 0, totalNationalityTruncated = 0, totalOccupationTruncated = 0, totalInstagramTruncated = 0, totalTwibbonLinkOverflowNulled = 0;
  let totalInvalidLegacyDatesNulled = 0, totalNulBytesStripped = 0;
  for (const [pid, s] of Object.entries(perProgram)) {
    console.log(pid, JSON.stringify(s));
    totalUsersMatched += s.usersMatched; totalUsersNew += s.usersNew;
    totalParticipantsReused += s.participantsReused; totalParticipantsNew += s.participantsNew;
    totalAppsNew += s.appsNew; totalAppsSkipped += s.appsSkippedExisting;
    totalInvoicesNew += s.invoicesNew; totalInvoicesSkipped += s.invoicesSkippedExisting; totalInvoicesUnmatchedTier += s.invoicesUnmatchedTier; totalInvoicesSuperseded += s.invoicesSupersededUnpaid; totalInvoicesSkippedFailed += s.invoicesSkippedFailed; totalTiersSynthesized += s.tiersSynthesized;
    totalDocumentsNew += s.documentsNew; totalDocumentsSkipped += s.documentsSkippedExisting; totalDocumentsUnmatchedApp += s.documentsUnmatchedApp;
    totalDupRowsMerged += s.dupRowsMerged; totalCrossBrandLegacyUsers += s.crossBrandLegacyUsers;
    totalPhoneOverflowNulled += s.phoneOverflowNulled; totalNationalityTruncated += s.nationalityTruncated;
    totalOccupationTruncated += s.occupationTruncated; totalInstagramTruncated += s.instagramTruncated;
    totalTwibbonLinkOverflowNulled += s.twibbonLinkOverflowNulled;
    totalInvalidLegacyDatesNulled += s.invalidLegacyDatesNulled;
    totalNulBytesStripped += s.nulBytesStripped;
  }
  console.log('\n=== Totals (raw counters) ===', JSON.stringify(counts));
  console.log('\n=== Owner-required breakdown (grand total) ===');
  console.log(`Users: matched-existing=${totalUsersMatched}  new-to-create=${totalUsersNew}`);
  console.log(`Participants: reused=${totalParticipantsReused}  new=${totalParticipantsNew}`);
  console.log(`Applications: new=${totalAppsNew}  skipped-existing=${totalAppsSkipped}`);
  console.log(`Invoices: new=${totalInvoicesNew}  skipped-existing=${totalInvoicesSkipped}  unmatched-tier=${totalInvoicesUnmatchedTier}  superseded-unpaid=${totalInvoicesSuperseded}  skipped-failed=${totalInvoicesSkippedFailed}  historical-tiers-synthesized=${totalTiersSynthesized}`);
  console.log(`Invoices by final status: paid=${counts.invoicesByStatus_paid || 0}  unpaid=${counts.invoicesByStatus_unpaid || 0}  failed=${counts.invoicesByStatus_failed || 0}`);
  console.log(`Documents (agreement letters + program documents): new=${totalDocumentsNew}  skipped-existing=${totalDocumentsSkipped}  no-target-application-yet=${totalDocumentsUnmatchedApp}`);
  console.log(`Same-email dedupe: dup-rows-merged=${totalDupRowsMerged}  cross-brand-legacy-user-matches-ignored=${totalCrossBrandLegacyUsers}`);
  console.log(`Varchar-overflow guards: phone-nulled=${totalPhoneOverflowNulled}  nationality-truncated=${totalNationalityTruncated}  occupation-truncated=${totalOccupationTruncated}  instagram-truncated=${totalInstagramTruncated}  twibbon-link-nulled=${totalTwibbonLinkOverflowNulled}`);
  console.log(`Invalid legacy dates nulled (birthdate/payment paid_at/created_at): ${totalInvalidLegacyDatesNulled}`);
  console.log(`NUL bytes stripped (motivation_letter/achievements/experiences): ${totalNulBytesStripped}`);
  console.log('Same-brand duplicate email groups (legacy):', dupSameBrand[0].n);
  console.log('Multi-brand same-email groups (expected, not dupes):', dupMultiBrand[0].n);

  // ---------- Media rehost manifest (CSV: table,id,url) -- never downloaded here ----------
  const csvEscape = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csvLines = [
    'table,legacy_id,url,parent_legacy_id',
    ...manifestRows.map((r) => `${csvEscape(r.table)},${csvEscape(r.id)},${csvEscape(r.url)},${csvEscape(r.parent)}`),
  ];
  fs.writeFileSync(manifestPath, csvLines.join('\n') + '\n');
  console.log(`\nMedia manifest written: ${manifestPath} (${manifestRows.length} rows, all storage.ybbfoundation.com URLs kept as-is, nothing downloaded)`);

  if (dryRun) {
    await pg.query('ROLLBACK'); // no-op data-wise (read-only txn), just closes it cleanly
    pg.release();
  }
  await my.end();
  await pgPool.end();
}

function mapGender(g) {
  if (g === 'male' || g === 'female') return g;
  return null; // 'prefer-not' / 'other' have no equivalent in the new Gender enum (male|female)
}
function mapCategory(c) {
  return c === 'fully_funded' || c === 'self_funded' ? c : null;
}
function mapScoreStatus(s) {
  if (s === 'go_to_interview') return 'go_to_interview';
  if (s === 'rejected') return 'not_selected';
  return 'pending';
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
