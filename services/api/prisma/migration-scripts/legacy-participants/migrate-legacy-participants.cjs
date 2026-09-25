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

function mapApplicationStatus(formStatus, generalStatus) {
  if (formStatus === FORM_STATUS.DRAFT) return 'draft';
  // form submitted/approved: refine by decision
  if (generalStatus === GENERAL_STATUS.APPROVED) return 'accepted';
  if (generalStatus === GENERAL_STATUS.REJECTED) return 'rejected';
  if (generalStatus === GENERAL_STATUS.UNDER_REVIEW) return 'under_review';
  return 'submitted'; // general_status PENDING (0) with a submitted/approved form
}

function mapLegacyPayStatus(code) {
  switch (code) {
    case LEGACY_PAY_STATUS.PAID: return 'paid';
    case LEGACY_PAY_STATUS.FAILED: return 'failed';
    case LEGACY_PAY_STATUS.PENDING: return 'processing';
    default: return 'unpaid';
  }
}

// One legacy `payments` row's terminal status. `payments.status` int code
// mirrors payment_status semantics (0 not required/void, 1 pending, 2 paid,
// 3 failed) per the same admin-app export model.
function mapPaymentRowStatus(statusCode) {
  return mapLegacyPayStatus(statusCode);
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

  const programIds = (onlyPrograms.length ? onlyPrograms : MAPPED_LEGACY_PROGRAM_IDS)
    .filter((id) => MAPPED_LEGACY_PROGRAM_IDS.includes(id));

  const pg = new Pool({ connectionString: process.env.DATABASE_URL });
  const my = await mysql.createConnection({
    host: process.env.LEGACY_DB_HOST,
    port: Number(process.env.LEGACY_DB_PORT || 3306),
    user: process.env.LEGACY_DB_USER,
    password: process.env.LEGACY_DB_PASSWORD,
    database: process.env.LEGACY_DB_NAME,
    charset: 'utf8mb4',
  });
  await my.query('SET SESSION TRANSACTION READ ONLY');
  const mq = async (sql, p = []) => (await my.query(sql, p))[0];

  console.log(`Mode: ${apply ? 'APPLY' : 'DRY-RUN'}  Programs: ${programIds.join(',')}  Batch size: ${batchSize}`);

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
  const missingPrograms = programIds.filter((id) => !programByLegacyId.has(id));
  if (missingPrograms.length) {
    console.warn(`WARNING: no new-prod program found with legacy_id in [${missingPrograms.join(',')}] — skipping those.`);
  }
  const activeProgramIds = programIds.filter((id) => programByLegacyId.has(id));

  // Pricing tiers per new program, matched by legacy_id when set, else by
  // (category + type) heuristic since program_payments were never content-migrated.
  const tiersByProgramId = new Map(); // new programId -> [{id, legacyId, feeType}]
  for (const { id: newProgramId } of programByLegacyId.values()) {
    const r = await pg.query(
      `SELECT id, legacy_id, fee_type FROM program_pricing_tiers WHERE program_id = $1`,
      [newProgramId],
    );
    tiersByProgramId.set(newProgramId, r.rows);
  }

  // Essay question maps per new program, matched by legacy_id when set, else
  // by ordinal position (see README "essay matching").
  const essaysByProgramId = new Map(); // new programId -> [{id, legacyId, order}]
  for (const { id: newProgramId } of programByLegacyId.values()) {
    const r = await pg.query(
      `SELECT id, legacy_id, "order" FROM program_essays WHERE program_id = $1 ORDER BY "order" ASC, created_at ASC`,
      [newProgramId],
    );
    essaysByProgramId.set(newProgramId, r.rows);
  }

  // ---------- Existing new-prod users, for email-match reporting ----------
  const counts = {};
  const bump = (k, n = 1) => (counts[k] = (counts[k] || 0) + n);
  const perProgram = {};

  for (const legacyProgramId of activeProgramIds) {
    const { id: newProgramId, brandId } = programByLegacyId.get(legacyProgramId);
    const stat = { participants: 0, usersNew: 0, usersMatched: 0, appsNew: 0, appsSkippedExisting: 0, orphanNoStatus: 0, invalidEmail: 0, emptyName: 0, essayMismatchPrograms: 0 };
    perProgram[legacyProgramId] = stat;

    // Legacy participants for this program (one row = one registration).
    const rows = await mq(
      `SELECT p.*, u.email AS user_email, u.full_name AS user_full_name, u.password AS user_password,
              u.is_verified AS user_is_verified, u.is_active AS user_is_active, u.is_deleted AS user_is_deleted,
              u.created_at AS user_created_at
       FROM participants p
       JOIN users u ON u.id = p.user_id
       WHERE p.program_id = ? AND p.is_deleted = 0
       ORDER BY p.id ASC`,
      [legacyProgramId],
    );
    stat.participants = rows.length;

    for (const row of rows) {
      const email = normEmail(row.user_email);
      if (!isValidEmail(email)) { stat.invalidEmail++; bump('invalidEmail'); continue; }
      if (!row.full_name || !String(row.full_name).trim()) { stat.emptyName++; bump('emptyName'); }

      // ---- User resolution (brand-scoped match) ----
      const existingUser = await pg.query(
        `SELECT id, legacy_id FROM users WHERE lower(trim(email)) = $1 AND brand_id = $2 LIMIT 1`,
        [email, brandId],
      );
      let userId;
      if (existingUser.rows.length) {
        userId = existingUser.rows[0].id;
        stat.usersMatched++;
        bump('usersMatched');
        if (apply && existingUser.rows[0].legacy_id == null) {
          await pg.query(`UPDATE users SET legacy_id = $1 WHERE id = $2`, [row.user_id, userId]);
        }
      } else {
        // Also check a different legacy_id already claimed this row (idempotent re-run).
        const byLegacyId = await pg.query(`SELECT id FROM users WHERE legacy_id = $1`, [row.user_id]);
        if (byLegacyId.rows.length) {
          userId = byLegacyId.rows[0].id;
          stat.usersMatched++;
          bump('usersMatched');
        } else {
          stat.usersNew++;
          bump('usersNew');
          if (apply) {
            const ins = await pg.query(
              `INSERT INTO users (email, brand_id, password_hash, email_verified, is_active, legacy_id, legacy_type, created_at, updated_at)
               VALUES ($1,$2,NULL,$3,$4,$5,'participant',$6,now())
               ON CONFLICT (legacy_id) DO UPDATE SET updated_at = now()
               RETURNING id`,
              [email, brandId, !!row.user_is_verified, !!row.user_is_active && !row.user_is_deleted, row.user_id, row.user_created_at || new Date()],
            );
            userId = ins.rows[0].id;
          }
        }
      }

      // ---- Participant profile (create once; never overwrite from a later program row) ----
      let participantId = null;
      if (apply && userId) {
        const existingParticipant = await pg.query(`SELECT id FROM participants WHERE user_id = $1`, [userId]);
        if (existingParticipant.rows.length) {
          participantId = existingParticipant.rows[0].id;
        } else {
          const ins = await pg.query(
            `INSERT INTO participants (user_id, full_name, nick_name, birthdate, gender, phone_country_code, phone_number,
               nationality, nationality_code, origin_address, current_address, institution, major, occupation,
               instagram_username, tshirt_size, education_level, knowledge_source, referral_code, legacy_id, created_at, updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,now())
             ON CONFLICT (legacy_id) DO NOTHING
             RETURNING id`,
            [
              userId, row.full_name || '', row.nickname || null, row.birthdate || null,
              mapGender(row.gender), row.country_code || null, row.phone_number || null,
              row.nationality || null, row.nationality_code || null, row.origin_address || null,
              row.current_address || null, row.institution || null, row.major || null, row.occupation || null,
              row.instagram_account || null, row.tshirt_size || null, row.education_level || null,
              row.knowledge_source || null, row.ref_code_ambassador || null, row.id, row.created_at || new Date(),
            ],
          );
          participantId = ins.rows.length ? ins.rows[0].id : (await pg.query(`SELECT id FROM participants WHERE user_id=$1`, [userId])).rows[0].id;
        }
      }

      // ---- Application (per legacy participants row = per program registration) ----
      const existingApp = await pg.query(`SELECT id FROM participant_applications WHERE legacy_id = $1`, [row.id]);
      if (existingApp.rows.length) {
        stat.appsSkippedExisting++;
        bump('appsSkippedExisting');
        continue;
      }
      if (apply) {
        // Duplicate-guard: same participant already has an application for this program natively.
        const dupApp = await pg.query(
          `SELECT id FROM participant_applications WHERE participant_id = $1 AND program_id = $2`,
          [participantId, newProgramId],
        );
        if (dupApp.rows.length) { stat.appsSkippedExisting++; bump('appsSkippedExisting'); continue; }
      }

      // 109 legacy participants rows (across all programs) have no participant_statuses
      // row at all (orphans) — treated as draft/unpaid since there's nothing else to infer status from.
      const statusRow = (await mq(
        `SELECT general_status, form_status, document_status, payment_status FROM participant_statuses WHERE participant_id = ? ORDER BY id DESC LIMIT 1`,
        [row.id],
      ))[0];
      if (!statusRow) { stat.orphanNoStatus++; bump('orphanNoStatus'); }
      const formStatus = statusRow ? statusRow.form_status : FORM_STATUS.DRAFT;
      const generalStatus = statusRow ? statusRow.general_status : GENERAL_STATUS.PENDING;
      const appStatus = mapApplicationStatus(formStatus, generalStatus);

      // Essay answers, keyed against new program_essays.legacy_id when matched,
      // else by ordinal position, else a raw legacy-id fallback key.
      const essayRows = await mq(
        `SELECT program_essay_id, answer FROM participant_essays WHERE participant_id = ?`,
        [row.id],
      );
      const newEssays = essaysByProgramId.get(newProgramId) || [];
      const legacyEssayOrder = await mq(
        `SELECT id FROM program_essays WHERE program_id = ? ORDER BY id ASC`,
        [legacyProgramId],
      );
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
        full_name: row.full_name || '',
        nationality: row.nationality || null,
        birthdate: row.birthdate ? String(row.birthdate) : null,
        phone_country_code: row.country_code || null,
        phone_number: row.phone_number || null,
        institution: row.institution || null,
        occupation: row.occupation || null,
        gender: mapGender(row.gender),
      };

      stat.appsNew++;
      bump('appsNew');
      if (apply) {
        await pg.query(
          `INSERT INTO participant_applications
             (program_id, participant_id, status, registration_payment_status, program_payment_status,
              application_category, personal_data, essay_answers, motivation_letter, achievements, experiences,
              twibbon_link, score_total, score_status, submission_date, legacy_id, created_at, updated_at)
           VALUES ($1,$2,$3,'unpaid','unpaid',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,now())
           ON CONFLICT (legacy_id) DO NOTHING`,
          [
            newProgramId, participantId, appStatus, mapCategory(row.category),
            JSON.stringify(personalData), JSON.stringify(essayAnswers),
            row.experiences || null, row.achievements || null, row.experiences || null,
            row.twibbon_link || null, scoreTotal, scoreStatus,
            formStatus !== FORM_STATUS.DRAFT ? (row.updated_at || row.created_at) : null,
            row.id, row.created_at || new Date(),
          ],
        );
      }
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

  console.log('\n=== Per-program summary ===');
  for (const [pid, s] of Object.entries(perProgram)) {
    console.log(pid, JSON.stringify(s));
  }
  console.log('\n=== Totals ===', JSON.stringify(counts));
  console.log('Same-brand duplicate email groups (legacy):', dupSameBrand[0].n);
  console.log('Multi-brand same-email groups (expected, not dupes):', dupMultiBrand[0].n);

  await my.end();
  await pg.end();
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
