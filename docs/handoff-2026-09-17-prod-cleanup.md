# Handoff: production cleanup after the 2026-09-17 client bug fixes

> For an agent with VPS access (ssh `ybb-vps`). All the **code** is merged and deployed.
> What remains is **data work on production** plus a read-only report for the owner.
> Written from a Codespace session that had no VPS access, so nothing below has been run yet.

## Background (what shipped)

Client reported four issues. All fixed and live:

| Issue | Backend (ybb-platform, `dev`) | Participant site (ybb-program-next, `develop`) |
|---|---|---|
| MEYS 2026 participants land on MEYS 2027 on login, can't reach invitation letter, program switcher errors | #215 | #110 |
| Many participants can't upload the agreement letter | #214 | #110 |
| Announcement URLs are UUIDs instead of readable slugs | #216 (migration `20260917120000_program_announcement_slug_unique`) | #110 |
| Fully Funded (FF) signups/payments still possible after FF closed (MEYS 2026, CYS 2026) | #217 | #110 |

Verified live: API `/v1/health` 200; `GET /v1/landing/announcements/:key` serves slugs; the KYS
announcement UUID URL redirects to its slug on koreayouthsummit.com.

The data left behind by the bugs is what this handoff is for.

---

## Task 1: delete the phantom MEYS 2027 draft applications (do this first)

### Why
Before 5441a62a (12 Sep), **every login** created an empty draft application on the brand's currently
open edition. MEYS 6th (2026) participants therefore got an empty 7th-edition (2027) draft. At report
time 1,816 MEYS participants had a 7th-edition application and ~**1,245** of them were empty phantoms.
The code no longer creates them or pins users to them, but the rows still exist: they appear in the
participant's program switcher, and they inflate the 7th edition's applicant counts in admin.

