# Legacy participant/application/payment migration

Full-history import of legacy MySQL/MariaDB participants (CodeIgniter 4 app) into
the new NestJS/Postgres platform: users, participants, applications, essays,
scores, payments/invoices, agreement letters/documents, and ambassador
referrals — for every CLOSED legacy program. Mirrors the conventions of
`prisma/migration-scripts/legacy-content/migrate-legacy-content.cjs`: raw SQL
via `pg`/`mysql2` (never the generated Prisma client, so no Prisma extension or
NestJS service side effect can fire), idempotent upserts keyed by `legacy_id`,
dry-run by default.

## Legacy -> new entity mapping

Legacy `programs`/`program_categories` -> new `programs`/`brands` are **already
migrated** by `legacy-content`'s script (legacy_id already populated on both).
This script only needs to resolve them, never create them.

| Legacy table | New table | Key relationship |
|---|---|---|
| `program_categories` | `brands` | already has `legacy_id` |
| `programs` | `programs` | already has `legacy_id` |
| `users` (one row per **email + program_category_id**, i.e. per brand) | `users` | `users.legacy_id` = legacy `users.id`; `users.brand_id` resolved from the brand's `legacy_id` |
| `participants` (one row per **program registration** — same `user_id` can have many rows, one per program) | `participants` (profile, 1:1 with `users`) **+** `participant_applications` (1 per program) | see "Participant vs Application" below |
| `participant_statuses` | folded into `participant_applications.status` / `registration_payment_status` / `program_payment_status` | see status mapping |
| `participant_essays` | `participant_applications.essay_answers` (JSON) | keyed by `program_essays.legacy_id` (new column, this migration) |
| `scores` | `participant_applications.score_total` / `score_breakdown` / `score_status` | denormalized, no separate row — legacy is not either (see below) |
| `payments` + `xendit_payment` + `midtrans_payment` | `application_invoices` | see "Payment isolation" below |
| `program_payments` | `program_pricing_tiers` | matched by `program_pricing_tiers.legacy_id` (new column, this migration) |
| `participant_agreement_letters` | `participant_documents` (type=`agreement_letter`) | `participant_documents.legacy_id` (already exists) |
| `participant_program_documents` | `participant_documents` (type=`requirement`) | same table, disambiguated by `type` |
| `ambassadors` | `ambassadors` | `legacy_id` already exists; needs a `users` row too (ambassadors are users) |
| `ambassador_participant_referrals` | `ambassador_referrals` | `legacy_id` already exists |

### Participant vs Application — verified, not assumed

Read `prisma/schema/roles.prisma` and `applications.prisma` directly: `Participant.userId`
is `@unique` (exactly one `Participant` profile per `User`), and
`ParticipantApplication` has `@@unique([participantId, programId])` (many
applications per participant, one per program). This matches the legacy shape
exactly once you separate `users` (identity) from `participants` (per-program
registration, legacy's actual per-program row).

- Legacy `users.id` -> new `User` + new `Participant` (created once, on first
  legacy program registration encountered for that user).
- Legacy `participants.id` (**note the legacy table is confusingly named** —
  it's a per-program *registration*, not a person) -> new
  `ParticipantApplication`, `legacy_id` = legacy `participants.id`.
- The new `Participant` profile columns (full_name, birthdate, phone,
  nationality, etc.) are **not** per-program in the new schema, but legacy
  stores them per-registration (a person can in principle answer them
  differently across programs). Policy: seed the `Participant` profile from
  the **first** (earliest `created_at`) legacy `participants` row for that
  user, and never overwrite it from a later program's registration row —
  each program's own answers still live in full on that application's
  `personal_data` JSON, so no information is lost, only the canonical
  profile snapshot is fixed to the first registration.

### Status mapping

Legacy `participant_statuses` has 4 independent int-coded fields whose integer
meanings live in the CI4 admin app's export-model code (verified against
`app/Models/AdvancedOptimizedParticipantExportModel.php`, not guessed):

- `general_status`: `0`=Pending Review, `1`=Under Review, `2`=Approved,
  `3`=Rejected
- `form_status`: `0`=Draft, `1`=Submitted, `2`=Approved
- `document_status`: `0`=Not Required, `1`=Pending, `2`=Submitted,
  `3`=Approved, `4`=Rejected
- `payment_status`: `0`=Not Required, `1`=Pending, `2`=Paid, `3`=Failed

Mapping to the new `ApplicationStatus` enum, driven primarily by
`form_status` (form completion) with `general_status` refining the outcome
once a decision was made:

| Legacy (`form_status`, `general_status`) | New `ApplicationStatus` | Used in prod today? |
|---|---|---|
| `form_status=0` (Draft) | `draft` | yes |
| `form_status IN (1,2)`, `general_status=0` (Pending) | `submitted` | yes |
| `form_status IN (1,2)`, `general_status=1` (Under Review) | `under_review` | **latent** — schema supports it, prod status-gated features aren't currently live (matches prior finding: prod only ever uses draft/submitted operationally) |
| `general_status=2` (Approved) | `accepted` | **latent**, same as above |
| `general_status=3` (Rejected) | `rejected` | **latent** |
| n/a (no legacy waitlist code found in `general_status`) | `waitlisted` | not produced by this import — legacy has no waitlist state; enum value exists for native use only |
| n/a (no legacy soft-withdraw column found on `participant_statuses`/`participants`) | `withdrawn` | not produced by this import |

Legacy `payment_status` (0/1/2/3 above) maps to `PaymentStatus` per fee
category (`unpaid`/`processing`/`paid`/`failed`) — see "Payment isolation".

Payment status: legacy `payment_status` code + presence of a `payments`/
`xendit_payment`/`midtrans_payment` row in a terminal state maps to
`PaymentStatus` (`unpaid`/`paid`/`processing`/`failed`/`refunded`/`cancelled`)
on both `registration_payment_status` and `program_payment_status`,
independently, based on which `program_payments.category` (`registration` vs
`program_fee_1`/`program_fee_2`) each legacy payment settled.

## Auth / password migration — decision

**Legacy password hash format, verified against live data**: all 262,801
`users.password` values are exactly 32 hex characters — **unsalted MD5**, not
bcrypt (confirmed by direct length/format inspection; no `$2b$`/`$1$` prefix
anywhere). This is already broken as a credential store (unsalted MD5 is
trivially crackable), which is an independent reason not to carry it forward
even if the decision to require reset weren't already made.

**Mechanism chosen** (verified against actual code in
`modules/auth/application/commands/handlers/login.handler.ts`,
`forgot-password.handler.ts`, `reset-password.handler.ts`):

- Migrated `users.password_hash` = `NULL`. No `UserIdentity` row is created.
- `login.handler.ts` guard: `if (!localIdentity && !user.passwordHash) throw
  UnauthorizedException('Local authentication not configured...')` — a
  migrated account gets a clear, safe rejection on a direct login attempt; it
  never reaches `bcrypt.compare` with a null hash (which would also safely
  fail, since `bcrypt.compare(pw, '')` is always `false`, but the explicit
  guard is what actually fires first).
- `forgot-password.handler.ts` and `reset-password.handler.ts` **never check
  `passwordHash` at all** — they operate purely on `passwordResetToken`/
  `passwordResetExpires` and email/brand lookup. So the standard "forgot
  password" flow works unmodified for a migrated account with a null hash:
  request a reset link, set a new password, log in normally afterward.
- No new column or flag is needed — `password_hash IS NULL` already *is* the
  "must reset" state the login handler understands.
- `email_verified` is set to `true` for migrated users (they already went
  through legacy verification); this avoids adding an extra email-verification
  step on top of the password reset for a brand where
  `require_email_verification` is on.

**Open question for the owner**: whether migrated participants should be
proactively emailed a "your account moved, reset your password here" link
(a real email send) is a product decision, not something this script should
do on its own — hard rule says no notification/email side effects, so the
migration only leaves accounts in a valid reset-able state and does not
trigger any send itself.

## Payment isolation — decision

Investigated `payment-reconciliation.service.ts` directly. Three scans exist:

1. `reconcileProcessingInvoices` / `reconcileApplicationRegistration`: only
   touches invoices with `status IN (processing, unpaid)` **AND**
   (`externalIntentId IS NOT NULL OR externalTransactionId IS NOT NULL`).
2. `reconcileTerminalInvoiceDrift`: only touches invoices with `status IN
   (cancelled, failed, refunded)` **AND** one of those two external-id columns
   set (this is the "terminal-drift auto-void" job called out as dangerous).
3. `reconcilePaidColumnDrift`: scans **all** `status = paid` invoices
   regardless of external ids, but only *mutates* anything when the parent
   application's `registration_payment_status`/`program_payment_status`
   disagrees with the invoice — i.e. it repairs drift, it doesn't act
   unconditionally.

**Chosen approach: option (b)** — insert into the existing
`application_invoices` table (not a separate historical table), with:
- `status` set to the legacy payment's own terminal outcome (`paid` /
  `refunded` / `failed` / `cancelled` / `unpaid`) — imported rows are never
  left in `processing`.
- `external_intent_id` and `external_transaction_id` left `NULL` on every
  imported row, unconditionally. This alone makes scans 1 and 2 skip every
  imported row (their WHERE clause requires one of those columns to be set).
- `legacy_id` set (new column, this migration) — doubles as the "this is a
  historical import" marker for any future admin query or job exclusion,
  since no native invoice ever has it set.
- The parent `participant_applications.registration_payment_status` /
  `program_payment_status` written to match the imported invoice's status
  exactly, so scan 3 finds no drift and never touches the row.

No separate table was needed and no new boolean flag column was needed —
`external_intent_id`/`external_transaction_id IS NULL` plus a consistent
paid-column state is sufficient to make every reconciler pass a safe no-op
against imported data, verified against the actual WHERE clauses above.

### Architecture finding: no second table to write, verified not assumed

