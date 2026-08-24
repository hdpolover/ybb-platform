# Program Content Copy and Brand/Program Ownership Split

Date: 2026-08-23
Status: approved, ready for planning

## Problem

Setting up a new program means retyping content that already exists on last year's program. Admins asked for the "Copy from program" / "Copy from template" buttons that exist on Master Data > Submission Form to be added to eight more surfaces, and for a new program created inside a brand to offer copying everything at once.

Two things block doing that directly.

**There is no copy mechanism to reuse.** The existing feature is bespoke to `ApplicationFormField`:

- `services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx:276-294` renders the buttons.
- `CopyFromProgramDialog.tsx` (395 lines) and `CopyFromTemplateDialog.tsx` (331 lines) are two hand-built `Sheet` drawers duplicating roughly 70% of each other (source picker, multi-select, append/replace toggle, type-REPLACE confirm, sticky footer), both hardcoded to form-field types.
- `POST /programs/:programId/form-fields/copy-from-program` and `.../apply-template` in `services/api/src/modules/programs/presentation/program-form-fields.controller.ts:28-79`, backed by `copy-fields-from-program.handler.ts` and `apply-form-template.handler.ts`.
- `ApplicationFormTemplate` / `ApplicationFormTemplateField` in `prisma/schema/applications.prisma:441-484` have no `entityType` discriminator. A template's children are strongly typed to form-field shape.

None of the eight target surfaces has any copy endpoint, dialog, or template model today.

**Two of the requested surfaces are not program-scoped.** Contact is four scalar columns on `Brand` (`contactEmail`, `contactPhone`, `contactWhatsapp`, `contactAddress`). Landing page content is a single `Brand.metadata` JSON column saved by whole-object PUT via `GET/PUT /brands/:brandId/metadata`. There is no program to copy from, because these are not program data.

## What production actually contains

`Brand.metadata` has drifted well past its TypeScript type (`services/admin-dashboard/app/platform/api.ts`, `BrandMetadata`), whose `[key: string]: unknown` index signature hid the drift.

| Brand | Programs | Metadata keys |
|---|---|---|
| China Youth Summit | 1 | benefits, features, further_information, impact_stats, moments_shorts, participant_demographics, partners_canva_url, payment_info, promo_cta, recognition, section_background |
| Istanbul Youth Summit | 5 | apple_icon_url, benefits, favicon_url, features, further_information, moments_shorts, partners_canva_url, payment_info, promo_cta, section_background |
| Japan Youth Summit | 4 | (empty) |
| Korea Youth Summit | 4 | benefits, coreValues, features, impact_stats, objectives, partners_canva_url, promo_cta, tagline |
| Middle East Youth Summit | 5 | apple_icon_url, benefits, favicon_url, features, further_information, impact_stats, moments_shorts, partners_canva_url, promo_cta, section_background |
| Vietnam Youth Summit | 1 | benefits, coreValues, objectives, tagline |
| World Youth Fest | 4 | (empty) |
| Youth Academic Forum | 3 | benefits, coreValues, objectives, tagline |

Findings that shaped the design:

