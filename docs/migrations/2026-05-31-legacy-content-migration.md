# Legacy Content Migration — Completion Report

**Date:** 2026-05-31
**Status:** Data migrated to production and verified. API deployed. Frontend rich-text fix pushed (awaiting `ybb-program-next` deploy).
**Design/plan (detailed):** [`docs/superpowers/plans/2026-05-31-legacy-content-migration.md`](../superpowers/plans/2026-05-31-legacy-content-migration.md)

---

## 1. Goal

Surface program *history* on the new platform: bring past-program content (brands, program editions, news/announcements, gallery, speakers, FAQs, schedules, awards, testimonials) from the **legacy CodeIgniter MySQL** site into the new **Postgres/Prisma** platform, and re-home referenced media into the new file service so the legacy storage can be retired.

Out of scope (intentionally not migrated): participants (~238k), essays, payments, users, ambassadors, scoring, abstracts/papers. No PII, no payment, no auth data.

## 2. Source & target

| | Source | Target |
|---|---|---|
| Engine | MySQL (CodeIgniter) | PostgreSQL (Prisma) |
| DB | `u1437096_ybb_master_app_db` @ legacy host | `ybb_platform_db` (prod, Dokploy container `ybb-platform-api-yeghdi-postgres-api-1`) |
| Assets | `storage.ybbfoundation.com` (public URLs) | file service → `cdn.ybbhub.com` |

Credentials live only in `.env` / container env — never in the repo.

## 3. What was migrated (verified counts on prod)

| Legacy table | New model | Result |
|---|---|---|
| `program_categories` (7) | `Brand` | 4 matched existing brands by name (anchored, empty fields backfilled, never overwritten) + 3 created (Korea, Youth Academic Forum, Vietnam). "China Youth Summit" untouched (no legacy match). |
| `programs` (18 active) | `Program` | 15 historical editions created, 3 ignored (legacy 12/21/22 — new DB authoritative), + 7 auto-created "history" stub editions for orphan photo years. |
| `program_faqs` | `ProgramFaq` | 241 |
| `program_speakers` | `ProgramSpeaker` | 19 (incl. session/instagram fields) |
| `program_awards` | `ProgramAward` | 31 |
| `program_announcements` | `ProgramAnnouncement` | **387 (ALL legacy announcements)** — see §6 |
| `program_schedules` + `program_rundowns` | `ProgramSchedule` | 234 (135 + 99) |
| `program_photos` | `ProgramGallery` | 79 (100% — orphan years rescued by history stubs) |
| `program_testimonies` + `program_video_testimonies` | `ProgramTestimonial` | 27 |
| assets (all of the above) | file service | **452 re-homed, 0 failures, 0 legacy URLs left** |

## 4. Key decisions

- **De-duplication / "new DB is authoritative".** Any legacy program already present in the new DB is **ignored** (not created, merged, or anchored). Confirmed ignore list: legacy `12`, `21` (MEYS 2026/"6th"), `22` (IYS 2027). Existing curated programs (China 2026, MEYS 6th, IYS 2027) were left completely untouched.
- **Brands** matched by normalized name; existing brands only anchored (`legacy_id` set) and empty fields backfilled — curated values never overwritten.
- **History stub programs.** ~66% of legacy photos belong to years with no `programs` row (e.g. MEYS 2023, WYF 2023). A minimal published `Program` is auto-created per orphan `(brand, year)` (synthetic `legacy_id >= 9_000_000`) so no historical gallery is dropped.
- **Slugs.** Program slugs for same-named editions are date-ordered (`-2`, `-3`), not legacy-id suffixed. Announcement slugs are **regenerated from the title** (legacy slugs were mangled — missing leading letters — plus duplicates/nulls); no old-site SEO to preserve.
- **News is brand-level.** Announcements display aggregates across all of a brand's programs; all 387 legacy announcements were migrated (see §6).
- **Asset re-homing is mandatory** because legacy storage will be deleted; isolated dry-run uploads via `ASSET_BUCKET_PREFIX=dryrun-`.
- **Anchor-space disjointness (no `legacy_id` collisions):** real program ids 1–22; rundown schedules `+2_000_000`; video testimonials `+2_000_000` (different table); history stubs `>= 9_000_000`.

## 5. Scripts & schema

Code lives in `services/api/prisma/migration-scripts/legacy-content/` (raw-SQL `.cjs`, run **in-container** so they never touch the live Prisma client; idempotent via `legacy_id` upsert). See that folder's `README.md`.

- `migrate-legacy-content.cjs` — Phase A: brands, programs, all per-program + brand-level content, history stubs.
- `rehome-legacy-assets.cjs` — Phase B: download legacy assets, re-upload to file service, rewrite URLs.
- `backfill-ignored-announcements.cjs` — migrate news from ignored editions onto each brand's current published program.

**Schema change (tracked migration `20260531120000_add_legacy_content_fields`, idempotent `IF NOT EXISTS`):** added `legacy_id` anchors to `program_faqs`, `program_schedules`, `program_gallery`, `program_testimonials`, `program_speakers`, `program_announcements`; speaker `instagram_url`/`session_title`/`session_description`/`session_time`/`is_keynote`/`expertise_areas`; announcement `slug`/`meta_title`/`meta_description`. Recorded on prod via `prisma migrate deploy` during the API deploy.