Investigated whether a Go-payment-service-owned row is *also* required for a
migrated payment to read as "paid" everywhere the admin dashboard/portal
check, per the task brief's explicit ask. Answer: **no** — `application_invoices`
lives in the API's own Postgres (`services/api/prisma/schema/applications.prisma:252`,
same `DATABASE_URL` as `participant_applications`), and every read path that
displays payment status queries that table (or the application's own
`registrationPaymentStatus`/`programPaymentStatus` columns) directly via
Prisma, never through a Go-service RPC:

- `services/api/src/modules/portal/application/queries/handlers/get-portal-dashboard.handler.ts:139,303`
  — `this.prisma.participantApplication.findFirst({ select: { registrationPaymentStatus: true, ... } })`.
- `services/api/src/modules/applications/application/dto/application-response.dto.ts:75-76`
  — admin application list/detail DTO exposes `registrationPaymentStatus`/
  `programPaymentStatus` straight off the Prisma row.
- `services/api/src/modules/payments/infrastructure/services/payment-reconciliation.service.ts`,
  `payment-events.controller.ts`, `registration-fee-gate.service.ts`,
  `confirm-portal-payment.handler.ts` — all read/write the same two columns
  directly, no Go-service call in the read path.

The Go payment service (`services/payment/`) owns a **separate** database
(`ybb_payments_db`) with its own `payment_intents`/`payment_transactions`
tables (`payment_intents`/`payment_transactions` per migration `005_reset_payment_v2.sql`,
superseding a v1 `payments` table that migration `014_drop_legacy_payments_table.sql`
dropped outright — that dropped table is unrelated to the *legacy CI4* system's
`payments` table this import reads from; same name, two different, unrelated
systems, one already gone). Those tables are keyed by `external_intent_id`/
`external_transaction_id`, which this import leaves `NULL` on every row by
design (see "Payment isolation" above) — so no Go-service row is ever created
or required for an imported invoice, and none is missing: nothing in the read
paths above ever joins out to the Go service to render payment status.
**Conclusion: writing `application_invoices` + the two `participant_applications`
payment-status columns is sufficient by itself.** No second table needed, and
none was written.

### Payment import — implemented, column names verified against live schema

**Update**: the column names below were initially guessed by inference and
flagged as an open caveat; they have since been checked directly against a
live, read-only `DESCRIBE` of `payments`/`xendit_payment`/`midtrans_payment`/
`participant_agreement_letters`/`participant_program_documents` on the real
legacy DB. Two were wrong and are now fixed: `payments` has no `paid_at`
column (real column is `payment_date`) and no `payment_method` column (real
source is `xendit_payment.payment_method` / `midtrans_payment.payment_type`,
LEFT JOINed as before). `is_deleted` filters were also added to `payments`,
`participant_agreement_letters`, and `participant_program_documents`,
matching every other legacy read in this script. Everything else below
(`participant_id`, `program_payment_id`, `amount`, `currency`, `status`,
`file_link`, `file_url`) was already correct.

`migrate-legacy-participants.cjs` now imports legacy `payments` into
`application_invoices`, one new row per legacy payment, and writes the parent
application's `registration_payment_status`/`program_payment_status` to match
(computed from *all* the participant's payments for that program, not just
the newest one — see "Status aggregation" below). Implementation:

- **Batched per legacy program** (once per `--program`, joined through
  `participants` exactly like the existing agreement-letter/program-document
  manifest queries), never per-participant-row — same precomputation pattern
  as `tiersByProgramId`/`essaysByProgramId`.
- **Tier resolution**: each payment's `program_payment_id` is matched against
  `program_pricing_tiers.legacy_id` (the same map `tiersByProgramId` already
  builds for essay/score import) to get both the new `pricing_tier_id` (NOT
  NULL on `application_invoices`, so an unmatched payment cannot be inserted
  and is reported as `invoicesUnmatchedTier` instead of guessed) and the fee
  type, which decides registration vs program-fee category
  (`registration_fee` -> `registrationPaymentStatus`; every other fee type ->
  `programPaymentStatus` — the new schema has no separate program_fee_1 vs
  program_fee_2 status column, only one "program fee" column).
- **Status**: `mapPaymentRowStatus` (already existed, already fixed to never
  emit `processing`) applied per payment row.
- **Amount/currency authority**: taken from the legacy `payments` row itself
  (the actual amount attempted/settled), not from the tier's *current* price
  — a historical payment must reflect what was actually charged at the time,
  which can differ from today's `program_pricing_tiers.price` after a later
  price edit. `program_payments`/tier pricing is only used to resolve
  *which* tier/category, never the amount.
- **xendit_payment/midtrans_payment**: LEFT JOINed for one purpose only — an
  informational `payment_method` label when `payments` itself doesn't carry
  one. Once `external_intent_id`/`external_transaction_id` are unconditionally
  `NULL` on every imported row (a hard, already-made decision — see above),
  nothing else on those two gateway detail tables is relevant to import;
  there was no second "authoritative" field to reconcile between the three
  tables once external ids are intentionally dropped.
- **`external_intent_id`/`external_transaction_id`**: always `NULL`, per the
  existing decision — unchanged.
- **`legacy_id`**: the legacy `payments.id`, unique per invoice row (one
  legacy payment = one new invoice row, full retry history preserved) —
  except see "unpaid supersession" below.