1. **Two dialects.** snake_case (`benefits`, `features`, `impact_stats`, `promo_cta`, `payment_info`, `section_background`, `further_information`, `moments_shorts`, `partners_canva_url`, `recognition`, `participant_demographics`) and camelCase (`tagline`, `objectives`, `coreValues`). Korea carries both.
2. **The type documents a key nobody uses.** `program_objectives` appears in `BrandMetadata`; no brand has it. Real data uses `objectives`.
3. **Undocumented real keys.** `apple_icon_url` and `favicon_url` on Istanbul and MEYS.
4. **`impact_stats` is byte-identical across three brands** — `{"total_alumni": "1700+", "editions_held": "15+", "total_countries": "50+", "total_participants": "1700+"}` on China, MEYS and Korea. These are YBB organisation-wide totals that were copy-pasted, not brand figures.
5. **Empty is normal.** Japan Youth Summit and World Youth Fest have `{}`. Migration must treat absent content as valid, not as an error.
6. **One encoding defect.** Vietnam Youth Summit's `objectives` contains `â€¢` where a bullet belongs (UTF-8 decoded as Latin-1). Confined to that one brand's metadata; zero programs affected. Fixed as a data cleanup line item, not a code change.
7. **The entire camelCase dialect is dead.** `tagline`, `objectives` and `coreValues` have no reader anywhere in `services/api/src` or `ybb-program-next`. They came from `prisma/migration-scripts/legacy-content/migrate-legacy-content.cjs:67-72`, which dumped `core_values`, `objectives`, `benefits` and `tagline` out of legacy MySQL into `Brand.metadata`. Only `benefits` was ever wired to a renderer. The frontend navbar does read a `brand.tagline` (`lib/api/settings.ts:71`, `components/layout/navbar.tsx:173`) but it is fed from `GET /v1/brands`, whose DTO has no `tagline` field — so it is always `undefined` at runtime and the fallback to `brand.description` is what actually renders. Dead end to end.
8. **Several fields already exist at both levels.** `Program` already has `metaTitle` and `metaDescription` (`program.prisma:200-201`) while `Brand` has those plus `metaKeywords`. `Program` has `paymentInfoHtml` while `Brand.metadata` has a structured `payment_info`. `Program` has a real `objectives ProgramObjective[]` relation while `Brand.metadata.program_objectives` acts as a brand-level override of it — the admin UI copy at `BrandDetailPage.tsx:2347` says outright "If this is empty, the landing page uses objectives from the active program". The override-with-fallback pattern we rejected is therefore already present in one place, and this work removes it.
9. **There is no platform-level settings home.** No `SystemSetting`, `PlatformSetting`, `AppConfig` or `GlobalSetting` model exists; `system.prisma` holds only `File` and `MigrationTracking`. The only settings concept is `BrandSetting`, which is brand-scoped. Moving `impact_stats` to platform level means creating both a model and an admin screen that do not exist today.

## Decisions

| Question | Decision |
|---|---|
| Copy abstraction | Copier registry with a narrow function interface (approach C) |
| Uniform list surfaces | Share a `copyScopedRows` helper |
| Payments | Implements the interface itself; two-level tier to validity-period insert |
| Copy semantics | Unchanged from today: replace soft-deletes then inserts, append skips dedupe-key collisions, dedupe stays case-sensitive |
| Templates | One generic store built now; `ApplicationFormTemplate` migrated into it |
| Template composition | `exportTemplate` / `applyTemplate` on the copier interface, so program-copy and template-apply share one apply path |
| Contact / landing | Split field ownership between brand and program; no fallback resolver |
| type-REPLACE gate | Stays at the API boundary, checked once per request, never inside a copier |
| `ProgramParticipationCategory` | Gains a `deletedAt` column so the soft-delete shape stays uniform |
| `impact_stats` | Platform-level, single source, in a new `PlatformSetting` model |
| camelCase keys (`tagline`/`objectives`/`coreValues`) | Backfilled into typed `Brand` columns, then removed. NOT deleted — they are the only copy |
| `program_objectives` override | Removed; objectives live only in `ProgramObjective` |
| Metadata dialects | Normalised into a typed schema; index signature dropped |
| Cross-brand copy | Per-surface copy allows it with the existing media warning; clone-on-create is same-brand only |
| Program content editing | Program Details, under Participant-Facing Content |
| Delivery | One spec, three independently deployed phases |

## Architecture

### The copier registry

The forcing function is clone-on-create: it must invoke every copier at once, atomically. That argues for a registry rather than nine endpoints wired individually.

```ts
interface ProgramCopier {
  readonly key: string;      // 'faqs' | 'timelines' | 'payments' | ...
  readonly label: string;    // 'FAQs'
  readonly supportsAppend: boolean;

  countFor(programId: string): Promise<number>;
  preview(programId: string): Promise<CopyPreviewItem[]>;
  copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult>;

  exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload>;
  applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult>;
}

type CopyMode = 'append' | 'replace';
type CopyInput = { sourceProgramId: string; targetProgramId: string; itemIds?: string[]; mode: CopyMode };
type CopyResult = { created: number; skipped: number; replaced: number };
```

The interface is a **function contract, not a data descriptor**. A surface whose shape differs writes different code behind the same contract instead of bending a shared schema. That is the whole reason this is approach C rather than a fully generic descriptor registry.