## 6. The announcements / news fix

The "ignore" rule had skipped news on the current MEYS/IYS editions, so `middleeastyouthsummit.com/announcements` showed nothing. Two causes, both fixed:

1. **Missing data:** announcements on ignored editions (legacy 12/21/22 = 75 items) were never migrated. `backfill-ignored-announcements.cjs` migrated **all** of them (no title dedup — completeness required). MEYS now has 62 announcements (52 on "6th" + 10 on "2025"). Total migrated announcements on prod: **387** (= every legacy `is_deleted=0` announcement).
2. **Query hid past programs:** the landing query (`src/modules/landing/strategies/announcements.strategy.ts`) required `program.isActive = true`, which excludes completed editions. Changed to gate on `isVisibleToUsers` (news shows for any published+visible program in the brand, active or not); result cap raised 10 → 50. Landing snapshots + Redis `landing:*` cache cleared.

Verified: `GET /v1/landing/announcements` with `x-brand-domain: middleeastyouthsummit.com` returns 50 MEYS announcements.

## 7. Rich-text rendering fix (separate repo: `ybb-program-next`)

The audit confirmed content migrated **faithfully** (valid HTML, no corruption, zero escaped/encoded tags). The "wall of text" was a **frontend** bug, not a migration defect (it affected admin-authored CYS news too). Root cause: the announcement detail page renders content in a Tailwind `prose` container, but `@tailwindcss/typography` was never installed/registered, so `prose` was inert and Tailwind preflight zeroed `<p>`/`<h3>` margins.

Fix: installed + registered `@tailwindcss/typography` in `ybb-program-next/tailwind.config.ts`. Commit `41ee8f7` on `develop`. Needs a `ybb-program-next` deploy to take effect.

## 8. Execution timeline

1. Backup prod (`pg_dump -Fc` → `ybb_platform_db_PRERUN_20260531_054939.dump` on the VPS).
2. Dry run on a restored scratch DB (`ybb_platform_dryrun`): validated end to end; caught and fixed two bugs (dedup must only match `legacy_id IS NULL` admin programs; nicer slugs; announcement slug regeneration).
3. Prod run: DDL → Phase A → verify → Phase B → verify.
4. Committed code (ybb-platform `dev` → `b343519`) and deployed via Dokploy; `prisma migrate deploy` recorded the migration.
5. Announcements completeness + landing query fix; cache cleared.
6. Content audit; rich-text rendering fix in `ybb-program-next` (`41ee8f7`).

## 9. Verification highlights

- No duplicate `(brand, slug)` programs.
- Curated programs (China 2026, MEYS 6th, IYS 2027): `legacy_id NULL`, zero legacy content mixed in — untouched.
- Idempotent: a second Phase A run produced identical counts, no row doubling.
- 0 remaining `storage.ybbfoundation.com` URLs after Phase B.
- All 387 legacy announcements present.

## 10. Rollback

Restore point: `ybb_platform_db_PRERUN_20260531_054939.dump` (VPS `/tmp`). Targeted undo (additive migration) — delete in FK-safe order, then clear anchors:

```sql
DELETE FROM program_faqs           WHERE legacy_id IS NOT NULL;
DELETE FROM program_speakers       WHERE legacy_id IS NOT NULL;
DELETE FROM program_gallery        WHERE legacy_id IS NOT NULL;
DELETE FROM program_announcements  WHERE legacy_id IS NOT NULL;
DELETE FROM program_testimonials   WHERE legacy_id IS NOT NULL;
DELETE FROM program_schedules      WHERE legacy_id IS NOT NULL;
DELETE FROM program_awards         WHERE legacy_id IS NOT NULL;
DELETE FROM programs               WHERE legacy_id IS NOT NULL;  -- includes history stubs (legacy_id >= 9000000)
UPDATE brands SET legacy_id = NULL WHERE legacy_id IS NOT NULL;  -- review backfilled brand fields vs dump if needed
```

(Re-homed assets in the file service are harmless to leave; the landing query change and typography fix are independent and safe to keep.)

## 11. Remaining / follow-ups

- **Deploy `ybb-program-next`** (`develop`, `41ee8f7`) so rich-text news renders correctly.
- **Revalidate** the Next.js ISR landing sites so migrated content appears.
- **Cleanup:** drop scratch DB `ybb_platform_dryrun`; purge dry-run uploads under `dryrun-*` storage paths + their file-service DB rows.
- **Optional polish:** add `whitespace-pre-line` for plain-text FAQ answers / speaker bios / testimonials if line breaks matter; disambiguate the two same-named "Korea Youth Summit 2026" editions; migrate `program_subthemes` (~82) if past-program tracks should show.

## 12. Commits

- `ybb-platform` `dev` — `b343519`: schema + migration + ETL scripts + landing query fix + plan/report docs.
- `ybb-program-next` `develop` — `41ee8f7`: Tailwind Typography plugin (rich-text rendering).