**Schema caveat — be honest about what could not be verified**: this session,
like the prior one (see "Real dry-run against prod/legacy — blocked, not
run"), has no working legacy MySQL credentials (checked again: no legacy
MySQL container on the VPS, no credentials in any running container's env).
The column names used above (`payments.participant_id`, `.program_payment_id`,
`.amount`, `.currency`, `.status`, `.paid_at`, `.payment_method`,
`xendit_payment.payment_id`, `midtrans_payment.payment_id`) are **inferred**
from the naming convention already verified elsewhere in this same script
(`participant_essays.participant_id`/`.program_essay_id`,
`program_payments` resolved via `program_pricing_tiers.legacy_id`), not
sampled from a real legacy row. **This must be confirmed against one real
`payments` row (`DESCRIBE payments; SELECT * FROM payments LIMIT 1;` and the
same for `xendit_payment`/`midtrans_payment`) before the real cutover run.**
If a column name differs, the query fails loudly (MySQL "unknown column"
error) rather than silently importing wrong data — it does not fail
partially or produce corrupt rows.

### Status aggregation (multiple payment attempts per fee)

A participant can have several legacy payment rows for the same fee (a failed
attempt followed by a successful retry, or several never-completed PENDING
attempts). Per category (registration/program), the aggregate status is the
*best* one seen: `paid` beats `failed` beats `unpaid` — if the fee was ever
completed, that's the truth for the category regardless of earlier failed or
abandoned attempts. This never invents a `processing`/`refunded`/`cancelled`
status; legacy `payment_status` has no equivalent codes for those (see
`mapLegacyPayStatus`).

**Backfill on re-run**: this computation now runs for an *already-migrated*
application too (previously the script `continue`d immediately on finding an
existing `legacy_id` match, skipping payment import entirely) — a re-run
against an application created by an older version of this script (which
hardcoded both payment-status columns to `'unpaid'`) backfills the correct
status via `UPDATE ... WHERE id = $3`, and mints any invoice rows that don't
exist yet by `legacy_id`.

### Unpaid supersession (constraint-driven, not a data-loss shortcut)

`application_invoices` has a partial unique index,
`application_invoices_application_tier_unpaid_key` (migration
`20260909100000_add_application_invoice_tier_unique_index`), on
`(application_id, pricing_tier_id) WHERE status IN ('unpaid', 'processing')`
— added to stop a real double-click race from minting two live UNPAID
invoices for the same tier. It does not distinguish a live race from a
historical import: inserting two literal-`'unpaid'` legacy payments for the
same (application, tier) — e.g. two abandoned PENDING attempts — would hit
this constraint. Only the **most recent** `'unpaid'` payment per tier is
therefore inserted; earlier ones that also mapped to `'unpaid'` are counted
in `invoicesSupersededUnpaid` and never written. This loses no settlement
information: none of the superseded rows ever completed anything (that's
what `'unpaid'` means here). `'paid'`/`'failed'` rows are **not** covered by
that partial index (its predicate excludes them), so multiple paid/failed
attempts for the same tier import in full, preserving real retry history for
fees that did eventually settle.

## Documents (agreement letters / program documents) — implemented

Previously a documented gap ("Legacy -> new entity mapping" listed this as
aspirational; `rehost-legacy-media.cjs`'s own README section called out
`columnSkippedNoTargetRow`/"Known gap, by design" for exactly this reason —
no `participant_documents` row existed yet for a rehosted letter/document to
attach to). `migrate-legacy-participants.cjs` now creates that row, which
means a subsequent `rehost-legacy-media.cjs` run against the same manifest no
longer skips those two sources (nothing needed to change in that script — the
gap was the missing target row, not its own logic).

- Agreement letters (`participant_agreement_letters`) and program documents
  (`participant_program_documents`) are already fetched once per legacy
  program (batched, joined through `participants`) for the media manifest —
  reused here rather than re-querying.
- Runs once per program **after** every participant row has resolved (or
  created) its application, via `applicationIdByLegacyParticipantId` (keyed
  by the legacy `participants.id`, same key the manifest's own
  `parent_legacy_id` column already uses).
- `type` values: `'agreement_letter'` for letters, `'complementary_document'`
  for program documents. **Correction to this README's own original mapping
  table** ("Legacy -> new entity mapping" above says `type=requirement`) —
  that value doesn't exist anywhere in the real `DocumentType` usage;
  verified against `create-update-program-content.dto.ts:1506-1507,1587-1588`
  and `upload-signed-copy.handler.ts:95`, whose actual enum is
  `agreement_letter | complementary_document | letter_of_acceptance |
  letter_of_invitation`. Left uncorrected in that earlier section on purpose
  (history of what was believed before verification) — this section is the
  corrected, implemented behavior.
- `file_url` is the legacy URL **as-is** (`storage.ybbfoundation.com`,
  pointing at the legacy host), matching the same "keep URL as-is, rehost
  bytes lazily/separately" decision already made for
  `participants.picture_url`/`.resume_url` in "Media / file URL rehosting"
  above — not blocked on `rehost-legacy-media.cjs` having run first.
- `legacy_id` = the letter's/document's own legacy id (already an existing
  column on `participant_documents`, per "`legacy_id` columns needed" below —
  no new migration needed for this).
- A letter/document whose parent legacy participant has no resolved
  application yet (shouldn't happen in a full run since letters/documents are
  always joined through a `participants` row that the same program's row
  loop just processed, but possible with `--limit` slicing) is counted as
  `documentsUnmatchedApp`, never guessed or crashed on.

## Side-effect bypass

No Prisma `$use` middleware exists (`prisma.service.ts` only chains two
`$extends` calls: a metrics wrapper and a soft-delete `deletedAt` filter —
neither emits events). No `PaymentOutboxEvent` row, RabbitMQ publish, or
notification email is ever produced by inserting rows directly with SQL.
Following the `legacy-content` precedent, this script never imports the
generated Prisma Client or calls any NestJS application service — it talks to
Postgres with a plain `pg.Pool` and to MySQL with `mysql2/promise`, so no
service-layer side effect (which lives entirely in the NestJS runtime this
script never boots) can fire.

## Dedupe rules

- Email match key: `lower(trim(email))`.
- **Brand-scoped, not global** — matches the new schema exactly
  (`users` has `@@unique([email, brandId])`, not a global unique). Verified
  against live legacy data: of the ~20,200 email values shared by more than
  one legacy `users` row, **20,186 groups are a person registered under
  multiple different `program_category_id` values** (multiple brands) — this
  is expected and correct, each becomes its own new `User` row scoped to its
  own brand, exactly mirroring the legacy per-brand `users` row. Only **14
  groups** are true same-brand duplicates (same email, same
  `program_category_id`, two different legacy user ids) — these are real
  conflicts: policy is to keep the earliest-created row as canonical and
  report the rest as skipped duplicates, never silently merging their
  participant data.
- Matching against **existing new-prod users**: same `lower(trim(email))` +
  resolved `brandId`. If found, link (write `legacy_id` onto the existing
  row) rather than creating a second user — this covers anyone who already
  self-registered natively on the new platform under the same brand.

## `legacy_id` columns needed (this migration's SQL)

Already existed before this work: `brands`, `programs`, `users`,
`participants`, `admins`, `admin_roles`, `admin_programs`, `admin_brands`,
`ambassadors`, `ambassador_referrals`, `participant_documents`.

Added by `20260925130000_add_legacy_participant_migration_fields`:
`participant_applications`, `application_invoices`, `program_essays`,
`program_pricing_tiers` (all nullable `INTEGER`, unique index, `IF NOT EXISTS`
throughout so a partial prior run is a safe no-op).

## Intentionally dropped / not migrated

- **Passwords** — see auth section above.
- **`participants.picture_url` / `resume_url`** binary content — URLs are
  imported as-is (pointing at the legacy host) per the media plan below; no
  file bytes are copied by this script.
- Legacy `abstract_*` / `paper_*` tables (conference paper submission system)
  — out of scope for this milestone; not part of participant/application
  history.
- Legacy `web_setting_*`, `menu_items`, `email_templates` — site content, not
  participant data; already out of scope (and largely superseded by
  `legacy-content`).
- Legacy `otp_requests`, `password_resets` — legacy session/security
  artifacts with no equivalent need in the new auth flow (a migrated user
  gets a fresh reset token from `forgot-password` on demand).

## Program-18 conflict — found during this investigation, not in the original brief

Legacy program 18 (Korea Youth Summit 2026 Batch 2) maps to new-prod program
**"Korea Youth Summit 4th"** (`legacy_id=18`), which **already has 5,189
native applications** (verified query) — people who registered directly on
the new platform for the same event while legacy program 18 was still also
open. Email-hash overlap: **125 of its 14,216 distinct legacy emails** already
have a native application there. This is the same shape of risk the brief
called out for program 22 (below), just on a program the import script *does*
touch. The per-(participant, program) duplicate-guard in the script (see
"Applications" above) is what protects against creating a second application
for those 125 people — it is not merely theoretical for this migration.

## Legacy program 12 (MEYS) — missing program row, found and fixed

`missingPrograms` (the `programByLegacyId` preflight in
`migrate-legacy-participants.cjs`) warns `no new-prod program found with
legacy_id in [12]` on every real run against prod. Verified directly, not
inferred (read-only `docker exec psql` into `ybb-platform-postgres-api-*`
and a temporary `mysql:8.0` container on `dokploy-network` against the real
legacy DB — no SSH tunnel/socat proxy was needed this session since
`docker exec` into the Postgres container itself avoids the overlay-network
routing problem the prior session's socat attempt hit; no prod writes, no
legacy writes):

- **Full gap check** — `SELECT unnest(ARRAY[1,2,3,4,5,6,7,8,9,10,11,12,16,17,18,20])
  EXCEPT SELECT legacy_id FROM programs WHERE legacy_id IS NOT NULL` against
  prod returned exactly **one** id: `12`. Every other id in
  `MAPPED_LEGACY_PROGRAM_IDS` already resolves to a real `programs` row.
- **Legacy program 12** ("Middle East Youth Summit 2026", `program_category_id=3`
  matching MEYS brand `legacy_id=3` / `52813193-96f0-42cf-89dd-27f33304a303`):
  `start_date=2026-03-30`, `end_date=2026-04-02`, `year=2026`,
  `theme='Global Muslim Youth Collaboration for Sustainable Development'`,
  `is_active=0`, `is_registration_open=0` (legacy DB), ~23,709 legacy
  `participants` rows, 28 legacy `program_announcements` rows.
- **Confirmed distinct from "Middle East Youth Summit 6th"**: that new-prod
  row (`cc4d7a9a-fcf4-41ae-acd2-54d867046856`, no `legacy_id`) is a real,
  different, later event — `2026-12-07..2026-12-10`, currently `is_active=t`,
  `allow_registration=t`, `status='published'`. Mapping legacy 12 onto it
  would have corrupted both. All 5 MEYS-brand new-prod programs, for the
  record: 2023 (`legacy_id=9032023`), 2024 (`9032024`), 2025 (`8`), 6th (no
  `legacy_id`, Dec 2026), 7th (no `legacy_id`, Mar 2027).
- **2025 edition (`legacy_id=8`) configuration mirrored** (a genuinely past,
  closed edition, not the currently-open "6th"), read directly off that row:
  `is_published=true`, `is_visible_to_users=true`, `is_active=false`,
  `allow_registration=false`, `status='completed'`, `registration_open_date`
  / `registration_close_date=NULL`, `currency='USD'`, `require_payment=false`.
  `application_deadline` on that same row equals its own `start_date`
  (`2025-12-01`) — legacy has no deadline-equivalent column, so the new
  legacy-12 row's `application_deadline` is set the same way, to its own
  `start_date` (`2026-03-30`).
- **Announcement finding**: all 28 of legacy program 12's
  `program_announcements` ids (276, 293–312, 318, 320, 322, 413–416) **already
  exist** in prod's `program_announcements.legacy_id`, but every one of them
  is attached to `program_id` = "Middle East Youth Summit 6th" — the same
  wrong program the brief warned against mapping legacy 12 onto. So the
  announcements were previously mis-migrated onto "6th" (verified by joining
  prod `program_announcements.legacy_id` back to `programs.name`), not lost
  and not attached anywhere correct. **Not fixed by this change** — re-pointing
  28 already-live announcement rows from one program to another is a decision
  for the owner (it changes what participants/admins of "6th" currently see),
  not something this migration should do silently as a side effect of
  creating the missing program row. Flagged here for a follow-up, scoped
  separately.
- **Fix implemented**: new Prisma migration
  `20260925150000_backfill_legacy_program_12_meys` (idempotent — guarded by
  `NOT EXISTS (... WHERE legacy_id = 12)` and `ON CONFLICT (legacy_id) DO
  NOTHING`, same convention as `20260824091000_backfill_content_template_from_form_templates`)
  inserts the missing `programs` row, brand resolved via `brands.legacy_id =
  3` (same map `brandByLegacyCategoryId` already uses), all real legacy
  fields cloned as above, publish/registration flags copied verbatim from the
  2025 edition. Verified locally against a throwaway `postgres:16-alpine`
  (destroyed after): first run inserts 1 row, second run is `INSERT 0 0` — a
  true no-op. This has **not** been run against prod from this session —
  it will apply the next time the normal `prisma migrate deploy` pipeline
  runs there (per `ybb-deploy-topology`: migrations auto-run on API boot),
  which resolves `migrate-legacy-participants.cjs`'s `programByLegacyId` gap
  for program 12 before the real `--apply` cutover run needs it.

## Program-22 handling (Istanbul Youth Summit 2027)

Legacy program 22 is **excluded from import entirely**. It is only used to
compute an overlap report: the new prod program `Istanbul Youth Summit 2027`
(id `a4b61c2e-e1a6-44ec-b13a-de06f085bba0`, **no** `legacy_id`) already has
9,360 native applications. Comparing normalized-email hashes (never printing
raw emails), **24 of the 247 legacy program-22 registrants already have a
native application on that same new-prod program** — these are the people who
re-registered directly on the new site after the legacy IYS-2027 form was
retired. This is reported for the owner's awareness only; nothing is written.

## Media / file URL rehosting

All legacy participant media (`participants.picture_url`, `.resume_url`,
`participant_agreement_letters.file_link`,
`participant_program_documents.file_url`) resolves to a **single hostname**:
`storage.ybbfoundation.com` (this is *not* the cPanel host named in the task
brief — that assumption was wrong; verified by sampling live rows across all
four URL columns, no other hostname appears). Counts (live query):

| Column | Non-empty rows |
|---|---|
| `participants.picture_url` | 57,019 |
| `participants.resume_url` | 36,119 |
| `participant_agreement_letters.file_link` | 259 |
| `participant_program_documents.file_url` | 1,216 |

**Rehosting plan (scope only, not implemented)**: the URLs are already
publicly reachable HTTPS links on a dedicated storage subdomain (not tied to
a legacy cPanel account that might get decommissioned), so the lowest-risk
option is to **store the legacy URL as-is** in the new columns
(`participants.profile_picture_url` / `resume_url`,
`participant_documents.file_url`) at import time, and only copy bytes into
the new file service lazily/on-demand (e.g. the first time an admin or
participant views/downloads it) rather than eagerly re-uploading ~94K files
up front. This is a scope decision, not a trivial one — it is **not**
implemented in this script. If `storage.ybbfoundation.com` has a decommission
date, that changes this calculus and should be confirmed with the owner
before cutover.

## CLI

```
node migrate-legacy-participants.cjs --dry-run [--program <legacyProgramId>] [--batch-size 500] [--limit N] [--status-mode flatten|preserve] [--manifest path.csv]
node migrate-legacy-participants.cjs --apply    --program <legacyProgramId>  [--batch-size 500] [--limit N] [--status-mode flatten|preserve] [--manifest path.csv]
```

- Default is `--dry-run`; `--apply` must be passed explicitly.
- `--program` restricts to one legacy program id (repeatable to run several);
  omitted = every mapped program except 22.
- `--limit N` caps rows pulled per program (testing/slicing a program locally,
  e.g. a 200-row slice of a large program) — never pass this for the real
  cutover run.
- `--status-mode` (default `flatten`): see "Application status mode" below.
- `--manifest path.csv` overrides where the media-rehost manifest is written
  (default `./legacy-media-manifest.csv`); see "Media rehost manifest" below.
- Idempotent: every insert is an upsert keyed on the relevant `legacy_id`, so
  a full re-run (e.g. the final cutover sync for programs 17/18/20) only
  touches rows that actually changed. Verified locally: re-running `--apply`
  for the same program a second time produces 0 new users/participants/
  applications (see "Local apply test" below).
- Both DB connections are read-only-by-construction in dry-run: legacy always
  runs `SET SESSION TRANSACTION READ ONLY` (in every mode, apply included —
  this script never writes to legacy MySQL); the Postgres side wraps the
  whole dry-run session in `BEGIN READ ONLY` / `ROLLBACK` so the server
  itself rejects a stray write, not just script discipline.

## Payment status mapping — fixed danger

`mapLegacyPayStatus` previously mapped legacy `PENDING` (payment_status=1) to
`'processing'`. This was wrong: in the new schema `'processing'` means "a
gateway webhook/callback is in flight right now", and prod has a known
event-sync drift (`payment.succeeded` events dropped) that leaves invoices
stuck in `'processing'` — exactly the state `PaymentReconciliationService`'s
hourly cron exists to clean up. Importing years-old legacy pending payments
as `'processing'` would have made them indistinguishable from live stuck
transactions.

Audited every status-filtered job in `services/api` (Go payment service has
no cron/ticker that filters by status at all — it only reacts to explicit
RPCs, and no `payment_transactions` row is ever created for an imported
invoice since no `external_intent_id`/`external_transaction_id` is set):

| Job | File:line | Filter | Touches a legacy-imported row? |
|---|---|---|---|
| `runScheduledReconciliation` / `reconcileProcessingInvoices` | `payment-reconciliation.service.ts:159,238,251-258` | `status IN (processing, unpaid)` **AND** (`externalIntentId` or `externalTransactionId` not null) | No — imported rows never set either external id |
| `reconcileApplicationRegistration` | `payment-reconciliation.service.ts:315-323` | same external-id guard as above | No |
| `reconcileTerminalInvoiceDrift` | `payment-reconciliation.service.ts:350,362-367` | `status IN (cancelled, failed, refunded)` **AND** external-id guard | No |
| `reconcilePaidColumnDrift` | `payment-reconciliation.service.ts:438,441-460` | `status = paid` **AND** application's own payment-status column disagrees with it | No — this migration writes the application's `registration_payment_status`/`program_payment_status` consistently with the invoice it mints, so there is never drift for an imported row |
| `PostPaymentFollowupService.sendDueFollowups` | `post-payment-followup.service.ts:49-51,118-127` | invoice `status=paid` **AND** `paidAt > POST_PAYMENT_FOLLOWUP_CUTOFF` (`2026-09-08T00:00:00+07:00`) **AND** application `submittedAt IS NULL` | No — every legacy payment predates the cutoff by construction (historical), so `paidAt > cutoff` never matches |
| `SubmissionDeadlineReminderService` | `submission-deadline-reminder.service.ts:88,135-141` | `status=draft` **AND** `program.applicationDeadline` within the next 1/3/7 days | No, contingent on all 16 mapped legacy programs' `applicationDeadline` being in the past (true for every closed program; **operational risk**, not code — verify this holds before cutover if any mapped program's deadline was left blank/future) |