Every copier takes a caller-supplied transaction. Single-surface copy wraps one copier in a transaction; clone-on-create wraps many in one. A copier that throws rolls back the entire clone.

### Copy semantics

Preserved exactly as `copy-fields-from-program.handler.ts:22-116` behaves today, because admins already know it:

- **Replace** soft-deletes the target program's existing rows (`deletedAt` set, `isActive: false`) and then inserts. Gated behind typing `REPLACE`.
- **Append** keeps existing rows, computes the next `order`, and skips source rows whose dedupe key collides with an existing row. It does not merge field-level content.
- Both run inside one transaction.

`supportsAppend: false` for scalar-valued copiers (Program Details, Contact, Landing) where appending to a scalar is meaningless. The UI hides the mode toggle for those.

### Per-surface copiers

| Key | Model | Dedupe key | Notes |
|---|---|---|---|
| `form-fields` | `ApplicationFormField` | `name` | Existing handler refactored onto the interface |
| `participation-categories` | `ProgramParticipationCategory` | `name` | Has **no `deletedAt`** column today; see below |
| `timelines` | `ProgramTimeline` | `title` | |
| `rundowns` | `ProgramSchedule` | `(day, activity)` | Backend calls these "schedules"; there is **no `title`** column |
| `faqs` | `ProgramFaq` | `question` | |
| `payments` | `ProgramPricingTier` + `PricingTierValidityPeriod` | tier `name` | Owns its two-level insert; remaps tier ids for child periods |
| `program-details` | `Program` scalars | n/a | `requirementsDescription`, `benefitsDescription`, `termsAndConditions`; replace only |
| `contact` | `Program` scalars (phase 3) | n/a | Replace only |
| `landing` | `Program` content fields (phase 3) | n/a | Replace only |

`copyScopedRows(tx, { delegate, scopeField, dedupeKey, fields, mode })` implements the shared body for the five uniform lists. Payments does not use it.

The payments copier must insert tiers first, capture the generated ids, then insert each tier's validity periods against the new id. It must not copy `soldCount` or `currentCount` — those are live counters, not content.

### Model-shape corrections found by adversarial review

An adversarial pass over the real Prisma models refuted three assumptions that an earlier draft of this document made. They are recorded here because a plan written from the earlier draft would not have compiled.

**`ProgramParticipationCategory` has no `deletedAt` column** (`program.prisma:326-345`). The soft-delete replace mechanic every other copier uses cannot run against it. It also has an inbound FK from `ParticipantApplication.participationCategoryId` (`applications.prisma:148-149`) declared with **no `onDelete`**, so a hard delete of a category still referenced by an application is refused by Postgres. Resolution: add `deletedAt` to the model in a migration so it matches its siblings, rather than giving `copyScopedRows` a per-model delete-strategy parameter. The uniform shape is the thing worth preserving; one column is cheaper than a branch that every future copier has to reason about. Replace on this surface must additionally refuse, with a clear error, when a category being replaced still has applications pointing at it.

**Dedupe keys were wrong for two models.** `ProgramParticipationCategory` has `name`, not `category`. `ProgramSchedule` has no `title` at all — its columns are `day`, `startTime`, `endTime`, `activity`, `description`, `location`, `speaker`, so the natural key is the composite `(day, activity)`. `copyScopedRows` therefore takes a dedupe key that may be composite, not a single field name.

**Dedupe is case-sensitive and the database enforces it.** `ApplicationFormField` carries a partial unique index `(program_id, name) WHERE deleted_at IS NULL` (`applications.prisma:122-127`), so if the application-level check is ever bypassed the insert fails at the constraint rather than silently duplicating. The existing handler compares with an exact `Set.has()` and no normalisation, so `Email` and `email` do not collide. Keep that behaviour — changing it now would alter what an existing button does — but state it in the UI copy so admins are not surprised.

### Where the type-REPLACE gate lives

The confirmation gate is **not** in the handler. It is enforced in `program-form-fields.controller.ts:65-70`, and the `confirm` field is dropped when building the command, so it never reaches the transaction. `ProgramCopier.copy` likewise has no `confirm` parameter. Keep the gate at the API boundary, checked once per request before any copier runs, so clone-on-create validates it once for a whole batch rather than once per entity. No copier is responsible for its own confirmation.


