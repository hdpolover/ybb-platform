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
node migrate-legacy-participants.cjs --dry-run [--program <legacyProgramId>] [--batch-size 500]
node migrate-legacy-participants.cjs --apply    --program <legacyProgramId>  [--batch-size 500]
```

- Default is `--dry-run`; `--apply` must be passed explicitly.
- `--program` restricts to one legacy program id (repeatable to run several);
  omitted = every mapped program except 22.
- Idempotent: every insert is an upsert keyed on the relevant `legacy_id`, so
  a full re-run (e.g. the final cutover sync for programs 17/18/20) only
  touches rows that actually changed.
- Both DB connections are read-only-by-construction in dry-run: legacy always
  runs `SET SESSION TRANSACTION READ ONLY`; the Postgres side only issues
  `SELECT`s unless `--apply` is passed.

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
