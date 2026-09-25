/* eslint-disable */
/**
 * Legacy-participant proactive password-reset notification — raw-SQL, new
 * Postgres only (no legacy MySQL connection needed: this only touches
 * accounts that migrate-legacy-participants.cjs already created).
 *
 * Scope: users with `legacy_id IS NOT NULL AND password_hash IS NULL AND
 * legacy_password_reset_sent_at IS NULL` (see README.md "Auth / password
 * migration — decision": migrated accounts get password_hash = NULL and no
 * UserIdentity row, and are otherwise indistinguishable from a normal account
 * that has simply never set a password).
 *
 * For each eligible user (--apply only), this reuses the EXISTING
 * forgot-password mechanism exactly as coded in
 * src/modules/auth/application/commands/handlers/forgot-password.handler.ts:
 *   - random token: crypto.randomBytes(32).toString('hex')
 *   - stored hashed: users.password_reset_token = sha256(token) via the same
 *     hashToken() helper (src/shared/utils/hash-token.util.ts) reset-password
 *     .handler.ts uses to verify it
 *   - users.password_reset_expires = now() + 1 hour
 *   - publishes the SAME RabbitMQ event the handler does: pattern
 *     'user.forgot-password' on exchange 'ybb.events' (topic), payload
 *     { email, name, token, brandId, brand }
 *     (src/shared/infrastructure/rabbitmq/rabbitmq-producer.service.ts:
 *     emit() publishes { pattern, data } to the 'ybb.events' topic exchange
 *     using `pattern` as the routing key)
 *
 * RabbitMQ binding — CONFIRMED already bound, no notification-service change
 * needed: services/notification/src/main.ts binds routing key 'user.#' on
 * exchange 'ybb.events' (see the `bindings` array passed to
 * ensureRetryTopology in bootstrap()), which matches 'user.forgot-password'.
 * The consumer is services/notification/src/modules/events/events.controller.ts
 * `@EventPattern('user.forgot-password')`. If that binding or handler is ever
 * removed, this script's publish will silently no-op into the ack-drop path
 * (AckDropRmqServer acks/drops unhandled patterns instead of nacking) — this
 * script does NOT re-verify the binding at runtime, only at the time this was
 * written (2026-09-25).
 *
 * Idempotency: on a successful publish, sets
 * users.legacy_password_reset_sent_at = now() so a rerun skips that user.
 * This column is NOT rolled back if the publish throws — a thrown emit()
 * means the message was never confirmed sent, so leaving the row eligible for
 * the next run is correct (matches emit()'s own throw-on-failure contract;
 * see rabbitmq-producer.service.ts emit() vs emitSafe()).
 *
 * Dry-run by default; --apply is required to write anything or publish
 * anything. NEVER sends real emails / publishes real events when invoked
 * without --apply.
 */
const { Pool } = require('pg');
const crypto = require('crypto');
const { connect } = require('amqp-connection-manager');

const EXCHANGE = 'ybb.events';
const EVENT_PATTERN = 'user.forgot-password';
const RESET_TOKEN_TTL_HOURS = 1;