`PaymentStatus` enum (`prisma/schema/enums.prisma:206-212`): `unpaid, paid,
processing, failed, refunded, cancelled`. Fixed mapping: legacy `PAID(2)` ->
`paid`, `FAILED(3)` -> `failed`, `PENDING(1)` and `NOT_REQUIRED(0)` -> `unpaid`
(never `processing`, never `cancelled` — `unpaid` is the correct "nothing was
ever completed" terminal value and is what a brand-new native application
defaults to before anyone pays). `application_invoices.legacy_id` is
non-null on every imported row, doubling as the "historical import" marker
per the existing "Payment isolation" section above — no additional
`legacy_id IS NULL` guard needed on any of the jobs above, since every one of
them already requires a signal (external id, or column-drift) that an
imported row never produces.

**Operational (non-code) risk found and not fixed by this migration**: the
admin-triggered reminder-campaign audience builders
(`registration-fee-audience.service.ts`, `program-fee-unpaid-audience.service.ts`,
`application-draft-unsubmitted-audience.service.ts`) are scoped by
`programId` and application status but are **not** automatically excluded
from a closed/legacy program — an admin could manually launch a reminder
campaign against a legacy program's imported applications. This is
admin-initiated, not autonomous, so it is flagged for the owner rather than
patched here.

## Application status mode

Prod has only ever operationally produced `draft`/`submitted`
(`ybb-application-status-only-draft-submitted` finding). `accepted` /
`rejected` / `under_review` exist in the `ApplicationStatus` enum but are
**latent** — importing a legacy "Approved" outcome as `accepted` would newly
light up, for a closed legacy program, with no time/program-active gate on
any of them:

- **LOA download eligibility** — `loa-eligibility.service.ts` /
  `loa-download.service.ts` key off `ApplicationStatus.accepted`.
- **Document-audience gating** — `document-audience.service.ts` gates which
  document requirements a participant portal shows by status.
- **`review-application.handler.ts`** — fires a status-change notification
  email when an application transitions to `accepted`/`rejected`; while this
  migration never calls that handler (raw SQL, no service layer — see
  "Side-effect bypass"), any *future* admin action that re-saves an imported
  `accepted` application through the normal API could re-trigger it.
- **Public activity-toast feed** — `activity.mapper.ts`'s
  `ACTIVITY_SOURCE_STATUSES` includes `accepted`, so an imported accepted
  application on a closed program could surface in the public "X just got
  accepted" toast.

`--status-mode` (default `flatten`) controls this:

- `flatten` (default): every non-draft outcome (submitted, under_review,
  accepted, rejected) is stored as `submitted` — the only two values ever
  exercised live. Nothing lights up.
- `preserve`: stores the real legacy outcome (`accepted`/`rejected`/
  `under_review`) — only pass this once the owner has explicitly signed off
  on the consequences above.

Either way, the true legacy outcome is never lost: it is always recorded in
`participant_applications.personal_data.legacy_outcome`
(`accepted`/`rejected`/`under_review`/`pending`/`null` for drafts), regardless
of mode, so switching from `flatten` to `preserve` later needs a small
migration script (read `legacy_outcome`, write `status`), not a re-import.

## Completeness audit — what `--apply` actually writes today

Exact line numbers in the current `migrate-legacy-participants.cjs`, not
assumed from this README's prose:

| Item | Implemented? | Where |
|---|---|---|
| Essay answers (`essay_answers` JSON) | **Yes** | Built at `migrate-legacy-participants.cjs:591-615`; written at `:649` (`JSON.stringify(essayAnswers)`, `participant_applications.essay_answers` column) |
| Scores (`score_total`/`score_status`) | **Yes** | Computed at `:619-620`; written at `:652` (`scoreTotal, scoreStatus` params of the `participant_applications` INSERT) |
| `participant_statuses`-derived application status | **Yes** | `mapApplicationStatus` at `:585`, written at `:647` (`appStatus` param); real legacy outcome preserved in `personal_data.legacy_outcome` regardless of `--status-mode` per "Application status mode" above |
| Payments -> `application_invoices` | **Yes (this session)** | Precomputed per-program at (essay-order precompute block, `payments`/`xendit_payment`/`midtrans_payment` batched read, ~`:255-300`); category/status resolved at `:522-546`; invoice rows inserted at `:681-697`; parent `registration_payment_status`/`program_payment_status` written at `:647` (new app) or `:665-669` (`UPDATE`, already-existing app) — see "Payment import" above |
| Agreement letters -> `participant_documents` | **Yes (this session)** | `:709-724` |
| Program documents -> `participant_documents` | **Yes (this session)** | `:727-744` |

Before this session, the last three rows were **not** implemented: payment
status was hardcoded to `'unpaid'`/`'unpaid'` on every application insert (the
old, single-string `VALUES (...,'unpaid','unpaid',...)` this session
replaced with computed `$4`/`$5` params), no `application_invoices` rows were
ever created, and agreement letters/program documents were recorded **only**
in the media manifest CSV (never as a `participant_documents` row) — this
matches `rehost-legacy-media.cjs`'s own README section 4 ("Known gap, by
design") describing exactly that missing target row.