### Generic template store

One template concept platform-wide, replacing the form-field-specific pair.

```prisma
model ContentTemplate {
  id          String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String   @db.VarChar(255)
  description String?  @db.Text
  entityType  String   @map("entity_type") @db.VarChar(64)  // matches ProgramCopier.key
  payload     Json                                            // typed per entityType, validated at the boundary
  payloadVersion Int   @default(1) @map("payload_version")
  isDefault   Boolean  @default(false) @map("is_default")
  createdBy   String?  @map("created_by") @db.Uuid
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)

  @@index([entityType, deletedAt])
  @@map("content_templates")
}
```

`payload` is JSON but **not** a free-for-all: each `entityType` has a zod schema validated on write and on apply, versioned by `payloadVersion` so a shape change is explicit rather than silent. This is the one place JSON is accepted, and it is accepted because the alternative is five typed model pairs plus five management screens.

Templates compose into the registry rather than sitting beside it. `exportTemplate` produces a payload; `applyTemplate` consumes one. Program-copy and template-apply therefore share dedupe, ordering and replace semantics instead of reimplementing them.

**The system-field re-resolution must survive the migration.** `apply-form-template.handler.ts:82-96` re-resolves `system`-sourced fields against the live `SystemFormFieldDefinition` catalog so system fields track catalog changes rather than freezing at template-save time. That logic moves into the form-fields copier's `applyTemplate`. It must not be generalised into shared code — no other entity has a catalog.

### Clone on create

After a program is created in a brand that already has at least one other program, offer a checklist:

- Source program dropdown, same brand only, most recent first.
- One checkbox per registered copier, with counts from `countFor` ("FAQs (12)", "Timelines (8)"). Copiers reporting zero render disabled.
- Defaults to all checked, `append` mode. The target is new and empty, so append and replace are equivalent in effect; append is the safer default if the flow is ever reached for a non-empty program.
- Skippable, and reachable later from the program's Master Data if skipped.

`POST /programs/:id/clone-from` takes `{ sourceProgramId, entities: [{ key, mode }] }` and runs every selected copier in one transaction.

### Brand and program ownership split

Each field gets exactly one owner. No duplication, no fallback resolver, no ambiguity about which level wins.

**Brand keeps** what is constant across seasons: `name`, `slug`, `description`, all four logo URLs, `bannerUrl`, `primaryColor`, `websiteUrl`, `landingUrl` (domain routing is definitionally brand), `about`, `vision`, `mission`, `socialMediaLinks`, `requireEmailVerification`, currency settings, `defaultLocation`/`defaultCountry`/`defaultTimezone`, and from metadata: `section_background` (its own comment says it is global across landing sections), `recognition`, `apple_icon_url`, `favicon_url`, `partners_canva_url`.

**Program takes** what changes every season: `contactEmail`, `contactPhone`, `contactWhatsapp`, `contactAddress`, SEO, and from metadata: `benefits`, `features`, `promo_cta`, `moments_shorts`, `further_information`, `payment_info`, `participant_demographics`.

**Platform takes** `impact_stats`. The values are identical across three brands and are YBB-wide totals. Storing them once removes a live triplicate that drifts the moment one brand is updated and the others are not.

**Backfilled into typed `Brand` columns, then removed:** `tagline`, `objectives` and `coreValues`. An earlier draft of this document said to delete them. That was wrong, and an adversarial review caught it.

Nothing in the new stack reads them — that part held up against an exhaustive search of both repos, the legacy PHP app, sibling repos, git history, tests and the admin UI. But three further facts change the conclusion entirely:

1. **The legacy PHP app renders this exact content to real users today.** `program_ybb_web` reads `$category['tagline']`, `$category['core_values']` and `$category['objectives']` in `app/Views/landing/home/program_category.php`, `program_details.php`, `landing/program-detail/hero.php` and `common/footer.php`. It reads them from the legacy MySQL `program_categories` table rather than from `Brand.metadata`, so this is not a reader of *our* column — but it proves the text is live, authored, in-use content, not abandoned residue.
2. **These keys are the only copy of that text in the new database.** `prisma/seeds/internal/migrate-brands.ts` established the intended mapping — `objectives` to `vision`, `core_values` to `mission`, `tagline` to `metaTitle`. The later production ETL, `migration-scripts/legacy-content/migrate-legacy-content.cjs:72`, wrote the four keys into `metadata` on insert and **never backfilled the typed columns**. `about.strategy.ts` consequently falls back to generic YBB boilerplate for these brands because their `vision` and `mission` are null.
3. **So this is not dead content. It is content whose migration was left half-finished.** Deleting it would complete a data loss that has already partly happened.

Resolution: finish the migration the earlier seed started. Map `objectives` to `Brand.vision`, `coreValues` to `Brand.mission`, and `tagline` to a real `Brand.tagline` column, for the three brands that carry them — Korea Youth Summit, Vietnam Youth Summit and Youth Academic Forum — then drop the metadata keys. A `tagline` column is worth adding rather than folding into `metaTitle`: the frontend navbar already tries to read `brand.tagline` (`lib/api/settings.ts:71`, `components/layout/navbar.tsx:173`) and silently falls back to `description` because `ListBrandsHandler` never sets it. Adding the column and populating the DTO fixes a live rendering gap rather than creating a new field.

Dump the raw metadata to a recoverable file before dropping regardless.

**Also removed:** `metadata.program_objectives`. It is a brand-level override of the `ProgramObjective` relation that already exists on Program. Under split ownership objectives have exactly one owner — the `ProgramObjective` table — and the override is precisely the two-sources-of-truth pattern this work is removing.

### Fields that already exist at both levels

Three pairs predate this work and must be resolved rather than duplicated further.

**SEO.** `Program` already has `metaTitle` and `metaDescription`; `Brand` has both plus `metaKeywords`. Program becomes the owner: add `metaKeywords` to `Program`, then drop all three from `Brand`.

Nothing renders the Brand-level ones. `generateMetadata()` in `ybb-program-next/app/layout.tsx` synthesises description and keywords from the landing payload title plus a hardcoded array, and neither `settings.strategy.ts` nor `about.strategy.ts` reads them; there is no sitemap or RSS builder that does either. **But they are shipped in the public, unauthenticated `BrandResponseDto`** from `GET /v1/brands` and `GET /v1/brands/:id` (`list-brands.handler.ts:63-65`). Dropping them is therefore a public API contract change, not merely an internal cleanup, and needs a deprecation note even though no known consumer reads them.

**Payment info.** `Program.paymentInfoHtml` is a rich-text block; `Brand.metadata.payment_info` is a structured landing section (eyebrow, title, intro, items, note). Both are program-owned after the split and both stay. They render in different places and merging them would lose the structure.

**Benefits.** `Program.benefitsDescription` is a rich-text block in Participant-Facing Content; `metadata.benefits` is a structured landing section (eyebrow, title, groups). Same reasoning: both program-owned, both kept, distinction recorded here so a future reader does not merge them by mistake.

## Data model changes

Phase 1 and 2 add no columns beyond `ContentTemplate`. Phase 3 carries the ownership split.

- `ContentTemplate` added; `ApplicationFormTemplate` and `ApplicationFormTemplateField` migrated in and then dropped.
- `Program` gains the four contact scalars, `metaKeywords`, and a typed content column for the program-owned landing sections.
- `Brand` loses `contactEmail`/`contactPhone`/`contactWhatsapp`/`contactAddress` and `metaTitle`/`metaDescription`/`metaKeywords` after backfill.
- `Brand.metadata` keys that moved are removed after backfill; `tagline`, `objectives`, `coreValues` and `program_objectives` are deleted without migration.
- New `PlatformSetting` model for organisation-wide values, seeded with `impact_stats`, plus a minimal admin screen to edit it. No such model or screen exists today, so this is net-new scope rather than a move.

## Migration

Phase 3 is the only phase touching live public rendering, and it ships alone.

