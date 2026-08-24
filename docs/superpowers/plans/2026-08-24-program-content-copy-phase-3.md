# Program Content Copy — Phase 3: Ownership Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split brand/program content ownership per the spec: add the new `Program` contact/SEO/landing-content columns and the `Brand.tagline` column, add a `PlatformSetting` model plus its admin screen, dump and then backfill the content living in `Brand.metadata` (both the dead camelCase keys and the ownership-split snake_case keys) onto the correct new home, repoint every consumer of `Brand.contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` (direct and relation-joined) onto the new `Program` columns, switch the two landing-read strategies over, purge all three cache layers, verify per-brand rendered output is unchanged, and only then drop the superseded `Brand` columns and metadata keys. Ships alone — it is the only phase that changes what renders on a public brand domain.

**Architecture:** Additive-then-switch. Nothing public reads the new columns until Task 15/16 flip the two landing strategies over; everything before that is schema + admin-only surfaces + data movement. Two new `ProgramCopier` registrations (`contact`, `landing`) reuse Phase 1's registry and Phase 1's generic `CopyFromProgramDialog` shell unchanged — no frontend copy-engine code is new in this phase, only two more copiers and two more `<CopyFromProgramDialog>` call sites. The `Brand.metadata` → `Program`/`PlatformSetting` data movement runs as committed, dry-run-by-default `ts-node` scripts under `services/api/scripts/`, matching this repo's existing house style for one-off backfills (see `scripts/revert-unpaid-submissions.ts`), not as raw SQL inside a Prisma migration — the per-brand branching and the Vietnam mojibake fix aren't expressible as pure DDL.

**Tech Stack:** NestJS + `@nestjs/cqrs` + Prisma 7 (API, Jest via `npx jest`), plain `ts-node -r tsconfig-paths/register` for one-off scripts under `services/api/scripts/`. Next.js 16 + React + Tailwind + sonner (admin dashboard, verified via `npx tsc --noEmit`, no FE test runner in this repo). `ybb-program-next` (Next.js 14) needs **zero code changes** in this phase — its `unstable_cache`/`revalidateTag` machinery and `/api/settings/revalidate` + `/api/home/revalidate` webhooks already exist and already work; this phase only needs to *call* them (via the existing `LandingRevalidationService`) after the read switch, for every affected brand instead of one.

**Spec:** `docs/superpowers/specs/2026-08-23-program-content-copy-design.md` — sections "Brand and program ownership split", "Fields that already exist at both levels", "Data model changes", and "Migration" are authoritative for this plan.

## Global Constraints