function hashToken(token) {
  // Mirrors src/shared/utils/hash-token.util.ts exactly (sha256-hex).
  return crypto.createHash('sha256').update(token).digest('hex');
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const dryRun = !apply;

  const onlyLegacyProgramIds = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--program') onlyLegacyProgramIds.push(Number(args[i + 1]));
  }
  const limitIdx = args.indexOf('--limit');
  const limit = limitIdx >= 0 ? Number(args[limitIdx + 1]) : null;
  const rateIdx = args.indexOf('--rate');
  const ratePerMinute = rateIdx >= 0 ? Number(args[rateIdx + 1]) : 30; // sends/minute cap in --apply

  console.log(
    `Mode: ${apply ? 'APPLY' : 'DRY-RUN'}  Programs: ${onlyLegacyProgramIds.length ? onlyLegacyProgramIds.join(',') : 'ALL'}` +
      `${limit ? `  Limit: ${limit}` : ''}  Rate: ${ratePerMinute}/min`,
  );

  const pgPool = new Pool({ connectionString: process.env.DATABASE_URL });
  // Same discipline as migrate-legacy-participants.cjs: dry-run holds one
  // client in an explicit read-only transaction so Postgres itself refuses
  // any stray write, not just script discipline. --apply uses the pool
  // directly since each update is its own short-lived read-write query.
  const pg = dryRun ? await pgPool.connect() : pgPool;
  if (dryRun) {
    await pg.query('BEGIN READ ONLY');
  }

  // ---------- Preflight: fail fast if this migration hasn't been applied yet ----------
  {
    const r = await pg.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_name = 'users' AND column_name = 'legacy_password_reset_sent_at'`,
    );
    if (!r.rows.length) {
      if (dryRun) { await pg.query('ROLLBACK'); pg.release(); }
      await pgPool.end();
      throw new Error(
        `Target Postgres is missing users.legacy_password_reset_sent_at. ` +
        `Migration 20260925140000_add_legacy_password_reset_sent_at has not been applied ` +
        `to this database yet -- run 'prisma migrate deploy' there first.`,
      );
    }
  }

  // ---------- Resolve eligible users ----------
  // Optional --program scoping: a legacy program id, resolved the same way
  // migrate-legacy-participants.cjs does (programs.legacy_id), then joined
  // through participant_applications -> participants -> users. A user can
  // have applications in multiple programs; --program with several values
  // includes any user with at least one matching application.
  let rows;
  if (onlyLegacyProgramIds.length) {
    rows = (
      await pg.query(
        `SELECT DISTINCT u.id, u.email, u.brand_id
         FROM users u
         JOIN participants pt ON pt.user_id = u.id
         JOIN participant_applications pa ON pa.participant_id = pt.id
         JOIN programs pr ON pr.id = pa.program_id
         WHERE u.legacy_id IS NOT NULL
           AND u.password_hash IS NULL
           AND u.legacy_password_reset_sent_at IS NULL
           AND u.deleted_at IS NULL
           AND pr.legacy_id = ANY($1::int[])
         ORDER BY u.id ASC
         ${limit ? `LIMIT ${Number(limit)}` : ''}`,
        [onlyLegacyProgramIds],
      )
    ).rows;
  } else {
    rows = (
      await pg.query(
        `SELECT id, email, brand_id
         FROM users
         WHERE legacy_id IS NOT NULL
           AND password_hash IS NULL
           AND legacy_password_reset_sent_at IS NULL
           AND deleted_at IS NULL
         ORDER BY id ASC
         ${limit ? `LIMIT ${Number(limit)}` : ''}`,
      )
    ).rows;
  }

  console.log(`Eligible users: ${rows.length}`);

  if (!rows.length) {
    if (dryRun) { await pg.query('ROLLBACK'); pg.release(); }
    await pgPool.end();
    return;
  }

  if (dryRun) {
    console.log('DRY-RUN: no tokens generated, no rows updated, no events published.');
    console.log('Sample (first 10):', rows.slice(0, 10).map((r) => ({ id: r.id, email: r.email })));
    await pg.query('ROLLBACK');
    pg.release();
    await pgPool.end();
    return;
  }

  // ---------- --apply: reuse the forgot-password mechanism verbatim ----------
  let rabbitConnection;
  let channelWrapper;
  try {
    rabbitConnection = connect([must('RABBITMQ_URL')]);
    channelWrapper = rabbitConnection.createChannel({
      json: true,
      setup: async (channel) => {
        await channel.assertExchange(EXCHANGE, 'topic', { durable: true });
      },
    });
    await channelWrapper.waitForConnect();

    // Brand cache: same shape forgot-password.handler.ts assembles for the
    // email template (name/colors/logo/contact/settings), fetched once per
    // brandId instead of per user.
    const brandCache = new Map();
    async function getBrandPayload(brandId) {
      if (brandCache.has(brandId)) return brandCache.get(brandId);
      const brandRes = await pgPool.query(
        `SELECT b.id, b.name, b.primary_color, b.logo_url, b.website_url, b.social_media_links,
                bs.footer_navigation, bs.support_email
         FROM brands b
         LEFT JOIN brand_settings bs ON bs.brand_id = b.id
         WHERE b.id = $1`,
        [brandId],
      );
      const b = brandRes.rows[0] || null;
      const payload = b
        ? {
            name: b.name,
            primaryColor: b.primary_color,
            logoUrl: b.logo_url,
            websiteUrl: b.website_url,
            contactEmail: null, // resolveActiveProgramContact() logic not replicated here — see note below.
            contactAddress: null,
            socialMediaLinks: b.social_media_links,
            website: b.website_url,
            settings: bs_settings(b),
          }
        : null;
      brandCache.set(brandId, payload);
      return payload;
    }
    function bs_settings(b) {
      // brand_settings columns were already left-joined onto `b` above; kept
      // as a helper only to mirror forgot-password.handler.ts's `settings`
      // sub-object shape for template compatibility.
      return { footerNavigation: b.footer_navigation ?? null, supportEmail: b.support_email ?? null };
    }

    let sent = 0;
    let failed = 0;
    for (const user of rows) {
      const token = crypto.randomBytes(32).toString('hex');
      const expires = new Date();
      expires.setHours(expires.getHours() + RESET_TOKEN_TTL_HOURS);

      // Same write forgot-password.handler.ts does: only the sha256 hash is
      // persisted, the raw token only ever goes out in the emitted event.
      await pgPool.query(
        `UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3`,
        [hashToken(token), expires, user.id],
      );

      const brand = await getBrandPayload(user.brand_id);

      try {
        await channelWrapper.publish(
          EXCHANGE,
          EVENT_PATTERN,
          {
            pattern: EVENT_PATTERN,
            data: {
              email: user.email,
              name: user.email.split('@')[0],
              token,
              brandId: user.brand_id,
              brand,
            },
          },
          { persistent: true },
        );
        await pgPool.query(
          `UPDATE users SET legacy_password_reset_sent_at = now() WHERE id = $1`,
          [user.id],
        );
        sent++;
      } catch (err) {
        // Matches emit()'s own contract: a publish failure means the message
        // was never confirmed sent, so legacy_password_reset_sent_at is left
        // NULL and this user stays eligible for the next run.
        failed++;
        console.error(`Publish failed for user ${user.id} (${user.email}): ${err.message}`);
      }

      if (ratePerMinute > 0) {
        await new Promise((r) => setTimeout(r, 60000 / ratePerMinute));
      }
    }

    console.log(`\nDone. Sent: ${sent}  Failed: ${failed}  Total eligible: ${rows.length}`);
  } finally {
    if (channelWrapper) await channelWrapper.close().catch(() => {});
    if (rabbitConnection) await rabbitConnection.close().catch(() => {});
    await pgPool.end();
  }
}

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`${name} is required`);
  return v;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