1. Add new columns. Deploy. Nothing reads them yet.
2. Backfill: for each brand, copy program-owned metadata onto its current active program. Brands with `{}` metadata are no-ops. Brands with several programs backfill onto the active one only; older programs stay empty and can be filled by copying.
3. Fix the Vietnam `â€¢` corruption during backfill.
4. Switch reads over in `services/api/src/modules/landing/strategies/home.strategy.ts` and `settings.strategy.ts`, the two places that read these keys. Verify every brand domain renders identically before and after, by diffing the rendered landing payload per brand.
5. Drop the moved metadata keys and the superseded `Brand` columns only after reads are confirmed switched.

**Caches must be invalidated deliberately at step 4.** Landing data sits behind two layers: Next.js `unstable_cache` in `ybb-program-next/lib/api/settings.ts:22-36`, keyed by brand domain with tag-based revalidation, in front of the API's own `landingSnapshotService.getOrBuildSettingsSnapshot` / `CacheService` (1 hour TTL) in `settings.strategy.ts:26-40`. A read switch that does not purge both will show stale content for up to an hour and will make the before/after diff meaningless. The existing `/api/settings/revalidate` tag hook is the mechanism for the outer layer.

Brands still served by the legacy PHP stack read from the legacy database and are unaffected by all of this. They must be excluded from verification rather than reported as failures.

## Testing

- Per-copier unit tests: append dedupes, replace soft-deletes then inserts, empty source is a no-op, item-id filtering is honoured.
- Payments copier: child validity periods are remapped to new tier ids; live counters are not copied.
- Clone-on-create: a copier throwing rolls back every other copier's writes in the same transaction.
- Template round-trip per entity type: `exportTemplate` then `applyTemplate` reproduces the source rows.
- Form-field template migration: system-sourced fields still re-resolve against `SystemFormFieldDefinition` after moving to `ContentTemplate`.
- Payload schema validation rejects a malformed template on write and on apply.
- Phase 3: per-brand rendered-payload diff before and after the read switch.

Follow the repo's jest house style, with comments explaining the real behaviour a test pins rather than restating the code.

## Phases

**Phase 1 — copy engine and program-scoped surfaces.** Registry, `copyScopedRows`, the six program copiers, dialog shell extracted from the working `CopyFromProgramDialog` and the existing Submission Form dialog re-pointed at it first to prove the shell, then buttons added to the other surfaces. Admin-only; cannot affect any public page.

**Phase 2 — templates and clone-on-create.** `ContentTemplate`, the migration off `ApplicationFormTemplate`, one management screen, `exportTemplate`/`applyTemplate` on every copier, and the clone-on-create checklist.

**Phase 3 — ownership split.** New `Program` columns, `PlatformSetting` and its admin screen, the dead-key dump and delete, backfill, cache purge and read switch, removal of the superseded `Brand` columns and metadata keys, and the contact/landing copiers. Ships alone, because it is the only phase that changes what renders on a public brand domain.

Phase 1 delivers the thing that was actually asked for. Phases 2 and 3 are the cost of doing it cleanly, and each can be stopped after the preceding one without leaving the system half-migrated.

## Risks

- **Phase 3 changes what renders on every brand domain.** Mitigated by additive-then-switch ordering and per-brand payload diffing, but it is the one phase that can break a public site. It ships by itself for that reason.
- **Refactoring the working Submission Form dialog** could regress a feature admins rely on. Mitigated by extracting the shell from that dialog and re-pointing it before any new surface uses it, so the proven surface validates the abstraction first.
- **Dropping `[key: string]: unknown`** will surface metadata keys nobody knew about. That is the point, but it may turn up more keys than the audit found, and each needs an owner before phase 3 backfills.
- **Cross-brand copy** can pull media URLs that point at another brand's assets. The existing dialog already warns about this; the shared shell must keep that warning rather than lose it in the extraction.
- **Two cache layers stand between Postgres and the public page.** Phase 3's read switch is only observable after both are purged. See the migration section.
- **`PlatformSetting` is net-new scope** that arrived from the audit, not from the original request. It exists solely to give `impact_stats` a single home. If that feels disproportionate, the fallback is leaving the stats on Brand and accepting the triplicate — a decision worth revisiting before phase 3 rather than during it.
- **The `tagline`/`objectives`/`coreValues` backfill touches the only surviving copy** of that text for three brands (Korea, Vietnam, Youth Academic Forum). Dump the raw metadata to a recoverable file before dropping the keys, and verify the typed columns are populated before the drop, not after.