- **Migration order is additive-then-switch, non-negotiable:** (1) add columns, deploy — Tasks 1-9 — nothing public reads them yet; (2) dump raw metadata as a recoverable backup — Task 10; (3) backfill — Tasks 11-12; (4) repoint every direct/relation-joined consumer of the columns being dropped — Tasks 13-14; (5) switch the two landing-read strategies — Tasks 15-16; (6) purge all three cache layers and verify per-brand payload parity — Tasks 17-18; (7) only then drop the superseded `Brand` columns and metadata keys — Task 21. **No task before Task 21 may delete a `Brand` column, a `Brand.metadata` key, or a positional constructor argument that any pre-Task-21 code still reads.**
- **No task runs a migration or backfill script against production.** Every migration task's verification is `prisma migrate dev` (or `db push` in the dev/staging DB already configured in this workspace) plus `npx tsc --noEmit`; every backfill/dump script's verification is running it in its default dry-run mode against the local/dev database and inspecting the printed summary — never `--apply` against prod. Actually running `--apply` in production, and running the read-switch/cache-purge/verification runbook against production, are deployment-runbook steps this plan documents precisely but does not execute.
- **Positional-constructor hazard (carried from Phase 1's adversarial findings, worse here):** `Brand` (`core/entities/brand.entity.ts`) and `Program` (`core/entities/program.entity.ts`) are both positional-argument classes with exactly **one** call site each (`brand.repository.ts` / `program.repository.ts`, both `mapToEntity()`). New `Program` fields are appended **after** the existing last parameter (`paymentInfoHtml`), never inserted in the middle — this repo's own precedent (`brandName`, `theme`, `paymentInfoHtml` were all appended as trailing optional params, never interleaved). Task 21's column drop is the one place fields are **removed** from `Brand`'s constructor; that task's verification section spells out the exact before/after argument count check because `tsc` alone cannot be trusted here — removing several adjacent `string | null` fields can still typecheck at a shifted position if it isn't paired 1:1 with the same removal at the single call site.
- **`Brand.metadata` keys moving in this phase, by destination** (from the spec's ownership-split table, cross-checked against the actual audit in the spec's "What production actually contains" table — Japan Youth Summit and World Youth Fest have `{}` and need no backfill action beyond being no-ops):
  - **To `Program.landingContent`** (new Json column, Task 1): `benefits`, `features`, `promo_cta`, `moments_shorts`, `further_information`, `payment_info`, `participant_demographics`. **`participant_demographics` has no reader anywhere in `services/api/src` today** (confirmed by direct grep — the `participant_demographics` *section* in `home.strategy.ts` is built entirely from computed country-application stats, never from `brandMeta.participant_demographics`) and appears in exactly one brand's metadata (China). It is carried forward into the new column with zero behavior change — still unread before and after this phase — because the spec assigns it Program ownership regardless of current wiring, and dropping it silently would be a second half-finished migration of the exact kind this phase exists to fix.
  - **To `Program.contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`** (new columns, Task 1): the four `Brand` contact scalars (not metadata keys — typed columns today).
  - **To `PlatformSetting` (key `impact_stats`)**: `impact_stats`, byte-identical today on China/MEYS/Korea.
  - **To typed `Brand` columns, then the metadata keys deleted** (dead-but-recoverable, Korea/Vietnam/Youth Academic Forum only): `objectives` → `Brand.vision`, `coreValues` → `Brand.mission`, `tagline` → new `Brand.tagline` column (Task 2). Vietnam's `objectives` has a `â€¢` UTF‑8-read-as-Latin‑1 defect fixed during this backfill.
  - **Deleted with no migration** (spec: "deleted without migration"): `program_objectives` (the brand-level override of the `ProgramObjective` relation — objectives have exactly one owner after this phase).
  - **Stay on `Brand.metadata`, untouched**: `section_background`, `recognition`, `apple_icon_url`, `favicon_url`, `partners_canva_url`, `affiliateCommission` (an unrelated feature outside this spec's scope — never touch it).
- **Fields that already exist at both levels, resolved per spec, not duplicated further:** SEO — `Program` gains `metaKeywords` (Task 1) joining its existing `metaTitle`/`metaDescription`; all three drop from `Brand` in Task 21. This is a **public API contract change** — `GET /brands` and `GET /brands/:id` currently return `metaTitle`/`metaDescription`/`metaKeywords` in the unauthenticated `BrandResponseDto` (confirmed: no known reader anywhere in `services/api` or `ybb-program-next` actually consumes them, but they are shipped) — Task 21 removes them from that DTO, documented there as the breaking change it is. Payment info and Benefits are **not** merged — `Program.paymentInfoHtml`/`Program.benefitsDescription` (rich text) and the new `Program.landingContent.payment_info`/`.benefits` (structured landing sections) render in different places and both stay, per spec.
- **The `tagline`/`objectives`/`coreValues` backfill (Task 11) is independent of the read-switch machinery.** `about.strategy.ts` already reads `brand.vision`/`brand.mission` directly with no cache-snapshot indirection beyond the standard 1-hour landing cache — populating those columns makes existing code render better content with no strategy code change. It is sequenced early (right after the dump) specifically because it carries zero read-switch risk, unlike the ownership-split backfill in Task 12.
- **Contact-field consumers are not limited to the two landing strategies.** A dedicated audit (this plan's authority for Tasks 13-14) found `Brand.contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` read in 15 more places across payments, ambassadors, portal receipts, forgot-password, and support tickets — several spelled as `application.program.brand.contactEmail` (a relation-joined read a Prisma-delegate-name grep on `Brand` alone would never surface) or as an untyped `...brand` spread (`brands.controller.ts`'s `toSafeBrandResponse`). Every one of these must be repointed before Task 21 drops the columns, or they silently start reading `undefined` off a still-compiling but now-absent field — Prisma doesn't error on a removed-from-schema property access from a stale positional read, it just returns `undefined` at runtime. `services/notification` (a separate microservice) consumes these fields only from the RabbitMQ event payload's field names, never the DB directly, so it needs zero changes as long as producers keep emitting the same key names.
- **Cache purge is not observable without all three layers cleared, per brand, keyed by brand id (not slug).** Redis `landing:*` keys (`CACHE_KEYS.LANDING_HOME`/`LANDING_SETTINGS`/`LANDING_SNAPSHOT`, all keyed by `brand.id`), the Postgres `brand_landing_snapshots` table, and `ybb-program-next`'s `unstable_cache` (tags `settings`/`settings:<domain>` and `home`/`home:<domain>`, TTLs 300s/120s) — all three already have one call path each (`CacheService.invalidateBrandLandingCaches`, `prisma.brandLandingSnapshot.deleteMany`, `LandingRevalidationService.revalidateHomeAndSettingsForBrand`), unified behind `LandingCacheInvalidationService.invalidate(brandId, options)`. Task 17 calls this once per active brand; skipping it makes Task 18's before/after diff meaningless (a stale cached response would compare equal to itself, not prove anything).
- **Brands still served by the legacy PHP stack read from the legacy MySQL database and are unaffected by any of this.** They are excluded from Task 18's verification set, not reported as failures — Task 18 spells out exactly how to identify them (a brand with no `landingUrl`/`websiteUrl` pointing at the new Next.js deployment, or one absent from the `available_brands` list `settings.strategy.ts` already returns).
- **Backfill/dump script convention, matching this repo's existing `services/api/scripts/*.ts`:** plain `ts-node -r tsconfig-paths/register`, **dry-run by default**, mutation gated behind an explicit `--apply` flag (not `--dry-run` — confirmed against `scripts/revert-unpaid-submissions.ts`, `scripts/backfill-orphaned-cancellations.ts`), always writes a timestamped JSON backup/report before mutating, prints a bucketed console summary. Pure classification/mapping logic is factored into an exported, unit-tested function (matching `prisma/migration-scripts/classify-existing-form-fields.ts` + its `.spec.ts`); the DB-touching wrapper is exercised by dry-run inspection, not a Jest test against a real database.
- **`Program.landingContent` is a normalised, allow-listed Json bucket, not a second untyped index signature.** Its 7 legal top-level keys are enumerated in `program-landing-content.constants.ts` (Task 1); the update handler (Task 5) rejects any other key with `BadRequestException` — this is what "index signature dropped" means in practice here. The admin write DTO stays a loose `@IsObject() patch` (matching the existing `UpdateBrandMetadataDto` convention exactly) with the allow-list enforced in the handler, not via seven hand-written nested class-validator DTOs — the existing editor sheets already validate shape client-side, and duplicating that server-side in fully-typed nested DTOs is scope this phase doesn't need to carry.
- API test command: `npx jest --testPathPattern="<pattern>"` from `services/api/`. Typecheck: `npx tsc --noEmit -p tsconfig.json` from `services/api/`. Admin dashboard has no test runner; verify with `npx tsc --noEmit` from `services/admin-dashboard/`. `ybb-program-next` gets no code changes in this phase, so it is never a build target of any task below.

---

## File Structure

**API (`services/api/`) — schema:**
- `prisma/schema/program.prisma` — `Program` gains `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaKeywords`/`landingContent`; `Brand` gains `tagline`; `Brand` loses the 7 superseded columns (Task 21 only).
- `prisma/schema/system.prisma` — new `PlatformSetting` model.
- `prisma/migrations/20260824120000_add_program_contact_and_landing_content/migration.sql`
- `prisma/migrations/20260824121000_add_brand_tagline/migration.sql`
- `prisma/migrations/20260824122000_add_platform_settings/migration.sql`
- `prisma/migrations/20260828150000_drop_superseded_brand_columns/migration.sql` (Task 21 — must not run until Tasks 10-18 are deployed/verified AND Task 20's admin UI cutover has shipped, per the renumbering note above Task 7)

**API — new copy-engine additions (Phase 1's registry, two more copiers):**
- `src/modules/programs/application/copy/copiers/contact.copier.ts` + `.spec.ts`
- `src/modules/programs/application/copy/copiers/landing.copier.ts` + `.spec.ts`
- `src/modules/programs/application/copy/program-landing-content.constants.ts` — the 7-key allow-list, shared between the copier, the update handler, and `home.strategy.ts`.

**API — new Program content surfaces:**
- `src/modules/programs/presentation/dto/update-program-contact.dto.ts`
- `src/modules/programs/presentation/dto/update-program-landing-content.dto.ts`
- `src/modules/programs/application/commands/program-content.commands.ts` — gains `UpdateProgramContactCommand`, `UpdateProgramLandingContentCommand`.
- `src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts` — gains `UpdateProgramContactHandler`, `UpdateProgramLandingContentHandler`.
- `src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts` — new test cases for both.
- `src/modules/programs/presentation/programs.controller.ts` — gains `PUT :id/contact`, `PUT :id/landing-content`.
- `src/modules/programs/presentation/admin-programs.controller.ts` — `mapToResponse` exposes the 6 new fields.
- `src/modules/programs/presentation/dto/program-detail-response.dto.ts` — 6 new fields.
- `src/modules/programs/presentation/dto/update-program.dto.ts` — gains `metaKeywords`.

**API — new `PlatformSetting` module:**
- `prisma/schema/system.prisma` (model, listed above)
- `src/modules/platform-settings/platform-settings.module.ts`
- `src/modules/platform-settings/infrastructure/persistence/platform-setting.repository.ts`
- `src/modules/platform-settings/application/dto/impact-stats.dto.ts`
- `src/modules/platform-settings/application/services/impact-stats.service.ts` + `.spec.ts`
- `src/modules/platform-settings/presentation/platform-settings.controller.ts` + `.spec.ts`

**API — modified entities/repositories (positional-constructor hazard applies):**
- `src/core/entities/program.entity.ts`
- `src/core/entities/brand.entity.ts` (Task 2 appends `tagline`; Task 21 removes 7 fields)
- `src/modules/programs/infrastructure/persistence/program.repository.ts`
- `src/modules/brands/infrastructure/persistence/brand.repository.ts`

**API — one-off scripts (`services/api/scripts/`):**
- `scripts/dump-brand-metadata.ts` — Task 10.
- `scripts/backfill-brand-dead-keys.ts` + `.spec.ts` (pure mapping/mojibake-fix function) — Task 11.
- `scripts/backfill-program-content-ownership.ts` + `.spec.ts` (pure mapping function) — Task 12.
- `scripts/purge-landing-caches-all-brands.ts` — Task 17.
- `scripts/diff-landing-payloads.ts` — Task 18.
- `scripts/strip-migrated-brand-metadata-keys.ts` — Task 21.

**API — repointed contact-field consumers (Tasks 13-14):**
- `src/shared/utils/resolve-active-program-contact.ts` + `.spec.ts` (new shared resolver)
- `src/modules/auth/application/commands/handlers/forgot-password.handler.ts`
- `src/modules/support/application/commands/handlers/reply-support-ticket.handler.ts`
- `src/modules/support/application/commands/handlers/create-support-ticket.handler.ts`
- `src/modules/support/presentation/admin-support-tickets.controller.ts`
- `src/modules/payments/presentation/payment-admin.controller.ts`
- `src/modules/payments/presentation/payment-events.controller.ts`
- `src/modules/participants/presentation/ambassador-admin.controller.ts`
- `src/modules/portal/presentation/portal.controller.ts`
- `src/modules/portal/application/services/portal-receipt.service.ts`

**API — read switch (Tasks 15-16):**
- `src/modules/landing/strategies/settings.strategy.ts` + new `settings.strategy.spec.ts`
- `src/modules/landing/strategies/home.strategy.ts` + `home.strategy.spec.ts` (existing file, modified)

**API — column drop cleanup (Task 21):**
- `src/modules/brands/presentation/dto/brand.dto.ts`
- `src/modules/brands/presentation/dto/create-brand.dto.ts`
- `src/modules/brands/presentation/dto/update-brand-details.dto.ts`
- `src/modules/brands/presentation/brands.controller.ts` (the `toSafeBrandResponse` spread)
- `src/modules/brands/application/queries/handlers/get-brand-detail.handler.ts`
- `src/modules/brands/application/queries/handlers/list-brands.handler.ts`
- `src/modules/brands/application/commands/handlers/update-brand-details.handler.ts`
- `src/modules/brands/presentation/brands.controller.spec.ts` (fixture updates)

**Admin dashboard (`services/admin-dashboard/`) — new API client surface:**
- `app/platform/api.ts` — new types/functions: `ProgramLandingContent` (type only — no dedicated GET wrapper; it rides along on the existing admin program detail fetch), `updateProgramLandingContent`, `updateProgramContact`, `getImpactStats`, `updateImpactStats` (named for the concrete `impact-stats` endpoint Task 6 built, not a generic `PlatformSetting` wrapper — `PlatformSetting` itself stays a backend-only key/value model); `PlatformBrandDetail`/`BrandMetadata` trimmed of the 7 moved-out keys in Task 20.

**Admin dashboard — new screens:**
- `app/platform/settings/platform-content/page.tsx` — the `PlatformSetting` (Impact Stats) editor, linked from the existing `/platform/settings` hub.
- `app/programs/[programId]/master-data/program-details/page.tsx` — gains a Contact section + a Landing Page section, each with its own `<CopyFromProgramDialog>`.
- `app/components/programDetailsMasterData/program-specifics/ProgramSpecificsTab.tsx` — renders the two new sections.
- `app/components/programDetailsMasterData/landing-content/*.tsx` — the 6 editor sheets moved from `BrandDetailPage.tsx` (Benefits, Features, PromoCta, FurtherInformation, MomentsShorts, PaymentInfo).

**Admin dashboard — trimmed:**
- `app/platform/brands/[brandId]/BrandDetailPage.tsx` — `LandingPageTab` loses `BenefitsSheet`, `FeaturesSheet`, `ImpactStatsSheet`, `PromoCtaSheet`, `FurtherInformationSheet`, `MomentsShortsSheet`, `PaymentInfoSheet`, `ProgramObjectivesSheet`; `ContactSheet`/`ContactTab`/`DetailsSheet`'s contact+meta fields removed (Task 20).

---

## Task 1: Migration — `Program` gains contact, `metaKeywords`, and `landingContent` columns

**Files:**
- Modify: `services/api/prisma/schema/program.prisma` (`Program` model, currently `program.prisma:145-253`)
- Create: `services/api/prisma/migrations/20260824120000_add_program_contact_and_landing_content/migration.sql`
- Modify: `services/api/src/core/entities/program.entity.ts`
- Modify: `services/api/src/modules/programs/infrastructure/persistence/program.repository.ts` (`create()` line 159, `update()` line 215, `mapToEntity()` line 284)
- Modify: `services/api/src/modules/programs/presentation/dto/update-program.dto.ts` (add `metaKeywords`, alongside the existing `metaTitle`/`metaDescription` at lines 164/169)
- Modify: `services/api/src/modules/programs/presentation/dto/program-detail-response.dto.ts` (add 6 fields, alongside `metaTitle`/`metaDescription` at lines 435/438)
- Modify: `services/api/src/modules/programs/presentation/admin-programs.controller.ts` (`mapToResponse`, currently exposes `metaTitle`/`metaDescription` at lines 95-96)
- Create: `services/api/src/modules/programs/application/copy/program-landing-content.constants.ts`

**Interfaces:**
- Produces: `Program.contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaKeywords`/`landingContent` (Prisma scalar + entity field); `PROGRAM_LANDING_CONTENT_KEYS` (the 7-key allow-list) and `ProgramLandingContent` (TS shape) — Tasks 5, 7, 8, 16 all import these exact names from `program-landing-content.constants.ts`.

This task is compile-verified, not TDD — it is pure schema + plumbing with no new branching logic (matching Phase 1 Task 4's precedent for schema-only tasks). `landingContent` is deliberately **not** read by any strategy yet; nothing changes at runtime for any existing request.

- [ ] **Step 1: Add the columns to the Prisma schema**

In `services/api/prisma/schema/program.prisma`, inside `model Program { ... }`, add after the existing SEO block (currently lines 199-201):

```prisma
  // Contact Information (program-owned — see docs/superpowers/specs/2026-08-23-program-content-copy-design.md)
  contactEmail    String? @map("contact_email") @db.VarChar(255)
  contactPhone    String? @map("contact_phone") @db.VarChar(50)
  contactWhatsapp String? @map("contact_whatsapp") @db.VarChar(50)
  contactAddress  String? @map("contact_address") @db.Text

  // SEO
  metaTitle       String? @map("meta_title") @db.VarChar(255)
  metaDescription String? @map("meta_description") @db.Text
  metaKeywords    String? @map("meta_keywords") @db.Text

  // Program-owned landing sections, normalised replacement for the
  // program-scoped subset of the old Brand.metadata index signature. Legal
  // top-level keys are enumerated in program-landing-content.constants.ts —
  // the update handler (Task 5) rejects any other key.
  landingContent Json @default("{}") @map("landing_content") @db.Json
```

(The existing `metaTitle`/`metaDescription` lines are replaced in place by the block above — `metaKeywords` is new, the other two are unchanged.)

- [ ] **Step 2: Write the migration SQL**

```sql
-- services/api/prisma/migrations/20260824120000_add_program_contact_and_landing_content/migration.sql

-- Additive only. Nothing reads these columns yet — see Global Constraints
-- in docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md for
-- why this must deploy alone before any backfill or read-switch task runs.
ALTER TABLE "programs"
  ADD COLUMN IF NOT EXISTS "contact_email" VARCHAR(255),
  ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "contact_whatsapp" VARCHAR(50),
  ADD COLUMN IF NOT EXISTS "contact_address" TEXT,
  ADD COLUMN IF NOT EXISTS "meta_keywords" TEXT,
  ADD COLUMN IF NOT EXISTS "landing_content" JSON NOT NULL DEFAULT '{}';
```

- [ ] **Step 3: Add the landing-content allow-list constants**

```typescript
// services/api/src/modules/programs/application/copy/program-landing-content.constants.ts

// The 7 Brand.metadata keys the ownership split moves onto Program (see
// spec's "Brand and program ownership split" table). This is the single
// source of truth for "what's a legal top-level key in
// Program.landingContent" — imported by the update handler (rejects
// anything else), the landing copier (Task 8), and home.strategy.ts
// (Task 16) so the three can never drift out of sync with each other.
export const PROGRAM_LANDING_CONTENT_KEYS = [
  'benefits',
  'features',
  'promo_cta',
  'moments_shorts',
  'further_information',
  'payment_info',
  // No reader anywhere in services/api/src today — see Global Constraints.
  // Carried forward with the same (lack of) behavior, not newly wired up.
  'participant_demographics',
] as const;

export type ProgramLandingContentKey = (typeof PROGRAM_LANDING_CONTENT_KEYS)[number];

// Loose on purpose — each key's internal shape is validated informally by
// the admin editor sheets that write it (same trust boundary as the
// Brand.metadata patch endpoint it replaces), not by nested class-validator
// DTOs. See Global Constraints for why.
export type ProgramLandingContent = Partial<Record<ProgramLandingContentKey, unknown>>;

export function isProgramLandingContentKey(key: string): key is ProgramLandingContentKey {
  return (PROGRAM_LANDING_CONTENT_KEYS as readonly string[]).includes(key);
}
```

- [ ] **Step 4: Wire the new fields into the `Program` entity (append-only)**

In `services/api/src/core/entities/program.entity.ts`, append after the existing trailing optional params (currently `paymentInfoHtml?: string | null,` at line 49) — **do not** insert these anywhere else in the constructor, per the positional-constructor hazard in Global Constraints:

```typescript
        public readonly brandName?: string | null,
        public readonly theme?: string | null,
        public readonly paymentInfoHtml?: string | null,
        public readonly contactEmail?: string | null,
        public readonly contactPhone?: string | null,
        public readonly contactWhatsapp?: string | null,
        public readonly contactAddress?: string | null,
        public readonly metaKeywords?: string | null,
        public readonly landingContent?: Record<string, unknown>,
    ) { }
}
```

- [ ] **Step 5: Wire the new fields into `program.repository.ts`**

Add to `create()`'s `data:` block (after `paymentInfoHtml: data.paymentInfoHtml,` at line 159):

```typescript
                paymentInfoHtml: data.paymentInfoHtml,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                contactWhatsapp: data.contactWhatsapp,
                contactAddress: data.contactAddress,
                metaKeywords: data.metaKeywords,
                landingContent: (data.landingContent ?? {}) as Prisma.InputJsonValue,
```

Add the identical block to `update()`'s `data:` block (after `paymentInfoHtml: data.paymentInfoHtml,` at line 215) — same six lines, `data.landingContent` may legitimately be `undefined` on update (leaves the column unchanged), so use `data.landingContent as Prisma.InputJsonValue | undefined` there instead of defaulting to `{}`:

```typescript
                paymentInfoHtml: data.paymentInfoHtml,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                contactWhatsapp: data.contactWhatsapp,
                contactAddress: data.contactAddress,
                metaKeywords: data.metaKeywords,
                landingContent: data.landingContent as Prisma.InputJsonValue | undefined,
```

Append to `mapToEntity()`'s positional call (after `prismaEntity.paymentInfoHtml ?? null,` at line 284):

```typescript
            prismaEntity.paymentInfoHtml ?? null,
            prismaEntity.contactEmail ?? null,
            prismaEntity.contactPhone ?? null,
            prismaEntity.contactWhatsapp ?? null,
            prismaEntity.contactAddress ?? null,
            prismaEntity.metaKeywords ?? null,
            (prismaEntity.landingContent as Record<string, unknown>) ?? {},
        );
```

- [ ] **Step 6: Expose `metaKeywords` on the general program update DTO**

In `services/api/src/modules/programs/presentation/dto/update-program.dto.ts`, add after the existing `metaDescription` field (line 169) — `UpdateProgramHandler` already spreads `{ ...updateProgramDto }` straight into `programRepository.update()` (confirmed by reading `update-program.handler.ts`), so this field needs no handler change to take effect:

```typescript
    @ApiPropertyOptional({ description: 'SEO keywords, comma-separated' })
    @IsOptional()
    @IsString()
    metaKeywords?: string;
```

- [ ] **Step 7: Expose all 6 new fields on the program detail response**

In `services/api/src/modules/programs/presentation/dto/program-detail-response.dto.ts`, add after the existing `metaDescription` field (line 438):

```typescript
  @ApiPropertyOptional() metaKeywords?: string;
  @ApiPropertyOptional() contactEmail?: string;
  @ApiPropertyOptional() contactPhone?: string;
  @ApiPropertyOptional() contactWhatsapp?: string;
  @ApiPropertyOptional() contactAddress?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true }) landingContent?: Record<string, unknown>;
```

In `services/api/src/modules/programs/presentation/admin-programs.controller.ts`, add to the object literal in `mapToResponse` (after `metaDescription: program.metaDescription ?? null,` at line 96):

```typescript
        metaDescription: program.metaDescription ?? null,
        metaKeywords: program.metaKeywords ?? null,
        contactEmail: program.contactEmail ?? null,
        contactPhone: program.contactPhone ?? null,
        contactWhatsapp: program.contactWhatsapp ?? null,
        contactAddress: program.contactAddress ?? null,
        landingContent: (program.landingContent as Record<string, unknown>) ?? {},
```

- [ ] **Step 8: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 9: Apply the migration to the local/dev database and sanity-check**

Run (from `services/api/`): `npx prisma migrate dev` (creates and applies the migration against the dev DB configured in this workspace — **never run against production**, per Global Constraints).
Then: `npx prisma studio` or a one-off `npx ts-node -e "..."` to confirm `SELECT contact_email, landing_content FROM programs LIMIT 1;` returns `NULL`/`{}` for existing rows — proves the migration is additive and non-destructive.

- [ ] **Step 10: Commit**

```bash
cd services/api
git add prisma/schema/program.prisma prisma/migrations/20260824120000_add_program_contact_and_landing_content src/core/entities/program.entity.ts src/modules/programs/infrastructure/persistence/program.repository.ts src/modules/programs/presentation/dto/update-program.dto.ts src/modules/programs/presentation/dto/program-detail-response.dto.ts src/modules/programs/presentation/admin-programs.controller.ts src/modules/programs/application/copy/program-landing-content.constants.ts
git commit -m "feat(programs): add contact, metaKeywords, and landingContent columns to Program"
```

---

## Task 2: Migration — `Brand` gains `tagline`, and the DTO/list-endpoint gap is closed

**Files:**
- Modify: `services/api/prisma/schema/program.prisma` (`Brand` model, currently `program.prisma:5-81`)
- Create: `services/api/prisma/migrations/20260824121000_add_brand_tagline/migration.sql`
- Modify: `services/api/src/core/entities/brand.entity.ts`
- Modify: `services/api/src/modules/brands/infrastructure/persistence/brand.repository.ts` (`update()` line 122, `mapToEntity()` line ~226)
- Modify: `services/api/src/modules/brands/presentation/dto/brand.dto.ts` (`BrandResponseDto`)
- Modify: `services/api/src/modules/brands/presentation/dto/update-brand-details.dto.ts`
- Modify: `services/api/src/modules/brands/application/commands/handlers/update-brand-details.handler.ts` (both the `brandRepository.update()` call and `mapToDto`)
- Modify: `services/api/src/modules/brands/application/queries/handlers/get-brand-detail.handler.ts`
- Modify: `services/api/src/modules/brands/application/queries/handlers/list-brands.handler.ts`

**Interfaces:**
- Produces: `Brand.tagline` — Task 11's backfill script writes it; `GET /brands` and `GET /brands/:id` return it.

This closes a real, live rendering gap noted in the spec: `ybb-program-next`'s `navbar.tsx:173` and `lib/api/settings.ts:71` already read `brand.tagline` from the `/v1/brands` list response and silently fall back to `brand.description` because the field has never existed on `Brand`. No `ybb-program-next` code changes — it already expects this field.

- [ ] **Step 1: Add the column**

In `services/api/prisma/schema/program.prisma`, inside `model Brand { ... }`, add after `description` (line 8):

```prisma
  description String?   @db.Text
  tagline     String?   @db.VarChar(255)
```

- [ ] **Step 2: Migration SQL**

```sql
-- services/api/prisma/migrations/20260824121000_add_brand_tagline/migration.sql
ALTER TABLE "brands" ADD COLUMN IF NOT EXISTS "tagline" VARCHAR(255);
```

- [ ] **Step 3: Append to the `Brand` entity constructor**

In `services/api/src/core/entities/brand.entity.ts`, append after the last existing param (`programCount?: number,` at line 50) — appended, not interleaved with the SEO block, for the same positional-hazard reason as Task 1:

```typescript
        public readonly settings?: BrandSetting | null,
        public readonly programCount?: number,
        public readonly tagline?: string | null,
    ) { }
}
```

- [ ] **Step 4: Wire into the repository**

In `brand.repository.ts`, add to `update()`'s `data:` block (after `metaKeywords: data.metaKeywords,` at line 138):

```typescript
                metaKeywords: data.metaKeywords,
                tagline: data.tagline,
```

Append to `mapToEntity()`'s positional `new Brand(...)` call, at the very end (after the existing last arguments — read the file to find the exact current tail before editing, since Phase 1/Task-1-of-this-plan work may have shifted nothing here but confirm live):

```typescript
            prismaEntity.tagline ?? null,
        );
```

- [ ] **Step 5: Expose it on the response DTO and the two read handlers**

In `services/api/src/modules/brands/presentation/dto/brand.dto.ts`, add near `description` (line ~40):

```typescript
    tagline?: string | null;
```

In `get-brand-detail.handler.ts` and `list-brands.handler.ts`, add to the returned object (near the `description`/`about` lines in each):

```typescript
            tagline: brand.tagline || null,
```

- [ ] **Step 6: Add it to the details-update DTO and handler**

In `update-brand-details.dto.ts`, add near `description`:

```typescript
    @ApiProperty({ required: false, example: 'Empowering the next generation of global leaders' })
    @IsOptional()
    @IsString()
    tagline?: string;
```

In `update-brand-details.handler.ts`, add `tagline: dto.tagline,` to both the `brandRepository.update()` call (near `about: dto.about,`) and `mapToDto` (near `dto.about = brand.about;`).

- [ ] **Step 7: Verify it compiles, migrate the dev DB**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — expect no errors.
Run: `npx prisma migrate dev` against the local/dev DB.

- [ ] **Step 8: Commit**

```bash
cd services/api
git add prisma/schema/program.prisma prisma/migrations/20260824121000_add_brand_tagline src/core/entities/brand.entity.ts src/modules/brands/infrastructure/persistence/brand.repository.ts src/modules/brands/presentation/dto/brand.dto.ts src/modules/brands/presentation/dto/update-brand-details.dto.ts src/modules/brands/application/commands/handlers/update-brand-details.handler.ts src/modules/brands/application/queries/handlers/get-brand-detail.handler.ts src/modules/brands/application/queries/handlers/list-brands.handler.ts
git commit -m "feat(brands): add tagline column, close the dead navbar tagline read"
```

---

## Task 3: Migration — `PlatformSetting` model and repository

**Files:**
- Modify: `services/api/prisma/schema/system.prisma`
- Create: `services/api/prisma/migrations/20260824122000_add_platform_settings/migration.sql`
- Create: `services/api/src/modules/platform-settings/platform-settings.module.ts`
- Create: `services/api/src/modules/platform-settings/infrastructure/persistence/platform-setting.repository.ts` + `.spec.ts`
- Modify: `services/api/src/app.module.ts` (register `PlatformSettingsModule`)

**Interfaces:**
- Produces: `PlatformSetting` Prisma model; `PlatformSettingRepository.get(key)` / `.upsert(key, value, updatedBy)` — Task 6's `ImpactStatsService` and Task 16's `home.strategy.ts` both depend on these exact method names.

A generic key-value table, not a single-purpose `impact_stats` table — the spec frames this as "organisation-wide values" (plural); a `key`/`value` shape means a second platform setting never needs a new migration. `impact_stats` is the only row seeded by this phase.

- [ ] **Step 1: Add the model**

In `services/api/prisma/schema/system.prisma`, add after `MigrationTracking`:

```prisma
// Organisation-wide, non-brand-scoped values. Distinct from BrandSetting
// (brand-scoped) — see docs/superpowers/specs/2026-08-23-program-content-copy-design.md,
// "There is no platform-level settings home" finding. Generic key/value so a
// second platform setting never needs a schema migration.
model PlatformSetting {
  id        String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  key       String   @unique @db.VarChar(100)
  value     Json     @db.Json
  updatedAt DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  updatedBy String?  @map("updated_by") @db.Uuid

  @@map("platform_settings")
}
```

- [ ] **Step 2: Migration SQL**

```sql
-- services/api/prisma/migrations/20260824122000_add_platform_settings/migration.sql
CREATE TABLE "platform_settings" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "key" VARCHAR(100) NOT NULL,
    "value" JSON NOT NULL,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "updated_by" UUID,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_settings_key_key" ON "platform_settings"("key");
```

- [ ] **Step 3: Write the failing repository test**

```typescript
// services/api/src/modules/platform-settings/infrastructure/persistence/platform-setting.repository.spec.ts
import { PlatformSettingRepository } from './platform-setting.repository';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(existing?: { key: string; value: unknown }): PrismaService {
  const base: any = {
    platformSetting: {
      findUnique: jest.fn().mockResolvedValue(existing ? { ...existing, updatedAt: new Date(), updatedBy: null } : null),
      upsert: jest.fn().mockImplementation(({ create }: any) => Promise.resolve({ ...create, updatedAt: new Date() })),
    },
  };
  return base as PrismaService;
}

describe('PlatformSettingRepository', () => {
  it('get() returns null when the key has never been set', async () => {
    const prisma = mkPrisma();
    const repo = new PlatformSettingRepository(prisma);
    expect(await repo.get('impact_stats')).toBeNull();
  });

  it('get() returns the stored value for an existing key', async () => {
    const prisma = mkPrisma({ key: 'impact_stats', value: { total_alumni: '1700+' } });
    const repo = new PlatformSettingRepository(prisma);
    const result = await repo.get('impact_stats');
    expect(result?.value).toEqual({ total_alumni: '1700+' });
  });

  it('upsert() writes via key-based upsert, not a raw update', async () => {
    const prisma = mkPrisma();
    const repo = new PlatformSettingRepository(prisma);
    await repo.upsert('impact_stats', { total_alumni: '1700+' }, 'user-1');
    expect((prisma as any).platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: 'impact_stats' },
      create: { key: 'impact_stats', value: { total_alumni: '1700+' }, updatedBy: 'user-1' },
      update: { value: { total_alumni: '1700+' }, updatedBy: 'user-1' },
    });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="platform-setting.repository.spec"`
Expected: FAIL — cannot find module `./platform-setting.repository`.

- [ ] **Step 5: Write the repository**

```typescript
// services/api/src/modules/platform-settings/infrastructure/persistence/platform-setting.repository.ts
import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

export interface PlatformSettingRow {
  key: string;
  value: unknown;
  updatedAt: Date;
  updatedBy: string | null;
}

@Injectable()
export class PlatformSettingRepository {
  constructor(private readonly prisma: PrismaService) {}

  async get(key: string): Promise<PlatformSettingRow | null> {
    const row = await this.prisma.platformSetting.findUnique({ where: { key } });
    if (!row) return null;
    return { key: row.key, value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }

  async upsert(key: string, value: unknown, updatedBy: string | null): Promise<PlatformSettingRow> {
    const row = await this.prisma.platformSetting.upsert({
      where: { key },
      create: { key, value: value as Prisma.InputJsonValue, updatedBy },
      update: { value: value as Prisma.InputJsonValue, updatedBy },
    });
    return { key: row.key, value: row.value, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="platform-setting.repository.spec"`
Expected: PASS — 3 passing tests.

- [ ] **Step 7: Module scaffold and registration**

```typescript
// services/api/src/modules/platform-settings/platform-settings.module.ts
import { Module } from '@nestjs/common';
import { PlatformSettingRepository } from './infrastructure/persistence/platform-setting.repository';

@Module({
  providers: [PlatformSettingRepository],
  exports: [PlatformSettingRepository],
})
export class PlatformSettingsModule {}
```

Register `PlatformSettingsModule` in `services/api/src/app.module.ts`'s `imports` array, alongside the other feature modules.

- [ ] **Step 8: Verify it compiles, migrate the dev DB**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run: `npx prisma migrate dev` against the local/dev DB.

- [ ] **Step 9: Commit**

```bash
cd services/api
git add prisma/schema/system.prisma prisma/migrations/20260824122000_add_platform_settings src/modules/platform-settings src/app.module.ts
git commit -m "feat(platform-settings): add PlatformSetting model and repository"
```

---

## Task 4: `PUT /programs/:id/contact` (TDD)

**Files:**
- Create: `services/api/src/modules/programs/presentation/dto/update-program-contact.dto.ts`
- Modify: `services/api/src/modules/programs/application/commands/program-content.commands.ts` (add `UpdateProgramContactCommand`, alongside `UpdateProgramPaymentInfoCommand` at line 269)
- Modify: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts` (add `UpdateProgramContactHandler`, alongside `UpdateProgramPaymentInfoHandler` at line 1691)
- Modify: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts`
- Modify: `services/api/src/modules/programs/presentation/programs.controller.ts` (add `PUT :id/contact`, alongside `PUT :id/payment-info` at line 191)
- Modify: `services/api/src/modules/programs/programs.module.ts` (register the new command handler)

**Interfaces:**
- Consumes: `Program.contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` (Task 1); `invalidateLandingCacheByProgramId` (existing, `manage-program-content.handlers.ts:45`).
- Produces: `UpdateProgramContactCommand`, `UpdateProgramContactHandler` — Task 7 (`ContactCopier`) does **not** depend on these (copiers write via `tx.program.update` directly, never through the command bus — see Task 7), but Task 19's admin UI does.

Mirrors `UpdateProgramPaymentInfoDto`/`Command`/`Handler` exactly — same shape, same admin-only guard, same `@CacheInvalidate(PROGRAM_CONTENT_PATTERNS)` decorator.

- [ ] **Step 1: Write the failing handler tests**

Add to `manage-program-content.handlers.spec.ts` (append a new `describe` block, following the file's existing style — it already tests sibling handlers from the same file with a mocked `IProgramContentRepository`/`IProgramRepository`):

```typescript
describe('UpdateProgramContactHandler', () => {
  it('replaces all four contact fields and invalidates landing caches', async () => {
    const programRepository = { findById: jest.fn().mockResolvedValue({ id: 'prog-1' }), update: jest.fn().mockResolvedValue({ id: 'prog-1' }) };
    const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-1' }) } };
    const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
    const handler = new UpdateProgramContactHandler(programRepository as any, prisma as any, landingCacheInvalidation as any);

    await handler.execute(new UpdateProgramContactCommand('prog-1', {
      contactEmail: 'hello@example.com',
      contactPhone: '+62811',
      contactWhatsapp: '62811',
      contactAddress: 'Jakarta',
    }, 'user-1'));

    expect(programRepository.update).toHaveBeenCalledWith('prog-1', {
      contactEmail: 'hello@example.com',
      contactPhone: '+62811',
      contactWhatsapp: '62811',
      contactAddress: 'Jakarta',
    });
    expect(landingCacheInvalidation.invalidate).toHaveBeenCalledWith('brand-1', expect.objectContaining({ revalidate: { kind: 'homeAndSettings' } }));
  });

  it('clears a field when the DTO sends it as undefined/omitted — omitted fields become null, not left unchanged', async () => {
    // Matches UpdateProgramPaymentInfoHandler's documented resolution: this
    // endpoint replaces the whole contact block, it does not patch.
    const programRepository = { findById: jest.fn().mockResolvedValue({ id: 'prog-1' }), update: jest.fn().mockResolvedValue({ id: 'prog-1' }) };
    const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-1' }) } };
    const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
    const handler = new UpdateProgramContactHandler(programRepository as any, prisma as any, landingCacheInvalidation as any);

    await handler.execute(new UpdateProgramContactCommand('prog-1', { contactEmail: 'hello@example.com' }, 'user-1'));

    expect(programRepository.update).toHaveBeenCalledWith('prog-1', {
      contactEmail: 'hello@example.com',
      contactPhone: null,
      contactWhatsapp: null,
      contactAddress: null,
    });
  });

  it('throws NotFoundException when the program does not exist', async () => {
    const programRepository = { findById: jest.fn().mockResolvedValue(null), update: jest.fn() };
    const handler = new UpdateProgramContactHandler(programRepository as any, {} as any, {} as any);
    await expect(handler.execute(new UpdateProgramContactCommand('missing', {}, 'user-1'))).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="manage-program-content.handlers.spec"`
Expected: FAIL — `UpdateProgramContactHandler`/`UpdateProgramContactCommand` are not defined.

- [ ] **Step 3: Write the DTO**

```typescript
// services/api/src/modules/programs/presentation/dto/update-program-contact.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString } from 'class-validator';
import { NormalizeEmail } from '@shared/decorators/normalize-email.decorator';

// Field-for-field mirror of update-brand-details.dto.ts's contact block —
// same validators, now owned by Program instead of Brand.
export class UpdateProgramContactDto {
  @ApiProperty({ required: false, example: 'contact@example.com' })
  @IsOptional()
  @NormalizeEmail()
  @IsEmail()
  contactEmail?: string;

  @ApiProperty({ required: false, example: '+628123456789' })
  @IsOptional()
  @IsString()
  contactPhone?: string;

  @ApiProperty({ required: false, example: '628123456789' })
  @IsOptional()
  @IsString()
  contactWhatsapp?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  contactAddress?: string;
}
```

(`@shared/decorators/normalize-email.decorator` confirmed against `update-brand-details.dto.ts:4` — same import, verbatim.)

- [ ] **Step 4: Add the command**

In `program-content.commands.ts`, add alongside `UpdateProgramPaymentInfoCommand`:

```typescript
export class UpdateProgramContactCommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UpdateProgramContactDto,
        public readonly userId: string,
    ) { }
}
```

- [ ] **Step 5: Write the handler**

In `manage-program-content.handlers.ts`, add alongside `UpdateProgramPaymentInfoHandler`:

```typescript
@CommandHandler(UpdateProgramContactCommand)
export class UpdateProgramContactHandler implements ICommandHandler<UpdateProgramContactCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramContactCommand): Promise<void> {
        const program = await this.programRepository.findById(command.programId);
        if (!program) {
            throw new NotFoundException(`Program ${command.programId} not found`);
        }

        // Replaces the whole block, like updatePaymentInfo — omitted fields
        // clear to null rather than being left as a stale partial patch.
        await this.programRepository.update(command.programId, {
            contactEmail: command.dto.contactEmail ?? null,
            contactPhone: command.dto.contactPhone ?? null,
            contactWhatsapp: command.dto.contactWhatsapp ?? null,
            contactAddress: command.dto.contactAddress ?? null,
        });

        await invalidateLandingCacheByProgramId(command.programId, this.prisma, this.landingCacheInvalidation);
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest --testPathPattern="manage-program-content.handlers.spec"`
Expected: PASS.

- [ ] **Step 7: Add the controller route**

In `programs.controller.ts`, add alongside `updatePaymentInfo` (after line 211):

```typescript
  @Put(':id/contact')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Replace program contact information' })
  @ApiResponse({ status: 200, description: 'Contact info updated successfully' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateContact(
    @Param('id') id: string,
    @Body() dto: UpdateProgramContactDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.commandBus.execute(new UpdateProgramContactCommand(id, dto, req.user.id));
    return { message: 'Contact info updated successfully' };
  }
```

Add the two new imports (`UpdateProgramContactCommand`, `UpdateProgramContactDto`) at the top of the file, alongside the existing payment-info ones.

- [ ] **Step 8: Register the handler in `programs.module.ts`**

Add `UpdateProgramContactHandler` to the `providers` array, alongside `UpdateProgramPaymentInfoHandler`.

- [ ] **Step 9: Verify compile and the full programs suite**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run: `npx jest --testPathPattern="modules/programs"` — PASS.

- [ ] **Step 10: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/dto/update-program-contact.dto.ts src/modules/programs/application/commands/program-content.commands.ts src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts src/modules/programs/presentation/programs.controller.ts src/modules/programs/programs.module.ts
git commit -m "feat(programs): add PUT /programs/:id/contact"
```

---

## Task 5: `PUT /programs/:id/landing-content` with a 7-key allow-list (TDD)

**Files:**
- Create: `services/api/src/modules/programs/presentation/dto/update-program-landing-content.dto.ts`
- Modify: `services/api/src/modules/programs/application/commands/program-content.commands.ts`
- Modify: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts`
- Modify: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts`
- Modify: `services/api/src/modules/programs/presentation/programs.controller.ts`
- Modify: `services/api/src/modules/programs/programs.module.ts`

**Interfaces:**
- Consumes: `PROGRAM_LANDING_CONTENT_KEYS`, `isProgramLandingContentKey` (Task 1).
- Produces: `UpdateProgramLandingContentCommand`/`Handler` — Task 19's admin UI editor sheets call this.

Partial-merge semantics (like the existing `UpdateBrandMetadataDto`/`UpdateBrandMetadataHandler` it's modeled on), but every top-level key in the patch is checked against the allow-list first — this is the "index signature dropped" half of the ownership split.

- [ ] **Step 1: Write the failing handler tests**

```typescript
describe('UpdateProgramLandingContentHandler', () => {
  it('merges the patch into the existing landingContent', async () => {
    const programRepository = {
      findById: jest.fn().mockResolvedValue({ id: 'prog-1', landingContent: { benefits: { title: 'Old' } } }),
      update: jest.fn().mockResolvedValue({ id: 'prog-1' }),
    };
    const prisma = { program: { findUnique: jest.fn().mockResolvedValue({ brandId: 'brand-1' }) } };
    const landingCacheInvalidation = { invalidate: jest.fn().mockResolvedValue(undefined) };
    const handler = new UpdateProgramLandingContentHandler(programRepository as any, prisma as any, landingCacheInvalidation as any);

    await handler.execute(new UpdateProgramLandingContentCommand('prog-1', { patch: { features: [{ title: 'New' }] } }, 'user-1'));

    expect(programRepository.update).toHaveBeenCalledWith('prog-1', {
      landingContent: { benefits: { title: 'Old' }, features: [{ title: 'New' }] },
    });
  });

  it('rejects a patch containing a key outside the 7-key allow-list', async () => {
    const programRepository = { findById: jest.fn().mockResolvedValue({ id: 'prog-1', landingContent: {} }), update: jest.fn() };
    const handler = new UpdateProgramLandingContentHandler(programRepository as any, {} as any, {} as any);

    await expect(
      handler.execute(new UpdateProgramLandingContentCommand('prog-1', { patch: { tagline: 'nope' } }, 'user-1')),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(programRepository.update).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the program does not exist', async () => {
    const programRepository = { findById: jest.fn().mockResolvedValue(null), update: jest.fn() };
    const handler = new UpdateProgramLandingContentHandler(programRepository as any, {} as any, {} as any);
    await expect(
      handler.execute(new UpdateProgramLandingContentCommand('missing', { patch: {} }, 'user-1')),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest --testPathPattern="manage-program-content.handlers.spec"` — FAIL, symbols undefined.

- [ ] **Step 3: Write the DTO**

```typescript
// services/api/src/modules/programs/presentation/dto/update-program-landing-content.dto.ts
import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

// Loose object, like UpdateBrandMetadataDto — the 7-key allow-list is
// enforced in the handler (program-landing-content.constants.ts), not here.
export class UpdateProgramLandingContentDto {
  @ApiProperty({
    description: 'Partial landingContent object. Top-level keys are merged into existing content. Legal keys: benefits, features, promo_cta, moments_shorts, further_information, payment_info, participant_demographics.',
    example: { benefits: { eyebrow: 'Program Benefits', title: 'Built for Students', groups: [] } },
  })
  @IsObject()
  patch!: Record<string, unknown>;
}
```

- [ ] **Step 4: Add the command**

```typescript
export class UpdateProgramLandingContentCommand {
    constructor(
        public readonly programId: string,
        public readonly dto: UpdateProgramLandingContentDto,
        public readonly userId: string,
    ) { }
}
```

- [ ] **Step 5: Write the handler**

```typescript
@CommandHandler(UpdateProgramLandingContentCommand)
export class UpdateProgramLandingContentHandler implements ICommandHandler<UpdateProgramLandingContentCommand> {
    constructor(
        @Inject('IProgramRepository') private readonly programRepository: IProgramRepository,
        private readonly prisma: PrismaService,
        private readonly landingCacheInvalidation: LandingCacheInvalidationService,
    ) {}

    async execute(command: UpdateProgramLandingContentCommand): Promise<void> {
        const program = await this.programRepository.findById(command.programId);
        if (!program) {
            throw new NotFoundException(`Program ${command.programId} not found`);
        }

        const unknownKeys = Object.keys(command.dto.patch).filter((key) => !isProgramLandingContentKey(key));
        if (unknownKeys.length > 0) {
            throw new BadRequestException({
                code: 'unknown_landing_content_key',
                message: `Unknown landingContent key(s): ${unknownKeys.join(', ')}. Legal keys: ${PROGRAM_LANDING_CONTENT_KEYS.join(', ')}.`,
            });
        }

        const existing = (program.landingContent as Record<string, unknown>) ?? {};
        const merged = { ...existing, ...command.dto.patch };

        await this.programRepository.update(command.programId, { landingContent: merged });
        await invalidateLandingCacheByProgramId(command.programId, this.prisma, this.landingCacheInvalidation);
    }
}
```

Add the import: `import { PROGRAM_LANDING_CONTENT_KEYS, isProgramLandingContentKey } from '../../copy/program-landing-content.constants';` (adjust the relative path to the actual file location).

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx jest --testPathPattern="manage-program-content.handlers.spec"` — PASS.

- [ ] **Step 7: Add the controller route**

```typescript
  @Put(':id/landing-content')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Update program-owned landing page content (partial merge)' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async updateLandingContent(
    @Param('id') id: string,
    @Body() dto: UpdateProgramLandingContentDto,
    @Request() req: AuthenticatedRequest,
  ) {
    await this.commandBus.execute(new UpdateProgramLandingContentCommand(id, dto, req.user.id));
    return { message: 'Landing content updated successfully' };
  }
```

- [ ] **Step 8: Register the handler, verify compile + suite**

Add `UpdateProgramLandingContentHandler` to `programs.module.ts`'s `providers`.
Run: `npx tsc --noEmit -p tsconfig.json` then `npx jest --testPathPattern="modules/programs"` — both clean.

- [ ] **Step 9: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/dto/update-program-landing-content.dto.ts src/modules/programs/application/commands/program-content.commands.ts src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts src/modules/programs/presentation/programs.controller.ts src/modules/programs/programs.module.ts
git commit -m "feat(programs): add PUT /programs/:id/landing-content with a 7-key allow-list"
```

---

## Task 6: `PlatformSettingsController` — GET/PUT impact stats (TDD)

**Files:**
- Create: `services/api/src/modules/platform-settings/application/dto/impact-stats.dto.ts`
- Create: `services/api/src/modules/platform-settings/application/services/impact-stats.service.ts` + `.spec.ts`
- Create: `services/api/src/modules/platform-settings/presentation/platform-settings.controller.ts` + `.spec.ts`
- Modify: `services/api/src/modules/platform-settings/platform-settings.module.ts`

**Interfaces:**
- Consumes: `PlatformSettingRepository` (Task 3).
- Produces: `ImpactStatsService.get()`/`.update()`, `GET /platform-settings/impact-stats`, `PUT /platform-settings/impact-stats` — Task 19's admin screen calls the HTTP routes; Task 16's `home.strategy.ts` calls `PlatformSettingRepository` directly (server-side, no HTTP hop).

- [ ] **Step 1: Write the failing service tests**

```typescript
// services/api/src/modules/platform-settings/application/services/impact-stats.service.spec.ts
import { ImpactStatsService } from './impact-stats.service';
import { PlatformSettingRepository } from '../../infrastructure/persistence/platform-setting.repository';

describe('ImpactStatsService', () => {
  it('get() returns null fields when nothing has been set yet', async () => {
    const repo = { get: jest.fn().mockResolvedValue(null), upsert: jest.fn() } as unknown as PlatformSettingRepository;
    const service = new ImpactStatsService(repo);
    expect(await service.get()).toEqual({
      totalAlumni: null,
      editionsHeld: null,
      totalCountries: null,
      totalParticipants: null,
    });
  });

  it('get() maps the stored snake_case JSON to camelCase', async () => {
    const repo = {
      get: jest.fn().mockResolvedValue({
        key: 'impact_stats',
        value: { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' },
        updatedAt: new Date(),
        updatedBy: null,
      }),
      upsert: jest.fn(),
    } as unknown as PlatformSettingRepository;
    const service = new ImpactStatsService(repo);
    expect(await service.get()).toEqual({
      totalAlumni: '1700+',
      editionsHeld: '15+',
      totalCountries: '50+',
      totalParticipants: '1700+',
    });
  });

  it('update() upserts under the impact_stats key in snake_case, merged with the existing value', async () => {
    const repo = {
      get: jest.fn().mockResolvedValue({ key: 'impact_stats', value: { total_alumni: '1700+' }, updatedAt: new Date(), updatedBy: null }),
      upsert: jest.fn().mockResolvedValue({ key: 'impact_stats', value: {}, updatedAt: new Date(), updatedBy: 'user-1' }),
    } as unknown as PlatformSettingRepository;
    const service = new ImpactStatsService(repo);

    await service.update({ editionsHeld: '16+' }, 'user-1');

    expect(repo.upsert).toHaveBeenCalledWith(
      'impact_stats',
      { total_alumni: '1700+', editions_held: '16+' },
      'user-1',
    );
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="impact-stats.service.spec"` — FAIL, module not found.

- [ ] **Step 3: Write the DTO**

```typescript
// services/api/src/modules/platform-settings/application/dto/impact-stats.dto.ts
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

// Values are display strings today ("1700+", "15+") not numbers — matches
// the shape already live in Brand.metadata.impact_stats across China/MEYS/Korea.
export class ImpactStatsDto {
  @ApiPropertyOptional() @IsOptional() @IsString() totalAlumni?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() editionsHeld?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() totalCountries?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() totalParticipants?: string;
}

export interface ImpactStats {
  totalAlumni: string | null;
  editionsHeld: string | null;
  totalCountries: string | null;
  totalParticipants: string | null;
}
```

- [ ] **Step 4: Write the service**

```typescript
// services/api/src/modules/platform-settings/application/services/impact-stats.service.ts
import { Injectable } from '@nestjs/common';
import { PlatformSettingRepository } from '../../infrastructure/persistence/platform-setting.repository';
import { ImpactStats, ImpactStatsDto } from '../dto/impact-stats.dto';

const IMPACT_STATS_KEY = 'impact_stats';

type RawImpactStats = {
  total_alumni?: string;
  editions_held?: string;
  total_countries?: string;
  total_participants?: string;
};

@Injectable()
export class ImpactStatsService {
  constructor(private readonly repository: PlatformSettingRepository) {}

  async get(): Promise<ImpactStats> {
    const row = await this.repository.get(IMPACT_STATS_KEY);
    const raw = (row?.value as RawImpactStats) ?? {};
    return {
      totalAlumni: raw.total_alumni ?? null,
      editionsHeld: raw.editions_held ?? null,
      totalCountries: raw.total_countries ?? null,
      totalParticipants: raw.total_participants ?? null,
    };
  }

  async update(patch: ImpactStatsDto, updatedBy: string): Promise<ImpactStats> {
    const row = await this.repository.get(IMPACT_STATS_KEY);
    const existing = (row?.value as RawImpactStats) ?? {};
    const merged: RawImpactStats = {
      ...existing,
      ...(patch.totalAlumni !== undefined && { total_alumni: patch.totalAlumni }),
      ...(patch.editionsHeld !== undefined && { editions_held: patch.editionsHeld }),
      ...(patch.totalCountries !== undefined && { total_countries: patch.totalCountries }),
      ...(patch.totalParticipants !== undefined && { total_participants: patch.totalParticipants }),
    };
    await this.repository.upsert(IMPACT_STATS_KEY, merged, updatedBy);
    return this.get();
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest --testPathPattern="impact-stats.service.spec"` — PASS, 3 tests.

- [ ] **Step 6: Write the controller (thin, admin-guarded)**

```typescript
// services/api/src/modules/platform-settings/presentation/platform-settings.controller.ts
import { Body, Controller, Get, Put, Request, UseGuards } from '@nestjs/common';
import { Request as ExpressRequest } from 'express';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { ImpactStatsService } from '../application/services/impact-stats.service';
import { ImpactStatsDto } from '../application/dto/impact-stats.dto';

// This codebase has no shared AuthenticatedRequest type — every controller
// declares its own local copy (confirmed across programs.controller.ts,
// program-announcements.controller.ts, program-application.controller.ts,
// etc.). Matching that convention here rather than introducing a shared one.
interface AuthenticatedRequest extends ExpressRequest {
  user: { id: string; userId: string; email: string; brandId: string };
}

@ApiTags('Platform Settings')
@ApiBearerAuth()
@Controller('platform-settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN)
export class PlatformSettingsController {
  constructor(private readonly impactStatsService: ImpactStatsService) {}

  @Get('impact-stats')
  @ApiOperation({ summary: 'Get organisation-wide impact stats (total alumni, editions, countries, participants)' })
  async getImpactStats() {
    return this.impactStatsService.get();
  }

  @Put('impact-stats')
  @ApiOperation({ summary: 'Update organisation-wide impact stats' })
  async updateImpactStats(@Body() dto: ImpactStatsDto, @Request() req: AuthenticatedRequest) {
    return this.impactStatsService.update(dto, req.user.id);
  }
}
```

Gated to `SUPER_ADMIN` only, not `ADMIN` — this is organisation-wide, not brand-scoped, unlike every other admin-guarded route in this plan.

- [ ] **Step 7: Controller test**

```typescript
// services/api/src/modules/platform-settings/presentation/platform-settings.controller.spec.ts
import { PlatformSettingsController } from './platform-settings.controller';
import { ImpactStatsService } from '../application/services/impact-stats.service';

describe('PlatformSettingsController', () => {
  it('getImpactStats() delegates to the service', async () => {
    const service = { get: jest.fn().mockResolvedValue({ totalAlumni: '1700+' }), update: jest.fn() } as unknown as ImpactStatsService;
    const controller = new PlatformSettingsController(service);
    expect(await controller.getImpactStats()).toEqual({ totalAlumni: '1700+' });
  });

  it('updateImpactStats() passes the authenticated user id through', async () => {
    const service = { get: jest.fn(), update: jest.fn().mockResolvedValue({ totalAlumni: '1800+' }) } as unknown as ImpactStatsService;
    const controller = new PlatformSettingsController(service);
    const result = await controller.updateImpactStats({ totalAlumni: '1800+' }, { user: { id: 'user-1' } } as any);
    expect(service.update).toHaveBeenCalledWith({ totalAlumni: '1800+' }, 'user-1');
    expect(result).toEqual({ totalAlumni: '1800+' });
  });
});
```

- [ ] **Step 8: Run, wire into the module, verify compile**

Run: `npx jest --testPathPattern="platform-settings.controller.spec"` — PASS.
Update `platform-settings.module.ts` to add `PlatformSettingsController` to `controllers` and `ImpactStatsService` to `providers`.
Run: `npx tsc --noEmit -p tsconfig.json` — no errors.

- [ ] **Step 9: Commit**

```bash
cd services/api
git add src/modules/platform-settings
git commit -m "feat(platform-settings): add GET/PUT /platform-settings/impact-stats"
```

---

> **Numbering note (self-review correction):** the admin-UI task was originally sketched as Task 21 and the column-drop task as Task 19 (see the early references inside Tasks 4-6's Interfaces sections and the File Structure section above). Working through Tasks 13-22 below surfaced a real sequencing bug in that sketch: the old Brand-level admin UI (`ContactSheet`, `DetailsSheet`, and the six `LandingPageTab` sheets in `BrandDetailPage.tsx`) writes through `PUT /brands/:id/details` and `PUT /brands/:brandId/metadata`, both of which stay live and unvalidated-by-schema (`Brand.metadata` is a loose Json column) right up until the column-drop task. If that old UI were still live when the column-drop task strips `Brand.metadata`'s moved keys, the next admin who opens the old Benefits/Features/etc. sheet and clicks Save would silently **resurrect** the just-stripped key — the write would succeed (loose JSON, no rejection), but nothing would read it any more (Task 16 already switched `home.strategy.ts` onto `Program.landingContent`), so the admin's edit would silently vanish from the live site with no error anywhere. The fix is ordering, not code: the new admin UI must exist and the old admin UI must be removed **before** the column drop runs, not after. Tasks below are renumbered accordingly — new admin UI is now **Task 19**, old-UI removal is **Task 20**, and the column drop is now **Task 21** (all cross-references above and in Tasks 4-6 have been updated to match). Task 16 (`home.strategy.ts`) keeps its original number — that one was already sequenced correctly.

---

## Task 7: `ContactCopier` — scalar copier for the four `Program` contact fields

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/contact.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/contact.copier.spec.ts`

**Interfaces:**
- Consumes: `Program.contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` (Task 1); the `ProgramCopier`, `CopyInput`, `CopyPreviewItem`, `CopyResult`, `PrismaTx` types from `program-copier.interface.ts` (Phase 1, unchanged in this phase).
- Produces: `ContactCopier` (`key: 'contact'`). Not yet reachable from any HTTP route — Task 9 registers it in `ProgramCopierRegistry` via `programs.module.ts`, at which point the **existing, unmodified** generic routes (`GET /programs/copy/:entityKey/counts`, `GET /programs/:programId/copy/:entityKey/preview`, `POST /programs/:programId/copy/:entityKey` in `program-copy.controller.ts`) serve it automatically for `entityKey: 'contact'` — no new controller code, in this task or Task 9.

Structurally identical to `ProgramDetailsCopier` (Task 1's closest analogue, already in the codebase): four scalars on the `Program` row itself, no id, no order, no dedupe key, no soft-delete, so this copier talks to `tx.program` directly rather than through `copyScopedRows`. The one real difference: `contactAddress` is `@db.Text` but is free-form plain text, never Tiptap-authored HTML (the admin editor is a plain `<textarea>`, confirmed in `BrandDetailPage.tsx`'s existing `ContactSheet` — `FieldTextarea`, not `RichTextEditor`). So this copier's blank-check is a plain `trim().length === 0`, not `ProgramDetailsCopier`'s tag-stripping `isBlankRichText`, and `preview()` never sets `hasExternalMedia` — there is no markup for a `<img>`/`<iframe>`/`<video>` tag to hide in.

- [ ] **Step 1: Write the failing spec**

```typescript
// services/api/src/modules/programs/application/copy/copiers/contact.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ContactCopier } from './contact.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type ProgramFixture = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactAddress: string | null;
};

function mkPrisma(programs: Record<string, ProgramFixture>): PrismaService {
  const base: any = {
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(programs[where.id] ?? null)),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('ContactCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ContactCopier(mkPrisma({}));
    expect(copier.key).toBe('contact');
    expect(copier.label).toBe('Contact Information');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies all four fields onto a target with no prior content', async () => {
    const prisma = mkPrisma({
      src: { contactEmail: 'hello@example.com', contactPhone: '+62811', contactWhatsapp: '62811', contactAddress: 'Jakarta' },
      // tgt intentionally absent — findUnique('tgt') resolves null, so the
      // target starts with nothing to overwrite.
    });
    const copier = new ContactCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { contactEmail: 'hello@example.com', contactPhone: '+62811', contactWhatsapp: '62811', contactAddress: 'Jakarta' },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('replace reports replaced: 1 when the target already had contact info that got overwritten', async () => {
    const prisma = mkPrisma({
      src: { contactEmail: 'new@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
      tgt: { contactEmail: 'old@example.com', contactPhone: '+62800', contactWhatsapp: null, contactAddress: null },
    });
    const copier = new ContactCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('rejects append mode', async () => {
    const prisma = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Data-loss guard, same shape as ProgramDetailsCopier's: a source with no
  // content in any of the four fields would overwrite the target's populated
  // contact info with four blanks. Mixes null/whitespace/'' to prove all
  // three count as "no content".
  it('rejects replace from a source with no contact info in any of the four fields', async () => {
    const prisma = mkPrisma({ src: { contactEmail: null, contactPhone: '   ', contactWhatsapp: null, contactAddress: '' } });
    const copier = new ContactCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('replace proceeds when only one of the four fields has content, blanking the other three on the target', async () => {
    const prisma = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('preview() returns an empty array when the source program has no contact info', async () => {
    const prisma = mkPrisma({ src: { contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    expect(await copier.preview('src')).toEqual([]);
  });

  // Plain strings, not markup — preview() must never set hasExternalMedia
  // for this copier (contrast with ProgramDetailsCopier, which does).
  it('preview() returns one item describing how many of the four fields have content, and never sets hasExternalMedia', async () => {
    const prisma = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: '+62811', contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 'src', label: 'Contact Information', meta: '2 field(s) with content' }]);
    expect(items[0].hasExternalMedia).toBeUndefined();
  });

  it('countFor() returns 1 when any field has content, 0 when the program has none or does not exist', async () => {
    const prisma = mkPrisma({ src: { contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null } });
    const copier = new ContactCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="contact.copier.spec"`
Expected: FAIL — cannot find module `./contact.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/contact.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';

/**
 * Scalar copier for the four Program-owned contact fields (Task 1's
 * migration: contactEmail/contactPhone/contactWhatsapp/contactAddress).
 * Structurally identical to ProgramDetailsCopier: no id, no order, no
 * dedupe key, no soft-delete — talks to tx.program directly rather than
 * through copyScopedRows.
 */
type ProgramContactScalars = {
  contactEmail: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactAddress: string | null;
};

const SELECT = { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true } as const;

// Plain strings, not Tiptap HTML — contactAddress is @db.Text but free text
// (the admin editor is a plain <textarea>, not RichTextEditor), so a
// straight trim-and-check is enough here, unlike ProgramDetailsCopier's
// tag-stripping isBlankRichText.
function isBlank(value: string | null): boolean {
  return !value || value.trim().length === 0;
}

function contentFieldCount(program: ProgramContactScalars): number {
  return [program.contactEmail, program.contactPhone, program.contactWhatsapp, program.contactAddress].filter(
    (value) => !isBlank(value),
  ).length;
}

@Injectable()
export class ContactCopier implements ProgramCopier {
  readonly key = 'contact';
  readonly label = 'Contact Information';

  // Same reasoning as ProgramDetailsCopier: four scalars on the Program row,
  // nothing to append to, only something to overwrite.
  readonly supportsAppend = false;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return 0;
    return contentFieldCount(program) > 0 ? 1 : 0;
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return [];
    const count = contentFieldCount(program);
    if (count === 0) return [];
    return [
      {
        id: programId,
        label: 'Contact Information',
        meta: `${count} field(s) with content`,
        // hasExternalMedia deliberately omitted — plain strings carry no
        // media references, unlike ProgramDetailsCopier's Tiptap fields.
      },
    ];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'contact only supports replace mode.',
      });
    }

    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) {
      throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    }

    // Same data-loss guard as ProgramDetailsCopier: a source with no content
    // in any of the four fields would overwrite the target's populated
    // contact info with four blanks, indistinguishable from wiping it.
    if (contentFieldCount(source) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          'The source program has no contact information to copy. Add at least one contact field on the source program, then try again.',
      });
    }

    const target = await tx.program.findUnique({ where: { id: input.targetProgramId }, select: SELECT });
    const targetHadContent = target !== null && contentFieldCount(target) > 0;

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: {
        contactEmail: source.contactEmail,
        contactPhone: source.contactPhone,
        contactWhatsapp: source.contactWhatsapp,
        contactAddress: source.contactAddress,
      },
    });

    return { created: 1, skipped: 0, replaced: targetHadContent ? 1 : 0 };
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="contact.copier.spec"`
Expected: PASS — 9 passing tests.

- [ ] **Step 5: Verify compile**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors. (`ContactCopier` is not yet imported anywhere, so this only proves the file itself is well-typed — registration and the resulting unused-provider risk are Task 9's concern.)

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/contact.copier.ts src/modules/programs/application/copy/copiers/contact.copier.spec.ts
git commit -m "feat(programs): add ContactCopier (program-copy registry, unregistered)"
```

---

## Task 8: `LandingCopier` — scalar copier for `Program.landingContent`

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/landing.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/landing.copier.spec.ts`

**Interfaces:**
- Consumes: `Program.landingContent`, `PROGRAM_LANDING_CONTENT_KEYS`, `ProgramLandingContent` (all Task 1, from `program-landing-content.constants.ts`); `ProgramCopier`/`CopyInput`/`CopyPreviewItem`/`CopyResult`/`PrismaTx` (Phase 1).
- Produces: `LandingCopier` (`key: 'landing'`). Same as Task 7 — unreachable until Task 9 registers it; then the existing generic copy routes serve `entityKey: 'landing'` automatically.

Also a scalar copier (one JSON bucket, not a row collection), but unlike `ContactCopier`'s four independent strings, `landingContent`'s "how much content" question is per-key: it has up to 7 legal top-level keys (the allow-list from Task 1), and each key's own shape is an opaque `unknown` — the type is deliberately loose (see Task 1's `ProgramLandingContent`, `Partial<Record<ProgramLandingContentKey, unknown>>`). So "blank" here means "the key is absent, or present but empty" (`null`/`undefined`, an empty array, or an empty object), checked structurally rather than by trimming a string.

One more difference from both `ProgramDetailsCopier` and `ContactCopier`: those two never set `hasExternalMedia` (Tiptap markup is pattern-matched for the former; the latter has no media surface at all). `landingContent` sections are known, from their field names, to carry literal image/video URLs — `moments_shorts` is short-form video content, `benefits.groups[].imageUrl` and `further_information.mockup_image_url` are images (confirmed against the actual admin editor shapes in `BrandDetailPage.tsx`'s `BenefitsSheet`/`FurtherInformationSheet`). But `landingContent`'s type is intentionally untyped `unknown` past the top-level key (Task 1's own design decision — "loose on purpose", see `program-landing-content.constants.ts`), so there is no reliable per-key media pattern to detect the way `ProgramDetailsCopier` detects `<img>` in known HTML fields. Rather than under-warn (silently skip the cross-brand warning on a section that does carry another brand's media URLs), this copier sets `hasExternalMedia: true` unconditionally whenever it has any content to preview at all — a copier is allowed to over-warn (the dialog's warning is advisory text, not a block), but under-warning here would silently ship another brand's asset URLs onto this brand's landing page with no notice, which is exactly the failure mode the flag exists to prevent.

- [ ] **Step 1: Write the failing spec**

```typescript
// services/api/src/modules/programs/application/copy/copiers/landing.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { LandingCopier } from './landing.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(programs: Record<string, { landingContent: Record<string, unknown> | null }>): PrismaService {
  const base: any = {
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(programs[where.id] ?? null)),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('LandingCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new LandingCopier(mkPrisma({}));
    expect(copier.key).toBe('landing');
    expect(copier.label).toBe('Landing Page Content');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies the whole landingContent object onto a target with no prior content', async () => {
    const prisma = mkPrisma({
      src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] } },
      // tgt absent — findUnique('tgt') resolves null.
    });
    const copier = new LandingCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] } },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('replace reports replaced: 1 when the target already had landing content that got overwritten', async () => {
    const prisma = mkPrisma({
      src: { landingContent: { promo_cta: { title: 'New' } } },
      tgt: { landingContent: { promo_cta: { title: 'Old' } } },
    });
    const copier = new LandingCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  // Defensive filter: PROGRAM_LANDING_CONTENT_KEYS is the allow-list
  // enforced by the update handler (Task 5), but this copier reads
  // landingContent straight off the row, not through that handler — a stray
  // key (e.g. from a bug, or a pre-allow-list backfill) must not propagate
  // to the target.
  it('drops any key outside the 7-key allow-list when copying, without erroring', async () => {
    const prisma = mkPrisma({
      src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, not_a_real_key: 'stray' } },
    });
    const copier = new LandingCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] } } },
    });
  });

  it('rejects append mode', async () => {
    const prisma = mkPrisma({ src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] } } } });
    const copier = new LandingCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // Empty is the default state (Task 1's column default is '{}') and must
  // not be treated as an error to refuse copying FROM — this test is about
  // the guard specifically, using a source whose landingContent has zero
  // populated keys.
  it('rejects replace from a source with no populated keys (empty object)', async () => {
    const prisma = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  // A key present but structurally empty (empty array, empty object) counts
  // as no content, same as an absent key — mirrors the admin editor's own
  // "cleared this section" state (e.g. BenefitsSheet saving groups: []).
  it('treats a present-but-structurally-empty key as no content', async () => {
    const prisma = mkPrisma({ src: { landingContent: { benefits: { eyebrow: '', title: '', groups: [] }, features: [] } } });
    const copier = new LandingCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('replace proceeds when only one of the seven keys has content', async () => {
    const prisma = mkPrisma({ src: { landingContent: { moments_shorts: { eyebrow: 'e', title: 't', description: 'd' } } } });
    const copier = new LandingCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { landingContent: { moments_shorts: { eyebrow: 'e', title: 't', description: 'd' } } },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('preview() returns an empty array when the source has no populated keys', async () => {
    const prisma = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    expect(await copier.preview('src')).toEqual([]);
  });

  it('preview() returns one item describing how many of the seven keys have content, with hasExternalMedia always true when non-empty', async () => {
    const prisma = mkPrisma({
      src: { landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, promo_cta: { title: 'x' } } },
    });
    const copier = new LandingCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 'src', label: 'Landing Page Sections', meta: '2 section(s) with content', hasExternalMedia: true }]);
  });

  it('countFor() returns 1 when any key has content, 0 when the program has none or does not exist', async () => {
    const prisma = mkPrisma({ src: { landingContent: { features: [{ id: 'f1' }] } } });
    const copier = new LandingCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });

  it('countFor() returns 0 for a program whose landingContent is the column default ({})', async () => {
    const prisma = mkPrisma({ src: { landingContent: {} } });
    const copier = new LandingCopier(prisma);
    expect(await copier.countFor('src')).toBe(0);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="landing.copier.spec"`
Expected: FAIL — cannot find module `./landing.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/landing.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { PROGRAM_LANDING_CONTENT_KEYS, isProgramLandingContentKey } from '../program-landing-content.constants';

const SELECT = { landingContent: true } as const;

// landingContent's per-key shape is deliberately untyped (unknown) — see
// program-landing-content.constants.ts. "Has content" is checked
// structurally rather than by field-specific inspection: null/undefined is
// empty, an empty array or empty object is empty (mirrors the admin
// editor's own "cleared this section" state, e.g. groups: []), anything
// else counts.
function hasContent(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'object') return Object.keys(value as object).length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  return Boolean(value);
}

function countPopulatedKeys(content: Record<string, unknown>): number {
  return PROGRAM_LANDING_CONTENT_KEYS.filter((key) => hasContent(content[key])).length;
}

// Belt-and-suspenders filter to the allow-list. The update handler (Task 5)
// already enforces this on every write that goes through it, but this
// copier reads landingContent straight off the row — defend against a stray
// key from any write path that didn't go through that handler (a raw
// backfill script, a future bug) propagating to the target.
function filterToAllowedKeys(content: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(content).filter(([key]) => isProgramLandingContentKey(key)));
}

@Injectable()
export class LandingCopier implements ProgramCopier {
  readonly key = 'landing';
  readonly label = 'Landing Page Content';

  // One JSON bucket on the Program row — nothing to append to, same
  // reasoning as ProgramDetailsCopier/ContactCopier.
  readonly supportsAppend = false;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return 0;
    const content = (program.landingContent as Record<string, unknown>) ?? {};
    return countPopulatedKeys(content) > 0 ? 1 : 0;
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) return [];
    const content = (program.landingContent as Record<string, unknown>) ?? {};
    const count = countPopulatedKeys(content);
    if (count === 0) return [];
    return [
      {
        id: programId,
        label: 'Landing Page Sections',
        meta: `${count} section(s) with content`,
        // Always true when there's any content at all — see this task's
        // description for why per-key media detection isn't reliable
        // against an intentionally untyped bucket, and why over-warning
        // here is the safer failure mode than under-warning.
        hasExternalMedia: true,
      },
    ];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'landing only supports replace mode.',
      });
    }

    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) {
      throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    }

    const sourceContent = (source.landingContent as Record<string, unknown>) ?? {};
    if (countPopulatedKeys(sourceContent) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message:
          'The source program has no landing page content to copy. Add content to at least one section on the source program, then try again.',
      });
    }

    const target = await tx.program.findUnique({ where: { id: input.targetProgramId }, select: SELECT });
    const targetHadContent =
      target !== null && countPopulatedKeys((target.landingContent as Record<string, unknown>) ?? {}) > 0;

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: { landingContent: filterToAllowedKeys(sourceContent) as Prisma.InputJsonValue },
    });

    return { created: 1, skipped: 0, replaced: targetHadContent ? 1 : 0 };
  }
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="landing.copier.spec"`
Expected: PASS — 12 passing tests.

- [ ] **Step 5: Verify compile**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/landing.copier.ts src/modules/programs/application/copy/copiers/landing.copier.spec.ts
git commit -m "feat(programs): add LandingCopier (program-copy registry, unregistered)"
```

---

## Task 9: Register `ContactCopier` and `LandingCopier` in the copy registry

**Files:**
- Modify: `services/api/src/modules/programs/programs.module.ts` (the `providers` array and the `ProgramCopierRegistry` factory's `inject` array, currently `programs.module.ts:161-181` at the end of the "Program Content Copy" block)

**Interfaces:**
- Consumes: `ContactCopier` (Task 7), `LandingCopier` (Task 8), the existing `ProgramCopierRegistry`/`ProgramCopier` (Phase 1, unchanged).
- Produces: a `ProgramCopierRegistry` instance whose `.list()` now includes 9 copiers (the 7 from Phase 1 plus `contact` and `landing`) — nothing downstream imports this fact by name; it becomes observable through the generic `program-copy.controller.ts` routes for `entityKey: 'contact'` and `entityKey: 'landing'`.

`ProgramCopierRegistry`'s constructor is variadic (`constructor(...copiers: ProgramCopier[])`), and `programs.module.ts` wires it with a `useFactory`/`inject` pair rather than Nest's usual class-provider shorthand, specifically so the registry itself stays framework-agnostic (it takes plain constructor args, not decorated Nest injection). That means a new copier is invisible to the registry until **both** halves are updated together: the copier class added to `providers` (so Nest can construct it at all) and the copier class added to the factory's `inject` array (so Nest passes the constructed instance into the factory call). Missing either half fails differently — omit it from `providers` and Nest throws `Nest can't resolve dependencies of the ProgramCopierRegistry` at bootstrap (`inject` names a token Nest never registered); omit it from `inject` only and the copier compiles, is constructible, sits unused, and **silently never appears in the registry** — no error at all, `entityKey: 'contact'` just keeps 404ing with `unknown_copy_entity` forever. The second failure mode is exactly why this gets a task of its own rather than being folded into Tasks 7/8: it doesn't fail loud, so it needs its own deliberate verification step, not an assumption that "the copier compiles, so it must be wired."

This task is compile/bootstrap-verified, not TDD, matching Task 1's and Task 3's precedent for pure-wiring changes — there's no new branching logic to unit-test, and `ProgramCopierRegistry`'s own spec (`program-copier.registry.spec.ts`) is already generic over fake copiers (see the file — it uses a `fakeCopier(key)` helper, not the real `ContactCopier`/`LandingCopier`), so it does not need any change here and does not, by itself, catch the "compiles but never reaches the factory" failure mode above. Verification for that specific failure is the runtime bootstrap check in Step 3 below.

- [ ] **Step 1: Add the two imports and providers entries**

In `services/api/src/modules/programs/programs.module.ts`, add two imports alongside the existing copier imports (after `import { ProgramDetailsCopier } from './application/copy/copiers/program-details.copier';`):

```typescript
import { ContactCopier } from './application/copy/copiers/contact.copier';
import { LandingCopier } from './application/copy/copiers/landing.copier';
```

In the `providers` array, add both classes alongside the existing copiers (after `ProgramDetailsCopier,`, before the `ProgramCopierRegistry` factory entry):

```typescript
    // Program Content Copy
    FormFieldsCopier,
    ParticipationCategoriesCopier,
    TimelinesCopier,
    RundownsCopier,
    FaqsCopier,
    PaymentsCopier,
    ProgramDetailsCopier,
    ContactCopier,
    LandingCopier,
    {
      provide: ProgramCopierRegistry,
      useFactory: (...copiers: ProgramCopier[]) => new ProgramCopierRegistry(...copiers),
      inject: [
        FormFieldsCopier,
        ParticipationCategoriesCopier,
        TimelinesCopier,
        RundownsCopier,
        FaqsCopier,
        PaymentsCopier,
        ProgramDetailsCopier,
        ContactCopier,
        LandingCopier,
      ],
    },
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — no errors. (This alone does **not** prove the registration is wired correctly — see the silent-failure mode described above. It only proves the two new provider tokens are valid TypeScript.)

- [ ] **Step 3: Verify the copiers are actually reachable through the registry (bootstrap smoke check)**

This repo has no `app.module.spec.ts`-style bootstrap test that would catch an `inject`-array omission automatically (confirmed — no file named `*bootstrap*.spec.ts` or `app.module.spec.ts` exists under `services/api/`), so this step is a manual runtime check, not a new automated test:

Run (from `services/api/`): `npm run start:dev`, wait for `Nest application successfully started` (a bootstrap-time DI failure, e.g. an `inject` token Nest can't resolve, throws and crashes startup here — this is the loud failure mode from the description above, and this step catches it). Then, against a program id that exists in the local/dev DB:

```bash
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:3000/programs/copy/contact/counts?programIds=<a-real-program-id>"
curl -s -H "Authorization: Bearer $ADMIN_JWT" \
  "http://localhost:3000/programs/copy/landing/counts?programIds=<a-real-program-id>"
```

Expected for both: `200 OK` with a JSON array like `[{"programId":"<id>","count":0}]` (or `1`, depending on whether that program already has contact/landing content) — **not** a `404` with `{"code":"unknown_copy_entity", ...}`. A 404 here is exactly the silent-failure mode this task exists to catch: it means the copier class compiled and is constructible, but never made it into the registry's map because it's missing from the factory's `inject` array despite being in `providers` (or vice versa). If either curl 404s, re-check that the same copier class appears in **both** `providers` and `inject` in Step 1 — the two arrays are edited independently and a partial edit is the actual bug class this step exists to catch.

- [ ] **Step 4: Run the existing programs module suite**

Run: `npx jest --testPathPattern="modules/programs"` — PASS. (Proves nothing about registry wiring specifically — see above — but confirms Steps 1's edit didn't regress any handler that already depended on the surrounding module providers list, e.g. via an accidental duplicate provider token.)

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/programs.module.ts
git commit -m "feat(programs): register ContactCopier and LandingCopier in the copy registry"
```

---

## Task 10: `dump-brand-metadata.ts` — recoverable backup of every brand's raw `metadata` **and the seven typed columns Task 21 drops**

**Files:**
- Create: `services/api/scripts/dump-brand-metadata.ts`

**Interfaces:**
- Consumes: `Brand.metadata` (existing column, unchanged by this phase until Task 21).
- Produces: a timestamped JSON backup file under `services/api/scripts/backups/` — the recoverable copy of every brand's raw metadata that the spec's Migration section and Global Constraints both require to exist **before** Task 11/12's backfills or Task 21's key strip touch anything. Nothing downstream imports this file programmatically; it exists purely as a human-recoverable artifact, matching this repo's existing `scripts/*.ts` convention (`revert-unpaid-submissions.ts` writes an equivalent backup before its own mutation).

Read-only — this script never writes to Postgres, so unlike every other script in this phase it has no `--apply` flag to gate. It has no branching/classification logic either (a straight `SELECT` plus `JSON.stringify`), so unlike Tasks 11-12 there is no pure function worth factoring out into a separately-unit-tested module — unit-testing "does `JSON.stringify` round-trip an object" would test the standard library, not this script. Verification is running it and inspecting the output, per the Global Constraints convention for this phase's scripts.

- [ ] **Step 1: Write the script**

```typescript
// services/api/scripts/dump-brand-metadata.ts
/**
 * dump-brand-metadata.ts
 *
 * Phase 3 step 1 of the ownership-split migration (see
 * docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md, Task
 * 10). Dumps the RAW Brand.metadata JSON for every non-deleted brand to a
 * timestamped backup file before anything backfills, switches reads, or
 * strips keys (Tasks 11, 12, 21).
 *
 * Read-only. Makes no changes to the database. Not gated behind --apply —
 * there is nothing to gate; this script never writes to Postgres.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register scripts/dump-brand-metadata.ts
 *
 * NEVER run this against production from an interactive agent session — see
 * this plan's Global Constraints. Running it against production, like every
 * other script in this phase, is a separate human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface BrandMetadataDump {
    brandId: string;
    brandName: string;
    brandSlug: string;
    metadata: unknown;
    // The seven TYPED columns Task 21 also drops. These are NOT part of
    // `metadata`, so dumping metadata alone does not back them up. Task 12's
    // backfill deliberately skips a field when the target Program already has
    // a value, and skips entirely when a brand has no published+active program
    // — for those fields the Brand value would otherwise exist nowhere once
    // Task 21 runs, recoverable only via Postgres PITR. Dump them here.
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    metaKeywords: string | null;
}

async function main(): Promise<void> {
    const brands = await prisma.brand.findMany({
        where: { deletedAt: null },
        select: {
            id: true, name: true, slug: true, metadata: true,
            contactEmail: true, contactPhone: true, contactWhatsapp: true,
            contactAddress: true, metaTitle: true, metaDescription: true,
            metaKeywords: true,
        },
        orderBy: { name: 'asc' },
    });

    const dump: BrandMetadataDump[] = brands.map((b) => ({
        brandId: b.id,
        brandName: b.name,
        brandSlug: b.slug,
        metadata: b.metadata,
        contactEmail: b.contactEmail,
        contactPhone: b.contactPhone,
        contactWhatsapp: b.contactWhatsapp,
        contactAddress: b.contactAddress,
        metaTitle: b.metaTitle,
        metaDescription: b.metaDescription,
        metaKeywords: b.metaKeywords,
    }));

    const backupDir = join(__dirname, 'backups');
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `dump-brand-metadata-${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify(dump, null, 2));

    console.log(`[dump-brand-metadata] dumped metadata for ${dump.length} brand(s) -> ${backupPath}`);
    console.table(
        dump.map((d) => ({
            brand: d.brandName,
            keys:
                d.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata)
                    ? Object.keys(d.metadata as object).length
                    : 0,
        })),
    );
}

main()
    .catch((err) => {
        console.error('[dump-brand-metadata] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — no errors. Scripts under `services/api/scripts/` are excluded from the Jest `testPathPattern` (no `.spec.ts` here), so this and Step 3 are the only verification for this task.

- [ ] **Step 3: Run it against the local/dev database and inspect the output**

Run (from `services/api/`, `DATABASE_URL` pointing at the local/dev DB — never production):

```bash
npx ts-node -r tsconfig-paths/register scripts/dump-brand-metadata.ts
```

Expected: a `services/api/scripts/backups/dump-brand-metadata-<timestamp>.json` file is created, and the printed `console.table` shows one row per non-deleted brand with a `keys` count. Open the JSON file and confirm every brand present in the dev DB appears with its actual `metadata` object verbatim (not summarized/truncated) — this file is what Tasks 11-12's backfills are cross-checked against if a discrepancy ever needs investigating, and what a human would restore from if a later step in this phase ever needs reverting.

- [ ] **Step 4: Commit**

```bash
cd services/api
git add scripts/dump-brand-metadata.ts
git commit -m "feat(scripts): add dump-brand-metadata.ts (Phase 3 pre-backfill backup)"
```

Do **not** commit anything under `scripts/backups/` — it is a local run artifact (matching `revert-unpaid-submissions.ts`'s existing convention; confirm `scripts/backups/` is covered by an existing `.gitignore` entry before committing, and add one if it is not already present).

---

## Task 11: `backfill-brand-dead-keys.ts` — `tagline`/`objectives`/`coreValues` into typed `Brand` columns

**Files:**
- Create: `services/api/scripts/backfill-brand-dead-keys.ts`
- Create: `services/api/scripts/backfill-brand-dead-keys.spec.ts`

**Interfaces:**
- Consumes: `Brand.metadata.tagline`/`.objectives`/`.coreValues` (read-only); `Brand.vision`/`.mission`/`.tagline` (Task 2's new column) — writes these three.
- Produces: `planBrandDeadKeysBackfill()`, `fixMojibakeBullets()` — pure, exported, unit-tested functions; no other task consumes them.

Finishes the migration the earlier seed (`prisma/seeds/internal/migrate-brands.ts`) started and the production ETL (`migration-scripts/legacy-content/migrate-legacy-content.cjs:72`) left half-done — see the spec's "Brand and program ownership split" section for the full history. Targets exactly three brands per the spec's audit: Korea Youth Summit, Vietnam Youth Summit, Youth Academic Forum. Sequenced right after the dump (Task 10) and before the ownership-split backfill (Task 12) because it is independent of the read-switch machinery — `about.strategy.ts` already reads `brand.vision`/`brand.mission` directly (no cache-snapshot indirection beyond the standard landing cache), so populating these columns only makes existing code render better content, with zero behavior change for any brand not in the target set.

This task backfills the **typed columns only**. It does **not** touch `Brand.metadata` — the dead keys stay in place, dead but recoverable, until Task 21 strips them (after Tasks 15-16's read switch and Task 18's verification confirm nothing regressed). Deleting them here, before that verification, would be the exact "delete now, worry about ownership later" mistake the spec's adversarial review already caught once (see the spec's "Backfilled into typed `Brand` columns, then removed" decision and its three supporting facts).

- [ ] **Step 1: Write the failing spec for the pure mapping/mojibake-fix functions**

```typescript
// services/api/scripts/backfill-brand-dead-keys.spec.ts
import { fixMojibakeBullets, planBrandDeadKeysBackfill } from './backfill-brand-dead-keys';

describe('fixMojibakeBullets', () => {
  it('replaces the UTF-8-read-as-Latin-1 bullet artifact with a real bullet', () => {
    expect(fixMojibakeBullets('Leadership â€¢ Networking â€¢ Culture')).toBe('Leadership • Networking • Culture');
  });

  it('leaves text with no mojibake artifact unchanged', () => {
    expect(fixMojibakeBullets('Leadership, Networking, Culture')).toBe('Leadership, Networking, Culture');
  });

  it('leaves an already-correct bullet character unchanged', () => {
    expect(fixMojibakeBullets('Leadership • Networking')).toBe('Leadership • Networking');
  });
});

describe('planBrandDeadKeysBackfill', () => {
  it('returns null for a brand with empty metadata ({}) — Japan/World Youth Fest no-op case', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-japan', brandName: 'Japan Youth Summit', metadata: {},
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toBeNull();
  });

  it('returns null for a brand whose metadata has other keys but none of the three dead keys', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-china', brandName: 'China Youth Summit',
      metadata: { benefits: {}, impact_stats: {} },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toBeNull();
  });

  it('plans vision/mission/tagline from objectives/coreValues/tagline when all three typed columns are currently empty', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-korea', brandName: 'Korea Youth Summit',
      metadata: { objectives: 'Lead. Connect. Grow.', coreValues: 'Integrity, Excellence, Unity', tagline: 'Shape Tomorrow, Today' },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toEqual({
      brandId: 'b-korea', brandName: 'Korea Youth Summit',
      vision: 'Lead. Connect. Grow.', mission: 'Integrity, Excellence, Unity', tagline: 'Shape Tomorrow, Today',
    });
  });

  it('fixes the mojibake bullet inside objectives while mapping it to vision (the Vietnam case)', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-vietnam', brandName: 'Vietnam Youth Summit',
      metadata: { objectives: 'Leadership â€¢ Networking â€¢ Culture', coreValues: 'Respect, Growth', tagline: 'Break the Boundaries' },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan?.vision).toBe('Leadership • Networking • Culture');
  });

  it('does not overwrite a typed column that already has content — never clobber a value an admin may have already set directly', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-yaf', brandName: 'Youth Academic Forum',
      metadata: { objectives: 'Meta objectives text', coreValues: 'Meta core values text', tagline: 'Meta tagline' },
      currentVision: 'Already-set vision from elsewhere', currentMission: null, currentTagline: null,
    });
    expect(plan).toEqual({
      brandId: 'b-yaf', brandName: 'Youth Academic Forum',
      mission: 'Meta core values text', tagline: 'Meta tagline',
      // vision omitted — currentVision already populated, not overwritten.
    });
  });

  it('returns a plan with skippedReason and no field writes when every target typed column is already populated', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-x', brandName: 'Some Brand',
      metadata: { objectives: 'x', coreValues: 'y', tagline: 'z' },
      currentVision: 'already set', currentMission: 'already set', currentTagline: 'already set',
    });
    expect(plan).toEqual({
      brandId: 'b-x', brandName: 'Some Brand',
      skippedReason: 'typed columns already populated; metadata key(s) present but would be overwritten, not applied',
    });
  });

  it('treats a whitespace-only dead-key value as absent, same as a missing key', () => {
    const plan = planBrandDeadKeysBackfill({
      brandId: 'b-y', brandName: 'Blank Brand',
      metadata: { objectives: '   ', coreValues: '', tagline: null },
      currentVision: null, currentMission: null, currentTagline: null,
    });
    expect(plan).toBeNull();
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="backfill-brand-dead-keys.spec"`
Expected: FAIL — cannot find module `./backfill-brand-dead-keys`.

- [ ] **Step 3: Write the pure functions and the DB-touching wrapper**

```typescript
// services/api/scripts/backfill-brand-dead-keys.ts
/**
 * backfill-brand-dead-keys.ts
 *
 * Phase 3 Task 11 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Finishes the migration prisma/seeds/internal/migrate-brands.ts started:
 * objectives -> Brand.vision, coreValues -> Brand.mission, tagline -> the
 * new Brand.tagline column (Task 2). Targets exactly Korea Youth Summit,
 * Vietnam Youth Summit, and Youth Academic Forum per the spec's audit —
 * every other brand's metadata has none of these three keys and is a no-op.
 *
 * Does NOT touch Brand.metadata — the dead keys are left in place until
 * Task 21 strips them, after the read switch (Tasks 15-16) and verification
 * (Task 18) confirm nothing regressed.
 *
 * DRY RUN by default. Prints a bucketed summary and writes a full backup
 * JSON of every planned write to ./backups/ before mutating anything.
 * Pass --apply to actually perform the backfill.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-brand-dead-keys.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-brand-dead-keys.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Production execution is a separate
 * human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

// ─── Pure logic (unit-tested in backfill-brand-dead-keys.spec.ts) ──────────

export interface BrandDeadKeysSnapshot {
    brandId: string;
    brandName: string;
    metadata: Record<string, unknown> | null;
    currentVision: string | null;
    currentMission: string | null;
    currentTagline: string | null;
}

export interface BrandDeadKeysBackfillPlan {
    brandId: string;
    brandName: string;
    vision?: string;
    mission?: string;
    tagline?: string;
    skippedReason?: string;
}

// The one known corruption: UTF-8 bullet bytes (E2 80 A2) decoded as
// Latin-1/cp1252 produce this exact three-character sequence. Targeted
// string replace, not a blanket Buffer.from(text, 'latin1').toString('utf8')
// re-decode of the whole string — the spec confirms the corruption is
// confined to the bullet character, so a targeted fix can't mangle any
// correctly-encoded text elsewhere in the same string the way a blanket
// re-decode risks doing.
const MOJIBAKE_BULLET = 'â€¢';

export function fixMojibakeBullets(text: string): string {
    return text.split(MOJIBAKE_BULLET).join('•');
}

function readTrimmedStringKey(metadata: Record<string, unknown>, key: string): string | undefined {
    const raw = metadata[key];
    if (typeof raw !== 'string') return undefined;
    const trimmed = raw.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

export function planBrandDeadKeysBackfill(snapshot: BrandDeadKeysSnapshot): BrandDeadKeysBackfillPlan | null {
    const metadata = snapshot.metadata ?? {};
    const objectives = readTrimmedStringKey(metadata, 'objectives');
    const coreValues = readTrimmedStringKey(metadata, 'coreValues');
    const tagline = readTrimmedStringKey(metadata, 'tagline');

    if (objectives === undefined && coreValues === undefined && tagline === undefined) {
        return null; // nothing to backfill for this brand
    }

    const plan: BrandDeadKeysBackfillPlan = { brandId: snapshot.brandId, brandName: snapshot.brandName };

    // Never overwrite a typed column that already has content — it may have
    // been set directly through the admin UI since this metadata key was
    // written, and this backfill's job is to fill a gap, not clobber a
    // newer value.
    if (objectives !== undefined && !snapshot.currentVision) {
        plan.vision = fixMojibakeBullets(objectives);
    }
    if (coreValues !== undefined && !snapshot.currentMission) {
        plan.mission = coreValues;
    }
    if (tagline !== undefined && !snapshot.currentTagline) {
        plan.tagline = tagline;
    }

    if (plan.vision === undefined && plan.mission === undefined && plan.tagline === undefined) {
        return {
            brandId: snapshot.brandId,
            brandName: snapshot.brandName,
            skippedReason: 'typed columns already populated; metadata key(s) present but would be overwritten, not applied',
        };
    }

    return plan;
}

// ─── DB-touching wrapper ─────────────────────────────────────────────────

/* istanbul ignore next -- exercised by dry-run inspection, not a DB-backed Jest test (see Global Constraints) */
async function runScript(): Promise<void> {
    loadEnv({ path: join(__dirname, '..', '.env') });
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
    }

    const APPLY = process.argv.includes('--apply');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log(`[backfill-brand-dead-keys] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

        const brands = await prisma.brand.findMany({
            where: { deletedAt: null },
            select: { id: true, name: true, metadata: true, vision: true, mission: true, tagline: true },
        });

        const plans = brands
            .map((b) =>
                planBrandDeadKeysBackfill({
                    brandId: b.id,
                    brandName: b.name,
                    metadata: b.metadata as Record<string, unknown> | null,
                    currentVision: b.vision,
                    currentMission: b.mission,
                    currentTagline: b.tagline,
                }),
            )
            .filter((p): p is BrandDeadKeysBackfillPlan => p !== null);

        const writable = plans.filter((p) => !p.skippedReason);
        const skipped = plans.filter((p) => p.skippedReason);

        console.log(
            `[backfill-brand-dead-keys] ${brands.length} brand(s) scanned -> ${writable.length} to backfill, ` +
            `${skipped.length} skipped (already populated), ${brands.length - plans.length} no-op (no dead keys).`,
        );
        console.table(writable.map((p) => ({ brand: p.brandName, vision: p.vision ? 'set' : '-', mission: p.mission ? 'set' : '-', tagline: p.tagline ? 'set' : '-' })));
        if (skipped.length > 0) {
            console.log('[backfill-brand-dead-keys] skipped (typed columns already populated):', skipped.map((p) => p.brandName).join(', '));
        }

        if (writable.length === 0) {
            console.log('[backfill-brand-dead-keys] nothing to do.');
            return;
        }

        const backupDir = join(__dirname, 'backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `backfill-brand-dead-keys-${stamp}.json`);
        writeFileSync(backupPath, JSON.stringify({ writable, skipped }, null, 2));
        console.log(`[backfill-brand-dead-keys] backup written: ${backupPath}`);

        if (!APPLY) {
            console.log('[backfill-brand-dead-keys] DRY RUN complete. Re-run with --apply to write the columns above.');
            return;
        }

        await prisma.$transaction(
            writable.map((p) =>
                prisma.brand.update({
                    where: { id: p.brandId },
                    data: {
                        ...(p.vision !== undefined && { vision: p.vision }),
                        ...(p.mission !== undefined && { mission: p.mission }),
                        ...(p.tagline !== undefined && { tagline: p.tagline }),
                    },
                }),
            ),
        );
        console.log(`[backfill-brand-dead-keys] backfilled ${writable.length} brand(s).`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    runScript().catch((err) => {
        console.error('[backfill-brand-dead-keys] FAILED:', err);
        process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="backfill-brand-dead-keys.spec"`
Expected: PASS — 9 passing tests.

- [ ] **Step 5: Verify compile, then dry-run against the local/dev database**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run (from `services/api/`, local/dev `DATABASE_URL`): `npx ts-node -r tsconfig-paths/register scripts/backfill-brand-dead-keys.ts`
Expected: dry-run output listing exactly the brands whose seeded dev data carries `objectives`/`coreValues`/`tagline` in `metadata` (in a dev DB seeded to mirror production, this is Korea/Vietnam/Youth Academic Forum — if the dev DB isn't seeded with this data, the table prints `0 to backfill` and that is the correct dry-run result for that DB, not a bug). Confirm the printed `vision`/`mission`/`tagline` values look correct, and specifically confirm Vietnam's `vision` value (if present in the dev DB) shows a real bullet `•`, not `â€¢`.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add scripts/backfill-brand-dead-keys.ts scripts/backfill-brand-dead-keys.spec.ts
git commit -m "feat(scripts): add backfill-brand-dead-keys.ts (tagline/objectives/coreValues -> typed columns)"
```

---

## Task 12: `backfill-program-content-ownership.ts` — contact, landing sections, and `impact_stats`

**Files:**
- Create: `services/api/scripts/backfill-program-content-ownership.ts`
- Create: `services/api/scripts/backfill-program-content-ownership.spec.ts`

**Interfaces:**
- Consumes: `Brand.contactEmail`/`.contactPhone`/`.contactWhatsapp`/`.contactAddress` (existing typed columns); `Brand.metadata`'s 7 landing keys (`benefits`, `features`, `promo_cta`, `moments_shorts`, `further_information`, `payment_info`, `participant_demographics`) and `.impact_stats`; `Program.contactEmail`/etc. and `Program.landingContent` (Task 1); `PlatformSettingRepository` (Task 3).
- Produces: `planContactBackfill()`, `planLandingContentBackfill()`, `planImpactStatsBackfill()` — pure, exported, unit-tested functions. Task 15/16 (the read switch) do not depend on this task's code — they depend on the *data* it writes.

**This is the highest-stakes script in the phase** because, unlike Task 11 (three brands, one destination each), it has three independent things to get right at once:

1. **Contact scalars are not metadata-gated.** `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` are typed `Brand` columns today, not metadata keys — a brand with `{}` metadata (Japan Youth Summit, World Youth Fest) can still have real contact info to backfill. "Brands with `{}` metadata are no-ops," the spec's own phrasing for this migration step, describes the **landing-content** half of this backfill only. This task's contact half runs independently of what `Brand.metadata` contains.

2. **SEO fields need no backfill at all.** The spec's ownership table lists SEO under what Program takes over, but `Program` already has its own, independent `metaTitle`/`metaDescription` (pre-existing, per-program, populated by whoever authored each program) — the spec's own audit confirms "Nothing renders the Brand-level ones" for `metaTitle`/`metaDescription`/`metaKeywords`. There is nothing to copy: Task 1 already added `Program.metaKeywords` as a new, correctly-null column, and dropping `Brand`'s three SEO fields in Task 21 loses zero live behavior because nothing reads them today. This task deliberately does **not** touch SEO — recorded here so a future reader doesn't "fix" what looks like a missing backfill step.

3. **"The active program" is not one query — it's two, and they can disagree.** `settings.strategy.ts` (which will read the backfilled contact fields, Task 15) resolves the active program as `program.findFirst({ where: { brandId, isPublished: true, isActive: true }, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] })`. `home.strategy.ts` (which will read the backfilled `landingContent`, Task 16) resolves it as `program.findFirst({ where: { brandId, isPublished: true, isActive: true }, orderBy: { startDate: 'desc' } })` — a **different `orderBy`**, confirmed by reading both files directly. For a brand with exactly one published+active program (China, Vietnam) the two queries trivially agree. For a brand with several (Istanbul: 5, MEYS: 5, Korea/Japan/World Youth Fest: 4, Youth Academic Forum: 3) they are not guaranteed to pick the same row — an edition added later in the year but starting earlier in the calendar could rank differently by `year` than by `startDate`. Writing contact and landing content onto "one" resolved active program per brand would be **wrong** whenever the two orderings disagree, because the corresponding read-path strategy would then look at the *other* program and find nothing. This script therefore resolves "the active program" **twice per brand**, once per orderBy, and backfills each destination onto the program its own consuming strategy will actually read — not onto a single merged guess. If the two resolutions disagree for a brand, the script does not silently pick one; it prints a warning naming both candidate programs so a human can confirm that's actually correct for that brand before `--apply`.

- [ ] **Step 1: Write the failing spec for the pure planning functions**

```typescript
// services/api/scripts/backfill-program-content-ownership.spec.ts
import {
  planContactBackfill,
  planLandingContentBackfill,
  planImpactStatsBackfill,
} from './backfill-program-content-ownership';

describe('planContactBackfill', () => {
  it('plans a write when the brand has contact info and the active program has none yet', () => {
    const plan = planContactBackfill({
      brandId: 'b1', brandName: 'Istanbul Youth Summit',
      brand: { contactEmail: 'x@ist.com', contactPhone: '+90', contactWhatsapp: null, contactAddress: 'Istanbul' },
      activeProgram: { id: 'p1', name: 'IYS 2026', contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(plan).toEqual({
      brandId: 'b1', brandName: 'Istanbul Youth Summit', programId: 'p1', programName: 'IYS 2026',
      contactEmail: 'x@ist.com', contactPhone: '+90', contactAddress: 'Istanbul',
    });
  });

  it('returns null when the brand has no contact info to backfill (all null)', () => {
    const plan = planContactBackfill({
      brandId: 'b2', brandName: 'Japan Youth Summit',
      brand: { contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null },
      activeProgram: { id: 'p2', name: 'JYS 2026', contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(plan).toBeNull();
  });

  it('returns a skip plan (with reason) when there is no resolvable active program for this brand', () => {
    const plan = planContactBackfill({
      brandId: 'b3', brandName: 'Some Brand',
      brand: { contactEmail: 'x@x.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
      activeProgram: null,
    });
    expect(plan).toEqual({
      brandId: 'b3', brandName: 'Some Brand',
      skippedReason: 'no published+active program found to backfill contact info onto',
    });
  });

  it('does not overwrite a program contact field that is already populated', () => {
    const plan = planContactBackfill({
      brandId: 'b4', brandName: 'Korea Youth Summit',
      brand: { contactEmail: 'brand@korea.com', contactPhone: '+82', contactWhatsapp: null, contactAddress: null },
      activeProgram: { id: 'p4', name: 'KYS 2026', contactEmail: 'already-set@korea.com', contactPhone: null, contactWhatsapp: null, contactAddress: null },
    });
    expect(plan).toEqual({
      brandId: 'b4', brandName: 'Korea Youth Summit', programId: 'p4', programName: 'KYS 2026',
      contactPhone: '+82',
      // contactEmail omitted — the program already has a value.
    });
  });
});

describe('planLandingContentBackfill', () => {
  it('returns null for a brand with empty metadata ({}) — Japan/World Youth Fest no-op case', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b1', brandName: 'Japan Youth Summit',
      metadata: {}, activeProgram: { id: 'p1', name: 'JYS 2026', landingContent: {} },
    });
    expect(plan).toBeNull();
  });

  it('plans a landingContent write containing only the 7 allow-listed keys present in metadata', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b2', brandName: 'China Youth Summit',
      metadata: {
        benefits: { eyebrow: 'e', title: 't', groups: [] },
        impact_stats: { total_alumni: '1700+' }, // NOT one of the 7 — must be dropped, handled by planImpactStatsBackfill instead
        section_background: { desktop_url: 'x' }, // stays on Brand — must be dropped
        promo_cta: { title: 'Apply now' },
      },
      activeProgram: { id: 'p2', name: 'CYS 2026', landingContent: {} },
    });
    expect(plan).toEqual({
      brandId: 'b2', brandName: 'China Youth Summit', programId: 'p2', programName: 'CYS 2026',
      landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, promo_cta: { title: 'Apply now' } },
    });
  });

  it('returns a skip plan when there is no resolvable active program for this brand', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b3', brandName: 'Some Brand',
      metadata: { benefits: { eyebrow: 'e', title: 't', groups: [] } },
      activeProgram: null,
    });
    expect(plan).toEqual({
      brandId: 'b3', brandName: 'Some Brand',
      skippedReason: 'no published+active program found to backfill landing content onto',
    });
  });

  it('merges into (does not replace) a landingContent that already has some keys set', () => {
    const plan = planLandingContentBackfill({
      brandId: 'b4', brandName: 'Istanbul Youth Summit',
      metadata: { features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] },
      activeProgram: { id: 'p4', name: 'IYS 2026', landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] } } },
    });
    expect(plan).toEqual({
      brandId: 'b4', brandName: 'Istanbul Youth Summit', programId: 'p4', programName: 'IYS 2026',
      landingContent: { benefits: { eyebrow: 'e', title: 't', groups: [] }, features: [{ id: 'f1', icon: 'star', title: 'X', description: 'Y' }] },
    });
  });
});

describe('planImpactStatsBackfill', () => {
  it('returns null when no brand carries impact_stats', () => {
    expect(planImpactStatsBackfill([])).toBeNull();
  });

  it('plans a single platform-wide write when every carrying brand agrees (the documented byte-identical case)', () => {
    const stats = { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' };
    const plan = planImpactStatsBackfill([
      { brandName: 'China Youth Summit', value: stats },
      { brandName: 'Middle East Youth Summit', value: stats },
      { brandName: 'Korea Youth Summit', value: stats },
    ]);
    expect(plan).toEqual({ value: stats, sourceBrands: ['China Youth Summit', 'Middle East Youth Summit', 'Korea Youth Summit'], disagreement: false });
  });

  it('flags disagreement instead of silently picking one value when carrying brands differ', () => {
    const plan = planImpactStatsBackfill([
      { brandName: 'China Youth Summit', value: { total_alumni: '1700+' } },
      { brandName: 'Middle East Youth Summit', value: { total_alumni: '1800+' } },
    ]);
    expect(plan?.disagreement).toBe(true);
    expect(plan?.value).toEqual({ total_alumni: '1700+' }); // first-seen value, used only if a human proceeds anyway
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="backfill-program-content-ownership.spec"`
Expected: FAIL — cannot find module `./backfill-program-content-ownership`.

- [ ] **Step 3: Write the pure functions and the DB-touching wrapper**

```typescript
// services/api/scripts/backfill-program-content-ownership.ts
/**
 * backfill-program-content-ownership.ts
 *
 * Phase 3 Task 12 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Backfills the program-owned half of the Brand/Program ownership split onto
 * each brand's active program(s):
 *   - Brand.contactEmail/contactPhone/contactWhatsapp/contactAddress ->
 *     Program.contactEmail/contactPhone/contactWhatsapp/contactAddress
 *   - Brand.metadata's 7 landing keys -> Program.landingContent
 *   - Brand.metadata.impact_stats (byte-identical on China/MEYS/Korea) -> a
 *     single PlatformSetting row, key 'impact_stats'
 *
 * "The active program" is resolved TWICE per brand, once per the orderBy
 * settings.strategy.ts uses (drives contact) and once per the orderBy
 * home.strategy.ts uses (drives landingContent) — the two queries are not
 * guaranteed to agree for a brand with several published+active programs.
 * See this task's plan-doc entry for why backfilling onto a single merged
 * guess would be wrong.
 *
 * DRY RUN by default. Prints a bucketed summary and writes a full backup
 * JSON of every planned write to ./backups/ before mutating anything.
 * Pass --apply to actually perform the backfill.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-program-content-ownership.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/backfill-program-content-ownership.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Production execution is a separate
 * human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';
import { PROGRAM_LANDING_CONTENT_KEYS } from '../src/modules/programs/application/copy/program-landing-content.constants';

// ─── Pure logic (unit-tested in backfill-program-content-ownership.spec.ts) ─

type ContactScalars = {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
};

export interface ContactBackfillInput {
    brandId: string;
    brandName: string;
    brand: ContactScalars;
    activeProgram: (ContactScalars & { id: string; name: string }) | null;
}

export interface ContactBackfillPlan {
    brandId: string;
    brandName: string;
    programId?: string;
    programName?: string;
    contactEmail?: string;
    contactPhone?: string;
    contactWhatsapp?: string;
    contactAddress?: string;
    skippedReason?: string;
}

export function planContactBackfill(input: ContactBackfillInput): ContactBackfillPlan | null {
    const hasAnyContact =
        !!input.brand.contactEmail || !!input.brand.contactPhone || !!input.brand.contactWhatsapp || !!input.brand.contactAddress;
    if (!hasAnyContact) return null;

    if (!input.activeProgram) {
        return {
            brandId: input.brandId,
            brandName: input.brandName,
            skippedReason: 'no published+active program found to backfill contact info onto',
        };
    }

    const plan: ContactBackfillPlan = {
        brandId: input.brandId,
        brandName: input.brandName,
        programId: input.activeProgram.id,
        programName: input.activeProgram.name,
    };

    // Never overwrite a program contact field that already has a value —
    // this backfill fills a gap, it does not clobber content a program may
    // already carry (e.g. from a prior manual entry or a copy-from-program
    // action run before this script executes).
    if (input.brand.contactEmail && !input.activeProgram.contactEmail) plan.contactEmail = input.brand.contactEmail;
    if (input.brand.contactPhone && !input.activeProgram.contactPhone) plan.contactPhone = input.brand.contactPhone;
    if (input.brand.contactWhatsapp && !input.activeProgram.contactWhatsapp) plan.contactWhatsapp = input.brand.contactWhatsapp;
    if (input.brand.contactAddress && !input.activeProgram.contactAddress) plan.contactAddress = input.brand.contactAddress;

    const wroteAnything =
        plan.contactEmail !== undefined || plan.contactPhone !== undefined || plan.contactWhatsapp !== undefined || plan.contactAddress !== undefined;
    if (!wroteAnything) {
        return {
            brandId: input.brandId,
            brandName: input.brandName,
            skippedReason: 'active program already has contact info for every field the brand carries',
        };
    }

    return plan;
}

export interface LandingContentBackfillInput {
    brandId: string;
    brandName: string;
    metadata: Record<string, unknown> | null;
    activeProgram: { id: string; name: string; landingContent: Record<string, unknown> } | null;
}

export interface LandingContentBackfillPlan {
    brandId: string;
    brandName: string;
    programId?: string;
    programName?: string;
    landingContent?: Record<string, unknown>;
    skippedReason?: string;
}

export function planLandingContentBackfill(input: LandingContentBackfillInput): LandingContentBackfillPlan | null {
    const metadata = input.metadata ?? {};
    const carried = Object.fromEntries(
        PROGRAM_LANDING_CONTENT_KEYS.map((key) => [key, metadata[key]]).filter(([, value]) => value !== undefined),
    );
    if (Object.keys(carried).length === 0) return null; // {} metadata (Japan/World Youth Fest) or no landing keys at all

    if (!input.activeProgram) {
        return {
            brandId: input.brandId,
            brandName: input.brandName,
            skippedReason: 'no published+active program found to backfill landing content onto',
        };
    }

    // Merge, don't replace — the target program's landingContent may already
    // carry keys (e.g. re-running this script after a partial --apply, or a
    // program that already had some sections entered through the admin UI).
    return {
        brandId: input.brandId,
        brandName: input.brandName,
        programId: input.activeProgram.id,
        programName: input.activeProgram.name,
        landingContent: { ...input.activeProgram.landingContent, ...carried },
    };
}

export interface ImpactStatsBackfillPlan {
    value: Record<string, unknown>;
    sourceBrands: string[];
    disagreement: boolean;
}

export function planImpactStatsBackfill(
    carriers: Array<{ brandName: string; value: Record<string, unknown> }>,
): ImpactStatsBackfillPlan | null {
    if (carriers.length === 0) return null;

    const first = carriers[0].value;
    const disagreement = carriers.some((c) => JSON.stringify(c.value) !== JSON.stringify(first));

    return {
        value: first,
        sourceBrands: carriers.map((c) => c.brandName),
        disagreement,
    };
}

// ─── DB-touching wrapper ─────────────────────────────────────────────────

/* istanbul ignore next -- exercised by dry-run inspection, not a DB-backed Jest test (see Global Constraints) */
async function runScript(): Promise<void> {
    loadEnv({ path: join(__dirname, '..', '.env') });
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
    }

    const APPLY = process.argv.includes('--apply');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log(`[backfill-program-content-ownership] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

        const brands = await prisma.brand.findMany({
            where: { deletedAt: null },
            select: {
                id: true, name: true, metadata: true,
                contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true,
            },
        });

        const contactPlans: ContactBackfillPlan[] = [];
        const landingPlans: LandingContentBackfillPlan[] = [];
        const impactStatsCarriers: Array<{ brandName: string; value: Record<string, unknown> }> = [];

        for (const brand of brands) {
            // Two separate active-program resolutions — see this task's
            // plan-doc entry for why they must not be merged into one query.
            const contactActiveProgram = await prisma.program.findFirst({
                where: { brandId: brand.id, isPublished: true, isActive: true },
                orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
                select: { id: true, name: true, contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true },
            });
            const landingActiveProgram = await prisma.program.findFirst({
                where: { brandId: brand.id, isPublished: true, isActive: true },
                orderBy: { startDate: 'desc' },
                select: { id: true, name: true, landingContent: true },
            });

            if (contactActiveProgram && landingActiveProgram && contactActiveProgram.id !== landingActiveProgram.id) {
                console.warn(
                    `[backfill-program-content-ownership] WARNING: ${brand.name} has DIFFERENT active programs for ` +
                    `contact ("${contactActiveProgram.name}") vs landing content ("${landingActiveProgram.name}") — ` +
                    `settings.strategy.ts and home.strategy.ts will read different programs for this brand. Confirm ` +
                    `this is actually correct before running --apply.`,
                );
            }

            const contactPlan = planContactBackfill({
                brandId: brand.id,
                brandName: brand.name,
                brand: { contactEmail: brand.contactEmail, contactPhone: brand.contactPhone, contactWhatsapp: brand.contactWhatsapp, contactAddress: brand.contactAddress },
                activeProgram: contactActiveProgram,
            });
            if (contactPlan) contactPlans.push(contactPlan);

            const landingPlan = planLandingContentBackfill({
                brandId: brand.id,
                brandName: brand.name,
                metadata: brand.metadata as Record<string, unknown> | null,
                activeProgram: landingActiveProgram
                    ? { id: landingActiveProgram.id, name: landingActiveProgram.name, landingContent: (landingActiveProgram.landingContent as Record<string, unknown>) ?? {} }
                    : null,
            });
            if (landingPlan) landingPlans.push(landingPlan);

            const impactStats = (brand.metadata as Record<string, unknown> | null)?.impact_stats;
            if (impactStats && typeof impactStats === 'object') {
                impactStatsCarriers.push({ brandName: brand.name, value: impactStats as Record<string, unknown> });
            }
        }

        const impactStatsPlan = planImpactStatsBackfill(impactStatsCarriers);

        // ── Summary ──
        const writableContact = contactPlans.filter((p) => !p.skippedReason);
        const writableLanding = landingPlans.filter((p) => !p.skippedReason);
        console.log(`[backfill-program-content-ownership] contact: ${writableContact.length} program(s) to backfill, ${contactPlans.length - writableContact.length} skipped.`);
        console.table(writableContact.map((p) => ({ brand: p.brandName, program: p.programName, email: p.contactEmail ?? '-', phone: p.contactPhone ?? '-', whatsapp: p.contactWhatsapp ?? '-', address: p.contactAddress ? 'set' : '-' })));

        console.log(`[backfill-program-content-ownership] landing content: ${writableLanding.length} program(s) to backfill, ${landingPlans.length - writableLanding.length} skipped.`);
        console.table(writableLanding.map((p) => ({ brand: p.brandName, program: p.programName, keys: p.landingContent ? Object.keys(p.landingContent).join(', ') : '-' })));

        if (impactStatsPlan) {
            console.log(
                `[backfill-program-content-ownership] impact_stats: carried by ${impactStatsPlan.sourceBrands.join(', ')} — ` +
                `${impactStatsPlan.disagreement ? 'DISAGREE, using the first-seen value, VERIFY before --apply' : 'all agree'}.`,
            );
            console.log(JSON.stringify(impactStatsPlan.value, null, 2));
        } else {
            console.log('[backfill-program-content-ownership] impact_stats: no brand carries it — nothing to backfill to PlatformSetting.');
        }

        const backupDir = join(__dirname, 'backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `backfill-program-content-ownership-${stamp}.json`);
        writeFileSync(backupPath, JSON.stringify({ contactPlans, landingPlans, impactStatsPlan }, null, 2));
        console.log(`[backfill-program-content-ownership] backup written: ${backupPath}`);

        if (!APPLY) {
            console.log('[backfill-program-content-ownership] DRY RUN complete. Re-run with --apply to write the above.');
            return;
        }

        if (impactStatsPlan?.disagreement) {
            throw new Error(
                'impact_stats values disagree across brands — refusing to --apply. Resolve manually (this is exactly ' +
                'the kind of silent drift PlatformSetting exists to prevent going forward) and re-run.',
            );
        }

        await prisma.$transaction(async (tx) => {
            for (const p of writableContact) {
                await tx.program.update({
                    where: { id: p.programId! },
                    data: {
                        ...(p.contactEmail !== undefined && { contactEmail: p.contactEmail }),
                        ...(p.contactPhone !== undefined && { contactPhone: p.contactPhone }),
                        ...(p.contactWhatsapp !== undefined && { contactWhatsapp: p.contactWhatsapp }),
                        ...(p.contactAddress !== undefined && { contactAddress: p.contactAddress }),
                    },
                });
            }
            for (const p of writableLanding) {
                await tx.program.update({
                    where: { id: p.programId! },
                    data: { landingContent: p.landingContent as Prisma.InputJsonValue },
                });
            }
            if (impactStatsPlan) {
                await tx.platformSetting.upsert({
                    where: { key: 'impact_stats' },
                    create: { key: 'impact_stats', value: impactStatsPlan.value as Prisma.InputJsonValue, updatedBy: null },
                    update: { value: impactStatsPlan.value as Prisma.InputJsonValue, updatedBy: null },
                });
            }
        });

        console.log(
            `[backfill-program-content-ownership] backfilled contact on ${writableContact.length} program(s), ` +
            `landing content on ${writableLanding.length} program(s)${impactStatsPlan ? ', and impact_stats on PlatformSetting' : ''}.`,
        );
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    runScript().catch((err) => {
        console.error('[backfill-program-content-ownership] FAILED:', err);
        process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="backfill-program-content-ownership.spec"`
Expected: PASS — 10 passing tests.

- [ ] **Step 5: Verify compile, then dry-run against the local/dev database**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run (from `services/api/`, local/dev `DATABASE_URL`): `npx ts-node -r tsconfig-paths/register scripts/backfill-program-content-ownership.ts`
Expected: dry-run tables for contact and landing content, an `impact_stats` summary, and no `disagreement: true` warning (if the dev DB is seeded to mirror production, `impact_stats` should show China/MEYS/Korea agreeing, per the spec's audit). If any brand prints the "DIFFERENT active programs for contact vs landing content" warning, manually inspect both candidate programs for that brand in the dev DB before deciding whether to proceed — this is a genuine data question, not a script bug.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add scripts/backfill-program-content-ownership.ts scripts/backfill-program-content-ownership.spec.ts
git commit -m "feat(scripts): add backfill-program-content-ownership.ts (contact + landing + impact_stats)"
```

---

## Task 13: `resolveActiveProgramContact` resolver + repoint the brand-only contact consumers

**Files:**
- Create: `services/api/src/shared/utils/resolve-active-program-contact.ts`
- Create: `services/api/src/shared/utils/resolve-active-program-contact.spec.ts`
- Modify: `services/api/src/modules/auth/application/commands/handlers/forgot-password.handler.ts` (~lines 111-130)
- Modify: `services/api/src/modules/support/application/commands/handlers/create-support-ticket.handler.ts` (~lines 109-135)
- Modify: `services/api/src/modules/support/application/commands/handlers/reply-support-ticket.handler.ts` (~lines 83-113)
- Modify: `services/api/src/modules/support/presentation/admin-support-tickets.controller.ts` (two sites, ~lines 471-497 and ~597-623)

**Interfaces:**
- Consumes: `Program.contactEmail`/`.contactPhone`/`.contactWhatsapp`/`.contactAddress` (Task 1, backfilled by Task 12).
- Produces: `resolveActiveProgramContact(prisma, brandId): Promise<ProgramContactInfo>` — Task 14's consumers do **not** use this (they already have a specific `Program` in scope, which is more precise than "the active one" — see Task 14). Task 15 (`settings.strategy.ts`) does not call this function either — it inlines the identical query, because it already holds a `Brand` and builds its own `program` variable; this resolver exists specifically for call sites that hold only a `brandId`/`Brand` with no program-scoped context at all.

This is the audit findings' category "(B)" consumers from this plan's Global Constraints — four call sites that only ever had a `Brand` in scope, never a specific `Program` (a `User` belongs directly to a `Brand`, not to a program; a support ticket's owner is a `User`). Unlike Task 14's consumers, there is no already-resolved program to repoint onto here, so these need an actual "which program's contact info do we show" resolution — and per the hazard already established in Task 12, that resolution is not arbitrary: it must match **`settings.strategy.ts`'s** `orderBy` (`year` desc, then `createdAt` desc), because that is the query that decides what a brand's own public landing page shows as its support email/phone/address. Using a *different* resolution here would mean a participant's forgot-password email could show different contact info than the brand's own public page — confusing in exactly the way this whole phase exists to eliminate. This resolver is intentionally not `home.strategy.ts`'s orderBy; it has nothing to do with landing content.

- [ ] **Step 1: Write the failing spec for the resolver**

```typescript
// services/api/src/shared/utils/resolve-active-program-contact.spec.ts
import { resolveActiveProgramContact } from './resolve-active-program-contact';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(program: Record<string, unknown> | null): PrismaService {
  const base: any = { program: { findFirst: jest.fn().mockResolvedValue(program) } };
  return base as PrismaService;
}

describe('resolveActiveProgramContact', () => {
  it('queries with the same orderBy settings.strategy.ts uses for its active-program resolution', async () => {
    const prisma = mkPrisma({ contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null });
    await resolveActiveProgramContact(prisma, 'brand-1');
    expect((prisma as any).program.findFirst).toHaveBeenCalledWith({
      where: { brandId: 'brand-1', isPublished: true, isActive: true },
      orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
      select: { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true },
    });
  });

  it('maps the resolved program contact fields through', async () => {
    const prisma = mkPrisma({ contactEmail: 'hello@brand.com', contactPhone: '+62811', contactWhatsapp: '62811', contactAddress: 'Jakarta' });
    const result = await resolveActiveProgramContact(prisma, 'brand-1');
    expect(result).toEqual({ contactEmail: 'hello@brand.com', contactPhone: '+62811', contactWhatsapp: '62811', contactAddress: 'Jakarta' });
  });

  it('returns all-null fields, not a rejection, when the brand has no published+active program', async () => {
    const prisma = mkPrisma(null);
    const result = await resolveActiveProgramContact(prisma, 'brand-1');
    expect(result).toEqual({ contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null });
  });

  it('null-coalesces individual program fields (a program row can have some contact fields set and others null)', async () => {
    const prisma = mkPrisma({ contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null });
    const result = await resolveActiveProgramContact(prisma, 'brand-1');
    expect(result).toEqual({ contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null });
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="resolve-active-program-contact.spec"`
Expected: FAIL — cannot find module `./resolve-active-program-contact`.

- [ ] **Step 3: Write the resolver**

```typescript
// services/api/src/shared/utils/resolve-active-program-contact.ts
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

export interface ProgramContactInfo {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
}

/**
 * Resolves contact info for a brand-only call site (no specific
 * ParticipantApplication/Program already in scope) by finding "the active
 * program" and reading its contact fields.
 *
 * Uses the SAME orderBy as settings.strategy.ts's active-program resolution
 * (year desc, then createdAt desc) — that is the query that decides what a
 * brand's own public landing page shows as support_email/contact_phone/
 * address, so a brand-only consumer like forgot-password or a support
 * ticket notification must resolve the same program, or its contact info
 * could visibly disagree with the brand's own public page. This is
 * deliberately NOT home.strategy.ts's orderBy (startDate desc) — that one
 * resolves landing CONTENT, a different concern (see Task 12's plan-doc
 * entry for why the two can disagree and must not be merged).
 *
 * Returns all-null fields rather than throwing when the brand has no
 * published+active program — every caller of this function already treated
 * a missing/undefined contact field as an acceptable, optional case before
 * this phase.
 */
export async function resolveActiveProgramContact(
    prisma: PrismaService,
    brandId: string,
): Promise<ProgramContactInfo> {
    const program = await prisma.program.findFirst({
        where: { brandId, isPublished: true, isActive: true },
        orderBy: [{ year: 'desc' }, { createdAt: 'desc' }],
        select: { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true },
    });

    return {
        contactEmail: program?.contactEmail ?? null,
        contactPhone: program?.contactPhone ?? null,
        contactWhatsapp: program?.contactWhatsapp ?? null,
        contactAddress: program?.contactAddress ?? null,
    };
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="resolve-active-program-contact.spec"`
Expected: PASS — 4 passing tests.

- [ ] **Step 5: Repoint `forgot-password.handler.ts`**

In `services/api/src/modules/auth/application/commands/handlers/forgot-password.handler.ts`, replace the `contactEmail`/`contactAddress` lines inside the `programCategory` object (currently lines 122-125):

```typescript
        // Fetch full brand details for email customization
        const brand = await this.prisma.brand.findUnique({
            where: { id: brandId },
            include: {
                settings: true
            }
        });
        const activeProgramContact = brand ? await resolveActiveProgramContact(this.prisma, brand.id) : null;

        const programCategory = brand ? {
            name: brand.name,
            primaryColor: brand.primaryColor,
            logoUrl: brand.logoUrl,
            websiteUrl: brand.websiteUrl,
            contactEmail: activeProgramContact?.contactEmail ?? null,
            contactAddress: activeProgramContact?.contactAddress ?? null, // Send address
            socialMediaLinks: brand.socialMediaLinks,
```

Add the import at the top of the file: `import { resolveActiveProgramContact } from '@shared/utils/resolve-active-program-contact';`

- [ ] **Step 6: Repoint `create-support-ticket.handler.ts`**

Replace (currently lines 109-131):

```typescript
        const ticketOwner = await this.prisma.user.findUnique({
            where: { id: participant.userId },
            include: { brand: true },
        });

        if (ticketOwner?.email) {
            const activeProgramContact = await resolveActiveProgramContact(this.prisma, ticketOwner.brandId);
            await this.rabbitmqProducer.emit('support.ticket.created', {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                category: ticket.category,
                subCategory: ticket.subCategory,
                subject: ticket.subject,
                status: ticket.status,
                priority: ticket.priority,
                createdAt: ticket.createdAt.toISOString(),
                email: ticketOwner.email,
                name: participant.fullName || 'Participant',
                brand: ticketOwner.brand
                    ? {
                        name: ticketOwner.brand.name,
                        websiteUrl: ticketOwner.brand.websiteUrl,
                        logoUrl: ticketOwner.brand.logoUrl,
                        contactEmail: activeProgramContact.contactEmail,
                    }
                    : undefined,
```

(Leave the rest of the emitted payload — `aiClassification` and anything after it — unchanged.) Add the import: `import { resolveActiveProgramContact } from '@shared/utils/resolve-active-program-contact';`

- [ ] **Step 7: Repoint `reply-support-ticket.handler.ts`**

Replace (currently lines 83-113):

```typescript
        const ticketOwner = await this.prisma.user.findUnique({
            where: { id: participant.userId },
            include: { brand: true },
        });

        if (ticketOwner?.email) {
            const resolvedStatus = (ticket.status === 'waiting_response' || ticket.status === 'resolved')
                ? SupportTicketStatus.open
                : ticket.status as SupportTicketStatus;
            const activeProgramContact = await resolveActiveProgramContact(this.prisma, ticketOwner.brandId);

            await this.rabbitmqProducer.emit('support.ticket.replied', {
                ticketId: ticket.id,
                ticketNumber: ticket.ticketNumber,
                subject: ticket.subject,
                status: resolvedStatus,
                actorRole: 'participant',
                responderName: participant.fullName || 'Participant',
                messagePreview: message.message.length > 200
                    ? `${message.message.slice(0, 200)}...`
                    : message.message,
                email: ticketOwner.email,
                name: participant.fullName || 'Participant',
                brand: ticketOwner.brand
                    ? {
                        name: ticketOwner.brand.name,
                        websiteUrl: ticketOwner.brand.websiteUrl,
                        logoUrl: ticketOwner.brand.logoUrl,
                        contactEmail: activeProgramContact.contactEmail,
                    }
                    : undefined,
            });
        }
```

Add the import: `import { resolveActiveProgramContact } from '@shared/utils/resolve-active-program-contact';`

- [ ] **Step 8: Repoint both sites in `admin-support-tickets.controller.ts`**

Both sites currently use the identical shape, `select: { fullName: true, user: { select: { email: true, brand: true } } }`, where `brand: true` pulls the whole `Brand` relation (including, today, `contactEmail`). Narrow the select so it stops depending on `Brand.contactEmail` at all, and resolve contact separately:

Site 1 (~line 471-497, inside the non-internal-note reply branch):

```typescript
    if (!isInternalNote) {
      const participantUser = await this.prisma.participant.findUnique({
        where: { id: ticket.participantId },
        select: {
          fullName: true,
          user: { select: { email: true, brandId: true, brand: { select: { name: true, websiteUrl: true, logoUrl: true } } } },
        },
      });

      if (participantUser?.user?.email) {
        const activeProgramContact = await resolveActiveProgramContact(this.prisma, participantUser.user.brandId);
        await this.rabbitmqProducer.emit('support.ticket.replied', {
          ticketId: ticket.id,
          ticketNumber: ticket.ticketNumber,
          subject: ticket.subject,
          status: SupportTicketStatus.waiting_response,
          actorRole: 'admin',
          responderName: adminName,
          messagePreview: message.length > 200 ? `${message.slice(0, 200)}...` : message,
          email: participantUser.user.email,
          name: participantUser.fullName || 'Participant',
          brand: participantUser.user.brand
            ? {
                name: participantUser.user.brand.name,
                websiteUrl: participantUser.user.brand.websiteUrl,
                logoUrl: participantUser.user.brand.logoUrl,
                contactEmail: activeProgramContact.contactEmail,
              }
            : undefined,
        });
      }
    }
```

Site 2 (~line 597-623, the status-update notification) — identical transform:

```typescript
      const participantUser = await this.prisma.participant.findUnique({
        where: { id: ticket.participantId },
        select: {
          fullName: true,
          user: { select: { email: true, brandId: true, brand: { select: { name: true, websiteUrl: true, logoUrl: true } } } },
        },
      });

      if (participantUser?.user?.email) {
        const activeProgramContact = await resolveActiveProgramContact(this.prisma, participantUser.user.brandId);
        await this.rabbitmqProducer.emit('support.ticket.status-updated', {
          ticketId: updated.id,
          ticketNumber: updated.ticketNumber,
          subject: updated.subject,
          previousStatus,
          status: updated.status,
          email: participantUser.user.email,
          name: participantUser.fullName || 'Participant',
          brand: participantUser.user.brand
            ? {
                name: participantUser.user.brand.name,
                websiteUrl: participantUser.user.brand.websiteUrl,
                logoUrl: participantUser.user.brand.logoUrl,
                contactEmail: activeProgramContact.contactEmail,
              }
            : undefined,
        });
      }
```

Add the import once at the top of the file: `import { resolveActiveProgramContact } from '@shared/utils/resolve-active-program-contact';`

- [ ] **Step 9: Verify compile and the affected modules' test suites**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — no errors.
Run: `npx jest --testPathPattern="modules/auth"` — PASS.
Run: `npx jest --testPathPattern="modules/support"` — PASS.

Confirm by reading the diff that no other field of `ticketOwner.brand`/`participantUser.user.brand` was accidentally narrowed away — only `contactEmail` (and, transitively, the other three contact scalars nobody here actually read) is removed from these `select`/`include` blocks; `name`, `websiteUrl`, `logoUrl` must still resolve exactly as before.

- [ ] **Step 10: Commit**

```bash
cd services/api
git add src/shared/utils/resolve-active-program-contact.ts src/shared/utils/resolve-active-program-contact.spec.ts src/modules/auth/application/commands/handlers/forgot-password.handler.ts src/modules/support/application/commands/handlers/create-support-ticket.handler.ts src/modules/support/application/commands/handlers/reply-support-ticket.handler.ts src/modules/support/presentation/admin-support-tickets.controller.ts
git commit -m "refactor(contact): repoint brand-only contact consumers onto Program via resolveActiveProgramContact"
```

---

## Task 14: Repoint the program-scoped contact consumers (ambassadors, payments, portal)

**Files:**
- Modify: `services/api/src/modules/participants/presentation/ambassador-admin.controller.ts` (two sites, ~lines 163-182 and ~245-264)
- Modify: `services/api/src/modules/payments/presentation/payment-admin.controller.ts` (four sites: ~756-800/916-917, ~995-1020/1063-1064, ~1130-1150/1178-1180, ~1409-1416/1458-1459)
- Modify: `services/api/src/modules/payments/presentation/payment-events.controller.ts` (four sites: ~65-75, ~205-221, ~355-364, ~685-696)
- Modify: `services/api/src/modules/portal/presentation/portal.controller.ts` (~lines 178-197, 218-254)
- Modify: `services/api/src/modules/portal/application/services/portal-receipt.service.ts` (~lines 58-61 — doc comment only, see Step 6)

**Interfaces:**
- Consumes: `Program.contactEmail`/`.contactPhone`/`.contactWhatsapp`/`.contactAddress` (Task 1, backfilled by Task 12).
- Produces: no new exported symbols — every site here already resolves a specific `Program` (via `application.program`, `ambassador.program`, or a direct `programId` lookup), so this task only repoints existing Prisma `select`/`include` blocks and read expressions onto that already-known program. `services/notification` needs **zero** changes: every emitted RabbitMQ payload keeps the exact same field names (`brand.contactEmail`, `brand.contactAddress`, etc.) — only what feeds those fields changes, per this plan's Global Constraints.

This is audit category "(A)" from Task 13's framing: unlike the four brand-only consumers Task 13 repointed, every site below already has the **exact right program** in scope — an ambassador's assigned program, an invoice's `application.program`, a receipt's `application.program` — so there is no "which program is active" question to resolve here at all, and no dependency on Task 13's resolver. This is strictly a Prisma-query change: pull `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` off the sibling `program` object in the same query instead of the nested `program.brand` object, then feed the *same* emitted-payload shape from the new source.

- [ ] **Step 1: Repoint `ambassador-admin.controller.ts` — both sites**

Site 1 (`create`, ~line 163-182 select, ~line 227-238 read/emit):

```typescript
    // Resolve program to get brandId and brand details for the welcome email
    const program = await this.prisma.program.findUnique({
      where: { id: programId },
      select: {
        id: true,
        brandId: true,
        contactEmail: true,
        contactAddress: true,
        brand: {
          select: {
            id: true,
            name: true,
            websiteUrl: true,
            primaryColor: true,
            logoUrl: true,
            socialMediaLinks: true,
          },
        },
      },
    });
```

```typescript
    // Best-effort: emit welcome/credentials email. Never fail the create.
    try {
      // Merge program-owned contact fields back onto the emitted `brand`
      // shape — services/notification reads brand.contactEmail/contactAddress
      // from this event payload's field names, unchanged by this phase.
      const brand = program.brand
        ? { ...program.brand, contactEmail: program.contactEmail, contactAddress: program.contactAddress }
        : null;
      let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
      if (brand?.websiteUrl) baseUrl = brand.websiteUrl.replace(/\/$/, '');
      const normalizedBaseUrl = /^https?:\/\//i.test(baseUrl) ? baseUrl : `https://${baseUrl}`;
      const loginUrl = `${normalizedBaseUrl}/login?role=ambassador`;

      await this.rabbitMQProducerService.emit('notification.ambassador_created', {
        id: ambassador.id,
        email,
        name: ambassador.fullName,
        referralCode: ambassador.referralCode,
        loginUrl,
        brand,
      });
```

Site 2 (`resendCredentials`, ~line 245-264 select, ~line 285-300 read/emit):

```typescript
    const ambassador = await this.prisma.ambassador.findFirst({
      where: { id, deletedAt: null },
      include: {
        user: { select: { email: true } },
        program: {
          select: {
            id: true,
            contactEmail: true,
            contactAddress: true,
            brand: {
              select: {
                id: true,
                name: true,
                websiteUrl: true,
                primaryColor: true,
                logoUrl: true,
                socialMediaLinks: true,
              },
            },
          },
        },
      },
    });
```

```typescript
    const email = ambassador.user?.email;
    if (!email) throw new BadRequestException('Ambassador has no email address on record');

    const brand = ambassador.program?.brand
      ? { ...ambassador.program.brand, contactEmail: ambassador.program.contactEmail, contactAddress: ambassador.program.contactAddress }
      : null;
    let baseUrl = this.configService.get('FRONTEND_URL') || 'http://localhost:3000';
```

- [ ] **Step 2: Repoint `payment-admin.controller.ts` — site 1 (full worked example), ~line 756-800 select / ~916-917 read**

```typescript
                application: {
                    select: {
                        id: true,
                        participant: {
                            select: {
                                fullName: true,
                                userId: true,
                                user: { select: { email: true } },
                            },
                        },
                        program: {
                            select: {
                                contactEmail: true,
                                contactAddress: true,
                                brand: {
                                    select: {
                                        landingUrl: true,
                                        websiteUrl: true,
                                        name: true,
                                        primaryColor: true,
                                        logoUrl: true,
                                        socialMediaLinks: true,
                                        settings: {
                                            select: {
                                                footerNavigation: true,
                                                supportEmail: true,
```

(The rest of that nested `settings.select` block, and everything else in the surrounding query, is unchanged — only `contactEmail`/`contactAddress` moved from inside `brand.select` to the sibling `program.select`.)

```typescript
                    const rawBrand = invoice.application?.program?.brand ?? null;
                    const rawProgram = invoice.application?.program ?? null;
                    const paymentsPageUrl = this.buildParticipantPaymentsUrl(rawBrand);
                    if (!paymentsPageUrl) {
                        this.logger.warn(
                            `payment.rejected for invoice ${id} has no paymentsPageUrl: brand.landingUrl/websiteUrl unset`,
                        );
                    }
                    const brandPayload = rawBrand
                        ? {
                            name: rawBrand.name,
                            primaryColor: rawBrand.primaryColor,
                            logoUrl: rawBrand.logoUrl,
                            websiteUrl: rawBrand.websiteUrl,
                            contactEmail: rawProgram?.contactEmail ?? null,
                            contactAddress: rawProgram?.contactAddress ?? null,
                            socialMediaLinks: rawBrand.socialMediaLinks,
                            settings: rawBrand.settings
                                ? {
```

- [ ] **Step 3: Repoint `payment-admin.controller.ts` — the remaining three sites**

Site 2 (~line 995-1020 select, ~1063-1064 read) — identical transform to Site 1: move `contactEmail: true, contactAddress: true,` out of `brand.select` and onto the sibling `program.select` (which already has `id: true, name: true,` alongside `brand` here); change `contactEmail: rawBrand.contactEmail, contactAddress: rawBrand.contactAddress,` (line 1063-1064) to `contactEmail: rawProgram?.contactEmail ?? null, contactAddress: rawProgram?.contactAddress ?? null,`, and add `const rawProgram = invoice.application?.program ?? null;` next to that site's own `const rawBrand = invoice.application?.program?.brand ?? null;`.

Site 3 (~line 1130-1150 select, ~1178-1180 read) — same transform, this one also carries `contactPhone`:

```typescript
                        program: {
                            select: {
                                id: true,
                                name: true,
                                contactEmail: true,
                                contactPhone: true,
                                contactAddress: true,
                                brand: {
                                    select: {
                                        id: true,
                                        landingUrl: true,
                                        websiteUrl: true,
                                        name: true,
                                        primaryColor: true,
                                        logoUrl: true,
                                    },
                                },
                            },
                        },
```

```typescript
        const rawBrand = invoice.application?.program?.brand ?? null;
        const rawProgram = invoice.application?.program ?? null;
        const brandPayload = rawBrand
            ? {
                name: rawBrand.name,
                logoUrl: rawBrand.logoUrl,
                primaryColor: rawBrand.primaryColor,
                contactEmail: rawProgram?.contactEmail ?? null,
                contactPhone: rawProgram?.contactPhone ?? null,
                contactAddress: rawProgram?.contactAddress ?? null,
                websiteUrl: rawBrand.websiteUrl,
            }
            : null;
```

Site 4 (~line 1409-1416 — this one uses `include`, not `select`, so `Program`'s full row — including the new contact columns — is already pulled in with no query change needed; only the read at ~1458-1459 changes):

```typescript
                    const rawBrand = updatedInvoice.application?.program?.brand ?? null;
                    const rawProgram = updatedInvoice.application?.program ?? null;
                    const brandPayload = rawBrand
                        ? {
                            name: rawBrand.name,
                            primaryColor: rawBrand.primaryColor,
                            logoUrl: rawBrand.logoUrl,
                            websiteUrl: rawBrand.websiteUrl,
                            contactEmail: rawProgram?.contactEmail ?? null,
                            contactAddress: rawProgram?.contactAddress ?? null,
                            socialMediaLinks: rawBrand.socialMediaLinks,
                            settings: rawBrand.settings
                                ? {
                                    footerNavigation: rawBrand.settings.footerNavigation,
                                    supportEmail: rawBrand.settings.supportEmail,
```

- [ ] **Step 4: Repoint `payment-events.controller.ts` — all four sites**

All four sites in this file use `include` (not `select`) — `program: { include: { brand: { include: { settings: true } } } }` — so, exactly like payment-admin.controller.ts's Site 4, `Program`'s full row already carries the new contact columns with no query change once Task 1's migration is deployed. Only the read expression changes, identically at all four sites (~line 74-75, ~220-221, ~363-364, ~695-696):

```typescript
            const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
            const rawProgram = invoiceWithBrand?.application?.program ?? null;
            const brandPayload = rawBrand
                ? {
                      name: rawBrand.name,
                      primaryColor: rawBrand.primaryColor,
                      logoUrl: rawBrand.logoUrl,
                      websiteUrl: rawBrand.websiteUrl,
                      contactEmail: rawProgram?.contactEmail ?? null,
                      contactAddress: rawProgram?.contactAddress ?? null,
                      socialMediaLinks: rawBrand.socialMediaLinks,
                      settings: rawBrand.settings
                          ? {
                                footerNavigation: rawBrand.settings.footerNavigation,
```

(Apply the same three-line change — add `rawProgram`, repoint the two `contactEmail`/`contactAddress` lines — at all four sites. Two of the four name the resolved invoice variable `invoiceWithBrand`, matching the snippet above verbatim; confirm the exact local variable name at each site before editing — it is always either `invoiceWithBrand` or `result?.invoiceId`-derived, per the surrounding code already in the file.)

- [ ] **Step 5: Repoint `portal.controller.ts`**

In `findOwnedInvoiceForDocument` (~line 178-197), move `contactEmail`/`contactPhone`/`contactAddress` from the nested `brand.select` to the sibling `program.select`:

```typescript
                        program: {
                            select: {
                                name: true,
                                logoUrl: true,
                                logoColorUrl: true,
                                contactEmail: true,
                                contactPhone: true,
                                contactAddress: true,
                                brand: {
                                    select: {
                                        name: true,
                                        logoUrl: true,
                                        primaryColor: true,
                                        websiteUrl: true,
                                    },
                                },
                            },
                        },
```

In `toReceiptDocInput` (~line 218-254), read the three fields off `program` instead of `brand`:

```typescript
    private toReceiptDocInput(
        invoice: Awaited<ReturnType<PortalController['findOwnedInvoiceForDocument']>>,
        docType: 'receipt' | 'invoice',
    ): Parameters<PortalReceiptService['generate']>[0] {
        const program = invoice.application.program;
        const participant = invoice.application.participant;
        const brand = program.brand;

        return {
            docType,
            invoiceId: invoice.id,
            status: invoice.status,
            amount: Number(invoice.amount),
            currency: invoice.currency,
            amountUsd: invoice.amountUsd != null ? Number(invoice.amountUsd) : null,
            amountIdr: invoice.amountIdr != null ? Number(invoice.amountIdr) : null,
            exchangeRateSnapshot: invoice.exchangeRateSnapshot != null ? Number(invoice.exchangeRateSnapshot) : null,
            feeProvider: invoice.feeProvider != null ? Number(invoice.feeProvider) : null,
            paidAt: invoice.paidAt,
            createdAt: invoice.createdAt,
            transactionReference: invoice.externalTransactionId ?? null,
            paymentMethod: invoice.paymentMethod ?? null,
            customerName: participant.fullName,
            customerEmail: participant.user.email ?? null,
            customerInstitution: participant.institution ?? null,
            programName: program.name,
            programLogoUrl: program.logoUrl ?? null,
            programLogoColorUrl: program.logoColorUrl ?? null,
            pricingTierName: invoice.pricingTier.name ?? null,
            feeType: invoice.pricingTier.feeType ?? null,
            brand: brand
                ? {
                      name: brand.name,
                      logoUrl: brand.logoUrl ?? null,
                      primaryColor: brand.primaryColor ?? null,
                      contactEmail: program.contactEmail ?? null,
                      contactPhone: program.contactPhone ?? null,
                      contactAddress: program.contactAddress ?? null,
                      websiteUrl: brand.websiteUrl ?? null,
                  }
                : null,
        };
    }
```

- [ ] **Step 6: Document the source change in `portal-receipt.service.ts`**

`PortalReceiptService.generate`'s input type (`~line 58-61`) already declares `contactEmail`/`contactPhone`/`contactAddress` as part of its `brand` parameter shape — that shape does not need to change (the receipt template just labels these "contact us" fields under the brand's letterhead; it does not care which table they came from). Add a comment only, so a future reader does not assume these still come from `Brand`:

```typescript
    brand?: {
        name: string;
        logoUrl: string | null;
        primaryColor: string | null;
        // Sourced from Program as of Phase 3 (docs/superpowers/specs/2026-08-23-program-content-copy-design.md)
        // — the caller (portal.controller.ts's toReceiptDocInput) reads these off
        // application.program, not application.program.brand. Shape unchanged.
        contactEmail: string | null;
        contactPhone: string | null;
        contactAddress: string | null;
        websiteUrl: string | null;
    } | null;
```

- [ ] **Step 7: Verify compile and the affected test suites**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — no errors.
Run: `npx jest --testPathPattern="ambassador-admin.controller.spec"` — an existing spec file for this controller; if it mocks `prisma.program.findUnique`'s return shape or asserts on the emitted `notification.ambassador_created` payload's `brand.contactEmail`/`contactAddress`, update its fixture to the new select shape (`contactEmail`/`contactAddress` on the mocked `program`, not nested under a mocked `program.brand`) so it reflects Step 1's change rather than the pre-Phase-3 shape.
Run: `npx jest --testPathPattern="portal.controller.spec"` — same check against Step 5's change.
Run: `npx jest --testPathPattern="modules/payments"` — PASS (no existing spec covers the two payments controllers touched here, per a direct search of `services/api/src/modules/payments` for `payment-admin.controller.spec.ts`/`payment-events.controller.spec.ts` — neither exists — so this is a regression check on the rest of the payments module, not new coverage of this task's edits).
Run: `npx jest --testPathPattern="modules/participants"` — PASS.

- [ ] **Step 8: Commit**

```bash
cd services/api
git add src/modules/participants/presentation/ambassador-admin.controller.ts src/modules/payments/presentation/payment-admin.controller.ts src/modules/payments/presentation/payment-events.controller.ts src/modules/portal/presentation/portal.controller.ts src/modules/portal/application/services/portal-receipt.service.ts
git commit -m "refactor(contact): repoint program-scoped contact consumers (ambassadors, payments, portal) onto Program"
```

---

## Task 15: `settings.strategy.ts` read switch — contact fields, `Brand` → `Program`

**Files:**
- Modify: `services/api/src/modules/landing/strategies/settings.strategy.ts` (`buildSettingsPayload`, currently lines 84-133)
- Create: `services/api/src/modules/landing/strategies/settings.strategy.spec.ts`

**Interfaces:**
- Consumes: `Program.contactEmail`/`.contactPhone`/`.contactWhatsapp`/`.contactAddress` (Task 1, backfilled by Task 12).
- Produces: `LandingSettingsResponseDto.brand.support_email`/`.contact_phone`/`.contact_whatsapp`/`.address` now sourced from `Program` — consumed by `ybb-program-next` (no code change there, per this plan's Tech Stack section; it already renders whatever this endpoint returns) and by Task 18's before/after payload diff.

The first of the two read-switch tasks (settings before home, matching the order this file's File Structure section already lists them in). This is the smaller of the two: `buildSettingsPayload` already resolves `program` via `this.prisma.program.findFirst({ where: { brandId: category.id, isPublished: true, isActive: true }, orderBy: [{ year: 'desc' }, { createdAt: 'desc' }] })` — **no `select` clause**, so the full `Program` row already includes the four new contact columns as soon as Task 1's migration is deployed, with zero query change needed here. This is also the exact `orderBy` Task 12's backfill and Task 13's `resolveActiveProgramContact` both use, by design (see both tasks' entries) — this file's own query *is* the canonical definition those two match themselves against, not the other way around.

Everything else in `buildSettingsPayload` stays untouched: `favicon_url`/`apple_icon_url` keep reading `Brand.metadata` (Brand-owned per the spec, not part of this phase's move), and `logo_url`/`logo_icon_url`/etc. keep their existing `program?.logoUrl || category.logoUrl` fallback chains unchanged.

- [ ] **Step 1: Write the failing spec (new file — none exists today for this strategy)**

```typescript
// services/api/src/modules/landing/strategies/settings.strategy.spec.ts
import { SettingsStrategy } from './settings.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { LandingSnapshotService } from '../services/landing-snapshot.service';

describe('SettingsStrategy', () => {
    let strategy: SettingsStrategy;
    let mockPrisma: any;
    let mockCache: any;
    let mockSnapshot: any;

    beforeEach(() => {
        mockPrisma = {
            brand: { findMany: jest.fn().mockResolvedValue([]) },
            program: { findFirst: jest.fn().mockResolvedValue(null) },
            brandSetting: { findUnique: jest.fn().mockResolvedValue(null) },
        };
        mockCache = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
        // getData() routes through LandingSnapshotService whenever `category`
        // is non-null — forward straight to the builder so these tests
        // exercise buildSettingsPayload's actual logic, not the snapshot
        // cache's own (separately-tested) behavior.
        mockSnapshot = {
            getOrBuildSettingsSnapshot: jest.fn().mockImplementation((_category: unknown, builder: () => Promise<unknown>) => builder()),
        };
        strategy = new SettingsStrategy(
            mockPrisma as PrismaService,
            mockCache as unknown as CacheService,
            mockSnapshot as unknown as LandingSnapshotService,
        );
    });

    // Brand-level contact columns still physically exist on this fixture
    // (Task 21 hasn't dropped them yet at this point in the migration) —
    // included deliberately so the assertions below can prove the strategy
    // no longer reads them, not merely that they're absent from the type.
    const category = {
        id: 'brand-1', name: 'Istanbul Youth Summit', logoUrl: 'logo.png', logoIconUrl: null,
        logoWhiteUrl: null, logoColorUrl: null, primaryColor: '#000', about: null, description: 'desc',
        defaultCurrency: 'USD', socialMediaLinks: null,
        contactEmail: 'brand-level@example.com', contactPhone: '+90-brand', contactWhatsapp: '90-brand', contactAddress: 'Brand Address',
    } as any;

    it('reads contact fields from the active PROGRAM, not the Brand, once one is resolved', async () => {
        mockPrisma.program.findFirst.mockResolvedValue({
            id: 'p1', name: 'IYS 2026', slug: 'iys-2026', year: 2026, usdInIdr: null,
            logoUrl: null, logoWhiteUrl: null, logoColorUrl: null, logoIconUrl: null, videoUrl: null,
            contactEmail: 'program@iys.com', contactPhone: '+90-program', contactWhatsapp: '90-program', contactAddress: 'Program Address',
        });

        const result: any = await strategy.getData(category);

        expect(result.brand.contact_phone).toBe('+90-program');
        expect(result.brand.contact_whatsapp).toBe('90-program');
        expect(result.brand.address).toBe('Program Address');
        expect(result.brand.support_email).toBe('program@iys.com');
        // Proves the Brand-level values on the fixture above did NOT leak through.
        expect(result.brand.contact_phone).not.toBe('+90-brand');
        expect(result.brand.address).not.toBe('Brand Address');
    });

    it('falls back to undefined contact fields (not the Brand columns) when there is no active program', async () => {
        mockPrisma.program.findFirst.mockResolvedValue(null);

        const result: any = await strategy.getData(category);

        expect(result.brand.contact_phone).toBeUndefined();
        expect(result.brand.contact_whatsapp).toBeUndefined();
        expect(result.brand.address).toBeUndefined();
        expect(result.brand.support_email).toBeUndefined();
    });

    it('support_email still prefers BrandSetting.supportEmail over the program contact email', async () => {
        mockPrisma.brandSetting.findUnique.mockResolvedValue({
            supportEmail: 'support@override.com', isMaintenanceMode: false, maintenanceMessage: null,
            maintenanceScheduledEnd: null, googleAnalyticsId: null, pixelId: null, footerNavigation: null,
        });
        mockPrisma.program.findFirst.mockResolvedValue({ id: 'p1', name: 'IYS 2026', contactEmail: 'program@iys.com' });

        const result: any = await strategy.getData(category);

        expect(result.brand.support_email).toBe('support@override.com');
    });

    it('favicon_url/apple_icon_url still come from Brand.metadata, unaffected by the contact-field switch', async () => {
        const categoryWithMeta = { ...category, metadata: { favicon_url: 'https://cdn/favicon.png', apple_icon_url: 'https://cdn/apple.png' } };
        mockPrisma.program.findFirst.mockResolvedValue(null);

        const result: any = await strategy.getData(categoryWithMeta);

        expect(result.brand.favicon_url).toBe('https://cdn/favicon.png');
        expect(result.brand.apple_icon_url).toBe('https://cdn/apple.png');
    });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="settings.strategy.spec"`
Expected: FAIL — `result.brand.contact_phone` is `'+90-brand'` (the Brand-level fixture value), not `'+90-program'`; the "falls back to undefined" test fails because `category.contactPhone` still resolves to `'+90-brand'` even with no active program.

- [ ] **Step 3: Switch the four contact reads**

In `services/api/src/modules/landing/strategies/settings.strategy.ts`, inside `buildSettingsPayload`'s returned `brand` object (currently lines 104-119), change:

```typescript
                support_email: settings?.supportEmail || category.contactEmail || undefined,
```

to:

```typescript
                support_email: settings?.supportEmail || program?.contactEmail || undefined,
```

and change:

```typescript
                contact_phone: category.contactPhone || undefined,
                contact_whatsapp: category.contactWhatsapp || undefined,
                address: category.contactAddress || undefined,
```

to:

```typescript
                contact_phone: program?.contactPhone || undefined,
                contact_whatsapp: program?.contactWhatsapp || undefined,
                address: program?.contactAddress || undefined,
```

No other line in this file changes — `favicon_url`/`apple_icon_url` keep reading `readBrandMetadataString(category, ...)`, and every `logo_*` field keeps its existing `program?.logoUrl || category.logoUrl` fallback chain.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="settings.strategy.spec"`
Expected: PASS — 4 passing tests.

- [ ] **Step 5: Verify compile and the landing module suite**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run: `npx jest --testPathPattern="modules/landing"` — PASS (includes the pre-existing `home.strategy.spec.ts`, untouched by this task).

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/landing/strategies/settings.strategy.ts src/modules/landing/strategies/settings.strategy.spec.ts
git commit -m "feat(landing): switch settings.strategy.ts contact fields from Brand to Program"
```

---

## Task 16: `home.strategy.ts` read switch — landing sections, `impact_stats`, and removing the `program_objectives` override

**Files:**
- Modify: `services/api/src/modules/landing/landing.module.ts` (import `PlatformSettingsModule` so `PlatformSettingRepository` is injectable)
- Modify: `services/api/src/modules/landing/strategies/home.strategy.ts` (`getData`, currently lines 92-263)
- Modify: `services/api/src/modules/landing/strategies/home.strategy.spec.ts` (existing file — add coverage, do not remove the existing "aggregates data" test)

**Interfaces:**
- Consumes: `Program.landingContent`, `PROGRAM_LANDING_CONTENT_KEYS` (Task 1, backfilled by Task 12); `PlatformSettingRepository.get('impact_stats')` (Task 3, backfilled by Task 12).
- Produces: the `program_benefits`/`program_features`/`promo_cta`/`program_shorts`/`further_information`/`payment_info`/`program_impact` sections of `GET /landing/home`'s response, now sourced from `Program`/`PlatformSetting` — consumed by `ybb-program-next` (no code change there) and by Task 18's before/after payload diff.

Six of this file's `brandMeta.<key>` reads switch to `programLandingContent.<key>` (the seven-key allow-list minus `participant_demographics`, which nothing reads either before or after — see Global Constraints). `impact_stats` switches to a platform-wide `PlatformSettingRepository` call — not `program.landingContent`, because it was never one of the 7 program-owned keys; it is organisation-wide, per the spec's ownership table. `section_background` and `recognition` **do not** move — both stay reading `brandMeta`, because both stay Brand-owned per the spec. And `program_objectives`'s `brandMeta.program_objectives` override is removed outright, not migrated anywhere: the spec's audit already confirmed "no brand has it" set in production, so this is a zero-behavior-change deletion of dead branching, not a data-loss risk — the section keeps rendering from the real `ProgramObjective` relation (`fallbackObjectiveItems`), exactly as it already does for every brand today.

- [ ] **Step 1: Extend the existing spec — new test proving the switch, plus the required DI mock**

In `services/api/src/modules/landing/strategies/home.strategy.spec.ts`, add the `PlatformSettingRepository` import and mock, and wire it into the `TestingModule`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HomeStrategy } from './home.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { PlatformSettingRepository } from '@modules/platform-settings/infrastructure/persistence/platform-setting.repository';

describe('HomeStrategy', () => {
    let strategy: HomeStrategy;

    const mockPrismaService = {
        // ...unchanged, see existing file...
    };

    const mockCacheService = {
        // ...unchanged, see existing file...
    };

    const mockPlatformSettingRepository = {
        get: jest.fn().mockResolvedValue(null),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                HomeStrategy,
                { provide: PrismaService, useValue: mockPrismaService },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PlatformSettingRepository, useValue: mockPlatformSettingRepository },
            ],
        }).compile();

        strategy = module.get<HomeStrategy>(HomeStrategy);

        jest.clearAllMocks();
    });

    // ...existing 'should be defined' / 'should return default structure' /
    // 'should aggregate data into correct sections' tests are UNCHANGED —
    // that fixture's category.metadata only has participant_demographics and
    // its mocked program has no landingContent, so every switched section
    // below simply renders its empty-state default, exactly as it already
    // does today. No existing assertion in that test touches
    // program_benefits/program_features/program_shorts/payment_info/
    // promo_cta/program_impact content, so none of them can regress here.

    it('reads benefits/features/promo_cta/moments_shorts/further_information/payment_info from Program.landingContent, not Brand.metadata, and impact_stats from PlatformSetting, not Brand.metadata', async () => {
        const category = {
            id: 'cat-1', name: 'Test Brand', bannerUrl: 'http://banner.jpg', websiteUrl: 'http://brand.com',
            vision: 'Vision', mission: 'Mission',
            // Brand-level metadata carries DIFFERENT values for the same keys
            // — proves the assertions below are reading Program/PlatformSetting,
            // not falling back to (or accidentally still reading) this.
            metadata: {
                benefits: { eyebrow: 'BRAND eyebrow', title: 'BRAND title', groups: [] },
                features: [{ id: 'brand-f', icon: 'x', title: 'BRAND feature', description: '' }],
                promo_cta: { title: 'BRAND promo' },
                moments_shorts: { eyebrow: 'BRAND shorts' },
                further_information: { title: 'BRAND further info' },
                payment_info: { eyebrow: 'BRAND payment', title: 'x', introText: 'x', items: [], note: 'x' },
                impact_stats: { total_alumni: 'BRAND-STALE-999' },
            },
        };

        mockPrismaService.program.findFirst.mockResolvedValueOnce({
            id: 'prog-1', name: 'Main Program',
            gallery: [], pricingTiers: [], resources: [], objectives: [], awards: [],
            landingContent: {
                benefits: { eyebrow: 'PROGRAM eyebrow', title: 'PROGRAM title', groups: [] },
                features: [{ id: 'prog-f', icon: 'y', title: 'PROGRAM feature', description: '' }],
                promo_cta: { title: 'PROGRAM promo' },
                moments_shorts: { eyebrow: 'PROGRAM shorts' },
                further_information: { title: 'PROGRAM further info' },
                payment_info: { eyebrow: 'PROGRAM payment', title: 'y', introText: 'y', items: [], note: 'y' },
            },
        });
        mockPrismaService.programGallery.findMany.mockResolvedValue([]);
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([]);
        mockPlatformSettingRepository.get.mockResolvedValue({
            key: 'impact_stats',
            value: { total_alumni: '1700+', editions_held: '15+', total_countries: '50+', total_participants: '1700+' },
            updatedAt: new Date(), updatedBy: null,
        });

        const result: any = await strategy.getData(category as any);
        const sections = result.sections;

        expect(sections.find((s: any) => s.type === 'program_benefits')?.content.eyebrow).toBe('PROGRAM eyebrow');
        expect(sections.find((s: any) => s.type === 'program_features')?.content.items[0].title).toBe('PROGRAM feature');
        expect(sections.find((s: any) => s.type === 'program_shorts')?.content.eyebrow).toBe('PROGRAM shorts');
        expect(sections.find((s: any) => s.type === 'further_information')?.content.title).toBe('PROGRAM further info');
        expect(sections.find((s: any) => s.type === 'payment_info')?.content.eyebrow).toBe('PROGRAM payment');
        // promo_cta merges via object spread (`...programLandingContent.promo_cta`)
        // rather than reading individual named sub-fields — assert the actual
        // merge behavior instead: the spread value for a key present in the
        // patch (title) wins over the section's own default.
        expect(sections.find((s: any) => s.type === 'promo_cta')?.content.title).toBe('PROGRAM promo');

        expect(sections.find((s: any) => s.type === 'program_impact')?.content.stats).toEqual([
            { id: 'participants', label: 'Total Participants', value: '1700+', icon: 'participants' },
            { id: 'countries', label: 'Total Countries', value: '50+', icon: 'countries' },
            { id: 'alumni', label: 'Total Alumni', value: '1700+', icon: 'alumni' },
        ]);
        expect(mockPlatformSettingRepository.get).toHaveBeenCalledWith('impact_stats');
    });

    it('program_objectives renders from the real ProgramObjective relation even when Brand.metadata.program_objectives is set — the override is removed, not merely deprioritized', async () => {
        const category = {
            id: 'cat-1', name: 'Test Brand', bannerUrl: 'http://banner.jpg', websiteUrl: 'http://brand.com',
            vision: 'Vision', mission: 'Mission',
            metadata: { program_objectives: { eyebrow: 'STALE override', title: 'STALE title', items: ['Stale item'] } },
        };

        mockPrismaService.program.findFirst.mockResolvedValueOnce({
            id: 'prog-1', name: 'Main Program',
            gallery: [], pricingTiers: [], resources: [],
            objectives: [{ id: 'obj-1', description: 'Real relation objective', order: 1 }],
            awards: [],
        });
        mockPrismaService.programGallery.findMany.mockResolvedValue([]);
        mockPrismaService.sponsor.findMany.mockResolvedValue([]);
        mockPrismaService.brandSocialFeed.findMany.mockResolvedValue([]);
        mockPrismaService.program.findMany.mockResolvedValue([]);
        mockPrismaService.programTestimonial.findMany.mockResolvedValue([]);
        mockPrismaService.participantApplication.findMany.mockResolvedValue([]);

        const result: any = await strategy.getData(category as any);
        const objectives = result.sections.find((s: any) => s.type === 'program_objectives');

        expect(objectives?.content.eyebrow).toBe('Program Objective'); // hardcoded default, not 'STALE override'
        expect(objectives?.content.items).toEqual([{ id: 'obj-1', description: 'Real relation objective', order: 1 }]);
    });
});
```

(The two ellipsis comments — `mockPrismaService`/`mockCacheService` "unchanged" — mean literally that: do not modify those two object literals at all in this step; only add the `mockPlatformSettingRepository` const, the new provider entry, and the two new `it` blocks above.)

- [ ] **Step 2: Run the spec to verify the new tests fail**

Run (from `services/api/`): `npx jest --testPathPattern="home.strategy.spec"`
Expected: the two new tests FAIL — `program_benefits`'s `eyebrow` is `'BRAND eyebrow'` (still reading `brandMeta`), and the `program_objectives` test's `eyebrow` is `'STALE override'` (the override still applies). The pre-existing "aggregates data" test also currently FAILS at this step, but for an unrelated reason — the `TestingModule` now requires `PlatformSettingRepository` as a provider (added in Step 1) and `HomeStrategy`'s constructor does not accept it yet — fix that in Step 3 alongside the read-source switches, then re-run.

- [ ] **Step 3: Make the switch**

**3a — `landing.module.ts`: make `PlatformSettingRepository` injectable here**

```typescript
import { Module } from '@nestjs/common';
import { LandingController } from './landing.controller';
import { LandingService } from './landing.service';
import { HomeStrategy } from './strategies/home.strategy';
import { AboutStrategy } from './strategies/about.strategy';
import { ProgramsStrategy } from './strategies/programs.strategy';
import { PartnersSponsorsStrategy } from './strategies/partners-sponsors.strategy';
import { AnnouncementsStrategy } from './strategies/announcements.strategy';
import { SettingsStrategy } from './strategies/settings.strategy';
import { FaqsStrategy } from './strategies/faqs.strategy';
import { ActivityStrategy } from './strategies/activity.strategy';
import { LandingSnapshotService } from './services/landing-snapshot.service';
import { PlatformSettingsModule } from '@modules/platform-settings/platform-settings.module';

@Module({
  imports: [PlatformSettingsModule],
  controllers: [LandingController],
  providers: [
    LandingService,
    HomeStrategy,
    AboutStrategy,
    ProgramsStrategy,
    PartnersSponsorsStrategy,
    AnnouncementsStrategy,
    SettingsStrategy,
    FaqsStrategy,
    ActivityStrategy,
    LandingSnapshotService,
  ],
  exports: [LandingService],
})
export class LandingModule {}
```

**3b — `home.strategy.ts`: inject the repository**

```typescript
import { Injectable } from '@nestjs/common';
import { ILandingPageStrategy } from './landing-page.strategy';
import { PrismaService } from '../../../shared/infrastructure/prisma/prisma.service';
import { CacheService } from '../../../shared/infrastructure/cache/cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../../shared/constants/cache-keys';
import { Brand } from '@prisma/client';
import { resolveMaskedFileUrl } from '@shared/utils/masked-file-url';
import {
  buildParticipantDistributionLevels,
  normalizeCountryGroups,
  resolveCountryName,
} from '@shared/utils/country-groups';
import { PlatformSettingRepository } from '@modules/platform-settings/infrastructure/persistence/platform-setting.repository';
```

```typescript
@Injectable()
export class HomeStrategy implements ILandingPageStrategy {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cacheService: CacheService,
    private readonly platformSettingRepository: PlatformSettingRepository,
  ) { }
```

**3c — add the `impact_stats` fetch to the existing `Promise.all`**

Append one more entry to the destructured array and the promise list (currently lines 120-270):

```typescript
    const [program, brandImageGallery, brandSponsors, socialFeeds, videoPrograms, alumniTestimonials, delegateTestimonials, registeredApplications, platformImpactStatsRow] = await Promise.all([
      this.prisma.program.findFirst({
        // ...unchanged...
      }),
      // ...six more unchanged entries...
      this.prisma.participantApplication.findMany({
        // ...unchanged...
      }),
      this.platformSettingRepository.get('impact_stats'),
    ]);
```

**3d — replace the `objectivesMeta`/`furtherInformationMeta`/`globalBg` block**

Replace (currently lines 314-316):

```typescript
    const objectivesMeta = (brandMeta.program_objectives as ProgramObjectivesMetadata | undefined) ?? {};
    const furtherInformationMeta = normalizeFurtherInformationContent(brandMeta.further_information);
    const globalBg = (brandMeta.section_background as SectionBackgroundMetadata | undefined);
```

with:

```typescript
    // Program-owned landing sections (Task 1's Program.landingContent), not
    // Brand.metadata, as of Phase 3's ownership split — see
    // docs/superpowers/specs/2026-08-23-program-content-copy-design.md,
    // "Brand and program ownership split". section_background stays reading
    // brandMeta below: it is explicitly Brand-owned ("global across landing
    // sections" per its own original comment) and unaffected by this switch.
    const programLandingContent = (program?.landingContent as Record<string, unknown>) ?? {};
    const furtherInformationMeta = normalizeFurtherInformationContent(programLandingContent.further_information);
    const globalBg = (brandMeta.section_background as SectionBackgroundMetadata | undefined);
```

(The `ProgramObjectivesMetadata` type import/declaration at the top of the file, currently lines 17-22, becomes unused — remove it. `objectivesMeta` had no other reader.)

**3e — remove the `objectiveItemsFromMetadata` block entirely**

Delete (currently lines 332-339):

```typescript
    const objectiveItemsFromMetadata = (objectivesMeta.items ?? [])
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter((item) => item.length > 0)
      .map((description, index) => ({
        id: `meta-objective-${index + 1}`,
        description,
        order: index + 1,
      }));
```

`fallbackObjectiveItems` (the line immediately above this block) stays — it is the real `ProgramObjective` relation data and is now the section's only source.

**3f — simplify the `program_objectives` section content**

Replace (currently lines 411-424):

```typescript
        {
          type: 'program_objectives',
          content: {
            eyebrow: (objectivesMeta.eyebrow || '').trim() || 'Program Objective',
            title: (objectivesMeta.title || '').trim() || 'Program Objectives',
            intro:
              (objectivesMeta.intro || '').trim() ||
              `The ${brand.name} program is carefully designed to shape delegates into impactful young leaders. Through a mix of forums, competitions, and collaborative projects, participants are guided to grow in character, skills, and global perspective.`,
            items: objectiveItemsFromMetadata.length > 0 ? objectiveItemsFromMetadata : fallbackObjectiveItems,
            // `gallery` is canonical; keep `images` for backwards compatibility.
            gallery: objectiveImages,
            images: objectiveImages,
          }
        },
```

with:

```typescript
        {
          type: 'program_objectives',
          content: {
            // No metadata override any more — objectives have exactly one
            // owner, the ProgramObjective relation (fallbackObjectiveItems).
            // The spec's audit confirmed no production brand had a
            // program_objectives override set, so this is a zero-behavior-
            // change removal, not a data-loss risk.
            eyebrow: 'Program Objective',
            title: 'Program Objectives',
            intro: `The ${brand.name} program is carefully designed to shape delegates into impactful young leaders. Through a mix of forums, competitions, and collaborative projects, participants are guided to grow in character, skills, and global perspective.`,
            items: fallbackObjectiveItems,
            // `gallery` is canonical; keep `images` for backwards compatibility.
            gallery: objectiveImages,
            images: objectiveImages,
          }
        },
```

**3g — `payment_info` section: switch the content source**

Replace (currently line 444):

```typescript
          content: normalizePaymentInfoContent(brandMeta.payment_info) || {
```

with:

```typescript
          content: normalizePaymentInfoContent(programLandingContent.payment_info) || {
```

**3h — `program_shorts` (moments shorts) section: switch the content source**

Replace (currently lines 487-489):

```typescript
            eyebrow: (brandMeta.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.eyebrow || 'Short Highlights',
            title: (brandMeta.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.title || 'Discover Our Moments in 60 Seconds',
            description: (brandMeta.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.description || `Watch bite-sized highlights from ${brand.name}'s workshops and cultural sessions.`,
```

with:

```typescript
            eyebrow: (programLandingContent.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.eyebrow || 'Short Highlights',
            title: (programLandingContent.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.title || 'Discover Our Moments in 60 Seconds',
            description: (programLandingContent.moments_shorts as { eyebrow?: string; title?: string; description?: string } | undefined)?.description || `Watch bite-sized highlights from ${brand.name}'s workshops and cultural sessions.`,
```

**3i — `program_impact` section: switch to the platform-wide value**

Replace (currently lines 500-511):

```typescript
        {
          type: 'program_impact',
          content: {
            eyebrow: 'Global Reach',
            title: 'Global Program Impact',
            stats: brandMeta.impact_stats
              ? [
                  { id: 'participants', label: 'Total Participants', value: (brandMeta.impact_stats as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown } | undefined)?.total_participants, icon: 'participants' },
                  { id: 'countries', label: 'Total Countries', value: (brandMeta.impact_stats as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown } | undefined)?.total_countries, icon: 'countries' },
                  { id: 'alumni', label: 'Total Alumni', value: (brandMeta.impact_stats as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown } | undefined)?.total_alumni, icon: 'alumni' },
                ]
              : [],
          },
        },
```

with:

```typescript
        {
          type: 'program_impact',
          content: {
            eyebrow: 'Global Reach',
            title: 'Global Program Impact',
            // Platform-wide, not brand-scoped — see Task 3/12. Was
            // brandMeta.impact_stats (byte-identical across three brands,
            // i.e. already a de-facto platform value that had merely been
            // triplicated); now a single PlatformSetting row every brand reads.
            stats: platformImpactStatsRow?.value
              ? [
                  { id: 'participants', label: 'Total Participants', value: (platformImpactStatsRow.value as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown }).total_participants, icon: 'participants' },
                  { id: 'countries', label: 'Total Countries', value: (platformImpactStatsRow.value as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown }).total_countries, icon: 'countries' },
                  { id: 'alumni', label: 'Total Alumni', value: (platformImpactStatsRow.value as { total_participants?: unknown; total_countries?: unknown; total_alumni?: unknown }).total_alumni, icon: 'alumni' },
                ]
              : [],
          },
        },
```

**3j — `program_features` section: switch the items source**

Replace (currently line 519):

```typescript
            items: ((brandMeta['features'] || []) as Array<{ id?: unknown; icon?: unknown; title?: unknown; description?: unknown }>).map((f) => ({
```

with:

```typescript
            items: ((programLandingContent['features'] || []) as Array<{ id?: unknown; icon?: unknown; title?: unknown; description?: unknown }>).map((f) => ({
```

**3k — `program_benefits` section: switch the content source**

Replace (currently line 530):

```typescript
            ...(brandMeta.benefits || {
```

with:

```typescript
            ...(programLandingContent.benefits || {
```

**3l — `promo_cta` section: switch the content source (three occurrences)**

Replace (currently lines 646, 650-652):

```typescript
            ...((brandMeta.promo_cta as Record<string, unknown>) || {}),
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
            text_color_scheme: sectionTextColorScheme,
            video_url: (brandMeta.promo_cta as { video_url?: string } | undefined)?.video_url || program?.videoUrl || null,
            video_title: (brandMeta.promo_cta as { video_title?: string } | undefined)?.video_title || (program ? `${program.name} Registration Guideline` : null),
            video_description: (brandMeta.promo_cta as { video_description?: string } | undefined)?.video_description || null,
```

with:

```typescript
            ...((programLandingContent.promo_cta as Record<string, unknown>) || {}),
            background_image_url: sectionBgDesktop,
            background_image_mobile_url: sectionBgMobile,
            text_color_scheme: sectionTextColorScheme,
            video_url: (programLandingContent.promo_cta as { video_url?: string } | undefined)?.video_url || program?.videoUrl || null,
            video_title: (programLandingContent.promo_cta as { video_title?: string } | undefined)?.video_title || (program ? `${program.name} Registration Guideline` : null),
            video_description: (programLandingContent.promo_cta as { video_description?: string } | undefined)?.video_description || null,
```

`recognition` (the `program_recognition`-family section) and `section_background` (`globalBg`) are **not** touched anywhere in this task — both stay reading `brandMeta`, per the spec's Brand-owned list.

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="home.strategy.spec"`
Expected: PASS — all 5 tests (3 pre-existing, 2 new).

- [ ] **Step 5: Verify compile and the landing module suite**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors. (Confirms `ProgramObjectivesMetadata`'s removal in Step 3d didn't leave a dangling import, and that `landing.module.ts`'s new `imports` array resolves.)
Run: `npx jest --testPathPattern="modules/landing"` — PASS.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/landing/landing.module.ts src/modules/landing/strategies/home.strategy.ts src/modules/landing/strategies/home.strategy.spec.ts
git commit -m "feat(landing): switch home.strategy.ts landing sections to Program/PlatformSetting, remove program_objectives override"
```

---

## Task 17: `purge-landing-caches-all-brands.ts` — clear all three cache layers, every active brand

**Files:**
- Create: `services/api/scripts/purge-landing-caches-all-brands.ts`

**Interfaces:**
- Consumes: `LandingCacheInvalidationService.invalidate(brandId, options)` (existing, unchanged by this phase — `services/api/src/modules/brands/application/services/landing-cache-invalidation.service.ts`).
- Produces: no new symbols. Task 18's diff script depends on this task having already run (a stale cached response would make the before/after diff meaningless — see this plan's Global Constraints).

Per this plan's Global Constraints, cache purge is only observable when all three layers are cleared **per brand, keyed by brand id** — Redis (`CACHE_KEYS.LANDING_HOME`/`LANDING_SETTINGS`/`LANDING_SNAPSHOT`), the Postgres `brand_landing_snapshots` table, and `ybb-program-next`'s `unstable_cache` (via the revalidate webhook). `LandingCacheInvalidationService.invalidate()` already does all three in one call — this script's entire job is calling it once per active brand, not reimplementing any of the three layers by hand.

That service's two real dependencies, `CacheService` (Redis client config) and `LandingRevalidationService` (`ConfigService`-sourced webhook secrets), are not simple enough to hand-construct safely in a raw-`PrismaClient`-style script the way Tasks 10-12 do — duplicating their construction here would risk drifting out of sync with `app.module.ts`'s real wiring. This script instead bootstraps the full Nest application context (`NestFactory.createApplicationContext`, no HTTP listener) and resolves the already-correctly-wired service from it. This is heavier than this phase's other scripts (it loads every module in `app.module.ts`, including ones this script doesn't need, e.g. `RabbitMQModule`) but is the only way to get a `LandingCacheInvalidationService` instance that is guaranteed to behave identically to the one every real request handler already uses.

This task is **not TDD** — there is no pure branching logic to extract (the entire script is "list brands, call an existing service"), matching Task 10's precedent for scripts with no classification logic. Verification is a dry run plus a documented, environment-dependent `--apply` check.

- [ ] **Step 1: Write the script**

```typescript
// services/api/scripts/purge-landing-caches-all-brands.ts
/**
 * purge-landing-caches-all-brands.ts
 *
 * Phase 3 Task 17 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Purges all three landing-cache layers (Redis, brand_landing_snapshots,
 * and ybb-program-next's unstable_cache via the revalidate webhook) for
 * every active brand, using the same LandingCacheInvalidationService every
 * write-path handler in this codebase already uses.
 *
 * Bootstraps the full Nest application context (no HTTP listener) rather
 * than hand-constructing CacheService/LandingRevalidationService — see this
 * task's plan-doc entry for why.
 *
 * Makes no Postgres schema/data changes, but DOES have an observable side
 * effect (busts caches, fires the ybb-program-next revalidate webhook), so
 * it still respects --apply like this phase's other scripts: dry run lists
 * which brands would be purged, --apply actually purges them.
 *
 * USAGE (from services/api):
 *   npx ts-node -r tsconfig-paths/register scripts/purge-landing-caches-all-brands.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/purge-landing-caches-all-brands.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Running this against production,
 * immediately after Task 16 deploys, is a separate human-approved
 * deployment step.
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../src/modules/brands/application/services/landing-cache-invalidation.service';

async function main(): Promise<void> {
    const APPLY = process.argv.includes('--apply');
    console.log(`[purge-landing-caches-all-brands] mode: ${APPLY ? 'APPLY (will purge caches + fire revalidation)' : 'DRY RUN (list only)'}`);

    const app = await NestFactory.createApplicationContext(AppModule, { logger: false });
    try {
        // strict: false — resolve these from anywhere in the container, not
        // only from providers BrandsModule/PrismaModule explicitly export.
        const prisma = app.get(PrismaService, { strict: false });
        const landingCacheInvalidation = app.get(LandingCacheInvalidationService, { strict: false });

        const brands = await prisma.brand.findMany({
            where: { isActive: true, deletedAt: null },
            select: { id: true, name: true, slug: true },
            orderBy: { name: 'asc' },
        });

        console.log(`[purge-landing-caches-all-brands] ${brands.length} active brand(s) to purge:`);
        console.table(brands.map((b) => ({ brand: b.name, slug: b.slug, id: b.id })));

        if (!APPLY) {
            console.log('[purge-landing-caches-all-brands] DRY RUN complete. Re-run with --apply to purge the brands above.');
            return;
        }

        let succeeded = 0;
        let failed = 0;
        for (const brand of brands) {
            try {
                // invalidate() swallows its own cache/webhook failures by
                // default (swallowErrors: true) and logs them internally —
                // this try/catch only catches an unexpected error the
                // service itself doesn't already handle (e.g. a bug), not
                // "Redis was unreachable" or "the webhook 500'd", which
                // print via the service's own console.error instead.
                await landingCacheInvalidation.invalidate(brand.id, { revalidate: { kind: 'homeAndSettings' } });
                succeeded++;
                console.log(`[purge-landing-caches-all-brands] purged: ${brand.name}`);
            } catch (err) {
                failed++;
                console.error(`[purge-landing-caches-all-brands] FAILED for ${brand.name}:`, err);
            }
        }
        console.log(`[purge-landing-caches-all-brands] done. ${succeeded} succeeded, ${failed} failed.`);
        if (failed > 0) process.exitCode = 1;
    } finally {
        await app.close();
    }
}

main().catch((err) => {
    console.error('[purge-landing-caches-all-brands] FAILED:', err);
    process.exitCode = 1;
});
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — no errors.

- [ ] **Step 3: Dry-run against the local/dev environment**

Run (from `services/api/`, local/dev `DATABASE_URL`): `npx ts-node -r tsconfig-paths/register scripts/purge-landing-caches-all-brands.ts`
Expected: the Nest application context boots (this takes longer than Tasks 10-12's scripts — every module in `app.module.ts` loads, including ones this script doesn't use), then prints a table of every active brand in the dev DB, then "DRY RUN complete."

- [ ] **Step 4: `--apply` against the local/dev environment, with local Redis and (optionally) a local `ybb-program-next` dev server running**

Run: `npx ts-node -r tsconfig-paths/register scripts/purge-landing-caches-all-brands.ts --apply`
Expected: `purged: <brand name>` printed for every active brand, then `done. N succeeded, 0 failed.` This exercises the Redis and Postgres-snapshot layers directly (both require only the local Redis + Postgres already running for local `services/api` development) — the third layer (the `ybb-program-next` revalidate webhook) will log an internal warning if no `ybb-program-next` dev server is reachable at `LANDING_URL`, which is expected in an API-only local setup and does not fail the script (the failure is swallowed inside `LandingRevalidationService`, per this task's description). Running with `ybb-program-next` also running locally lets you additionally confirm the webhook calls succeed (`200` in that process's own logs).

- [ ] **Step 5: Commit**

```bash
cd services/api
git add scripts/purge-landing-caches-all-brands.ts
git commit -m "feat(scripts): add purge-landing-caches-all-brands.ts (Phase 3 read-switch cache purge)"
```

---

## Task 18: `diff-landing-payloads.ts` — per-brand before/after rendered-payload verification

**Files:**
- Create: `services/api/scripts/diff-landing-payloads.ts`
- Create: `services/api/scripts/diff-landing-payloads.spec.ts`

**Interfaces:**
- Consumes: `GET /landing/home` and `GET /landing/settings` (existing, unauthenticated, resolved via the `x-brand-domain` header — `services/api/src/modules/landing/landing.controller.ts`).
- Produces: `diffBrandPayload()`, `normalizeForDiff()` — pure, exported, unit-tested functions; two timestamped capture JSON files under `scripts/backups/` per run, consumed by a human (or a follow-up run of this same script in `--diff` mode).

**Concretely, this is what "verify every brand renders identically before and after" (the spec's Migration step 4) means as an executable check:**

- **Endpoint captured:** `GET /landing/home` and `GET /landing/settings`, once per brand, identified via the `x-brand-domain` header (the same mechanism `ybb-program-next` itself uses — confirmed in `landing.controller.ts`).
- **Which brands:** exactly the brands `GET /landing/settings`'s own `available_brands` list already returns (a `category: null` request, i.e. no `x-brand-domain` header) — this is the API's own live definition of "brands served by the new stack," so this script never hardcodes a separate legacy-PHP exclusion list that could silently drift out of sync with reality. A brand still on the legacy PHP stack is, by construction, excluded here — not captured, not diffed, and never reported as a failure (per this plan's Global Constraints).
- **How compared:** a structural deep-diff of the two JSON payloads, with one deliberate exception — `home.strategy.ts`'s image-gallery Fisher-Yates shuffle (confirmed in the source: `imageGallery`, and everything derived from it — `program_objectives.gallery`/`.images`, `program_highlights.gallery`/`.image_gallery`, `program_gallery.gallery`/`.images`) re-randomizes on every cache-miss build, so two genuinely-identical-content fetches of the *same unmodified brand* can still differ in the order of those specific arrays. Comparing them by array order would report false positives on every brand, every time, drowning out any real regression. This script compares `gallery`/`images`/`image_gallery`-keyed arrays **as sets** (sorted by their serialized content) and everything else **order-sensitively** — the exact and only exception, not a blanket "ignore array order" rule that would hide a real reordering bug elsewhere (e.g. `footer_navigation` or `program_features.items`, both of which should NOT reorder between two runs).
- **What constitutes a pass:** for every captured brand, `diffBrandPayload(before, after).changedPaths` is empty. Any non-empty result is a genuine content difference for that brand and must be investigated before Task 21 is allowed to run — per this phase's ordering, the phase can be paused at Task 18 indefinitely without harm (nothing before Task 21 is destructive), so there is no time pressure to explain away a real diff.

- [ ] **Step 1: Write the failing spec for the pure diff functions**

```typescript
// services/api/scripts/diff-landing-payloads.spec.ts
import { diffBrandPayload, normalizeForDiff, type BrandPayloadCapture } from './diff-landing-payloads';

function mkCapture(overrides: Partial<BrandPayloadCapture> = {}): BrandPayloadCapture {
  return {
    brandSlug: 'istanbul-youth-summit',
    brandName: 'Istanbul Youth Summit',
    home: { title: 'IYS', sections: [{ type: 'program_benefits', content: { eyebrow: 'e', title: 't' } }] },
    settings: { brand: { name: 'IYS', contact_phone: '+90' } },
    ...overrides,
  };
}

describe('diffBrandPayload', () => {
  it('reports no changed paths for two identical captures', () => {
    const capture = mkCapture();
    const result = diffBrandPayload(capture, { ...capture });
    expect(result.changedPaths).toEqual([]);
  });

  it('reports the exact dot-path of a real content difference', () => {
    const before = mkCapture();
    const after = mkCapture({
      home: { title: 'IYS', sections: [{ type: 'program_benefits', content: { eyebrow: 'e', title: 'CHANGED' } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths).toEqual(['home.sections.0.content.title']);
  });

  it('reports a settings-side difference under the settings prefix', () => {
    const before = mkCapture();
    const after = mkCapture({ settings: { brand: { name: 'IYS', contact_phone: '+90-CHANGED' } } });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths).toEqual(['settings.brand.contact_phone']);
  });

  // The core false-positive this script exists to suppress: home.strategy.ts's
  // Fisher-Yates gallery shuffle reorders the SAME items on every build.
  it('does NOT report a gallery reorder (same items, different order) as a change', () => {
    const before = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'a' }, { id: 'b' }, { id: 'c' }] } }] },
    });
    const after = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'c' }, { id: 'a' }, { id: 'b' } ] } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths).toEqual([]);
  });

  // But a genuinely DIFFERENT gallery (an item added/removed/changed, not
  // merely reordered) must still be caught — set comparison, not "ignore".
  it('DOES report a gallery with an actually different item, even though it is set-compared', () => {
    const before = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'a' }, { id: 'b' }] } }] },
    });
    const after = mkCapture({
      home: { sections: [{ type: 'program_gallery', content: { gallery: [{ id: 'a' }, { id: 'DIFFERENT' }] } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths.length).toBeGreaterThan(0);
  });

  // A non-gallery array (e.g. footer_navigation, or program_features.items)
  // stays order-sensitive — reordering IS a real, reportable change there.
  it('reports a reorder of a non-gallery-keyed array as a change', () => {
    const before = mkCapture({
      home: { sections: [{ type: 'program_features', content: { items: [{ id: 'f1' }, { id: 'f2' }] } }] },
    });
    const after = mkCapture({
      home: { sections: [{ type: 'program_features', content: { items: [{ id: 'f2' }, { id: 'f1' }] } }] },
    });
    const result = diffBrandPayload(before, after);
    expect(result.changedPaths.length).toBeGreaterThan(0);
  });
});

describe('normalizeForDiff', () => {
  it('sorts a gallery-keyed array into a canonical order', () => {
    const a = normalizeForDiff([{ id: 'b' }, { id: 'a' }], 'gallery');
    const b = normalizeForDiff([{ id: 'a' }, { id: 'b' }], 'gallery');
    expect(a).toEqual(b);
  });

  it('leaves a non-gallery-keyed array in its original order', () => {
    const result = normalizeForDiff([{ id: 'b' }, { id: 'a' }], 'items');
    expect(result).toEqual([{ id: 'b' }, { id: 'a' }]);
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="diff-landing-payloads.spec"`
Expected: FAIL — cannot find module `./diff-landing-payloads`.

- [ ] **Step 3: Write the pure functions and the HTTP-touching wrapper**

```typescript
// services/api/scripts/diff-landing-payloads.ts
/**
 * diff-landing-payloads.ts
 *
 * Phase 3 Task 18 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Captures GET /landing/home + GET /landing/settings for every brand on the
 * new stack (per GET /landing/settings's own available_brands list — this
 * is how legacy-PHP brands are excluded, not a hardcoded list), then diffs
 * two captures against each other. See this task's plan-doc entry for the
 * concrete "endpoint / which brands / how compared / what's a pass"
 * definition this script implements.
 *
 * USAGE (from services/api, API_BASE_URL pointing at the TARGET api, default http://localhost:3000):
 *   npx ts-node -r tsconfig-paths/register scripts/diff-landing-payloads.ts --capture before
 *   # ...deploy Tasks 15-16, run Task 17's cache purge...
 *   npx ts-node -r tsconfig-paths/register scripts/diff-landing-payloads.ts --capture after
 *   npx ts-node -r tsconfig-paths/register scripts/diff-landing-payloads.ts --diff before after
 *
 * NEVER point API_BASE_URL at production from an interactive agent session
 * — see this plan's Global Constraints. Capturing "before"/"after" against
 * production is a separate human-approved deployment step run alongside the
 * actual Task 15/16/17 production deploys, in that order.
 */
import { join } from 'path';
import { writeFileSync, mkdirSync, readFileSync } from 'fs';

export interface BrandPayloadCapture {
    brandSlug: string;
    brandName: string;
    home: unknown;
    settings: unknown;
}

export interface BrandDiffResult {
    brandSlug: string;
    brandName: string;
    changedPaths: string[];
}

// Keys whose array value is a product of home.strategy.ts's Fisher-Yates
// image-gallery shuffle (imageGallery, and everything sliced from it:
// objectiveImages, highlightGallery, programGallery) — re-randomized on
// every cache-miss build, so order alone must never be treated as a
// content change for these three keys specifically. See this task's
// plan-doc entry for why this is a narrow exception, not a blanket rule.
const SET_COMPARED_ARRAY_KEYS = new Set(['gallery', 'images', 'image_gallery']);

export function normalizeForDiff(value: unknown, keyHint?: string): unknown {
    if (Array.isArray(value)) {
        const normalized = value.map((item) => normalizeForDiff(item));
        if (keyHint && SET_COMPARED_ARRAY_KEYS.has(keyHint)) {
            return [...normalized].sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
        }
        return normalized;
    }
    if (value && typeof value === 'object') {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, v]) => [key, normalizeForDiff(v, key)]),
        );
    }
    return value;
}

function collectDiffPaths(a: unknown, b: unknown, path: string, out: string[]): void {
    if (JSON.stringify(a) === JSON.stringify(b)) return;
    if (a && b && typeof a === 'object' && typeof b === 'object' && !Array.isArray(a) && !Array.isArray(b)) {
        const keys = new Set([...Object.keys(a as object), ...Object.keys(b as object)]);
        for (const key of keys) {
            collectDiffPaths((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key], `${path}.${key}`, out);
        }
        return;
    }
    out.push(path);
}

export function diffBrandPayload(before: BrandPayloadCapture, after: BrandPayloadCapture): BrandDiffResult {
    const changedPaths: string[] = [];
    collectDiffPaths(normalizeForDiff(before.home), normalizeForDiff(after.home), 'home', changedPaths);
    collectDiffPaths(normalizeForDiff(before.settings), normalizeForDiff(after.settings), 'settings', changedPaths);
    return { brandSlug: before.brandSlug, brandName: before.brandName, changedPaths };
}

// ─── HTTP-touching wrapper ──────────────────────────────────────────────

/* istanbul ignore next -- exercised by running --capture/--diff against a real API, not a Jest test */
async function fetchJson(baseUrl: string, path: string, brandDomain?: string): Promise<unknown> {
    const response = await fetch(`${baseUrl}${path}`, {
        headers: brandDomain ? { 'x-brand-domain': brandDomain } : {},
    });
    if (!response.ok) {
        throw new Error(`${path} for ${brandDomain ?? '(no brand)'} -> HTTP ${response.status}`);
    }
    return response.json();
}

/* istanbul ignore next */
async function capture(label: string): Promise<void> {
    const baseUrl = process.env.API_BASE_URL ?? 'http://localhost:3000';
    console.log(`[diff-landing-payloads] capturing "${label}" from ${baseUrl}`);

    const settings = (await fetchJson(baseUrl, '/landing/settings')) as {
        available_brands?: Array<{ slug: string; name: string; landing_url?: string; website_url?: string }>;
    };
    const brands = settings.available_brands ?? [];
    console.log(`[diff-landing-payloads] ${brands.length} brand(s) on the new stack (available_brands) to capture.`);

    const captures: BrandPayloadCapture[] = [];
    for (const brand of brands) {
        const domain = brand.landing_url || brand.website_url;
        if (!domain) {
            console.warn(`[diff-landing-payloads] SKIP ${brand.name}: no landing_url/website_url to resolve x-brand-domain from.`);
            continue;
        }
        const brandDomain = domain.replace(/^https?:\/\//, '').replace(/\/$/, '');
        const [home, brandSettings] = await Promise.all([
            fetchJson(baseUrl, '/landing/home', brandDomain),
            fetchJson(baseUrl, '/landing/settings', brandDomain),
        ]);
        captures.push({ brandSlug: brand.slug, brandName: brand.name, home, settings: brandSettings });
        console.log(`[diff-landing-payloads] captured: ${brand.name}`);
    }

    const backupDir = join(__dirname, 'backups');
    mkdirSync(backupDir, { recursive: true });
    const outPath = join(backupDir, `diff-landing-payloads-${label}.json`);
    writeFileSync(outPath, JSON.stringify(captures, null, 2));
    console.log(`[diff-landing-payloads] wrote ${captures.length} brand capture(s) -> ${outPath}`);
}

/* istanbul ignore next */
async function diff(beforeLabel: string, afterLabel: string): Promise<void> {
    const backupDir = join(__dirname, 'backups');
    const before = JSON.parse(readFileSync(join(backupDir, `diff-landing-payloads-${beforeLabel}.json`), 'utf-8')) as BrandPayloadCapture[];
    const after = JSON.parse(readFileSync(join(backupDir, `diff-landing-payloads-${afterLabel}.json`), 'utf-8')) as BrandPayloadCapture[];

    const afterBySlug = new Map(after.map((c) => [c.brandSlug, c]));
    const results: BrandDiffResult[] = [];
    for (const beforeCapture of before) {
        const afterCapture = afterBySlug.get(beforeCapture.brandSlug);
        if (!afterCapture) {
            results.push({ brandSlug: beforeCapture.brandSlug, brandName: beforeCapture.brandName, changedPaths: ['MISSING_FROM_AFTER_CAPTURE'] });
            continue;
        }
        results.push(diffBrandPayload(beforeCapture, afterCapture));
    }

    const failing = results.filter((r) => r.changedPaths.length > 0);
    console.log(`[diff-landing-payloads] ${results.length} brand(s) compared, ${failing.length} with differences.`);
    if (failing.length === 0) {
        console.log('[diff-landing-payloads] PASS — every brand renders identically before and after.');
        return;
    }
    for (const f of failing) {
        console.log(`[diff-landing-payloads] DIFF: ${f.brandName}`);
        console.log(f.changedPaths.map((p) => `  - ${p}`).join('\n'));
    }
    process.exitCode = 1;
}

/* istanbul ignore next */
async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args[0] === '--capture' && args[1]) {
        await capture(args[1]);
        return;
    }
    if (args[0] === '--diff' && args[1] && args[2]) {
        await diff(args[1], args[2]);
        return;
    }
    console.error('Usage: diff-landing-payloads.ts --capture <label>  |  diff-landing-payloads.ts --diff <before-label> <after-label>');
    process.exitCode = 1;
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[diff-landing-payloads] FAILED:', err);
        process.exitCode = 1;
    });
}
```

- [ ] **Step 4: Run the spec to verify it passes**

Run: `npx jest --testPathPattern="diff-landing-payloads.spec"`
Expected: PASS — 8 passing tests.

- [ ] **Step 5: Verify compile, then a local capture/diff round-trip**

Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run (from `services/api/`, local API running on `http://localhost:3000` or `API_BASE_URL` set accordingly): `npx ts-node -r tsconfig-paths/register scripts/diff-landing-payloads.ts --capture smoke-test`
Expected: a `services/api/scripts/backups/diff-landing-payloads-smoke-test.json` file is created, containing one entry per brand in the local DB's `available_brands` list.
Run: `npx ts-node -r tsconfig-paths/register scripts/diff-landing-payloads.ts --capture smoke-test-2` immediately after (no data changes in between), then `npx ts-node -r tsconfig-paths/register scripts/diff-landing-payloads.ts --diff smoke-test smoke-test-2`
Expected: `PASS — every brand renders identically before and after.` This specific round-trip is the sharpest local proof this script actually suppresses the gallery-shuffle false positive described above — two genuinely back-to-back captures of an unmodified brand will still have re-shuffled `imageGallery`-derived arrays (a fresh cache-miss build fires on almost every request in a local dev DB with a short/absent Redis TTL), so a PASS here on a local run, before any Phase 3 read-switch code has even been written, is what proves the diff logic itself is sound — not a no-op check.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add scripts/diff-landing-payloads.ts scripts/diff-landing-payloads.spec.ts
git commit -m "feat(scripts): add diff-landing-payloads.ts (Phase 3 per-brand before/after verification)"
```

---

## Task 19: Admin UI — new Program Contact + Landing Page Content sections

**Files:**
- Modify: `services/admin-dashboard/app/platform/api.ts` (new types/functions)
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/shared.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/BenefitsSheet.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/FeaturesSheet.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/PromoCtaSheet.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/FurtherInformationSheet.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/MomentsShortsSheet.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/landing-content/PaymentInfoSheet.tsx`
- Create: `services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/ProgramContactSheet.tsx`
- Modify: `services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/ProgramSpecificsTab.tsx`
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/program-details/page.tsx`
- Create: `services/admin-dashboard/app/platform/settings/platform-content/page.tsx`

**Interfaces:**
- Consumes: `PUT /programs/:id/contact` (Task 4), `PUT /programs/:id/landing-content` (Task 5), `GET`/`PUT /platform-settings/impact-stats` (Task 6), `Program.landingContent` riding along on the existing `GET /admin/programs/:id` response (Task 1 Step 7); Phase 1's `CopyFromProgramDialog` (`app/components/shared/copy-from-program/CopyFromProgramDialog.tsx`), unmodified.
- Produces: no new backend-facing symbols — this task is entirely admin-dashboard UI wiring onto already-shipped (Tasks 4-6) endpoints.

Compile-verified, not TDD — the admin dashboard has no test runner (`dev`/`build`/`start`/`lint` only, confirmed in `package.json`); verification is `npx tsc --noEmit` and `npm run lint`, matching this plan's stated house rule for this package.

**Why this task exists where it does, not later:** per this file's renumbering note (just above Task 7), the original sketch placed the admin UI cutover *after* the backend column drop. Working through the sequencing surfaced a real bug in that ordering — the old Brand-level UI this task's sibling, Task 20, removes must stop being able to write to `Brand.metadata`'s moved keys and `Brand`'s contact/meta columns **before** Task 21 drops them, or an admin using stale UI would silently resurrect a just-stripped key with zero live effect (the public site already reads from `Program` by then). This task builds the replacement first; Task 20 removes the old surfaces next; only then does Task 21 drop the columns.

**Why six landing-content sheets move nearly unchanged:** every one of `BenefitsSheet`/`FeaturesSheet`/`PromoCtaSheet`/`FurtherInformationSheet`/`MomentsShortsSheet`/`PaymentInfoSheet` (currently in `BrandDetailPage.tsx`) already follows the exact same shape — local form state seeded from an `initial` prop, a `handleSave` that PUTs a patch and reports success/failure. The only things that change per sheet are: (1) the prop that identifies where to write (`brandId` → `programId`), (2) the persistence call (`updatePlatformBrandMetadata(brandId, {...})` → `updateProgramLandingContent(programId, {patch: {...}})`), and (3) the save-success callback shape (`onSaved(updated: BrandMetadata)` → `onSaved(): void`, because — unlike the old `PUT /brands/:brandId/metadata` endpoint, which returns the updated metadata object — Task 5's `PUT /programs/:id/landing-content` returns only `{ message }`, matching every other program-content endpoint in this plan; the caller re-fetches instead, exactly like `program-details/page.tsx`'s existing `handleSaveSpecifics` already does). Everything else — every form field, every piece of JSX, `BenefitGroupImageField`'s whole media-picker — moves verbatim. This task therefore specifies each sheet as "copy the named lines from `BrandDetailPage.tsx` verbatim, then apply this diff" rather than reprinting hundreds of unchanged lines already fully visible in the current repo.

- [ ] **Step 1: Add the new admin API client functions and types**

In `services/admin-dashboard/app/platform/api.ts`, add near the existing `BrandMetadata`-family types (after the `updatePlatformBrandMetadata` function, ~line 651):

```typescript
// ─── Program-owned contact + landing content (Phase 3 ownership split) ───────
// Mirrors BrandMetadata's structured section types but scoped to
// Program.landingContent (PUT /programs/:id/landing-content, partial merge,
// 7-key allow-list enforced server-side) — reuses BenefitGroup/BrandFeature/
// BrandPromoCta/BrandMomentsShorts/BrandFurtherInformation/BrandPaymentInfo,
// same shapes, now Program-owned instead of Brand-owned.
export type ProgramLandingContent = {
  benefits?: { eyebrow: string; title: string; groups: BenefitGroup[] };
  features?: BrandFeature[];
  promo_cta?: BrandPromoCta;
  moments_shorts?: BrandMomentsShorts;
  further_information?: BrandFurtherInformation;
  payment_info?: BrandPaymentInfo;
  participant_demographics?: Record<string, unknown>;
};

// No dedicated GET function for landingContent — it already rides along on
// the general admin program detail response (program-detail-response.dto.ts)
// that program-details/page.tsx already fetches for every other field on
// this page (Task 1 Step 7). A separate getProgramLandingContent() wrapper
// would have no caller in this task's wiring — Step 7 below reads
// detail.landingContent straight off the same ProgramDetail the page
// already holds, same as every other field on that type.

// PUT /programs/:id/landing-content merges the patch server-side and
// returns only { message } (matching every other program-content endpoint
// in this plan) — the caller re-fetches the program detail to see the
// merged result, it is not returned here.
export function updateProgramLandingContent(
  programId: string,
  patch: Partial<ProgramLandingContent>,
): Promise<{ message: string }> {
  return request<{ message: string }>(`/programs/${programId}/landing-content`, {
    method: "PUT",
    body: JSON.stringify({ patch }),
  });
}

export type ProgramContact = {
  contactEmail?: string;
  contactPhone?: string;
  contactWhatsapp?: string;
  contactAddress?: string;
};

// PUT /programs/:id/contact REPLACES the whole block (not a patch) — an
// omitted field clears to null server-side, matching UpdateProgramContactHandler.
export function updateProgramContact(programId: string, contact: ProgramContact): Promise<{ message: string }> {
  return request<{ message: string }>(`/programs/${programId}/contact`, {
    method: "PUT",
    body: JSON.stringify(contact),
  });
}

// ─── Platform settings (organisation-wide, not brand/program-scoped) ─────────

export type ImpactStats = {
  totalAlumni: string | null;
  editionsHeld: string | null;
  totalCountries: string | null;
  totalParticipants: string | null;
};

export function getImpactStats(): Promise<ImpactStats> {
  return request<ImpactStats>("/platform-settings/impact-stats");
}

export function updateImpactStats(patch: Partial<ImpactStats>): Promise<ImpactStats> {
  return request<ImpactStats>("/platform-settings/impact-stats", {
    method: "PUT",
    body: JSON.stringify(patch),
  });
}
```

- [ ] **Step 2: Create the shared field primitives + media-picker module for the moved sheets**

`BrandDetailPage.tsx` defines `FieldInput`, `FieldTextarea`, `SheetMsg`, `clampFileTitle`, `normalizeBenefitGroup`/`normalizeBenefitGroups`, `DEFAULT_PAYMENT_INFO_ITEMS`/`normalizePaymentInfo`, `isImageMediaFile`, and `BenefitGroupImageField` as **module-private** helpers (confirmed — none of them are exported or imported from elsewhere; `grep -n "function FieldInput\|function SheetMsg\|function normalizeBenefitGroup" BrandDetailPage.tsx` finds only local definitions). The six sheets below need all of them. Rather than duplicating this logic per sheet file, or reaching into `BrandDetailPage.tsx` internals (Task 20 deletes those definitions once the old sheets that used them are gone), create one shared module both this task's new sheets AND (until Task 20 lands) `BrandDetailPage.tsx`'s still-live old sheets can independently use — copied, not re-exported, because `BrandDetailPage.tsx` is out of scope for this task and Task 20 is what retires its copies:

```typescript
// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/shared.tsx
// Copied verbatim from app/platform/brands/[brandId]/BrandDetailPage.tsx's
// module-private helpers (FieldInput, FieldTextarea, SheetMsg, clampFileTitle,
// normalizeBenefitGroup(s), DEFAULT_PAYMENT_INFO_ITEMS/normalizePaymentInfo,
// isImageMediaFile, BenefitGroupImageField) — see this task's plan-doc entry
// for why this is a copy, not a shared import, and Task 20 for where
// BrandDetailPage.tsx's own copies are retired.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon, Layers, Upload, X } from "lucide-react";
import { Label } from "@/src/ui/label";
import { Input } from "@/src/ui/input";
import { Button } from "@/src/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/src/ui/dialog";
import {
  listProgramMedia,
  type MediaFile,
} from "@/src/shared/api-client";
// uploadFileViaPresignedUrl is NOT used in this module — BenefitGroupImageField
// only manages file selection/preview; the actual upload happens in the
// calling sheet's own handleSave (see BenefitsSheet.tsx / FurtherInformationSheet.tsx
// Step 3/4 below, which import it directly from @/src/shared/api-client).
import { listPlatformPrograms, type PlatformProgram } from "@/app/platform/api";
import type { BenefitGroup, BenefitItem, BrandPaymentInfo, BrandPaymentInfoItem } from "@/app/platform/api";

const FILE_TITLE_MAX_LEN = 255;
export function clampFileTitle(filename: string): string {
  return filename.slice(0, FILE_TITLE_MAX_LEN);
}

export function FieldInput({
  label, id, value, onChange, placeholder, type = "text", hint,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; type?: string; hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
      {hint && <p className="text-xs text-zinc-400">{hint}</p>}
    </div>
  );
}

export function FieldTextarea({
  label, id, value, onChange, placeholder, rows = 3,
}: {
  label: string; id: string; value: string; onChange: (v: string) => void;
  placeholder?: string; rows?: number;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <textarea
        id={id} rows={rows} value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm placeholder:text-zinc-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
      />
    </div>
  );
}

export function SheetMsg({ message, variant }: { message: string | null; variant: "error" | "success" }) {
  if (!message) return null;
  const cls = variant === "error"
    ? "border-red-200 bg-red-50 text-red-700"
    : "border-emerald-200 bg-emerald-50 text-emerald-700";
  return <p className={`rounded-lg border px-3 py-2 text-xs ${cls}`}>{message}</p>;
}

export function normalizeBenefitGroup(group: Partial<BenefitGroup> | undefined, index: number): BenefitGroup {
  return {
    id: typeof group?.id === "string" && group.id.trim().length > 0 ? group.id : `group_${Date.now()}_${index}`,
    title: typeof group?.title === "string" ? group.title : "",
    imageUrl: typeof group?.imageUrl === "string" ? group.imageUrl : "",
    items:
      Array.isArray(group?.items) && group.items.length > 0
        ? group.items.map((item) => (typeof item === "string" ? item : ""))
        : ([""] as BenefitItem[]),
  };
}

export function normalizeBenefitGroups(groups: BenefitGroup[] | undefined): BenefitGroup[] {
  return (groups ?? []).map((group, index) => normalizeBenefitGroup(group, index));
}

export const DEFAULT_PAYMENT_INFO_ITEMS: BrandPaymentInfoItem[] = [
  { id: "payment-schedule", icon: "payment_schedule", title: "Payment Schedule", body: "All participants pay program fees in scheduled batches, not as a single upfront payment." },
  { id: "selection-quota", icon: "selection_quota", title: "Selection Quota", body: "Fully funded slots are limited and competitive based on qualifications and available funding." },
  { id: "fully-funded-process", icon: "fully_funded_process", title: "Fully Funded Process", body: "Complete the registration fee, submit the required documents and essay, and participate in the interview process." },
  { id: "self-funded-guarantee", icon: "self_funded_guarantee", title: "Refund Policy", body: "Self-funded participants who are declined receive a full refund in line with our refund policy." },
];

export function normalizePaymentInfo(value: BrandPaymentInfo | undefined): BrandPaymentInfo {
  const items = Array.isArray(value?.items) && value.items.length > 0
    ? value.items.map((item, index) => ({
        id: item.id?.trim() || `payment-item-${index + 1}`,
        icon: item.icon?.trim() || "payment_schedule",
        title: item.title ?? "",
        body: item.body ?? "",
      }))
    : DEFAULT_PAYMENT_INFO_ITEMS;

  return {
    eyebrow: value?.eyebrow ?? "Payment & Selection",
    title: value?.title ?? "Important information before you apply",
    introText: value?.introText ?? "Understand how the payment schedule and fully funded selection work so you can choose the best registration type for you.",
    items,
    note: value?.note ?? "All payments are processed securely. For queries, contact our support team.",
  };
}

function isImageMediaFile(file: MediaFile): boolean {
  return file.content_type?.startsWith("image/") ?? false;
}

// Verbatim copy of BrandDetailPage.tsx's BenefitGroupImageField
// (~lines 191-380 there). Still takes `brandId` — the media library is
// brand-scoped regardless of which surface (Brand or Program) is editing a
// benefit group, so this component needs no changes beyond being callable
// from a Program-scoped caller, which already has brandId available via
// programDetail.brand.id.
export function BenefitGroupImageField({
  brandId, groupId, value, pendingFile, onFileChange, onUrlChange, onClear,
}: {
  brandId: string; groupId: string; value?: string; pendingFile: File | null;
  onFileChange: (file: File | null) => void; onUrlChange: (url: string) => void; onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [programs, setPrograms] = useState<PlatformProgram[]>([]);
  const [programsLoading, setProgramsLoading] = useState(false);
  const [programsError, setProgramsError] = useState<string | null>(null);
  const [selectedProgramId, setSelectedProgramId] = useState("");
  const [files, setFiles] = useState<MediaFile[]>([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [filesError, setFilesError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const pendingPreviewUrl = useMemo(() => (pendingFile ? URL.createObjectURL(pendingFile) : null), [pendingFile]);

  useEffect(() => {
    return () => {
      if (pendingPreviewUrl) URL.revokeObjectURL(pendingPreviewUrl);
    };
  }, [pendingPreviewUrl]);

  const loadFiles = useCallback(
    async (programId: string) => {
      if (!programId) {
        setFiles([]);
        setFilesError(null);
        return;
      }
      setFilesLoading(true);
      setFilesError(null);
      try {
        const result = await listProgramMedia({ programId, brandId, limit: 100 });
        setFiles((result.files ?? []).filter(isImageMediaFile));
      } catch (err) {
        setFiles([]);
        setFilesError(err instanceof Error ? err.message : "Failed to load media.");
      } finally {
        setFilesLoading(false);
      }
    },
    [brandId],
  );

  const openLibrary = useCallback(async () => {
    setPickerOpen(true);
    setSearch("");
    setProgramsLoading(true);
    setProgramsError(null);
    try {
      const result = await listPlatformPrograms({ brandId, limit: 100 });
      setPrograms(result.data);
      const nextProgramId = result.data[0]?.id ?? "";
      setSelectedProgramId(nextProgramId);
      if (nextProgramId) {
        await loadFiles(nextProgramId);
      } else {
        setFiles([]);
        setFilesError(null);
      }
    } catch (err) {
      setPrograms([]);
      setProgramsError(err instanceof Error ? err.message : "Failed to load programs.");
      setFiles([]);
      setFilesError(null);
    } finally {
      setProgramsLoading(false);
    }
  }, [brandId, loadFiles]);

  const previewUrl = pendingPreviewUrl ?? value ?? null;
  const visibleFiles = search.trim()
    ? files.filter((file) => (file.original_filename || file.filename || "").toLowerCase().includes(search.trim().toLowerCase()))
    : files;

  // JSX below is a verbatim copy of BenefitGroupImageField's return
  // statement in BrandDetailPage.tsx (lines 297-465) — every prop/state
  // reference above matches 1:1, so nothing in this JSX changes.
  return (
    <div className="space-y-2">
      <Label htmlFor={`g-img-${groupId}`}>Image</Label>

      <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white">
        <div
          className="flex h-40 items-center justify-center bg-zinc-50 cursor-pointer"
          onClick={() => inputRef.current?.click()}
        >
          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={previewUrl} alt="Benefit group preview" className="h-full w-full object-cover" />
          ) : (
            <div className="flex flex-col items-center gap-2 text-zinc-400">
              <ImageIcon className="h-8 w-8" />
              <span className="text-xs">Upload or pick an image</span>
            </div>
          )}
        </div>

        <div className="space-y-2 border-t border-zinc-100 p-3">
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" type="button" onClick={() => inputRef.current?.click()}>
              <Upload className="mr-1 h-3.5 w-3.5" /> Upload image
            </Button>
            <Button size="sm" variant="outline" type="button" onClick={() => void openLibrary()}>
              <Layers className="mr-1 h-3.5 w-3.5" /> Media library
            </Button>
            {(pendingFile || value) ? (
              <Button size="sm" variant="ghost" type="button" onClick={onClear}>
                <X className="mr-1 h-3.5 w-3.5" /> Clear
              </Button>
            ) : null}
          </div>

          <Input
            id={`g-img-${groupId}`}
            value={value ?? ""}
            onChange={(event) => onUrlChange(event.target.value)}
            placeholder="https://..."
          />
          <p className="text-xs text-zinc-400">
            Paste a direct URL, upload a new image, or choose one from a program media library.
          </p>
          {pendingFile ? (
            <p className="text-xs font-medium text-blue-600">
              {pendingFile.name} selected. Save changes to upload and persist it.
            </p>
          ) : null}
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0] ?? null;
          onFileChange(file);
          event.target.value = "";
        }}
      />

      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent className="max-w-4xl overflow-hidden p-0">
          <DialogHeader className="border-b border-zinc-200 px-6 py-4">
            <DialogTitle>Pick Benefit Image</DialogTitle>
          </DialogHeader>

          <div className="space-y-3 border-b border-zinc-200 bg-zinc-50/70 px-6 py-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,220px)_1fr]">
              <div className="space-y-1.5">
                <Label htmlFor={`benefit-program-${groupId}`}>Program media library</Label>
                <select
                  id={`benefit-program-${groupId}`}
                  value={selectedProgramId}
                  onChange={(event) => {
                    const nextProgramId = event.target.value;
                    setSelectedProgramId(nextProgramId);
                    void loadFiles(nextProgramId);
                  }}
                  disabled={programsLoading || programs.length === 0}
                  className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {programs.length === 0 ? <option value="">No programs available</option> : null}
                  {programs.map((program) => (
                    <option key={program.id} value={program.id}>
                      {program.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor={`benefit-search-${groupId}`}>Search images</Label>
                <Input
                  id={`benefit-search-${groupId}`}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search media files..."
                />
              </div>
            </div>

            {programsError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {programsError}
              </div>
            ) : null}
          </div>

          <div className="max-h-[60vh] overflow-y-auto px-6 py-4">
            {programsLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500">Loading programs…</div>
            ) : programs.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No programs are available for this brand yet. Upload a new image instead.
              </div>
            ) : filesLoading ? (
              <div className="py-12 text-center text-sm text-zinc-500">Loading media…</div>
            ) : filesError ? (
              <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {filesError}
              </div>
            ) : visibleFiles.length === 0 ? (
              <div className="py-12 text-center text-sm text-zinc-500">
                No matching images were found for the selected program.
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                {visibleFiles.map((file) => {
                  const url = file.url ?? file.download_url;
                  return (
                    <button
                      key={file.id}
                      type="button"
                      onClick={() => {
                        if (!url) return;
                        onUrlChange(url);
                        setPickerOpen(false);
                      }}
                      className="overflow-hidden rounded-lg border border-zinc-200 bg-white text-left shadow-sm transition hover:border-blue-400 hover:shadow-md"
                    >
                      <div className="flex h-28 items-center justify-center bg-zinc-100">
                        {url ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={url} alt={file.original_filename} className="h-full w-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-zinc-300" />
                        )}
                      </div>
                      <div className="px-2 py-1.5">
                        <p className="truncate text-[11px] font-medium text-zinc-800">{file.original_filename}</p>
                        <p className="truncate text-[10px] text-zinc-400">{file.asset_type ?? file.content_type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
```

- [ ] **Step 3: Move and repoint `BenefitsSheet.tsx`**

Adapted from `BrandDetailPage.tsx` lines 1313-1573 — every field, group-management function, and the whole image-upload flow moves unchanged; only the two lines noted inline (the persistence call and the success callback) differ from the source:

```typescript
// services/admin-dashboard/app/components/programDetailsMasterData/landing-content/BenefitsSheet.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { Label } from "@/src/ui/label";
import { Plus, Save, X } from "lucide-react";
import { useAuth } from "@/app/contexts/AuthContext";
import { updateProgramLandingContent, type BenefitGroup, type ProgramLandingContent } from "@/app/platform/api";
import { FieldInput, SheetMsg, normalizeBenefitGroup, normalizeBenefitGroups, BenefitGroupImageField, clampFileTitle } from "./shared";
import { uploadFileViaPresignedUrl } from "@/src/shared/api-client";

export function BenefitsSheet({
  programId,
  brandId,
  initial,
  onSaved,
}: {
  programId: string;
  brandId: string;
  initial: ProgramLandingContent["benefits"];
  onSaved: () => void;
}) {
  const { adminProfile } = useAuth();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [eyebrow, setEyebrow] = useState(initial?.eyebrow ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [groups, setGroups] = useState<BenefitGroup[]>(normalizeBenefitGroups(initial?.groups));
  const [pendingImages, setPendingImages] = useState<Record<string, File | null>>({});

  function resetState() {
    setEyebrow(initial?.eyebrow ?? "");
    setTitle(initial?.title ?? "");
    setGroups(normalizeBenefitGroups(initial?.groups));
    setPendingImages({});
    setError(null);
  }

  function addGroup() {
    setGroups((gs) => [...gs, normalizeBenefitGroup({ title: "", imageUrl: "", items: [""] }, gs.length)]);
  }

  function removeGroup(idx: number) {
    setGroups((gs) => {
      const target = gs[idx];
      if (target) {
        setPendingImages((current) => {
          const next = { ...current };
          delete next[target.id];
          return next;
        });
      }
      return gs.filter((_, i) => i !== idx);
    });
  }

  function setGroupField(idx: number, field: keyof BenefitGroup, value: string) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, [field]: value } : g)));
  }

  function setGroupImageFile(idx: number, file: File | null) {
    setGroups((gs) => {
      const target = gs[idx];
      if (!target) return gs;
      setPendingImages((current) => ({ ...current, [target.id]: file }));
      return gs;
    });
  }

  function setGroupImageUrl(idx: number, url: string) {
    setGroups((gs) => gs.map((group, groupIndex) => (groupIndex === idx ? { ...group, imageUrl: url } : group)));
    setPendingImages((current) => {
      const target = groups[idx];
      if (!target) return current;
      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }

  function clearGroupImage(idx: number) {
    setGroups((gs) => gs.map((group, groupIndex) => (groupIndex === idx ? { ...group, imageUrl: "" } : group)));
    setPendingImages((current) => {
      const target = groups[idx];
      if (!target) return current;
      const next = { ...current };
      delete next[target.id];
      return next;
    });
  }

  function setGroupItems(idx: number, items: string[]) {
    setGroups((gs) => gs.map((g, i) => (i === idx ? { ...g, items } : g)));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      if (Object.values(pendingImages).some(Boolean) && !adminProfile?.userId) {
        throw new Error("An admin user session is required before images can be uploaded.");
      }

      const resolvedGroups = await Promise.all(
        groups.map(async (group) => {
          const pendingFile = pendingImages[group.id];
          let imageUrl = group.imageUrl || undefined;

          if (pendingFile) {
            const upload = await uploadFileViaPresignedUrl(pendingFile, {
              userId: adminProfile!.userId,
              brandId,
              bucket: "brands",
              assetType: "image",
              title: clampFileTitle(pendingFile.name),
              altText: group.title || title || eyebrow || "Benefit group image",
            });

            if (!upload.publicUrl) {
              throw new Error(`Image upload succeeded for ${pendingFile.name} but no public URL was returned.`);
            }

            imageUrl = upload.publicUrl;
          }

          return {
            ...group,
            imageUrl,
            items: group.items.map((item) => item.trim()).filter(Boolean),
          };
        }),
      );

      // Was: await updatePlatformBrandMetadata(brandId, { benefits: { eyebrow, title, groups: resolvedGroups } });
      //      onSaved(updated) — the old endpoint returned the updated metadata object.
      await updateProgramLandingContent(programId, {
        benefits: { eyebrow, title, groups: resolvedGroups },
      });
      toast.success("Benefits section updated.");
      setPendingImages({});
      setOpen(false);
      onSaved(); // was onSaved(updated) — caller re-fetches instead, see this task's plan-doc entry
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Program Benefits</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-5">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Eyebrow text" id="ben-eyebrow" value={eyebrow} onChange={setEyebrow} placeholder="Program Benefits" />
            <FieldInput label="Section title" id="ben-title" value={title} onChange={setTitle} placeholder="Built for Students & Professionals" />

            <div className="border-t border-zinc-100 pt-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">Audience Groups</p>
                <Button size="sm" variant="outline" onClick={addGroup}>
                  <Plus className="mr-1 h-3.5 w-3.5" /> Add Group
                </Button>
              </div>
              <div className="space-y-4">
                {groups.map((group, gi) => (
                  <div key={group.id} className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-zinc-500">Group {gi + 1}</p>
                      <Button size="sm" variant="ghost" onClick={() => removeGroup(gi)}>
                        <X className="h-3.5 w-3.5 text-red-500" />
                      </Button>
                    </div>
                    <FieldInput label="Title" id={`g-title-${gi}`} value={group.title} onChange={(v) => setGroupField(gi, "title", v)} placeholder="Benefits for High School Students" />
                    <BenefitGroupImageField
                      brandId={brandId}
                      groupId={group.id}
                      value={group.imageUrl}
                      pendingFile={pendingImages[group.id] ?? null}
                      onFileChange={(file) => setGroupImageFile(gi, file)}
                      onUrlChange={(url) => setGroupImageUrl(gi, url)}
                      onClear={() => clearGroupImage(gi)}
                    />
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label>Benefit Items</Label>
                        <button
                          type="button"
                          className="text-xs text-blue-500 hover:underline"
                          onClick={() => setGroupItems(gi, [...group.items, ""])}
                        >
                          + Add item
                        </button>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((item, ii) => (
                          <div key={ii} className="flex gap-2">
                            <input
                              className="flex-1 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                              value={item}
                              placeholder={`Item ${ii + 1}`}
                              onChange={(e) => {
                                const newItems = [...group.items];
                                newItems[ii] = e.target.value;
                                setGroupItems(gi, newItems);
                              }}
                            />
                            <button
                              type="button"
                              className="shrink-0 text-zinc-400 hover:text-red-500"
                              onClick={() => setGroupItems(gi, group.items.filter((_, i) => i !== ii))}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                {groups.length === 0 && (
                  <p className="py-4 text-center text-sm text-zinc-400">No groups yet. Add a group to create one.</p>
                )}
              </div>
            </div>
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 4: Move and repoint the remaining five sheets**

Each follows the identical two-line transform. Copy each sheet's full body verbatim from the cited `BrandDetailPage.tsx` line range, rename the `brandId` prop to also accept it under a `programId` prop (source of the write), and apply:

**`FeaturesSheet.tsx`** (source: `BrandDetailPage.tsx:1577-1671`):

```typescript
// Was:
const updated = await updatePlatformBrandMetadata(brandId, { features });
onSaved(updated);
// Becomes:
await updateProgramLandingContent(programId, { features });
onSaved();
```

Props: `{ programId, initial, onSaved }: { programId: string; initial: BrandFeature[] | undefined; onSaved: () => void }` (drops `brandId` entirely — this sheet never uploads media, so it never needed `brandId` beyond the old metadata write).

**`PromoCtaSheet.tsx`** (source: `BrandDetailPage.tsx:1961-2029`):

```typescript
// Was:
const updated = await updatePlatformBrandMetadata(brandId, { promo_cta: form });
onSaved(updated);
// Becomes:
await updateProgramLandingContent(programId, { promo_cta: form });
onSaved();
```

Props: `{ programId, initial, onSaved }: { programId: string; initial: BrandPromoCta | undefined; onSaved: () => void }`.

**`FurtherInformationSheet.tsx`** (source: `BrandDetailPage.tsx:2031-2189`, uses `uploadFileViaPresignedUrl` for the mockup image, so it keeps a `brandId` prop like `BenefitsSheet` does):

```typescript
// Was:
const updated = await updatePlatformBrandMetadata(brandId, {
  further_information: { eyebrow: ..., title: ..., subtitle: ..., mockup_image_url: mockupUrl },
});
onSaved(updated);
// Becomes:
await updateProgramLandingContent(programId, {
  further_information: { eyebrow: ..., title: ..., subtitle: ..., mockup_image_url: mockupUrl },
});
onSaved();
```

Props: `{ programId, brandId, initial, onSaved }: { programId: string; brandId: string; initial: BrandFurtherInformation | undefined; onSaved: () => void }` — `brandId` is still needed here only for `uploadFileViaPresignedUrl`'s own `brandId` parameter (the upload target bucket), not for the content write.

**`MomentsShortsSheet.tsx`** (source: `BrandDetailPage.tsx:2193-2249`):

```typescript
// Was:
const updated = await updatePlatformBrandMetadata(brandId, { moments_shorts: form });
onSaved(updated);
// Becomes:
await updateProgramLandingContent(programId, { moments_shorts: form });
onSaved();
```

Props: `{ programId, initial, onSaved }: { programId: string; initial: BrandMomentsShorts | undefined; onSaved: () => void }`.

**`PaymentInfoSheet.tsx`** (source: `BrandDetailPage.tsx:2647-2794`, uses `normalizePaymentInfo`/`DEFAULT_PAYMENT_INFO_ITEMS` from `./shared`):

```typescript
// Was:
const updated = await updatePlatformBrandMetadata(brandId, {
  payment_info: { eyebrow: form.eyebrow.trim(), title: form.title.trim(), introText: form.introText.trim(), items: sanitizedItems, note: form.note.trim() },
});
onSaved(updated);
// Becomes:
await updateProgramLandingContent(programId, {
  payment_info: { eyebrow: form.eyebrow.trim(), title: form.title.trim(), introText: form.introText.trim(), items: sanitizedItems, note: form.note.trim() },
});
onSaved();
```

Props: `{ programId, initial, onSaved }: { programId: string; initial: BrandPaymentInfo | undefined; onSaved: () => void }`.

`ProgramObjectivesSheet` and `ImpactStatsSheet` are **not** moved here — the former's underlying `metadata.program_objectives` override was removed outright by Task 16 (nothing to move), and the latter moves to the platform-wide screen built in Step 7 below, not into `landing-content/`.

- [ ] **Step 5: Create `ProgramContactSheet.tsx` (new — no `BrandDetailPage.tsx` analogue carries social media, which stays Brand-owned)**

```typescript
// services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/ProgramContactSheet.tsx
"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/src/ui/sheet";
import { Button } from "@/src/ui/button";
import { updateProgramContact } from "@/app/platform/api";
import { FieldInput, FieldTextarea } from "../landing-content/shared";

interface ProgramContactSheetProps {
  programId: string;
  initial: {
    contactEmail?: string | null;
    contactPhone?: string | null;
    contactWhatsapp?: string | null;
    contactAddress?: string | null;
  };
  onSaved: () => void;
}

export function ProgramContactSheet({ programId, initial, onSaved }: ProgramContactSheetProps) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    contactEmail: initial.contactEmail ?? "",
    contactPhone: initial.contactPhone ?? "",
    contactWhatsapp: initial.contactWhatsapp ?? "",
    contactAddress: initial.contactAddress ?? "",
  });

  function resetState() {
    setForm({
      contactEmail: initial.contactEmail ?? "",
      contactPhone: initial.contactPhone ?? "",
      contactWhatsapp: initial.contactWhatsapp ?? "",
      contactAddress: initial.contactAddress ?? "",
    });
    setError(null);
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      // PUT /programs/:id/contact REPLACES the whole block — send every
      // field explicitly, matching UpdateProgramContactHandler's semantics
      // (an omitted field clears to null server-side).
      await updateProgramContact(programId, {
        contactEmail: form.contactEmail || undefined,
        contactPhone: form.contactPhone || undefined,
        contactWhatsapp: form.contactWhatsapp || undefined,
        contactAddress: form.contactAddress || undefined,
      });
      toast.success("Contact information updated.");
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact information.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          resetState();
          setOpen(true);
        }}
      >
        Edit Contact
      </Button>
      <Sheet open={open} onOpenChange={(v) => !v && !saving && setOpen(false)}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle>Edit Program Contact</SheetTitle>
            <SheetDescription>Shown on this program&apos;s public landing page as its support contact.</SheetDescription>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {error && <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
            <FieldInput label="Email" id="contactEmail" value={form.contactEmail} onChange={(v) => set("contactEmail", v)} type="email" placeholder="contact@example.com" />
            <FieldInput label="Phone" id="contactPhone" value={form.contactPhone} onChange={(v) => set("contactPhone", v)} placeholder="+62 21 1234 5678" />
            <FieldInput label="WhatsApp" id="contactWhatsapp" value={form.contactWhatsapp} onChange={(v) => set("contactWhatsapp", v)} placeholder="628123456789" />
            <FieldTextarea label="Address" id="contactAddress" value={form.contactAddress} onChange={(v) => set("contactAddress", v)} rows={3} />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 6: Wire both new sections into `ProgramSpecificsTab.tsx`, with their Copy-from-Program buttons**

Add two new fields to `ProgramSpecificsData` and two new props to the component, then render sections 4 and 5 after the existing "Participant-Facing Content" section:

```typescript
// services/admin-dashboard/app/components/programDetailsMasterData/program-specifics/ProgramSpecificsTab.tsx
import {
  IdentificationIcon,
  DocumentTextIcon,
  CalendarDaysIcon,
  PhoneIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/solid";
import { useState } from "react";
import type { ProgramLandingContent } from "@/app/platform/api";
import { ProgramContactSheet } from "./ProgramContactSheet";
import { BenefitsSheet } from "../landing-content/BenefitsSheet";
import { FeaturesSheet } from "../landing-content/FeaturesSheet";
import { PromoCtaSheet } from "../landing-content/PromoCtaSheet";
import { FurtherInformationSheet } from "../landing-content/FurtherInformationSheet";
import { MomentsShortsSheet } from "../landing-content/MomentsShortsSheet";
import { PaymentInfoSheet } from "../landing-content/PaymentInfoSheet";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";

export interface ProgramSpecificsData {
  schedule: { /* ...unchanged... */ };
  operations: { /* ...unchanged... */ };
  participantContent: { /* ...unchanged... */ };
  contact: {
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
  };
  landingContent: ProgramLandingContent;
}

interface ProgramSpecificsTabProps {
  data: ProgramSpecificsData;
  programId: string;
  brandId: string;
  onDataChanged: () => void;
}

export function ProgramSpecificsTab({ data, programId, brandId, onDataChanged }: ProgramSpecificsTabProps) {
  const [copyContactOpen, setCopyContactOpen] = useState(false);
  const [copyLandingOpen, setCopyLandingOpen] = useState(false);
  const lc = data.landingContent;

  return (
    <div className="space-y-6 pt-2">
      {/* ...sections 1-3 (Program Shell Snapshot, Registration & Operations,
           Participant-Facing Content) are UNCHANGED, copy verbatim... */}

      {/* Contact Information */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">4</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Contact Information</h2>
              <p className="text-xs text-zinc-500">Program-owned support contact, shown on this program&apos;s public landing page.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setCopyContactOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              Copy from program
            </button>
            <ProgramContactSheet programId={programId} initial={data.contact} onSaved={onDataChanged} />
          </div>
        </div>
        <dl className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Email</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactEmail || "Not configured"}</dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Phone</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactPhone || "Not configured"}</dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">WhatsApp</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactWhatsapp || "Not configured"}</dd>
          </div>
          <div>
            <dt className="mb-1.5 block text-xs font-medium text-zinc-500">Address</dt>
            <dd className="rounded-md border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-900 shadow-sm">{data.contact.contactAddress || "Not configured"}</dd>
          </div>
        </dl>
      </section>

      {/* Landing Page Content */}
      <section className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between gap-3 border-b border-zinc-200 pb-4">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700">5</span>
            <div>
              <h2 className="text-base font-bold text-zinc-900">Landing Page Content</h2>
              <p className="text-xs text-zinc-500">Program-owned structured sections rendered on the public landing page.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setCopyLandingOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            Copy from program
          </button>
        </div>

        <div className="space-y-4">
          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Program Benefits</h3>
              <BenefitsSheet programId={programId} brandId={brandId} initial={lc.benefits} onSaved={onDataChanged} />
            </div>
            <p className="text-xs text-zinc-500">{lc.benefits?.groups?.length ?? 0} group(s) configured.</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Key Features</h3>
              <FeaturesSheet programId={programId} initial={lc.features} onSaved={onDataChanged} />
            </div>
            <p className="text-xs text-zinc-500">{lc.features?.length ?? 0} feature(s) configured.</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Promo / CTA Section</h3>
              <PromoCtaSheet programId={programId} initial={lc.promo_cta} onSaved={onDataChanged} />
            </div>
            <p className="text-xs text-zinc-500">{lc.promo_cta?.title || "Not configured"}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Further Information CTA</h3>
              <FurtherInformationSheet programId={programId} brandId={brandId} initial={lc.further_information} onSaved={onDataChanged} />
            </div>
            <p className="text-xs text-zinc-500">{lc.further_information?.title || "Not configured"}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Moments Shorts</h3>
              <MomentsShortsSheet programId={programId} initial={lc.moments_shorts} onSaved={onDataChanged} />
            </div>
            <p className="text-xs text-zinc-500">{lc.moments_shorts?.title || "Not configured"}</p>
          </div>

          <div className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-800">Payment &amp; Selection</h3>
              <PaymentInfoSheet programId={programId} initial={lc.payment_info} onSaved={onDataChanged} />
            </div>
            <p className="text-xs text-zinc-500">{lc.payment_info?.items?.length ?? 0} item(s) configured.</p>
          </div>
        </div>
      </section>

      <CopyFromProgramDialog
        open={copyContactOpen}
        entityKey="contact"
        entityLabel="Contact Information"
        programId={programId}
        supportsAppend={false}
        onClose={() => setCopyContactOpen(false)}
        onApplied={() => {
          setCopyContactOpen(false);
          onDataChanged();
        }}
      />
      <CopyFromProgramDialog
        open={copyLandingOpen}
        entityKey="landing"
        entityLabel="Landing Page Content"
        programId={programId}
        supportsAppend={false}
        onClose={() => setCopyLandingOpen(false)}
        onApplied={() => {
          setCopyLandingOpen(false);
          onDataChanged();
        }}
      />
    </div>
  );
}
```

`referenceBrandName` and `replaceCaveat` are **not** passed to either `<CopyFromProgramDialog>` — both are Submission-Form-only props (confirmed in `CopyFromProgramDialog.tsx`'s own prop doc comments: `referenceBrandName` pins a reference source to the top of the picker, `replaceCaveat` appends a surface-specific warning sentence; neither has a meaningful default for Contact or Landing Content, which have no "reference brand" concept, and the generic replace disclaimer already covers what these two scalar copiers need to say).

- [ ] **Step 7: Extend `program-details/page.tsx`'s `ProgramDetail` type and wiring**

In `services/admin-dashboard/app/programs/[programId]/master-data/program-details/page.tsx`, add the six new fields to `ProgramDetail` (after `benefitsDescription`, ~line 63):

```typescript
  requirementsDescription?: string | null;
  benefitsDescription?: string | null;
  termsAndConditions?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactWhatsapp?: string | null;
  contactAddress?: string | null;
  landingContent?: import("@/app/platform/api").ProgramLandingContent;
  metaTitle?: string | null;
  metaDescription?: string | null;
```

In `toProgramSpecificsData` (~line 188-222), add the two new blocks:

```typescript
    participantContent: {
      requirementsDescription: formatDisplayValue(detail.requirementsDescription),
      benefitsDescription: formatDisplayValue(detail.benefitsDescription),
      termsAndConditions: formatDisplayValue(detail.termsAndConditions),
    },
    contact: {
      contactEmail: detail.contactEmail ?? null,
      contactPhone: detail.contactPhone ?? null,
      contactWhatsapp: detail.contactWhatsapp ?? null,
      contactAddress: detail.contactAddress ?? null,
    },
    landingContent: detail.landingContent ?? {},
  };
}
```

And repoint the `<ProgramSpecificsTab>` call site (~line 561):

```typescript
          ) : programSpecificsData ? (
            <ProgramSpecificsTab
              data={programSpecificsData}
              programId={resolvedProgramId}
              brandId={programDetail?.brand?.id ?? ""}
              onDataChanged={() => void refreshProgramDetail()}
            />
          ) : (
```

- [ ] **Step 8: Build the Platform Settings (Impact Stats) admin screen**

```typescript
// services/admin-dashboard/app/platform/settings/platform-content/page.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/src/ui/button";
import { Label } from "@/src/ui/label";
import { Input } from "@/src/ui/input";
import { getImpactStats, updateImpactStats, type ImpactStats } from "@/app/platform/api";

export default function PlatformContentPage() {
  const [stats, setStats] = useState<ImpactStats | null>(null);
  const [form, setForm] = useState({ totalAlumni: "", editionsHeld: "", totalCountries: "", totalParticipants: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    getImpactStats()
      .then((data) => {
        if (!mounted) return;
        setStats(data);
        setForm({
          totalAlumni: data.totalAlumni ?? "",
          editionsHeld: data.editionsHeld ?? "",
          totalCountries: data.totalCountries ?? "",
          totalParticipants: data.totalParticipants ?? "",
        });
      })
      .catch((err) => {
        if (mounted) setError(err instanceof Error ? err.message : "Failed to load impact stats.");
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, []);

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const updated = await updateImpactStats({
        totalAlumni: form.totalAlumni || undefined,
        editionsHeld: form.editionsHeld || undefined,
        totalCountries: form.totalCountries || undefined,
        totalParticipants: form.totalParticipants || undefined,
      });
      setStats(updated);
      toast.success("Impact stats updated.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save impact stats.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="rounded-lg border border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-600">Loading…</div>;
  }

  return (
    <main className="max-w-xl space-y-4">
      <div>
        <h1 className="text-lg font-bold text-zinc-900">Platform Content</h1>
        <p className="text-sm text-zinc-500">
          Organisation-wide values shared across every brand&apos;s landing page — not brand- or program-scoped.
        </p>
      </div>

      <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h2 className="mb-4 text-sm font-bold text-zinc-900">Impact Stats</h2>
        {error && <p className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="totalAlumni">Total Alumni</Label>
            <Input id="totalAlumni" value={form.totalAlumni} onChange={(e) => set("totalAlumni", e.target.value)} placeholder="1700+" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="editionsHeld">Editions Held</Label>
            <Input id="editionsHeld" value={form.editionsHeld} onChange={(e) => set("editionsHeld", e.target.value)} placeholder="15+" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalCountries">Total Countries</Label>
            <Input id="totalCountries" value={form.totalCountries} onChange={(e) => set("totalCountries", e.target.value)} placeholder="50+" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="totalParticipants">Total Participants</Label>
            <Input id="totalParticipants" value={form.totalParticipants} onChange={(e) => set("totalParticipants", e.target.value)} placeholder="1700+" />
          </div>
        </div>
        <div className="mt-6">
          <Button onClick={handleSave} disabled={saving}>
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </section>
    </main>
  );
}
```

Link to this page from the existing `/platform/settings` hub (find that hub page's list of settings links and add one for "Platform Content", pointing at `/platform/settings/platform-content` — confirm the hub's exact link-list pattern by reading it before adding, since it is not otherwise touched by this plan).

- [ ] **Step 9: Verify — compile and lint (no test runner in this package)**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit` — no errors.
Run: `npm run lint` — no errors.
Manually confirm in a running dev server: the Program Details page's "Specifics" tab shows sections 4 and 5 with their Edit/Copy buttons; each of the six landing-content sheets opens, edits, and saves; both new `<CopyFromProgramDialog>` instances open, list source programs, and complete a replace; `/platform/settings/platform-content` loads and saves.

- [ ] **Step 10: Commit**

```bash
cd services/admin-dashboard
git add app/platform/api.ts app/components/programDetailsMasterData app/programs/\[programId\]/master-data/program-details/page.tsx app/platform/settings/platform-content
git commit -m "feat(admin): add Program Contact + Landing Page Content sections, Platform Content (Impact Stats) screen"
```

**Known gap, deliberately out of scope here:** Task 1 (Step 6) added `metaKeywords` to `UpdateProgramDto` and Task 21 removes `Brand.metaTitle`/`.metaDescription`/`.metaKeywords` entirely (not migrated — nothing renders the Brand-level ones, per the spec's audit). But the admin UI's existing General Information edit modal (`EditGeneralInformationModal.tsx`, pre-dates this phase) only exposes `metaTitle`/`metaDescription`, never `metaKeywords`, for `Program`. This task does not add it — doing so correctly requires reading `EditGeneralInformationModal.tsx`'s current form-field pattern first (not read during this planning pass) and is a small, independent addition unrelated to the contact/landing/copier work this task actually covers. Net effect: `Program.metaKeywords` is writable via `PUT /programs/:id` today (Task 1) but has no dedicated admin form field anywhere. Worth a follow-up ticket, not a blocker for this phase — nothing depends on it rendering, per the same audit.

---

## Task 20: Admin UI — remove the superseded Brand-level contact/landing/SEO surfaces

**Files:**
- Modify: `services/admin-dashboard/app/platform/brands/[brandId]/BrandDetailPage.tsx`
- Modify: `services/admin-dashboard/app/platform/api.ts` (`BrandMetadata`, `PlatformBrandDetail`, `RawPlatformBrand` — trim the 7 moved-out metadata keys and the 7 moved-out contact/SEO columns)

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task only deletes admin-dashboard UI that would otherwise still be able to write to the `Brand` columns/`Brand.metadata` keys Task 21 is about to drop.

**Why this must ship before Task 21, not after (repeating the reasoning from the renumbering note above Task 7, because it is the load-bearing reason this task exists at all):** `PUT /brands/:brandId/metadata` is a loose, schema-unvalidated `Json` patch endpoint (`UpdateBrandMetadataDto`'s `@IsObject() patch`) — it does not reject an unknown key, and it is not touched by Task 21 at all (only the *data already stored* under the moved keys is stripped, once, by Task 21's `strip-migrated-brand-metadata-keys.ts`). If the old `BenefitsSheet`/`FeaturesSheet`/etc. in `BrandDetailPage.tsx` were still reachable after that strip, saving any one of them would silently **write the stripped key straight back into `Brand.metadata`** — a 200 OK, with zero live effect, because `home.strategy.ts` (Task 16) already reads `Program.landingContent` instead. Removing these surfaces is therefore a correctness precondition for Task 21's drop, not cleanup that can trail behind it.

- [ ] **Step 1: Remove the eight superseded cards from `LandingPageTab`**

In `BrandDetailPage.tsx`'s `LandingPageTab` (currently lines 2363-2645), delete these `<Card>` blocks in full: **Benefits** (~2414-2443), **Key Features** (~2445-2467), **Impact Stats** (~2469-2485), **Payment & Selection** (~2487-2514), **Promo CTA** (~2516-2532), **Further Information CTA** (~2534-2550), **Program Objectives** (~2552-2583), **Moments Shorts** (~2585-2600). Leave every other card untouched: **Section Background Image** (~2390-2412), **Partners Page — Canva Embed** (~2602-2622), **Partners Page — Affiliate Commission** (~2624-2642) all stay — none of their fields are part of this phase's move.

Also remove the now-unused `paymentInfo` local (`const paymentInfo = normalizePaymentInfo(meta.payment_info);`, currently line 2386) — its only reader was the deleted Payment & Selection card.

- [ ] **Step 2: Delete the eight superseded sheet function definitions**

Delete these function bodies from `BrandDetailPage.tsx` in full (confirmed exact boundaries via `grep -n "^function "`): `BenefitsSheet` (1313-1573), `FeaturesSheet` (1577-1671), `ImpactStatsSheet` (1675-1732), `PromoCtaSheet` (1961-2029), `FurtherInformationSheet` (2031-2189), `MomentsShortsSheet` (2193-2249), `ProgramObjectivesSheet` (2253-2359), `PaymentInfoSheet` (2647-2794). Also delete `BenefitGroupImageField` (191-465) and `isImageMediaFile` (187-189) — both were only reachable from the now-deleted `BenefitsSheet`.

**Do not delete** `SectionBackgroundSheet` (1736-1957) — it stays, and it independently calls `clampFileTitle`/`uploadFileViaPresignedUrl`, which must also stay for that reason. Confirm before deleting anything in this step that `clampFileTitle` (currently lines 100-104), `FieldInput`/`FieldTextarea`/`SheetMsg` (467-524), and `normalizeBenefitGroup`/`normalizeBenefitGroups`/`normalizePaymentInfo`/`DEFAULT_PAYMENT_INFO_ITEMS` (120-185) have no remaining callers among the sheets that stay before deleting them too — a direct search after Step 1-2's deletions is the actual verification, not this list; `clampFileTitle` and the `FieldInput`-family definitely stay (still used by `DetailsSheet`, `SocialMediaSheet` per Step 3, `SettingsSheet`, `SectionBackgroundSheet`, `PartnersCanvaSheet`, `AffiliateCommissionSheet`), but `normalizeBenefitGroup(s)`/`normalizePaymentInfo`/`DEFAULT_PAYMENT_INFO_ITEMS` have no remaining caller once `BenefitsSheet`/`PaymentInfoSheet` are gone — delete those three too.

- [ ] **Step 3: Trim `ContactSheet` down to social media only, rename it `SocialMediaSheet`**

`ContactSheet` (currently lines 822-920) edits both the four contact scalars and the five social-media links in one form. Contact moves to `Program` entirely; social media stays on `Brand`. Replace the whole function with:

```typescript
function SocialMediaSheet({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    socialInstagram: brand.socialMediaLinks?.instagram ?? "",
    socialLinkedin: brand.socialMediaLinks?.linkedin ?? "",
    socialTwitter: brand.socialMediaLinks?.twitter ?? "",
    socialFacebook: brand.socialMediaLinks?.facebook ?? "",
    socialYoutube: brand.socialMediaLinks?.youtube ?? "",
  });

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
    setError(null);
  }

  function resetState() {
    setForm({
      socialInstagram: brand.socialMediaLinks?.instagram ?? "",
      socialLinkedin: brand.socialMediaLinks?.linkedin ?? "",
      socialTwitter: brand.socialMediaLinks?.twitter ?? "",
      socialFacebook: brand.socialMediaLinks?.facebook ?? "",
      socialYoutube: brand.socialMediaLinks?.youtube ?? "",
    });
    setError(null);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const socialMediaLinks: Record<string, string> = {};
    if (form.socialInstagram) socialMediaLinks.instagram = form.socialInstagram;
    if (form.socialLinkedin) socialMediaLinks.linkedin = form.socialLinkedin;
    if (form.socialTwitter) socialMediaLinks.twitter = form.socialTwitter;
    if (form.socialFacebook) socialMediaLinks.facebook = form.socialFacebook;
    if (form.socialYoutube) socialMediaLinks.youtube = form.socialYoutube;
    try {
      await updatePlatformBrandDetails(brand.id, {
        socialMediaLinks: Object.keys(socialMediaLinks).length > 0 ? socialMediaLinks : undefined,
      });
      setOpen(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Button size="sm" variant="outline" onClick={() => { resetState(); setOpen(true); }}>
        <Pencil className="mr-1.5 h-3.5 w-3.5" /> Edit
      </Button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="right" className="sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Edit Social Media</SheetTitle></SheetHeader>
          <div className="mt-6 space-y-4">
            <SheetMsg message={error} variant="error" />
            <FieldInput label="Instagram" id="socialInstagram" value={form.socialInstagram} onChange={(v) => set("socialInstagram", v)} placeholder="https://instagram.com/..." />
            <FieldInput label="LinkedIn" id="socialLinkedin" value={form.socialLinkedin} onChange={(v) => set("socialLinkedin", v)} placeholder="https://linkedin.com/..." />
            <FieldInput label="Twitter / X" id="socialTwitter" value={form.socialTwitter} onChange={(v) => set("socialTwitter", v)} placeholder="https://twitter.com/..." />
            <FieldInput label="Facebook" id="socialFacebook" value={form.socialFacebook} onChange={(v) => set("socialFacebook", v)} placeholder="https://facebook.com/..." />
            <FieldInput label="YouTube" id="socialYoutube" value={form.socialYoutube} onChange={(v) => set("socialYoutube", v)} placeholder="https://youtube.com/..." />
          </div>
          <SheetFooter className="mt-6">
            <Button onClick={handleSave} loading={saving} disabled={saving}>
              <Save className="mr-1.5 h-4 w-4" /> Save
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}
```

- [ ] **Step 4: Restructure `ContactTab`**

Replace `ContactTab` (currently lines 1176-1260) — drop the "Contact Information" `Section` entirely (nothing left to show once `Brand.contactEmail`/etc. are gone), keep the Social Media card, and move the edit action onto it:

```typescript
function ContactTab({ brand, onSaved }: { brand: PlatformBrandDetail; onSaved: () => void }) {
  const social = brand.socialMediaLinks ?? {};
  const hasSocial = Object.keys(social).length > 0;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Social Media</CardTitle>
            <SocialMediaSheet brand={brand} onSaved={onSaved} />
          </div>
        </CardHeader>
        <CardContent>
          {hasSocial ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {Object.entries(social).map(([platform, url]) => (
                <div key={platform}>
                  <p className="text-xs font-medium capitalize text-zinc-500">{platform}</p>
                  <a
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-0.5 flex items-center gap-1 text-sm text-blue-600 hover:underline"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    <span className="truncate">{url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-zinc-400">No social media links configured.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

The `Mail`/`Phone`/`MessageCircle`/`MapPin` icon imports at the top of the file (used only by the deleted Contact Information block) become unused — remove them from the `lucide-react` import list; `Globe`/`ExternalLink` stay (still used above).

- [ ] **Step 5: Trim the SEO block out of `DetailsSheet` and `OverviewTab`**

In `DetailsSheet` (currently lines 716-820), remove `metaTitle`/`metaDescription`/`metaKeywords` from the `form` state, the `handleSave` payload, and the JSX's `<div className="border-t border-zinc-100 pt-4">…SEO…</div>` block (currently lines 802-809) in full — `about`/`vision`/`mission`/`defaultLocation`/`defaultCountry`/`defaultTimezone` all stay unchanged.

In `OverviewTab` (currently lines 1005-1068), delete the conditional SEO `Section` block in full:

```typescript
      {(brand.metaTitle || brand.metaDescription || brand.metaKeywords) && (
        <Section title="SEO">
          <FieldView label="Meta Title" value={brand.metaTitle} />
          <FieldView label="Meta Description" value={brand.metaDescription} />
          <FieldView label="Meta Keywords" value={brand.metaKeywords} />
        </Section>
      )}
```

- [ ] **Step 6: Trim `app/platform/api.ts`'s `BrandMetadata`/`PlatformBrandDetail`/`RawPlatformBrand` types**

Remove `benefits`, `features`, `impact_stats`, `promo_cta`, `moments_shorts`, `program_objectives`, `further_information`, `payment_info`, and `participant_demographics` from `BrandMetadata` (~lines 559-575) — `section_background`, `partners_canva_url`, `affiliateCommission`, and `recognition` stay (Brand-owned, unaffected). The `[key: string]: unknown` index signature stays too — Global Constraints' "index signature dropped" refers to `Program.landingContent`'s allow-list (Task 1), not this type; `Brand.metadata` keeps a few genuinely free-form keys (`recognition`) so its own index signature is not part of this phase's scope to remove.

Also delete the now-fully-orphaned standalone type declarations `BrandImpactStats` and `BrandProgramObjectives` (~lines 492-497 and 523-528) — unlike `BenefitGroup`/`BrandFeature`/`BrandPromoCta`/`BrandMomentsShorts`/`BrandFurtherInformation`/`BrandPaymentInfo`/`BrandPaymentInfoItem`, which Task 19's `ProgramLandingContent` type keeps reusing (do **not** delete those seven — they are still live, just serving `Program.landingContent` instead of `Brand.metadata` now), nothing references `BrandImpactStats` or `BrandProgramObjectives` any more once `ImpactStatsSheet` and `ProgramObjectivesSheet` are gone (Step 2) and `impact_stats`/`program_objectives` are gone from `BrandMetadata` (above) — platform-level impact stats have their own `ImpactStats` type (Task 19), and program objectives have no admin-editable metadata override left at all (Task 16).

Remove `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaTitle`/`metaDescription`/`metaKeywords` from `PlatformBrandDetail` (wherever that type declares them — confirm the exact block by reading the type before editing, since its full body was not reproduced during this planning pass) and their `snake_case` counterparts from `RawPlatformBrand` (`contact_email`/`contact_phone`/`contact_whatsapp`/`contact_address`/`meta_title`/`meta_description`/`meta_keywords`, currently lines 33-39 and 43-45).

The now-orphaned `sanitizeBenefits`/`sanitizeBenefitGroup`/`sanitizeProgramObjectives` functions (~lines 591-617), which existed only to defend `getBrandMetadata`'s parsing of the now-removed `benefits`/`program_objectives` keys, are deleted along with their callers inside `sanitizeBrandMetadata` — leave `sanitizeBrandMetadata` itself in place (it still runs, just with a smaller set of keys to sanitize; if no key it sanitizes remains, simplify it to return `raw as BrandMetadata` unconditionally and note why in a comment, rather than leaving dead branches).

- [ ] **Step 7: Verify — compile and lint**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit` — no errors. This is the sharpest check in this task: every deleted type field/function whose only remaining reference was inside the code just deleted will surface as a compile error if the deletion was incomplete (e.g. a card in `LandingPageTab` referencing a sheet component whose definition was deleted, or a fixture check that still reads `brand.contactEmail`).
Run: `npm run lint` — no errors (catches the unused-icon-import case from Step 4).
Manually confirm in a running dev server: `/platform/brands/[brandId]` → Landing Page tab shows exactly Section Background, Partners Canva, and Affiliate Commission; Contact tab shows only Social Media; Overview tab shows no SEO section.

- [ ] **Step 8: Commit**

```bash
cd services/admin-dashboard
git add app/platform/brands/\[brandId\]/BrandDetailPage.tsx app/platform/api.ts
git commit -m "refactor(admin): remove superseded Brand-level contact/landing/SEO surfaces, now owned by Program/PlatformSetting"
```

---

## Task 21: Drop the superseded `Brand` columns and strip the migrated `Brand.metadata` keys

**Files:**
- Create: `services/api/prisma/migrations/20260828150000_drop_superseded_brand_columns/migration.sql`
- Modify: `services/api/prisma/schema/program.prisma` (`Brand` model)
- Modify: `services/api/src/core/entities/brand.entity.ts`
- Modify: `services/api/src/modules/brands/infrastructure/persistence/brand.repository.ts` (`create()`, `update()`, `mapToEntity()`)
- Modify: `services/api/src/modules/brands/presentation/dto/brand.dto.ts` (`BrandResponseDto`)
- Modify: `services/api/src/modules/brands/presentation/dto/create-brand.dto.ts`
- Modify: `services/api/src/modules/brands/presentation/dto/update-brand-details.dto.ts`
- Modify: `services/api/src/modules/brands/presentation/brands.controller.ts` (verify `toSafeBrandResponse`, no code change expected)
- Modify: `services/api/src/modules/brands/application/queries/handlers/get-brand-detail.handler.ts`
- Modify: `services/api/src/modules/brands/application/queries/handlers/list-brands.handler.ts`
- Modify: `services/api/src/modules/brands/application/commands/handlers/update-brand-details.handler.ts`
- Modify: `services/api/src/modules/brands/presentation/brands.controller.spec.ts` (fixture updates, driven by running it)
- Create: `services/api/scripts/strip-migrated-brand-metadata-keys.ts`

**Interfaces:**
- Consumes: nothing new.
- Produces: nothing new — this task only removes. `GET /brands` and `GET /brands/:id`'s `BrandResponseDto` stop shipping `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaTitle`/`metaDescription`/`metaKeywords`, which is the public API contract change the spec and this plan's Global Constraints both flag explicitly.

**Preconditions, non-negotiable per this plan's Global Constraints:** Tasks 10-18 deployed and verified (backup taken, both backfills applied, every contact consumer repointed, both read strategies switched, all caches purged, Task 18's diff shows zero unexplained differences across every non-legacy brand) **and** Task 20's admin UI cutover shipped (the old Brand-level UI must be gone before this runs, or an admin using it would silently resurrect a key this task is about to strip permanently — see Task 20's own entry for the full mechanism). This task is the one place in the whole phase where a mistake is expensive to reverse — Task 10's dump covers BOTH the raw `metadata` JSON **and** all seven typed columns dropped here (contact x4, SEO x3) — it was originally metadata-only, which left a real hole: Task 12's backfill skips a field when the target Program already has a value, and skips entirely when a brand has no published+active program, so those Brand values would have existed nowhere once this task ran. Verify the dump file contains non-null contact values for every brand before proceeding. Treat the migration step as one-way regardless.

This task is compile-verified, not TDD, like Tasks 1-3 — it is schema + plumbing removal with no new branching logic. But unlike those additive tasks, `Brand`'s constructor is positional with fields being **removed from the middle**, not appended at the end (this plan's Global Constraints flags this exact task by name for that reason) — `tsc` alone can silently pass a shifted-position bug if two adjacent `string | null` params are removed from the entity but not from the single `mapToEntity()` call site in the same positions. Step 4 below is an explicit before/after argument-count check for exactly that reason; do not skip it because Step 3's `tsc --noEmit` was clean.

- [ ] **Step 1: Drop the schema columns**

In `services/api/prisma/schema/program.prisma`, inside `model Brand { ... }`, delete these seven lines (currently lines 34-37 and 51-53, confirmed via direct read):

```prisma
  contactEmail     String? @map("contact_email") @db.VarChar(255)
  contactPhone     String? @map("contact_phone") @db.VarChar(50)
  contactWhatsapp  String? @map("contact_whatsapp") @db.VarChar(50)
  contactAddress   String? @map("contact_address") @db.Text
```
```prisma
  metaTitle       String? @map("meta_title") @db.VarChar(255)
  metaDescription String? @map("meta_description") @db.Text
  metaKeywords    String? @map("meta_keywords") @db.Text
```

`Brand.vision`/`.mission`/`.tagline` are **not** touched — those are the Task 2 typed columns the dead-key backfill (Task 11) populated, and stay permanently.

```sql
-- services/api/prisma/migrations/20260828150000_drop_superseded_brand_columns/migration.sql

-- Only runs after Tasks 10-18 are deployed/verified AND Task 20's admin UI
-- cutover has shipped — see this migration's plan-doc entry
-- (docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md, Task 21)
-- for the full precondition list. One-way: there is no automated rollback
-- script for this specific DROP beyond Postgres point-in-time recovery.
ALTER TABLE "brands"
  DROP COLUMN IF EXISTS "contact_email",
  DROP COLUMN IF EXISTS "contact_phone",
  DROP COLUMN IF EXISTS "contact_whatsapp",
  DROP COLUMN IF EXISTS "contact_address",
  DROP COLUMN IF EXISTS "meta_title",
  DROP COLUMN IF EXISTS "meta_description",
  DROP COLUMN IF EXISTS "meta_keywords";
```

- [ ] **Step 2: Remove the seven fields from the `Brand` entity and its single call site, in lockstep**

In `services/api/src/core/entities/brand.entity.ts`, delete these two blocks from the constructor (confirmed exact current text via direct read):

```typescript
        // Contact
        public readonly contactEmail: string | null,
        public readonly contactPhone: string | null,
        public readonly contactWhatsapp: string | null,
        public readonly contactAddress: string | null,
```
(leave `public readonly socialMediaLinks: Record<string, string> | null,`, the line directly after this block, in place)

```typescript
        // SEO
        public readonly metaTitle: string | null,
        public readonly metaDescription: string | null,
        public readonly metaKeywords: string | null,
```
(leave the surrounding `// Configuration`/`enableMultiCurrency` block above and `createdAt`/`updatedAt`/... below in place)

In `services/api/src/modules/brands/infrastructure/persistence/brand.repository.ts`'s `mapToEntity()`, delete the matching four and three lines from the positional `new Brand(...)` call, in the same two positions:

```typescript
            prismaEntity.contactEmail,
            prismaEntity.contactPhone,
            prismaEntity.contactWhatsapp,
            prismaEntity.contactAddress,
```
```typescript
            prismaEntity.metaTitle,
            prismaEntity.metaDescription,
            prismaEntity.metaKeywords,
```

In the same file, `create()`'s `data:` block loses its one contact line (`contactEmail: data.contactEmail,` — the only one of the seven `create()` ever set); `update()`'s `data:` block loses both blocks (`contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`, and `metaTitle`/`metaDescription`/`metaKeywords`), matching `mapToEntity()`'s removal 1:1.

- [ ] **Step 3: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` — no errors.

- [ ] **Step 4: The before/after argument-count check `tsc` cannot substitute for**

Count `Brand`'s constructor parameters before this task's edit and after. Before this task (i.e. after Task 2 has already appended `tagline`, the state this task starts from): 34 parameters — the 33 already in the file today (`id` through `programCount`, confirmed by direct read), plus Task 2's `tagline` appended at the end. After Step 2's removal of the 7 contact/SEO fields: 27. Count the positional arguments in `mapToEntity()`'s `new Brand(...)` call the same way — it must also go from 34 to 27, **and every remaining argument after the two deleted blocks must still line up with the same-named entity field it did before** (e.g. the entity's `socialMediaLinks` parameter, now immediately following `mission` instead of `contactAddress`, must still receive `prismaEntity.socialMediaLinks` at that same position in the call — not `prismaEntity.defaultLocation` or any other field that happened to shift into that slot). Read both the full constructor and the full call side by side after editing and confirm every remaining pair matches by name, not merely by count — this is the specific failure mode Global Constraints warns `tsc` cannot catch (two adjacent `string | null` fields can swap positions and still typecheck).

- [ ] **Step 5: Remove the fields from the DTOs and handlers**

`brand.dto.ts` (`BrandResponseDto`): delete the `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaTitle`/`metaDescription`/`metaKeywords` `@ApiProperty` declarations. This is the public contract change — `GET /brands`/`GET /brands/:id` stop returning these seven fields, as documented in Task 2's own entry and this plan's Global Constraints.

`create-brand.dto.ts`: delete the `contactEmail` field (the only one of the seven this DTO ever declared, currently ~line 61-64).

`update-brand-details.dto.ts`: delete all seven fields (`contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` and `metaTitle`/`metaDescription`/`metaKeywords`).

`update-brand-details.handler.ts`: delete `contactEmail: dto.contactEmail,`/`contactPhone: dto.contactPhone,`/`contactWhatsapp: dto.contactWhatsapp,`/`contactAddress: dto.contactAddress,` and `metaTitle: dto.metaTitle,`/`metaDescription: dto.metaDescription,`/`metaKeywords: dto.metaKeywords,` from the `brandRepository.update()` call, and the mirrored `dto.contactEmail = brand.contactEmail;` etc. lines from `mapToDto`.

`get-brand-detail.handler.ts` and `list-brands.handler.ts`: delete the same seven `contactEmail: brand.contactEmail || null,`-style lines from each handler's returned object.

`brands.controller.ts`: `toSafeBrandResponse` spreads `{...brand}` and casts — it needs no code change; the seven fields simply stop existing on `brand` once Step 2 lands, and TypeScript can't warn about a field that no longer exists to warn about. Read the file once after Steps 2 and 5 to confirm no *other*, more explicit reference to these seven fields exists elsewhere in this controller (e.g. an OpenAPI example object) — none is expected, but this is exactly the kind of file a spread-based leak hides in, per this plan's Global Constraints finding about `toSafeBrandResponse`.

- [ ] **Step 6: Write the metadata-key strip script**

```typescript
// services/api/scripts/strip-migrated-brand-metadata-keys.ts
/**
 * strip-migrated-brand-metadata-keys.ts
 *
 * Phase 3 Task 21 (see docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md).
 * Removes every Brand.metadata key that this phase migrated elsewhere, now
 * that Tasks 11-12's backfills, Tasks 15-16's read switch, and Task 18's
 * verification are all confirmed:
 *   - To Program.landingContent (Task 12): benefits, features, promo_cta,
 *     moments_shorts, further_information, payment_info, participant_demographics
 *   - To PlatformSetting (Task 12): impact_stats
 *   - To typed Brand columns (Task 11): tagline, objectives, coreValues
 *   - Deleted without migration (spec: "no brand has it set" in production):
 *     program_objectives
 *
 * Leaves untouched: section_background, recognition, apple_icon_url,
 * favicon_url, partners_canva_url, affiliateCommission — all Brand-owned,
 * per the spec's ownership split.
 *
 * DRY RUN by default. Prints a bucketed summary and writes a full backup
 * JSON of every brand's metadata BEFORE stripping to ./backups/ (on top of,
 * not instead of, Task 10's earlier full dump — this one captures state
 * immediately before the strip, closer to the point of no return).
 * Pass --apply to actually strip.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register scripts/strip-migrated-brand-metadata-keys.ts            # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/strip-migrated-brand-metadata-keys.ts --apply    # execute
 *
 * NEVER run --apply against production from an interactive agent session —
 * see this plan's Global Constraints. Production execution, after Task 20's
 * admin UI cutover has shipped, is a separate human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient, Prisma } from '@prisma/client';

const KEYS_TO_STRIP = [
    'benefits', 'features', 'promo_cta', 'moments_shorts', 'further_information', 'payment_info', 'participant_demographics',
    'impact_stats',
    'tagline', 'objectives', 'coreValues',
    'program_objectives',
] as const;

export function stripMigratedKeys(metadata: Record<string, unknown> | null): { stripped: Record<string, unknown>; removedKeys: string[] } {
    const source = metadata ?? {};
    const removedKeys = KEYS_TO_STRIP.filter((key) => key in source);
    const stripped = Object.fromEntries(Object.entries(source).filter(([key]) => !(KEYS_TO_STRIP as readonly string[]).includes(key)));
    return { stripped, removedKeys };
}

/* istanbul ignore next -- exercised by dry-run inspection, not a DB-backed Jest test (see Global Constraints) */
async function main(): Promise<void> {
    loadEnv({ path: join(__dirname, '..', '.env') });
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
        throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
    }

    const APPLY = process.argv.includes('--apply');
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        console.log(`[strip-migrated-brand-metadata-keys] mode: ${APPLY ? 'APPLY (will mutate)' : 'DRY RUN (no changes)'}`);

        const brands = await prisma.brand.findMany({ where: { deletedAt: null }, select: { id: true, name: true, metadata: true } });

        const plans = brands.map((b) => {
            const { stripped, removedKeys } = stripMigratedKeys(b.metadata as Record<string, unknown> | null);
            return { brandId: b.id, brandName: b.name, stripped, removedKeys };
        });

        const withRemovals = plans.filter((p) => p.removedKeys.length > 0);
        console.log(`[strip-migrated-brand-metadata-keys] ${withRemovals.length}/${plans.length} brand(s) have keys to strip.`);
        console.table(withRemovals.map((p) => ({ brand: p.brandName, removedKeys: p.removedKeys.join(', ') })));

        if (withRemovals.length === 0) {
            console.log('[strip-migrated-brand-metadata-keys] nothing to do.');
            return;
        }

        const backupDir = join(__dirname, 'backups');
        mkdirSync(backupDir, { recursive: true });
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupPath = join(backupDir, `strip-migrated-brand-metadata-keys-${stamp}.json`);
        writeFileSync(
            backupPath,
            JSON.stringify(
                brands.map((b) => ({ brandId: b.id, brandName: b.name, metadataBeforeStrip: b.metadata })),
                null,
                2,
            ),
        );
        console.log(`[strip-migrated-brand-metadata-keys] backup written: ${backupPath}`);

        if (!APPLY) {
            console.log('[strip-migrated-brand-metadata-keys] DRY RUN complete. Re-run with --apply to strip the keys above.');
            return;
        }

        await prisma.$transaction(
            withRemovals.map((p) =>
                prisma.brand.update({ where: { id: p.brandId }, data: { metadata: p.stripped as Prisma.InputJsonValue } }),
            ),
        );
        console.log(`[strip-migrated-brand-metadata-keys] stripped keys from ${withRemovals.length} brand(s).`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((err) => {
        console.error('[strip-migrated-brand-metadata-keys] FAILED:', err);
        process.exitCode = 1;
    });
}
```

- [ ] **Step 7: Run the full API suite, dry-run the strip script locally, migrate the local/dev DB**

Run (from `services/api/`): `npx jest` — the whole suite, not a filtered pattern — Step 5's deletions touch `brands.controller.spec.ts` and any other fixture across the codebase that constructs a `Brand`-shaped object with all 33 (pre-Task-21) fields; a full run is what surfaces every one, not just the file this plan already knows about. Fix each fixture by removing the seven fields, matching this task's DTO/entity removal exactly.
Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run (local/dev `DATABASE_URL`): `npx ts-node -r tsconfig-paths/register scripts/strip-migrated-brand-metadata-keys.ts` — dry run, inspect the table.
Run: `npx prisma migrate dev` — applies Step 1's migration to the local/dev DB.
Run again: `npx ts-node -r tsconfig-paths/register scripts/strip-migrated-brand-metadata-keys.ts --apply` — against the same local/dev DB, now that the migration is applied; confirm the printed count matches the dry run and that `SELECT metadata FROM brands` no longer contains any of the twelve stripped keys for any brand.

- [ ] **Step 8: Commit**

```bash
cd services/api
git add prisma/schema/program.prisma prisma/migrations/20260828150000_drop_superseded_brand_columns src/core/entities/brand.entity.ts src/modules/brands/infrastructure/persistence/brand.repository.ts src/modules/brands/presentation/dto/brand.dto.ts src/modules/brands/presentation/dto/create-brand.dto.ts src/modules/brands/presentation/dto/update-brand-details.dto.ts src/modules/brands/application/commands/handlers/update-brand-details.handler.ts src/modules/brands/application/queries/handlers/get-brand-detail.handler.ts src/modules/brands/application/queries/handlers/list-brands.handler.ts src/modules/brands/presentation/brands.controller.spec.ts scripts/strip-migrated-brand-metadata-keys.ts
git commit -m "feat(brands): drop superseded contact/SEO columns and strip migrated Brand.metadata keys (Phase 3 final cutover)"
```

---

## Task 22: Final verification sweep

**Files:** none created or modified — this task runs checks and, if any of them turns up a real miss, files it as a fix folded into the nearest task above rather than as new scope here. It exists to catch anything Tasks 7-21 individually verified in isolation but that only shows up when the whole phase is considered together.

**Interfaces:** none.

Four checks, in order. Each has a concrete pass/fail condition — this is not a "review the code" task, it is a "run these and confirm the output" task, per this plan's stated verification standard.

- [ ] **Step 1: A fresh, independent grep sweep for the contact-field hazard — not a re-check of Tasks 13-14's own list**

Tasks 13-14 repointed the fifteen consumers Global Constraints' own audit found (`application.program.brand.contactEmail`-style relation-joined reads, which a Prisma-delegate-name grep alone would never surface — this is the exact failure mode that produced a public endpoint leaking soft-deleted rows during Phase 1's adversarial review). That audit could itself have missed something. Re-derive it independently here, searching by **property name**, not by delegate name or by any list of "known" files, across the whole API source tree:

```bash
cd services/api
grep -rn "\.contactEmail\b\|\.contactPhone\b\|\.contactWhatsapp\b\|\.contactAddress\b" src/ --include="*.ts" | grep -v "\.spec\.ts"
```

Expected: every remaining hit resolves to a `Program`-typed value (`program.contactEmail`, `rawProgram.contactEmail`, `activeProgramContact.contactEmail`, `resolveActiveProgramContact(...)`'s return value, or a DTO/entity field literally named `contactEmail` that is declared on `Program`/`ProgramContactInfo`/`ProgramContact`, not `Brand`) — confirm this by reading the declaration each hit's variable was assigned from, not by the variable's name alone (a variable named `brand` could, after a sloppy edit, still hold a `Program`-shaped object, and vice versa — name-matching is not type-checking). Any hit that resolves to an actual `Brand`-typed value is a miss Tasks 13-14 (or Task 21's grep-based DTO cleanup) didn't catch; fix it in place and re-run this grep until clean. Repeat for `metaTitle`/`metaDescription`/`metaKeywords`, expecting every survivor to resolve to `Program`, never `Brand` (`Brand` no longer has these fields at all after Task 21, so a survivor here is either a `Program` field, which is fine, or a compile error already caught by `tsc` — the grep is a belt-and-suspenders check for anything hiding behind an `any`/`unknown` cast that `tsc` can't see through, e.g. a raw SQL result or a `JSON.parse`d payload).

- [ ] **Step 2: Full backend and admin-dashboard verification, unfiltered**

Run (from `services/api/`): `npx jest` — the complete suite, not a `--testPathPattern` filter. Expected: 0 failures.
Run: `npx tsc --noEmit -p tsconfig.json` — no errors.
Run (from `services/admin-dashboard/`): `npx tsc --noEmit` — no errors.
Run: `npm run lint` — no errors.
Run (from `services/admin-dashboard/`): `npm run build` — a production build catches anything `tsc --noEmit`/`lint` alone can miss (e.g. a server/client component boundary violation in one of Task 19's new `"use client"` files). Expected: build succeeds.

- [ ] **Step 3: Confirm the public API contract change is the only one, and is real**

Run (from `services/api/`, against the local/dev API): `curl -s http://localhost:3000/brands | jq '.data[0] | keys'` (or equivalent). Expected: the returned key list contains `tagline` (Task 2's fix for the dead navbar read) and does **not** contain `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaTitle`/`metaDescription`/`metaKeywords`. This is the one documented breaking change in this whole phase (Task 2's entry, and Global Constraints) — confirm it is exactly that, nothing broader: `GET /programs/:id` (or `/admin/programs/:id`) should show the mirror image, now carrying `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress`/`metaKeywords`/`landingContent` that it didn't before Task 1.

- [ ] **Step 4: Confirm the two systems this plan promised zero changes to actually received zero changes**

`ybb-program-next` (per this plan's Tech Stack section: "needs zero code changes in this phase"): run `git status`/`git diff` in that repo's working tree — if this phase's work never touched it, there is nothing to check beyond confirming that. If any file under `ybb-program-next/` was modified in the course of executing Tasks 1-21, that is itself the finding — either the modification was actually necessary (in which case this plan's premise was wrong somewhere, and the discrepancy needs explaining before shipping) or it was accidental scope creep (revert it).

`services/notification`: this microservice consumes the RabbitMQ payloads Tasks 13-14 repointed (`notification.ambassador_created`, `support.ticket.created`/`.replied`/`.status-updated`, `payment.rejected`/`payment_succeeded`-family events) purely by field name, never by querying the API's database directly (confirmed in this plan's Global Constraints). Grep `services/notification`'s source for `contactEmail`/`contactPhone`/`contactAddress` to confirm it only ever reads these as plain object properties off the event payload (e.g. `event.brand.contactEmail`), never via its own Prisma client against `brands`/`programs` — if it does have its own direct DB access to either table, that is a consumer Tasks 13-14 missed entirely (a different codebase, not caught by Step 1's grep, which was scoped to `services/api`) and needs its own repointing pass before Task 21 ships.

If Steps 1-4 all pass, Phase 3 is complete: every task from 1 through 21 has run (this task, 22, is the check that they all landed correctly together, not itself a change), backend and frontend both compile and pass their full suites, the only public contract change is the documented one, and neither of the two systems assumed to need no changes required any.