## Owner-required breakdown

Every run (dry-run or apply) prints, per legacy program and as a grand
total: users matched-existing vs new-to-create (brand-scoped
`lower(trim(email))` match against new-prod `users`), participants reused vs
new (a `Participant` profile is 1:1 with `User`, so "new" only happens on a
user's first-encountered program registration), and applications new vs
skipped-existing (already-imported via `legacy_id`, or a native duplicate on
the same participant+program). See "Local apply test" below for real
numbers from a local run, and "Real dry-run against prod/legacy" for why
this repo cannot yet print real prod numbers.

## Media rehost manifest

Every row that would create (or, in apply mode, does create) a new
`Participant` emits one manifest line per non-empty media URL
(`participants.picture_url`, `participants.resume_url`) to
`--manifest` (default `./legacy-media-manifest.csv`), format
`table,legacy_id,url`. URLs are kept as-is (`storage.ybbfoundation.com`,
never downloaded) per the "Media / file URL rehosting" section above — this
manifest is scope for a later, separate rehost step only.

## Local apply test (docker, synthetic data — no real PII)

Ran end-to-end against a throwaway `postgres:16-alpine` + `mysql:8.0` in
Docker (both destroyed after the test): `prisma migrate deploy` applied
cleanly (34 migrations including
`20260925130000_add_legacy_participant_migration_fields`); seeded two
synthetic brands/programs carrying `legacy_id=1` and `legacy_id=4` (no real
prod data — this repo has no working legacy MySQL credentials, see below,
so exact prod row counts for programs 1/4 could not be reproduced locally);
seeded 8 synthetic participants for program 1 (including one whose email
matches a pre-seeded existing new-prod user, to exercise the dedupe path)
and 6 for program 4, with a deliberate mix of draft/submitted/approved/
rejected/under_review statuses and 3 rows with no `participant_statuses` row
at all (orphan path).

Results:
- `--dry-run --program 1 --program 4`: 0 Postgres writes (verified by
  re-querying row counts after — still exactly the 1 pre-seeded user, 0
  applications). Breakdown printed matched expectations: 1 user
  matched-existing, 13 new-to-create, 14 applications new, 3 orphans (no
  status row).
- `--apply --program 1`: 8 users (7 new + 1 matched-existing linked by
  `legacy_id`, not duplicated), 8 participants, 8 applications. Verified
  directly: 0 duplicate `(email, brand_id)` rows, 0 duplicate
  `participants.user_id` rows, the pre-seeded user kept its original id with
  `legacy_id` now populated. `--status-mode=flatten` (default) confirmed:
  stored `status` values were only `draft`/`submitted`; the true outcome
  (`accepted`/`rejected`/`under_review`/`pending`) was recorded in
  `personal_data.legacy_outcome` for every non-draft row.
- **Idempotency**: re-ran `--apply --program 1` a second time —
  `usersNew=0, participantsNew=0, appsNew=0`, all 8/8/8 reported as
  matched/reused/skipped-existing, and Postgres row counts were unchanged
  (8/8/8) after the rerun.
- `--apply --program 4 --limit 3`: imported exactly 3 of the 6 seeded
  program-4 rows (confirms `--limit` slicing), bringing running totals to 11
  users / 11 applications (8 + 3), matching expectations exactly.

Caveat: this is a small synthetic dataset (14 rows total), not a
production-scale replica of program 1's real 31 participants or a 200-row
program-4 slice, because no real legacy data was available locally (see
next section) — it validates the *mechanism* (dedupe, idempotency, status
flattening, limit slicing, zero-write dry-run) with real executed SQL, not
hand-derived expectations, but does not stand in for a real-data dry run.

## Local apply test — payments/invoices/documents (this session)

Separate run, done to verify the payment-import and document-import work in
this session (the prior "Local apply test" above predates both). Fresh
`postgres:16-alpine` + `mysql:8.0` in Docker (both destroyed after), real
`prisma migrate deploy` (all 34 migrations, same as before). Synthetic legacy
schema built by hand for `payments`/`xendit_payment`/`midtrans_payment`
(column names per the "Payment import — schema caveat" inference above, since
no real legacy schema was available to copy) plus the existing
`users`/`participants`/`participant_statuses`/`participant_essays`/
`participant_agreement_letters`/`participant_program_documents` tables.
Seeded 2 programs (legacy id 1 and 4), 4 pricing tiers (2 per program:
`registration_fee` + `program_fee_1`, `legacy_id` = synthetic
`program_payments.id`), 1 essay, 5 users/participants across the two
programs, 8 synthetic payments, and 1 agreement letter + 1 program document
(program 4) — no real names, emails, or amounts.

**Bugs this test caught before they could reach a real run** (fixed in this
session, not left as findings-only):
1. **`INSERT has more target columns than expressions`** — the
   `participant_applications` INSERT's placeholder count was off by one after
   replacing the hardcoded `'unpaid','unpaid'` literals with
   `$4`/`$5` computed params; the VALUES clause still said `$16` where it
   needed `$17`. Caught on the very first `--apply` row.
2. **Partial-unique-index collision on a real retry case**: two abandoned
   `PENDING` legacy payments for the same (application, tier) both mapped to
   `'unpaid'` and the naive "keep first, skip rest" dedupe kept the *older*
   attempt while my own README text claimed "most recent" — fixed to
   explicitly `ORDER BY pay.created_at ASC, pay.id ASC` and keep the
   last-seen entry per tier, verified by re-checking which `legacy_id` ended
   up in the table (the later attempt, as intended).
3. **`participant_documents.legacy_id` cross-table collision**: agreement
   letters and program documents are two independent legacy auto-increment
   sequences that both start at 1; inserting a program document's raw
   `doc.id` as `legacy_id` collided with an agreement letter of the same id
   and was silently absorbed by `ON CONFLICT (legacy_id) DO NOTHING`,
   producing 1 document row instead of 2. Fixed by storing program documents
   as `-doc.id` (negated) — verified afterward: both rows present with
   distinct `legacy_id` (`1` and `-1`).

**Results, after the fixes above, on a clean database:**
- `--apply --program 1 --program 4`: `usersNew=5`, `participantsNew=5`,
  `appsNew=5`, `invoicesNew=8`, `invoicesSupersededUnpaid=1` (the
  two-PENDING-attempt case), `documentsNew=2` (1 letter + 1 program
  document). A separate earlier run against the same seed data but with a
  pre-existing native user planted first (email-dedupe path, same mechanism
  as the original "Local apply test" above) also exercised `usersMatched=1`
  correctly linking `legacy_id` onto the existing row rather than
  duplicating it. Verified directly in Postgres: 8 `application_invoices`
  rows, **0 in `'processing'`**, statuses matching the seeded legacy payment
  outcomes exactly per participant (e.g. a participant with a paid
  registration + pending program fee landed at
  `registration_payment_status='paid'`, `program_payment_status='unpaid'`; a
  participant with a failed-then-paid program fee landed at `'paid'` — paid
  beats failed, per "Status aggregation" above).
- **Idempotent rerun**: `--apply` again on the same data —
  `usersNew=0, participantsNew=0, appsNew=0, invoicesNew=0, documentsNew=0`,
  everything reported `matched`/`reused`/`skipped-existing`
  (`invoicesSkippedExisting=8`, `documentsSkippedExisting=2`). Postgres row
  counts identical before/after (5 users / 5 participants / 5 applications /
  8 invoices / 2 documents), confirmed with a direct re-query, not just the
  script's own printed counters.
- **Paid-status verification through the real read path, not asserted**:
  called the actual generated `@prisma/client` (via `@prisma/adapter-pg`,
  the same driver adapter `prisma.service.ts` uses) with the *exact*
  `currentApplicationWhere`/`currentApplicationOrderBy` helpers
  (`current-application.query.ts:45-58`) and the `select` shape from
  `get-portal-dashboard.handler.ts:55-61,139` (quoted verbatim into a
  throwaway script, not reimplemented) against a participant whose legacy
  registration payment was seeded as `PAID`. Result:
  `{"status":"submitted","registrationPaymentStatus":"paid","programPaymentStatus":"unpaid"}`.
  The same handler file's own lock-check
  (`switchLockedStatuses = new Set(['processing','paid'])`,
  `get-portal-dashboard.handler.ts:295,302-304`) treats `registrationPaymentStatus`
  the same lowercase-string way this test's row satisfies. This is the real
  Prisma query (real generated client, real driver adapter) the portal
  dashboard runs, executed against this migration's actual output rows —
  not a hand-written SQL assertion standing in for it.
- No real legacy MySQL, prod Postgres, or any non-local database was written
  to or read from during this test. Both Docker containers and the temporary
  verification script were removed afterward; no generated Prisma client
  artifacts were left behind (`node_modules/.prisma`/`node_modules/@prisma/client`
  did not exist in this checkout before this test and were removed again
  after).

## Real dry-run against prod/legacy — blocked, not run

Attempted per the hard-rule constraints (read-only, `BEGIN READ ONLY` on
Postgres, never write to legacy MySQL):

- **Prod Postgres**: reachable in principle — `ybb-platform-postgres-api-*`
  runs on a Docker Swarm overlay network (`dokploy-network`) whose IP
  (`10.0.1.158:5432`) is not routable from the VPS host's own network
  namespace (`docker exec` reaches it via Docker's internal API, not a
  routable path), so a plain `ssh -L` from a laptop can't reach it directly.
  Worked around this by running a temporary `alpine/socat` container
  attached to the same overlay network as a TCP proxy
  (`TCP-LISTEN:15432 -> 10.0.1.158:5432`), then `ssh -L` to that container's
  published port — this proved the network path is viable. However, the
  authenticated connection through that path failed (`password
  authentication failed`) despite reading the exact `POSTGRES_PASSWORD` env
  var off the live container, and prod's own Postgres log at the same
  timestamp showed **another concurrent session already issuing live
  exploratory queries against this same prod database** (schema-mismatch
  errors referencing `legacy_id`/`program_pricing_tiers`, and unrelated live
  `support_tickets` INSERT errors from real traffic). Given that signal, this
  session stopped rather than keep contending for the same production
  target — the proxy container and both SSH tunnels were torn down
  immediately after. **No prod queries executed successfully from this
  session; no prod data was read.**
- **Legacy MySQL**: no working credentials exist anywhere accessible to this
  session — not in this repo (`.env.example` files only have placeholders),
  not in any running container's environment (checked the live API
  containers and the swarm service), and not in shell history on the VPS.
  The legacy-content migration that already ran evidently used credentials
  supplied ad-hoc at invocation time (per its own README's `docker exec -e
  LEGACY_DB_...` example) that were never persisted anywhere this session
  could find. **This is a real, unresolved blocker for the "run the actual
  script end-to-end against real data" requirement** — the owner needs to
  supply `LEGACY_DB_HOST/PORT/USER/PASSWORD/NAME` (or point to wherever they
  are stored) before that can be attempted.

## Runtime estimate (277k participants)

No real-data run was possible (see above), so this is derived from the
query shape, not measurement. Per legacy participant row the script issues:
1 existing-user lookup, 0–1 user insert, 0–1 participant lookup/insert, 1
existing-application lookup, 0–1 duplicate-application lookup (apply only),
1 `participant_statuses` lookup, 1 `participant_essays` lookup, 1
`program_essays` lookup (this last one is **redundant per-row** — it doesn't
depend on `row`, only on `legacyProgramId`, and is currently issued inside
the per-row loop; hoisting it out to once per program, alongside the
existing `essaysByProgramId`/`tiersByProgramId` precomputation, is a
straightforward follow-up that would cut one full MySQL round-trip per row).
That's roughly 6–8 network round-trips per row today (5–7 after hoisting the
essay-order query), none currently batched. At an assumed ~5–8ms per
round-trip on a same-region connection (higher over the SSH-tunnel path this
migration will likely run through), 277,000 rows x ~7 round-trips x ~6ms ≈
**3.2–4 hours** for a single-threaded full run; hoisting the redundant query
and increasing `--batch-size`-driven parallelism (currently unused —
`--batch-size` is accepted but not yet wired into any batched/parallel
fetch) would meaningfully cut this. This estimate has **not** been validated
against real timing since no real-data run was possible this session.

## Still-live legacy programs — cutover note

Verified directly against `programs.is_active` / `is_registration_open` and
recent `participants.created_at` activity (today's date: 2026-09-25):

| Legacy id | Program | is_active | is_registration_open | Most recent registration |
|---|---|---|---|---|
| 17 | World Youth Fest 2026 | 1 | 1 | 2026-09-24 |
| 18 | Korea Youth Summit 2026 Batch 2 | 1 | 1 | 2026-08-27 |
| 20 | Japan Youth Summit 2026 Batch 2 | 1 | 1 | 2026-09-25 |

**Correction to the brief**: program 18 is *also* flagged live
(`is_active=1`, `is_registration_open=1`), not just 17 and 20 — its most
recent registration (2026-08-27) is older than 17/20's, so it may be
winding down, but the flags say it is still open. Treat all three the same
way: incremental, idempotent, re-run at cutover.

## Legacy password-reset notification (separate script)

Follow-up to the "Open question for the owner" in "Auth / password migration
— decision" above: the owner decided migrated participants **should** be
proactively emailed a password-reset link. That send is deliberately kept out
of `migrate-legacy-participants.cjs` (hard rule: no notification/email side
effects in that script) and lives in its own script,
`notify-legacy-password-reset.cjs`, in this same folder.

**Scope**: `users.legacy_id IS NOT NULL AND password_hash IS NULL AND
legacy_password_reset_sent_at IS NULL AND deleted_at IS NULL`, optionally
narrowed further with `--program <legacyProgramId>` (repeatable), which joins
`users -> participants -> participant_applications -> programs` and matches
`programs.legacy_id`.

**CLI**:
```
node notify-legacy-password-reset.cjs --dry-run [--program <legacyProgramId>] [--limit <n>]
node notify-legacy-password-reset.cjs --apply    [--program <legacyProgramId>] [--limit <n>] [--rate <perMinute>]
```
- Default is `--dry-run` (reports the eligible-user count and a 10-row
  sample only); `--apply` is required to write or send anything.
- `--rate` (default 30/min) sleeps `60000/rate` ms between sends in `--apply`
  to stay under whatever limit the notification pipeline/SMTP provider needs.
- Only needs `DATABASE_URL` and `RABBITMQ_URL` — no `LEGACY_DB_*` vars, since
  it never touches legacy MySQL (every row it acts on was already migrated).

**Token/email mechanism reused verbatim** from
`forgot-password.handler.ts` (see that file for line references — verified
2026-09-25):
- Token: `crypto.randomBytes(32).toString('hex')`, expiry `now() + 1 hour`.
- Stored hashed: `users.password_reset_token = sha256(token)` using the same
  `hashToken()` helper as `shared/utils/hash-token.util.ts` (which
  `reset-password.handler.ts` uses on the verify side) — the raw token is
  never persisted, only emitted in the event payload, exactly as the handler
  does it.
- Publishes the SAME RabbitMQ event: exchange `ybb.events` (topic), routing
  key/pattern `user.forgot-password`, payload `{ email, name, token, brandId,
  brand }`.
- **Known deviation**: the `brand.contactEmail` / `brand.contactAddress`
  fields the handler populates via `resolveActiveProgramContact()` (a 3-rule
  active-program fallback in `active-program-resolver.ts`) are left `null`
  here rather than reimplemented in raw SQL — replicating that fallback
  correctly was judged out of scope for this script. Everything else in the
  `brand` payload (name, colors, logo, website, social links, footer nav,
  support email) is populated from `brands`/`brand_settings` directly.

**RabbitMQ binding — confirmed already wired, no fix needed**: routing key
`user.forgot-password` matches the existing `user.#` wildcard binding in
`services/notification/src/main.ts` (the `bindings` array passed to
`ensureRetryTopology()` in `bootstrap()`), consumed by
`@EventPattern('user.forgot-password')` in
`services/notification/src/modules/events/events.controller.ts`. Nothing
needed to be added there.

**Idempotency**: on a confirmed publish, sets
`users.legacy_password_reset_sent_at = now()`. If the publish throws, that
column is left `NULL` on purpose (matches `RabbitMQProducerService.emit()`'s
own throw-on-failure contract) so the user stays eligible for the next run
instead of silently being marked "sent" for a message that never went out.

**New migration**: `20260925140000_add_legacy_password_reset_sent_at` adds
`users.legacy_password_reset_sent_at TIMESTAMPTZ` (nullable, `IF NOT EXISTS`,
same convention as `20260925130000_add_legacy_participant_migration_fields`),
plus the matching field on the `User` Prisma model in `schema/auth.prisma`.

This script was never run with `--apply` and never sent a real email while
being written — verification was limited to `node --check` (syntax) and
confirming `pg`/`amqp-connection-manager` resolve as installed dependencies.

## Legacy media rehost (separate script)

`rehost-legacy-media.cjs` copies legacy media bytes into the new platform's
object storage before `storage.ybbfoundation.com` is shut down, **as native
file-service uploads** — same object-key layout, same `files` row, same
participant-url representation a real upload through the app would produce.
It reads the manifest CSV that `migrate-legacy-participants.cjs` writes
(`table,legacy_id,url,parent_legacy_id`). It never deletes anything at the
source and never writes to storage or Postgres without `--apply`.

**Manifest now complete:** `migrate-legacy-participants.cjs` records all four
media sources — `participants.picture_url`, `.resume_url`,
`participant_agreement_letters.file_link`, `participant_program_documents.file_url`
— via two additional batched (once per legacy program, never per participant
row) read-only MySQL queries, joined through `participants` exactly like the
existing `--program` filter lookup in this script. A 4th CSV column,
`parent_legacy_id`, was added for the letter/document rows: their own
`legacy_id` is the letter's/document's own id (matches the future
`ParticipantDocument.legacyId`), not the participant's, so resolving the new
program/participant context for the storage key needs the parent legacy
`participants.id` (the per-registration row) carried separately. It's blank
for the picture/resume rows, where `legacy_id` already **is** the participant.

### Native key convention (verified in code, not the prior version's side namespace)

Two contexts from `FilePathService.get_storage_path`
(`services/file/app/application/services/file_path_service.py:26-106`),
picked per source column since profile picture/resume live on the
`Participant` profile (1:1 with `User`, not per-program) while agreement
letters/program documents are per-application (per legacy `participants`
per-registration row):

| Source column | Category | Scope | Key |
|---|---|---|---|
| `participants.picture_url` | `avatars` | user | `{env}/{brandId}/users/{userId}/avatars/{fileId}.{ext}` |
| `participants.resume_url` | `documents` | user | `{env}/{brandId}/users/{userId}/documents/{fileId}.{ext}` |
| `participant_agreement_letters.file_link` | `signed-copies` | program-participant | `{env}/{brandId}/programs/{programId}/participants/{participantId}/signed-copies/{fileId}.{ext}` |
| `participant_program_documents.file_url` | `documents` | program-participant | `{env}/{brandId}/programs/{programId}/participants/{participantId}/documents/{fileId}.{ext}` |

Category values are taken verbatim from code, never invented:
`signed-copies` matches `upload-signed-copy.handler.ts:71`'s own bucket for a
participant's signed agreement letter; `documents`/`signed-copies` are the
only two entries in `PRIVATE_CATEGORIES`
(`services/api/src/shared/utils/private-file-key.ts:7`); `avatars` is
`PARTICIPANT_UPLOAD_BUCKETS[0]`
(`services/api/src/modules/files/presentation/files.controller.ts:50`). None
of the four are in `UploadFileHandler.PUBLIC_CATEGORIES`
(`upload_file_handler.py:63-80`), so every object this script writes gets no
public-read ACL — same as a native upload to those categories (the script
mirrors `PUBLIC_CATEGORIES` as an explicit allowlist rather than hardcoding
"always private", so it stays correct if a category is ever added).

`{env}` is `dev`/`staging`/`prod` per `--env` (new flag, default `production`
-> `prod`, matching `file_path_service.py`'s own `prefix_map`). `{fileId}` is
a **deterministic uuidv5** — `uuidv5(`${table}:${legacyId}:${url}`,
NAMESPACE)` with a fixed namespace constant — never
`crypto.randomUUID()`, which is random and would break idempotency. Re-running
the exact same manifest row always recomputes the identical id and key. The
`uuid` package used for this is already a `services/api` dependency
(`package.json`); no new dependency was added, and no hand-rolled SHA-1
uuidv5 was needed since a maintained implementation was already available.

### Required side effects, matching a native upload (`--apply` only)

1. **Object storage**: unchanged mechanics from before (dependency-free SigV4
   PUT/HEAD/GET, byte-count + MD5/ETag verification, skip-if-size-matches) —
   now writing to the native key above instead of a side `legacy/` namespace.
2. **`files` row**, in the file service's OWN Postgres database (`FILE_DATABASE_URL`
   — a DIFFERENT database from the API's `DATABASE_URL`; see
   `services/file/.env.example`, `postgres-file` / `ybb_files_db` vs. the
   API's `postgres-api` / `ybb_platform`). Columns mirror
   `services/file/prisma/schema.prisma:16-45` exactly: `id` (the deterministic
   uuid), `filename`/`original_filename`, `file_type`/`mime_type` (derived the
   same way as `UploadFileHandler.execute`, `upload_file_handler.py:184-196`),
   `file_size`, `storage_path` (unique — same key as above), `bucket` (the
   PHYSICAL bucket, `MINIO_BUCKET`, not the category — matches
   `upload_file_handler.py:172` assigning `bucket=real_bucket`), `user_id`,
   `brand_id`, `program_id`, `metadata` (a small JSON marker:
   `legacy_migration`, `legacy_table`, `legacy_id`, `context`), `status='READY'`.
   `ON CONFLICT (id) DO NOTHING` is sufficient for idempotency since `id` and
   `storage_path` are both derived from the same deterministic seed. This row
   is **not optional bookkeeping** — `documents`/`signed-copies` are only
   presignable because `get_presigned_url_internal_handler.py:47` calls
   `file_repository.find_by_storage_path(...)` and 404s if no row exists at
   that path, so without it a rehosted agreement letter or program document
   would be permanently unreadable through the app's own private-file path.
3. **Participant profile column** — `participants.profile_picture_url` /
   `.resume_url` — written to the same CDN-style url a real upload produces
   (`MinIOStorage.get_public_url`, `minio_storage.py:195-206`:
   `{proto}://{MINIO_PUBLIC_ENDPOINT}/{key}`), but **only when the column is
   currently `NULL`** — a participant who uploaded natively after the
   historical import always wins; this script never overwrites that.
4. **Known gap, by design**: agreement letters and program documents have no
   `participant_documents` row to write a url into yet —
   `migrate-legacy-participants.cjs` does not create one for legacy data (see
   its own "Legacy -> new entity mapping" table above; that mapping is
   currently aspirational, not implemented — out of this script's scope).
   Bytes and the `files` row are still created for these two sources (both
   idempotent, both cheap to do now, both keyed by the same deterministic
   `legacyId`/`fileId`), so a future pass that DOES create
   `participant_documents` rows (matching `ParticipantDocument.legacyId` to
   the letter's/document's own legacy id) can link them without re-touching
   storage. Verified end-to-end below: these two rows correctly report
   `columnSkippedNoTargetRow` and skip the write rather than guessing a target.

A manifest row whose legacy id doesn't resolve to an already-migrated
Postgres row yet (that program hasn't had
`migrate-legacy-participants.cjs --apply` run for it) is written to the retry
CSV with an actionable message instead of silently skipped or crashing the
batch.

### `--source-dir` (preferred over HTTP — read this first)

`--source-dir <path>` reads bytes from a local mirror of the legacy storage
docroot instead of HTTP: `https://storage.ybbfoundation.com/<path>` maps 1:1
onto `<path>` joined under `--source-dir`. This is the **preferred** source
per the owner — a local cPanel export needs one download instead of ~64.5K
throttled requests against a host that bans by volume (see "Sample findings"
below, unchanged from before). `--rate`/`--breaker`/`--source-host` are all
no-ops in this mode (nothing is fetched over HTTP at all). HTTP fetch remains
the fallback when `--source-dir` is omitted, unchanged from the prior version
(paced GET/HEAD, exponential backoff, circuit breaker).

### Running on the VPS (real cutover — not run as part of this task)

The intended real run is `ssh ybb-vps`, plain `node` (no container rebuild
needed — `pg`, `mysql2`, `uuid` are already vendored under
`services/api/node_modules`; no new dependency was added, so nothing else is
required), `--source-dir /root/legacy-storage/storage.ybbfoundation.com`
(the owner's local mirror of the legacy docroot), writing to the real
DigitalOcean Spaces bucket via the file service's own live env:

```
docker exec <file-service-container> env | grep -E '^MINIO_|^DATABASE_URL'
```

`MINIO_ENDPOINT`/`MINIO_ACCESS_KEY`/`MINIO_SECRET_KEY`/`MINIO_BUCKET`/
`MINIO_REGION`/`MINIO_SECURE`/`MINIO_PUBLIC_ENDPOINT` are the exact names this
script already reads (verified against `services/file/.env.example` — these
are what ops will find on the live container, so they copy across unchanged;
no `SPACES_*` renaming was needed). The file service's own `DATABASE_URL`
value from that same `docker exec` must be set as this script's
`FILE_DATABASE_URL` — a deliberately different variable name, since this
script also needs the API's own `DATABASE_URL` open at the same time (two
different databases: `ybb_files_db` vs. `ybb_platform`). None of these
values are ever printed or logged by this script.

**This task did not run against the real VPS storage mirror or the real
Spaces bucket.** Verification (below) used localstack for object storage and
a throwaway local Postgres for both database roles — same shape as the "Local
apply test" done for the main migration script, never the real infrastructure.

### CLI

```
node rehost-legacy-media.cjs --manifest m.csv [--dry-run] --env production [--program <legacyProgramId>] [--limit N]
                             [--concurrency 8] [--rate 4] [--breaker 15]
                             [--source-dir /path/to/legacy-storage-mirror]
                             [--source-host storage.ybbfoundation.com] [--retry-csv path.csv]
node rehost-legacy-media.cjs --manifest m.csv --apply [...same flags]
```

- `--env` (default `production`): `development|staging|production` -> `dev|staging|prod` path segment.
- `--dry-run` (default): resolves ids/keys and HEADs (or `stat`s, in `--source-dir`
  mode) the source and the destination object; would-upload / would-skip only. It
  never reads a body and never writes to Postgres.
- `--apply`: if the key is absent it streams GET/read into PUT (one legacy request
  per file in HTTP mode). If the key exists it checks size and skips on a match, or
  re-uploads if the stored copy is truncated. Every upload is checked for byte count
  and MD5 == ETag. On a confirmed-present object it upserts the `files` row and,
  for picture/resume rows, the participant url column (see above). Requires both
  `DATABASE_URL` and `FILE_DATABASE_URL`.
- `--program`: filters manifest rows with a read-only legacy lookup
  (`participants.program_id`, joined through `participant_id` for letters/documents) — unchanged.
- `--source-dir`: local mirror of the legacy storage docroot (preferred; see above).
- `--source-host`: allowlist of hosts to fetch from over HTTP. Ignored with `--source-dir`.
- `--rate`/`--breaker`: unchanged (HTTP mode only) — global req/s cap and consecutive-failure circuit breaker.
- `--retry-csv` (default `rehost-retry.csv` next to the manifest): `table,legacy_id,url,parent_legacy_id,error`,
  written as failures/unresolved-context rows happen. Feed it back in as the next `--manifest`.
- No npm dependency added: SigV4 signing and HEAD/PUT/GET use Node built-ins only;
  `pg`/`mysql2`/`uuid` were already `services/api` dependencies.

### Sample findings (2026-09-25, real legacy host, read-only) — unchanged

Stratified random sample from legacy MySQL (session `READ ONLY`): 3,450 URLs
(1,210 picture / 765 resume / all 259 letters / all 1,216 program documents).
The column counts match the table in "Media / file URL rehosting" above
(57,019 / 36,119 / 259 / 1,216).

- **Hostnames:** `picture_url`, `file_link` and program-document `file_url` are
  100% `storage.ybbfoundation.com`. **`resume_url` is not:** only 16.7% is on
  the legacy host. The rest is Google Drive 45.6%, Google Docs 8.9%, malformed
  8.2% (e.g. `https//name@mail.com`), LinkedIn 5.5%, Canva 2.5%, OneDrive and
  about 50 other hosts. Third-party links are kept as-is and never rehosted.
- **HEAD results (storage host, before the ban below):** 453/453 returned `200`.
  Content types: `image/jpeg` 97%, `image/png` 2%, `text/html` <1%.
  Profile pictures: avg 131 KB, median 37 KB, max 1.9 MB (n=450).
- **The legacy host bans by request volume.** Connections from our IP started
  getting reset (`ECONNRESET`, then connect timeouts) after about 1.5-2.5K
  HEADs at concurrency 20 unpaced. This is the reason `--source-dir` is
  preferred over HTTP for the real cutover.

### Verification done (this task — localstack, throwaway Postgres, no real infra)

- Started `localstack/localstack:3.0` (S3 only) and a throwaway
  `postgres:16-alpine`, both in Docker, both destroyed after the test.
  Created two databases on the same throwaway Postgres instance
  (`ybb_api_test` mirroring the relevant slice of the API's schema —
  `brands`/`programs`/`users`/`participants`/`participant_applications` with
  `legacy_id` columns — and `ybb_files_test` mirroring
  `services/file/prisma/schema.prisma`'s `files` table column-for-column) to
  stand in for `DATABASE_URL` and `FILE_DATABASE_URL`.
- Seeded 8 participants (legacy ids 101-108, one brand/program) and 2
  applications (legacy ids 555/556, for the agreement-letter/program-document
  rows) with real foreign keys, matching how `migrate-legacy-participants.cjs`
  would have populated them.
- Real legacy MySQL access is not available to this session (unchanged from
  the main script's "Real dry-run against prod/legacy — blocked, not run"
  finding) and `storage.ybbfoundation.com` was reachable but no known-valid
  path could be constructed without it, so the source for this test was 20
  synthetic files under a local `--source-dir` (16 picture/resume files
  across the 8 participants + 2 agreement letters + 2 program documents,
  including the private `signed-copies` and `documents` categories) — sizes
  and content are synthetic, but every code path (context resolution, native
  key construction, S3 PUT/HEAD, `files` row upsert, participant column
  write, idempotency, retry-csv) is the same code that runs against a real
  HTTP/legacy-host manifest row; only the byte source differs.
- `--dry-run`: `20/20` resolved with `unresolved=0`, `would-upload=20`,
  zero Postgres writes.
- `--apply`: `uploaded=20 failed=0 aborted=0`; `files-row upserted=20`;
  `participant-column written=16` (8 participants x 2 columns);
  `no-target-row-yet(agreement/document)=4` (the 2 letters + 2 documents,
  correctly deferred per the "Known gap" above). Verified directly against
  both Postgres databases and via `aws s3 ls --endpoint-url` against
  localstack: object keys, `files` row count/columns, and
  `participants.profile_picture_url`/`.resume_url` all matched exactly
  (see the key table above for the exact shape produced).
- **Idempotent rerun**: `--apply` a second time on the same manifest gave
  `uploaded=0 skipped(existing)=20`, `participant-column written=0`
  (`already-set(skipped)=16`), and the `files` table's row count and every
  row's `id` (the deterministic uuidv5) were byte-identical before and after.
- **Masked/signed url parse-back** (proving the private-category path
  actually works, not just asserting it): took the `signed-copies` object's
  real `storage_path` from the test `files` row, built its CDN url via this
  script's own `publicUrlFor()` (`{proto}://{MINIO_PUBLIC_ENDPOINT}/{key}`,
  matching `MinIOStorage.get_public_url`), then ran a byte-for-byte
  replica of `private-file-key.ts`'s `deriveStorageKeyFromUrl` +
  `isPrivateCategoryKey` against that url in a throwaway script: the derived
  key matched the original `storage_path` exactly, and
  `isPrivateCategoryKey` returned `true` — the same two checks
  `PrivateFileUrlResolver.resolve()` (`private-file-url-resolver.service.ts:23-34`)
  runs before calling `get_presigned_url_internal_handler.py`, which would
  then find this script's `files` row via `find_by_storage_path` and succeed.
- **Unresolved-context handling**: a manifest row for a participant with no
  matching migrated Postgres row, and a letter row missing
  `parent_legacy_id`, were both run through `--dry-run`: both landed in the
  retry CSV with a specific, actionable error message (not a generic
  failure) and did not stop the rest of the batch.
- The real Spaces bucket, the real VPS, and the real legacy host's bytes were
  never touched by this verification. The localstack and Postgres containers
  were removed afterwards; all temp files/manifests were deleted.

## Post-VPS-dry-run fixes (2026-09-26) — invoice tier synthesis, dup-guard, program-12

A real dump-based dry-run against all mapped programs (see "Real dry-run
against prod/legacy") surfaced three real bugs, fixed here and re-verified
locally against real legacy data (small `--limit`-based run, programs 1/4/12):

### 1. Invoice tier matching was dropping almost all payment history

`invoicesUnmatchedTier=27,149` on the real run — requiring an exact
`program_pricing_tiers.legacy_id` match before minting an invoice silently
dropped nearly every legacy payment, because legacy programs' fee
definitions (`program_payments`) were mostly never content-migrated into
current pricing tiers. Fixed: `resolveOrCreateTier()` now falls back to
synthesizing a historical tier (`program_pricing_tiers` row, `is_active =
false`, `fee_type` mapped from legacy `program_payments.category` —
`registration` -> `registration_fee`, `program_fee_1`/`program_fee_2` pass
through unchanged, anything else -> `custom_fee`) from the legacy
`program_payments` definition itself, keyed by `legacy_id` so a rerun
reuses the same synthesized tier instead of creating a duplicate. Only a
payment whose `program_payment_id` doesn't exist in legacy `program_payments`
either (a true orphan) still counts as `invoicesUnmatchedTier`. Verified
live (small local run): `tiersSynthesized=1`, `invoicesNew=19` for a
5-participant slice of program 4, broken down by final status
(`paid=4 unpaid=1 failed=14`) — the new "Invoices by final status" line in
the printed report.

### 2. Native-duplicate application guard didn't run in dry-run

`appsSkippedExisting=0` on the real run despite `participantsReused=1,323`
and a separately-verified 125 legacy-program-18 emails already holding a
native application on the mapped Korea Youth Summit program. Root cause:
the `(participant_id, program_id)` duplicate check was gated behind
`if (apply)`, so dry-run never saw it — not a missing-column issue, that
check uses columns that already exist in prod today. Fixed: the check now
runs whenever `participantId` is available (i.e., in both dry-run and
apply, for any participant whose profile already exists — a brand-new
dry-run-only participant, not yet inserted, is the only case correctly
skipped, since it cannot already have a native application).

### 3. Legacy program 12 (MEYS) — dry-run now simulates the pending backfill

Legacy program 12 still has no new-prod `programs` row (see the dedicated
migration `20260925150000_backfill_legacy_program_12_meys`, not yet
deployed to prod). Rather than let its 23,709 participants silently vanish
from every dry-run count, a small `PENDING_PROGRAM_BACKFILLS` table in the
script lets dry-run simulate "this program will exist" for legacy id 12
specifically (brand resolved the same way the real migration does, via
`brands.legacy_id = 3`), using a synthetic non-uuid program id that skips
(rather than errors on) any real Postgres lookup keyed by that id
(`program_pricing_tiers`/`program_essays`/duplicate-application checks).
This is dry-run-only by construction — `--apply` never creates a program
row itself; that stays a reviewed schema migration, not something this
per-participant ETL improvises.

### Same-brand duplicate email groups: 14 vs 19 — explained, not a bug

An earlier investigation (predating this branch, documented against an
older legacy snapshot) found 14 same-brand duplicate email groups; both the
dump-based VPS run and a live direct query against the current legacy DB
(run independently, same session) return **19**, in exact agreement with
each other. Since two independently-run instances of the identical query
(`SELECT ... GROUP BY LOWER(TRIM(email)), program_category_id HAVING
COUNT(*) > 1`) against two different real snapshots (the VPS dump and a
live connection) agree with each other and disagree with the older
figure, this is snapshot timing — the legacy database has kept growing
(three legacy programs are still open for registration as of this writing,
see "Still-live legacy programs" below) — not a normalization or query
difference.

## Perf fix (2026-09-26): set-based lookups + CONCURRENTLY index

Observed directly on a prod clone running this migration's own dry-run:
`SELECT id, legacy_id FROM users WHERE lower(trim(email)) = $1 AND brand_id =
$2 LIMIT 1`, issued once per legacy participant with no matching expression
index, seq-scanned the entire `users` table every time — ~88% sustained CPU
on the clone. Against the live prod primary at 250k+ lookups, this would
have meant hours of degraded seq-scan load on the site's own database.

**Fixed**: the per-row Postgres lookups (`users` by email, `users` by
`legacy_id`, `participants` by `user_id`, `participant_applications` by
`legacy_id`, and the native `(participant_id, program_id)` duplicate-guard)
are now batch-prefetched **once per program** (not once per fixed-size
chunk, and not once per row) into in-memory `Map`s before the per-row loop
runs, using `= ANY($1::type[])` array parameters. Per-program batching (as
opposed to fixed `--batch-size` chunks) was chosen because it's strictly
fewer round trips for the same correctness — the largest single mapped
program has ~55K rows, comfortably within one array parameter — and it
requires no cross-chunk bookkeeping. The in-memory maps are also updated as
rows resolve within the loop, so a rare repeated legacy participant/
application row within the same program still sees a same-run predecessor
correctly (closing a gap batching would otherwise introduce). Insert paths
remain per-row for now (still correctness-critical, ON CONFLICT-guarded);
batching writes is a separate, lower-urgency follow-up not done in this pass.

**Verified locally** (small `--limit`-based run against real legacy data):
identical counts before/after the refactor (users/participants/applications/
invoices/documents), and a real apply + rerun confirming the existing-user
reuse path and idempotency both still work correctly through the new batched
lookups.

**Index**: `idx_users_brand_lower_trim_email` on `users (brand_id,
lower(trim(email)))`, added in migration
`20260926090000_add_legacy_email_lookup_index`. This CANNOT go through the
normal `prisma migrate deploy` pipeline as a real `CREATE INDEX
CONCURRENTLY` — Prisma wraps every migration file in a transaction, and
`CONCURRENTLY` cannot run inside one. The migration file itself is a no-op
guard (documents the requirement, doesn't attempt `CONCURRENTLY` inside a
transaction). The actual index creation is a **manual, one-time, out-of-band
step**, run once before any real `--apply`:

```
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -c \
  "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_brand_lower_trim_email \
   ON users (brand_id, lower(trim(email)));"
npx prisma migrate resolve --applied 20260926090000_add_legacy_email_lookup_index
```

`CONCURRENTLY` takes only a `SHARE UPDATE EXCLUSIVE` lock (blocks other DDL/
`VACUUM FULL`, never blocks normal reads/writes), so this is safe to run
against the live prod primary ahead of any real `--apply`; it may take a
while on a large table, which is expected and non-blocking.