### Tool
`services/api/scripts/cleanup-phantom-edition-drafts.ts` (merged in #215). **Read its header comment
before running**: it documents the exact predicate, safety model and the prod run recipe. Summary:

- Dry run by default; `--apply` to delete. `--brand=<uuid|slug>`, `--program=<uuid>`.
- A row qualifies only if it is a live, never-edited, unpaid, completely empty draft with no tier,
  category, referral, score, review, invoice, document, assessment, edit history, award or payment outbox
  event, **and** the participant holds an older live application in the same brand.
- Predicate is re-checked under `FOR UPDATE` inside the delete transaction.
- Writes full JSON backups (dry run and apply) to `./backups/`.
- Hard delete on purpose (soft delete would collide with `@@unique([participantId, programId])`).
- Deletes matching `submission_reminder_logs` rows too (no FK), backed up.
- Busts affected users' portal caches via ioredis if `REDIS_*` env is set, otherwise prints patterns.
- Uses only `pg`, `ioredis`, `dotenv`; does NOT bootstrap Nest (AppModule won't start in the prod container).

### Steps
1. **Take a DB backup first** (whatever the established method is on the VPS, e.g. `pg_dump` of
   `ybb_platform_db` from `ybb-platform-api-yeghdi-postgres-api-1`). Beware decoy containers:
   `ybb-postgres` and `ybb-redis` are NOT the platform's.
2. Compile locally from `services/api` on an up-to-date `dev` checkout:
   ```bash
   npx tsc scripts/cleanup-phantom-edition-drafts.ts --outDir /tmp/phantom \
     --target es2021 --module commonjs --esModuleInterop --skipLibCheck
   scp /tmp/phantom/cleanup-phantom-edition-drafts.js ybb-vps:/tmp/
   ```
3. On the VPS: find the API container (`docker ps | grep ybb-platform-api`) and copy into `/app`:
   ```bash
   docker cp /tmp/cleanup-phantom-edition-drafts.js <api>:/app/cleanup-phantom-edition-drafts.js
   ```
   If `/app` is not writable or `pg`/`ioredis` don't resolve there, stop and fall back to running the
   same predicate via psql (read it from the script's `PHANTOM_PREDICATE`), in a transaction, after
   exporting the matching rows to JSON/CSV.
4. **Dry run for MEYS** (find the MEYS brand slug: `SELECT id, slug, name FROM brands;`):
   ```bash
   docker exec -w /app <api> node cleanup-phantom-edition-drafts.js --brand=<meys-slug>
   docker cp <api>:/app/backups/. ./phantom-backups/
   ```
   **Sanity gate before applying:**
   - Matches should be on the MEYS **7th** edition, in the order of ~1,000–1,300 (the count can be lower
     than 1,245 if some participants genuinely started a 2027 application since).
   - Spot-check 3–5 rows from the backup: empty personal data, no invoices, and the same participant has
     a 6th-edition application.
   - If the count is far outside that range, matches land on the 6th edition, or anything looks
     non-empty: **stop and report to the owner instead of applying.**
5. Apply and keep the backup:
   ```bash
   docker exec -w /app <api> node cleanup-phantom-edition-drafts.js --brand=<meys-slug> --apply
   docker cp <api>:/app/backups/. ./phantom-backups/
   ```
6. Run a dry run **without** `--brand` to see whether other brands with two concurrent editions have
   phantoms. Apply to each brand only if it passes the same sanity gate.
7. If the script reports Redis was unreachable, clear the printed key patterns inside the platform
   redis container (`ybb-platform-redis-service-omv9vw.1.*`) with
   `redis-cli --scan --pattern '<pattern>' | xargs -r redis-cli del` (auth as that container requires).
8. Verify:
   - Re-run the dry run: it must report 0 matches.
   - Counts on the MEYS 7th edition in admin / DB drop by the deleted amount.
   - Example participants from the client report no longer have a 7th-edition application:
     `alfourkonefoods@gmail.com`, `a-bibarsova@list.ru` (join `users` → participant → `participant_applications`).
9. Remove the script copy from the container (`docker exec <api> rm /app/cleanup-phantom-edition-drafts.js`);
   keep the backups off-container.

---

## Task 2: FF registration-window follow-up (READ-ONLY, report to owner)

### Why
#217 makes the server enforce each category's registration window, taken from the
**registration_fee pricing tier validity periods** (`program_pricing_tiers.allowed_categories` +
`pricing_tier_validity_periods`). Consequences the owner must decide on; **do not change data here**:

- An unpaid registration invoice whose category window has closed can no longer be paid by the
  participant (API code `REGISTRATION_WINDOW_CLOSED`). They must switch category, or an admin charges them
  (admin payment-intent route only logs a warning).
- A registration_fee tier **with no validity periods stays payable** (not gated).
- This applies to Self Funded too once the SF window closes.

### Produce a short report with
1. For MEYS 2026 and CYS 2026 (and any other currently running edition): every active, non-deleted
   `registration_fee` tier with `allowed_categories`, prices, and all validity periods. **Flag any FF tier
   with no periods** (it is still payable).
   ```sql
   SELECT b.slug brand, p.name program, t.id, t.name, t.allowed_categories, t.usd_price, t.idr_price,
          t.is_active, v.start_date, v.end_date
   FROM program_pricing_tiers t
   JOIN programs p ON p.id = t.program_id JOIN brands b ON b.id = p.brand_id
   LEFT JOIN pricing_tier_validity_periods v ON v.pricing_tier_id = t.id
   WHERE t.deleted_at IS NULL AND t.fee_type = 'registration_fee'
   ORDER BY b.slug, p.name, t.name, v.start_date;
   ```
   (Verify column names like `t.name` against `prisma/schema/applications.prisma` first.)
2. Per edition: number of `fully_funded` applications with an unpaid/failed/cancelled registration invoice
   (`application_invoices` joined to the tier), and how many of those applications were created **after**
   the FF window's last `end_date`, i.e. the accounts the client complained about.
3. Any `self_funded` application that has an invoice (paid or not) on a tier whose `allowed_categories`
   does not include `self_funded` (previously possible, now blocked).
4. Whether registration-fee reminder emails would still target closed-window FF participants: read
   `services/api/src/modules/reminders/` (registration-fee audience service) and state yes/no with the
   file:line. No code change in this task. Just report.

Hand the report to the owner with a recommendation (switch those FF applications to SF, cancel their
unpaid FF invoices, or add a grace period). Don't take any of those actions without the owner's go-ahead.

---

## Task 3: agreement-letter upload spot check (READ-ONLY)

#214 (file service infers the type of `application/octet-stream` uploads from the extension) and #110
(photo uploads, size checks, readable errors) are live. Confirm uploads are flowing again:
```sql
SELECT date_trunc('day', updated_at) AS day, count(*)
FROM participant_documents
WHERE submission_status = 'uploaded' AND updated_at > now() - interval '14 days'
GROUP BY 1 ORDER BY 1;
```
Also grep the last 24h of logs for leftover failures:
- file service: `not allowed. Allowed types`, `File too large`
- participant site (Next): `Request body exceeded`
- API: 413/5xx on `POST /v1/portal/documents/:templateId/signed-copy`

Report counts before/after 17 Sep 09:15 UTC (the #110 deploy).

---

## Rules for the executing agent
- Take a DB backup before Task 1. Keep every JSON backup the script writes, off the container.
- Tasks 2 and 3 are read-only. Task 1 is the only data change allowed by this handoff.
- If a sanity gate fails or something doesn't match this document, stop and report. Don't improvise
  data changes.
- When done, append a short "Result" section to this file (counts deleted, backup locations, report
  findings) and commit it.
