# Program Content Copy — Phase 2: Templates and Clone-on-Create Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the form-field-specific `ApplicationFormTemplate`/`ApplicationFormTemplateField` pair with one generic `ContentTemplate` model, add `exportTemplate`/`applyTemplate` to all seven `ProgramCopier` implementations Phase 1 shipped, expose a generic template CRUD surface plus an `apply-template` route on `ProgramCopyController`, extract a generic `CopyFromTemplateDialog` shell (mirroring Phase 1's `CopyFromProgramDialog` extraction) and wire it onto all seven program-content surfaces, replace the unlinked `/platform/form-templates` screen with a generic `/platform/content-templates` screen, and add the clone-on-create checklist that runs every selected copier's existing `copy()` in one transaction when a new program is created into a brand that already has siblings.

**Architecture:** `ProgramCopier` (Phase 1, `program-copier.interface.ts`) gains two members — `exportTemplate(programId, itemIds?): Promise<TemplatePayload>` and `applyTemplate(tx, payload, targetProgramId, mode): Promise<CopyResult>` — bringing every copier up to the spec's full interface. `TemplatePayload` is `{ entityType, payloadVersion, items: Record<string, unknown>[] }`: a uniform envelope so generic frontend code can show an item count without knowing what "item" means for any given entity. Each entity type's `items` shape is validated by a zod schema (`template-payload.schemas.ts`) on both `exportTemplate`'s output (write path, inside `CreateContentTemplateHandler`) and `applyTemplate`'s input (apply path, inside each copier). `ContentTemplate` (new Prisma model in `content.prisma`, alongside the other `*Template` models already there) stores the payload as JSON with an `entityType` discriminator matching `ProgramCopier.key`. `copy-scoped-rows.ts` gains a sibling export, `applyScopedTemplate`, sharing its guarded core with the existing `copyScopedRows` — both call the same private `runScopedInsert`, so the five list-copiers' `applyTemplate` methods inherit the exact empty-replace-source guard `copyScopedRows` already enforces, without touching `copyScopedRows`'s existing signature, callers, or tests. Payments and Program Details, which don't use `copyScopedRows` today, duplicate their existing explicit guards into `applyTemplate` the same way they already duplicate them between their own `preview`/`copy` — an established pattern in this codebase, not a new one. `ProgramCopyController` gains three routes: `apply-template` (mirrors `copy`'s transaction + type-REPLACE gate + post-commit landing-cache invalidation), `registry` (entity key/label/supportsAppend/count, feeding both the new template screen's tabs and the clone-on-create checklist), and `clone-from` (runs every selected copier's `copy()` in one transaction). A new `ContentTemplatesController` exposes generic list/detail/create-from-program/update-metadata/delete. On the frontend, `CopyFromTemplateDialog` is extracted the same way Phase 1 extracted `CopyFromProgramDialog` — proven first on Submission Form Fields (which already has a bespoke, working template-apply dialog), then wired onto the other six surfaces. `/platform/content-templates` replaces the currently-unlinked `/platform/form-templates` screen with an entity-type-tabbed list plus a "Create from program" dialog that reuses Phase 1's existing preview/counts endpoints. A new `CloneOnCreateDialog` replaces the ad-hoc `window.confirm`-based `offerDefaultTemplate` prompt in `programs/page.tsx` whenever the target brand already has another program; brands with no existing programs keep the old default-template prompt, since there is nothing to clone from.

**Tech Stack:** NestJS + `@nestjs/cqrs` + Prisma 7 (API, Jest via `npx jest`) + zod (new dependency — added in Task 1; already used in `services/admin-dashboard` at `^4.3.6`, not yet in `services/api`). Next.js 16 + React + Tailwind + sonner (admin dashboard, verified via `npx tsc --noEmit`, no FE test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-08-23-program-content-copy-design.md`. This plan implements exactly the Phase 2 slice: "`ContentTemplate`, the migration off `ApplicationFormTemplate`, one management screen, `exportTemplate`/`applyTemplate` on every copier, and the clone-on-create checklist." Phase 3 (Brand/Program ownership split, `contact`/`landing` copiers, `PlatformSetting`) is untouched here.

## Global Constraints

- **Grounded in what Phase 1 actually shipped, not the Phase 1 plan draft.** Production code diverged from `docs/superpowers/plans/2026-08-23-program-content-copy-phase-1.md` in three ways this plan depends on: (1) `copyScopedRows` (`copy-scoped-rows.ts`) already throws `BadRequestException({code:'empty_replace_source'})` before any mutation when `mode==='replace'` and the resolved source is empty — this guard is preserved unconditionally in this plan's refactor. (2) `ProgramCopierRegistry`'s constructor throws a plain `Error` on a duplicate key, and `programs.module.ts` wires it via a `useFactory`/`inject` provider (its constructor is a variadic rest param — Nest cannot positionally inject that directly as an ordinary provider). (3) `ProgramCopyController` injects `LandingCacheInvalidationService` and calls `invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation)` (exported from `manage-program-content.handlers.ts`) **after** the transaction commits, because `@CacheInvalidate(PROGRAM_CONTENT_PATTERNS)` only busts Redis-pattern caches, not the DB-backed `brand_landing_snapshots` row the public landing pages read through. Every new route this plan adds that mutates program content (`apply-template`, `clone-from`) follows the same after-commit invalidation call.
- **The empty-replace-source guard must not be reimplemented ad hoc.** It bit this feature four times across Phase 1's fix rounds. `applyScopedTemplate` (Task 3) shares its guarded core with `copyScopedRows`, so the five list-copiers inherit it automatically. `PaymentsCopier.applyTemplate` and `ProgramDetailsCopier.applyTemplate` (Tasks 11, 12) each duplicate their own `copy()`'s explicit guard, matching how those two copiers already duplicate it between their own methods today — this is existing, accepted precedent, not new debt.
- **Guards run before any mutation**, and every test that exercises a guard asserts **no delegate mutation call happened** (`updateMany`/`create` not called), not merely that an exception was thrown — a thrown-but-already-mutated guard is not a passing test here.
- **Test fixtures use distinguishable source/target ids** (`'src'`/`'tgt'`, never both `'p1'`) wherever a test asserts *which* program id a call was made against — an assertion on indistinguishable ids cannot detect a source/target swap bug.
- **`TemplatePayload.items` is `Record<string, unknown>[]`, not a per-entity generic.** `ProgramCopier` stays entity-agnostic at the interface level (spec: "a function contract, not a data descriptor") — each copier's own `exportTemplate`/`applyTemplate` bodies know their own item shape and validate it via `template-payload.schemas.ts` (Task 4); nothing outside a copier ever needs to know it.
- **`ScopedRowsDelegate<Row>` is structurally satisfiable by a non-transactional `prisma.model`** — TypeScript will not catch a copier accidentally passing `this.prisma.<model>` instead of `tx.<model>` into `applyScopedTemplate`. Every copier task below casts `tx.<model>` explicitly, matching the existing `copy()` methods' pattern, and every test's mock `PrismaService` asserts the call happened through the object passed as `tx`.
- **`exportTemplate`'s system-field re-resolution logic must not be generalised.** Per the spec, `apply-form-template.handler.ts`'s live re-resolution of `source: 'system'` fields against `SystemFormFieldDefinition` moves into `FormFieldsCopier.applyTemplate` (Task 6) verbatim — no other entity type has a catalog, so no shared helper is introduced for it.
- **Exported system-sourced form fields never freeze `label`/`type`/`helpText`/`options` from the live program field.** The existing `TemplateFormModal.tsx` creation flow (being replaced by Task 24) never lets an admin set a custom label/type/options for a system-sourced template field — it only ever picks a `systemFieldKey` + `section` and always resolves everything else from the catalog at apply time. `FormFieldsCopier.exportTemplate` (Task 6) preserves that behavior: system-sourced items export only `{ source: 'system', systemFieldKey, section, isRequired, order }`, with no `label`/`type`/`helpText`/`options` in the payload at all, so `applyTemplate` always re-resolves them from the live catalog, every time, for every template — not just ones nobody customized. Custom-sourced items export their full resolved shape, since a custom field has no catalog to track.
- **Migrating existing `ApplicationFormTemplateField` rows into `ContentTemplate` payloads is a straight, lossless 1:1 field copy** (Task 19) — including whatever `labelOverride`/`helpTextOverride`/`label`/`type`/`options` values already sit in those rows, even though nothing in this codebase's UI has ever set a non-null override. `FormFieldsCopier.applyTemplate` (Task 6) accepts both shapes: items with only `{source:'system', systemFieldKey, section, isRequired, order}` (freshly exported) and items carrying the full legacy shape with `labelOverride`/`helpTextOverride` (migrated) — both are optional fields on the same zod schema, and the resolution algorithm is the exact `apply-form-template.handler.ts` algorithm, unchanged.
- **`ContentTemplate.isDefault` is scoped by `entityType`, not by the old `category` field.** `ApplicationFormTemplate.category` (a free-text string, never used for anything but default-scoping and a category filter dropdown) has no equivalent on `ContentTemplate` — the spec's model doesn't carry one. Setting `isDefault: true` on a `ContentTemplate` unsets it on every other template of the **same `entityType`**, which is the natural replacement scope now that `entityType` is the only discriminator.
- **Template creation is export-only — there is no hand-authored/raw-payload creation path.** The existing `TemplateFormModal.tsx` "create" flow only ever picks system catalog field keys (never custom fields, never overrides) — it is a narrow special case of "export a hand-picked selection," not general authoring. Phase 2 generalizes to "pick a source program and items, then export," consistent with the spec's `exportTemplate`/`applyTemplate` composition and with every other entity type, none of which ever had a hand-authoring UI. `POST /content-templates` therefore always takes `{ entityType, sourceProgramId, itemIds? }` and calls `registry.get(entityType).exportTemplate(sourceProgramId, itemIds)` server-side — it never accepts a client-supplied payload.
- **The type-`REPLACE` confirmation gate and the `supportsAppend` check apply identically to `apply-template` and `clone-from`** as they already do to `copy` — checked once per request/per-entity at the `ProgramCopyController` boundary, never inside a copier. `clone-from`'s default mode is `append` for every entity (per spec: "Defaults to all checked, append mode"), but the endpoint still validates whatever mode the client actually sends per entity, since the same route serves "reachable later from the program's Master Data if skipped."
- **No new dependency added to the admin dashboard.** `zod` is already present there (`^4.3.6`) — this plan only adds it to `services/api`.
- **`/platform/form-templates` has no sidebar/nav entry today** (verified: no reference to `platform/form-templates` or the label "Form Templates" exists anywhere in `services/admin-dashboard` outside that page's own folder) — it is reached only by direct URL. `/platform/content-templates` (Task 25) inherits that same unlinked state; adding a nav entry is out of scope for this plan.
- API test command: `npx jest --testPathPattern="<pattern>"` from `services/api/`. Typecheck: `npx tsc --noEmit -p tsconfig.json` from `services/api/`. Admin dashboard has no test runner; verify with `npx tsc --noEmit` from `services/admin-dashboard/`.
- Out of scope: Phase 3 in full (Brand/Program ownership split, `contact`/`landing` copiers, `PlatformSetting`, the dead-metadata-key dump/backfill/drop).

---

## File Structure

**API (`services/api/`) — modified copy engine:**
- `src/modules/programs/application/copy/program-copier.interface.ts` — add `TemplatePayload` type; add `exportTemplate`/`applyTemplate` to `ProgramCopier`.
- `src/modules/programs/application/copy/copy-scoped-rows.ts` + `.spec.ts` — add `applyScopedTemplate` + `ApplyScopedTemplateConfig`, sharing a new private `runScopedInsert` core with the existing `copyScopedRows` (unchanged signature/behavior).
- `src/modules/programs/application/copy/template-payload.schemas.ts` + `.spec.ts` — new: per-entityType zod item schemas + `parseTemplateItems(entityType, items)`.
- `src/modules/programs/application/copy/copiers/*.copier.ts` + `.spec.ts` (all seven) — add `exportTemplate`/`applyTemplate`.

**API — new `ContentTemplate` model + CRUD:**
- `prisma/schema/content.prisma` — add `model ContentTemplate`.
- `prisma/migrations/20260824090000_add_content_template/migration.sql` — create `content_templates`.
- `prisma/migrations/20260824091000_backfill_content_template_from_form_templates/migration.sql` — data migration.
- `prisma/migrations/20260824092000_drop_application_form_template/migration.sql` — drop old tables (Task 19, after app code stops referencing them).
- `src/modules/programs/application/commands/content-template.commands.ts` — `CreateContentTemplateCommand`, `UpdateContentTemplateCommand`, `DeleteContentTemplateCommand`.
- `src/modules/programs/application/commands/handlers/content-template.handler.ts` + `.spec.ts` — the three command handlers.
- `src/modules/programs/application/queries/get-content-templates.query.ts` — `GetContentTemplatesQuery`, `GetContentTemplateByIdQuery`.
- `src/modules/programs/application/queries/handlers/get-content-templates.handler.ts` + `.spec.ts` — the two query handlers.
- `src/modules/programs/presentation/dto/content-template.dto.ts` — `CreateContentTemplateDto`, `UpdateContentTemplateDto`, `ContentTemplateSummaryDto`, `ContentTemplateDetailDto`.
- `src/modules/programs/presentation/content-templates.controller.ts` + `.spec.ts` — `ContentTemplatesController`.

**API — `ProgramCopyController` additions:**
- `src/modules/programs/presentation/program-copy.controller.ts` + `.spec.ts` — add `apply-template`, `registry`, `clone-from` routes.
- `src/modules/programs/presentation/dto/copy-entity.dto.ts` — add `ApplyTemplateEntityDto`, `CloneFromProgramDto`.

**API — deleted (superseded by `ContentTemplate` + the generic routes):**
- `src/modules/programs/presentation/form-templates.controller.ts`
- `src/modules/programs/presentation/dto/form-template.dto.ts` + `.spec.ts`
- `src/modules/programs/presentation/dto/apply-form-template.dto.ts`
- `src/modules/programs/application/commands/form-template.commands.ts`
- `src/modules/programs/application/commands/handlers/form-template.handler.ts` + `.spec.ts`
- `src/modules/programs/application/commands/apply-form-template.command.ts`
- `src/modules/programs/application/commands/handlers/apply-form-template.handler.ts` + `.spec.ts`
- `src/modules/programs/application/queries/get-form-templates.query.ts`
- `src/modules/programs/application/queries/handlers/get-form-templates.handler.ts` + `.spec.ts`

**API — modified wiring:**
- `src/modules/programs/programs.module.ts` — remove old template providers/controller; add `ContentTemplatesController` + the new command/query handlers.
- `src/modules/programs/presentation/program-form-fields.controller.ts` — remove the `apply-template` route (superseded by `ProgramCopyController`'s generic one).
- `package.json` — add `zod`.

**Admin dashboard (`services/admin-dashboard/`) — new shared shells:**
- `app/components/shared/copy-from-program/copy-api.ts` — add `fetchCopyRegistry`, `postApplyTemplate`, `postCloneFrom`.
- `app/components/shared/copy-from-program/CopyFromTemplateDialog.tsx` — new, generic (mirrors `CopyFromProgramDialog.tsx`).
- `app/components/shared/content-templates/content-templates-api.ts` — new: template CRUD client.
- `app/components/shared/content-templates/CreateTemplateFromProgramDialog.tsx` — new.
- `app/components/shared/content-templates/ContentTemplateDetailDrawer.tsx` — new, generic.

**Admin dashboard — new management screen:**
- `app/platform/content-templates/page.tsx` — new, replaces `app/platform/form-templates/`.

**Admin dashboard — new clone-on-create:**
- `app/platform/components/programs/CloneOnCreateDialog.tsx` — new.
- `app/platform/programs/page.tsx` — modified: hook `CloneOnCreateDialog` into `handleCreateProgram`.

**Admin dashboard — modified (add "Copy from template" button) or deleted:**
- Delete: `app/platform/form-templates/` (`page.tsx`, `TemplateFormModal.tsx`, `TemplateDetailDrawer.tsx`).
- Delete: `app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx`.
- Modify: `app/components/submissionsMasterData/form-fields/catalog-api.ts` — remove template-only exports; keep system-field-catalog exports (`fetchSystemFormFields`, `create/update/deleteSystemFormField` and their types) untouched.
- Modify: `app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx` — re-point at the shared `CopyFromTemplateDialog` (proves the abstraction first).
- Modify: `app/components/submissionsMasterData/categories/ParticipationCategoriesTable.tsx`.
- Modify: `app/programs/[programId]/master-data/timelines/page.tsx`.
- Modify: `app/programs/[programId]/master-data/faqs/page.tsx`.
- Modify: `app/programs/[programId]/master-data/program-rundowns/page.tsx`.
- Modify: `app/components/programPaymentsMasterData/options/PaymentOptionTable.tsx`.
- Modify: `app/programs/[programId]/master-data/program-details/page.tsx`.

## Task 1: Add the `zod` dependency

**Files:**
- Modify: `services/api/package.json`

**Interfaces:**
- Produces: the `zod` package available to `import { z } from 'zod'` — Task 4's schema file is the first consumer.

- [ ] **Step 1: Install it**

Run (from `services/api/`):

```bash
npm install zod@^4.3.6
```

This matches the version already used in `services/admin-dashboard` (`package.json` there pins `"zod": "^4.3.6"`), so both services validate with the same major version even though they're separate `npm` installs.

- [ ] **Step 2: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors (nothing imports it yet).

- [ ] **Step 3: Commit**

```bash
cd services/api
git add package.json package-lock.json
git commit -m "chore(api): add zod dependency for template payload validation"
```

---

## Task 2: Extend `ProgramCopier` with `TemplatePayload` and `exportTemplate`/`applyTemplate`

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/program-copier.interface.ts`

**Interfaces:**
- Produces: `TemplatePayload` type; `ProgramCopier.exportTemplate(programId, itemIds?): Promise<TemplatePayload>` and `ProgramCopier.applyTemplate(tx, payload, targetProgramId, mode): Promise<CopyResult>` — every copier task below (6-12) implements both; Task 13-17's template/apply-template routes consume `TemplatePayload` directly.

This is the full spec interface now — Phase 1's own comment block said "Phase 1 subset ... exportTemplate/applyTemplate, added in Phase 2 once ContentTemplate exists." That comment is removed here since it's no longer true.

- [ ] **Step 1: Edit the file**

```typescript
// services/api/src/modules/programs/application/copy/program-copier.interface.ts
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Mirrors TxLike in copy-fields-from-program.handler.ts — the callback
// argument of PrismaService.$transaction is typed as PrismaService itself
// throughout this codebase, not Prisma.TransactionClient.
export type PrismaTx = PrismaService;

export type CopyMode = 'append' | 'replace';

export interface CopyInput {
  sourceProgramId: string;
  targetProgramId: string;
  itemIds?: string[];
  mode: CopyMode;
  // Deliberately no `confirm` field: the type-REPLACE gate lives only at the
  // API boundary (ProgramCopyController), checked once before any copier
  // runs. See copy-fields-from-program.handler.ts, which never received
  // `confirm` either — program-form-fields.controller.ts drops it before
  // building the command.
}

export interface CopyResult {
  created: number;
  skipped: number;
  replaced: number;
}

export interface CopyPreviewItem {
  id: string;
  label: string;
  meta?: string;
  // Set true only by copiers whose rows can carry cross-brand media: either
  // literal media references (form-fields' mediaUrl/helpAssets) or Tiptap
  // rich-text fields that can embed <img>/<iframe>/<video>
  // (program-details, participation-categories, payments' tier
  // description). Lets the generic dialog show the cross-brand warning
  // without knowing which entity it's rendering.
  hasExternalMedia?: boolean;
}

/**
 * The portable, storable form of "what a copier would copy" — produced by
 * exportTemplate, consumed by applyTemplate, and what ContentTemplate.payload
 * actually stores as JSON (Task 5). `items` is intentionally untyped at this
 * level: ProgramCopier is a function contract, not a data descriptor (spec),
 * so each copier's own exportTemplate/applyTemplate is the only code that
 * knows its own item shape — validated against template-payload.schemas.ts
 * (Task 4) inside each copier, not here.
 */
export interface TemplatePayload {
  entityType: string;
  payloadVersion: number;
  items: Record<string, unknown>[];
}

/**
 * Full spec ProgramCopier contract
 * (docs/superpowers/specs/2026-08-23-program-content-copy-design.md). Phase 1
 * shipped every member except exportTemplate/applyTemplate, deferred until
 * ContentTemplate existed. This plan (Phase 2) adds them.
 */
export interface ProgramCopier {
  readonly key: string;
  readonly label: string;
  readonly supportsAppend: boolean;

  countFor(programId: string): Promise<number>;
  preview(programId: string): Promise<CopyPreviewItem[]>;
  copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult>;

  /** Builds a storable payload from a program's current live rows. Honors itemIds like copy() does. */
  exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload>;
  /** Applies a stored payload into targetProgramId, sharing copy()'s dedupe/order/replace semantics. */
  applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult>;
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: **errors** — every existing copier class (`FormFieldsCopier`, `ParticipationCategoriesCopier`, `TimelinesCopier`, `RundownsCopier`, `FaqsCopier`, `PaymentsCopier`, `ProgramDetailsCopier`) now fails to satisfy `ProgramCopier` because none of them implements `exportTemplate`/`applyTemplate` yet. This is expected and resolved incrementally by Tasks 6-12; do not add stub implementations here to silence it.

- [ ] **Step 3: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/program-copier.interface.ts
git commit -m "feat(programs): add TemplatePayload and exportTemplate/applyTemplate to ProgramCopier"
```

---

## Task 3: `applyScopedTemplate` — share `copyScopedRows`'s guarded core (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copy-scoped-rows.ts`
- Modify: `services/api/src/modules/programs/application/copy/copy-scoped-rows.spec.ts` (add tests; existing tests are untouched and must keep passing)

**Interfaces:**
- Consumes: `CopyMode`, `CopyResult` from `./program-copier.interface` (Task 2).
- Produces: `ApplyScopedTemplateConfig<Row>`, `applyScopedTemplate<Row>(config): Promise<CopyResult>` — Tasks 6, 7, 8, 9, 10 (the five `copyScopedRows`-based copiers) import this exact name alongside the existing `copyScopedRows`/`ScopedRowsDelegate`.

`copyScopedRows`'s existing public signature, behavior, and its own five passing tests are **untouched** — this task extracts a private `runScopedInsert` core that both `copyScopedRows` (which still resolves `sourceRows` from `delegate.findMany({ where: { [scopeField]: sourceProgramId } })` + `itemIds` filtering, exactly as today) and the new `applyScopedTemplate` (which takes already-resolved `sourceRows` straight from a template payload — there is no `sourceProgramId` to query) call afterward. The empty-replace-source guard, the `beforeReplace` integrity hook, the dedupe set, and the order-baseline logic all live in the shared core, so `applyScopedTemplate` inherits every one of them for free.

- [ ] **Step 1: Write the failing tests**

Append to `services/api/src/modules/programs/application/copy/copy-scoped-rows.spec.ts` (the existing `import` and the existing `describe('copyScopedRows', ...)` block stay exactly as they are — this only adds a new top-level `describe`):

```typescript
// Append to services/api/src/modules/programs/application/copy/copy-scoped-rows.spec.ts
import { applyScopedTemplate } from './copy-scoped-rows';

describe('applyScopedTemplate', () => {
  it('append inserts template rows and skips exact dedupe-key collisions (case-sensitive)', async () => {
    const delegate = fakeDelegate([{ id: 't1', name: 'email', order: 0, programId: 'tgt' }]);
    const result = await applyScopedTemplate({
      delegate,
      scopeField: 'programId',
      targetProgramId: 'tgt',
      sourceRows: [
        { id: '', name: 'Email', order: 0, programId: '' } as Row,
        { id: '', name: 'phone', order: 1, programId: '' } as Row,
      ],
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    // 'Email' (capital E) does not collide with existing lowercase 'email' —
    // same exact-match dedupe copyScopedRows uses, verified here so
    // applyScopedTemplate can't silently drift from it.
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
    expect(delegate.create).toHaveBeenCalledTimes(2);
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const delegate = fakeDelegate([{ id: 't1', name: 'old', order: 0, programId: 'tgt' }]);
    await expect(
      applyScopedTemplate({
        delegate,
        scopeField: 'programId',
        targetProgramId: 'tgt',
        sourceRows: [] as Row[],
        mode: 'replace',
        activeFilter: {},
        idOf: (r: Row) => r.id,
        dedupeKey: (r: Row) => r.name,
        fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
        replaceData: { deletedAt: new Date() },
      }),
    ).rejects.toThrow('empty_replace_source' /* substring match against the error's JSON-ish message is enough here */);
    expect(delegate.updateMany).not.toHaveBeenCalled();
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it('replace soft-deletes existing target rows via replaceData, then inserts from order 0', async () => {
    const delegate = fakeDelegate([{ id: 't1', name: 'old', order: 0, programId: 'tgt' }]);
    const replaceData = { deletedAt: new Date('2026-08-24'), isActive: false };
    const result = await applyScopedTemplate({
      delegate,
      scopeField: 'programId',
      targetProgramId: 'tgt',
      sourceRows: [{ id: '', name: 'a', order: 3, programId: '' } as Row],
      mode: 'replace',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData,
    });
    expect(delegate.updateMany).toHaveBeenCalledWith({ where: { programId: 'tgt' }, data: replaceData });
    expect(delegate.create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('runs beforeReplace with the existing target row ids before deleting, and aborts if it throws', async () => {
    const delegate = fakeDelegate([{ id: 't1', name: 'old', order: 0, programId: 'tgt' }]);
    const beforeReplace = jest.fn(async () => {
      throw new Error('blocked');
    });
    await expect(
      applyScopedTemplate({
        delegate,
        scopeField: 'programId',
        targetProgramId: 'tgt',
        sourceRows: [{ id: '', name: 'a', order: 0, programId: '' } as Row],
        mode: 'replace',
        activeFilter: {},
        idOf: (r: Row) => r.id,
        dedupeKey: (r: Row) => r.name,
        fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
        replaceData: { deletedAt: new Date() },
        beforeReplace,
      }),
    ).rejects.toThrow('blocked');
    expect(beforeReplace).toHaveBeenCalledWith(['t1']);
    expect(delegate.updateMany).not.toHaveBeenCalled();
    expect(delegate.create).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copy-scoped-rows.spec"`
Expected: FAIL — `applyScopedTemplate` is not exported yet. The pre-existing `copyScopedRows` tests in the same file still PASS (they're unaffected by anything added so far).

- [ ] **Step 3: Refactor the helper**

```typescript
// services/api/src/modules/programs/application/copy/copy-scoped-rows.ts
import { BadRequestException } from '@nestjs/common';
import { CopyMode, CopyResult } from './program-copier.interface';

/**
 * Minimal duck-typed slice of a Prisma model delegate. Deliberately not the
 * generated Prisma delegate type: the five callers (form fields, participation
 * categories, timelines, rundowns, FAQs) each have a different row shape, so
 * each copier casts its real `tx.<model>` delegate into this shape at the
 * call site (`as unknown as ScopedRowsDelegate<Row>`) rather than
 * copyScopedRows assuming a schema. This mirrors the existing `as never`
 * casts in copy-fields-from-program.handler.ts for the same reason: Prisma's
 * generated types are too specific to share across five different models.
 */
export interface ScopedRowsDelegate<Row> {
  findMany(args: { where: Record<string, unknown>; orderBy?: Record<string, unknown> }): Promise<Row[]>;
  updateMany(args: { where: Record<string, unknown>; data: Record<string, unknown> }): Promise<{ count: number }>;
  create(args: { data: Record<string, unknown> }): Promise<Row>;
}

interface ScopedInsertArgs<Row> {
  delegate: ScopedRowsDelegate<Row>;
  scopeField: string;
  targetProgramId: string;
  sourceRows: Row[];
  mode: CopyMode;
  activeFilter: Record<string, unknown>;
  idOf: (row: Row) => string;
  dedupeKey: (row: Row) => string;
  fields: (row: Row, order: number) => Record<string, unknown>;
  replaceData: Record<string, unknown>;
  beforeReplace?: (existingIds: string[]) => Promise<void>;
}

/**
 * Shared guarded core for both entry points below. `sourceRows` arrives
 * already resolved and already itemIds-filtered by the caller — this
 * function never queries for a source, only ever for the target's existing
 * rows (needed for the dedupe set / order baseline / integrity guard / what
 * a replace is about to soft-delete).
 */
async function runScopedInsert<Row>(args: ScopedInsertArgs<Row>): Promise<CopyResult> {
  const { delegate, scopeField, targetProgramId, sourceRows, mode, activeFilter, idOf, dedupeKey, fields, replaceData, beforeReplace } = args;

  // Replace mode soft-deletes every current target row unconditionally, then
  // inserts sourceRows. If sourceRows is empty here — either the source has
  // nothing active, an itemIds selection filtered it down to nothing, or (for
  // applyScopedTemplate) the stored template payload is empty — that
  // soft-delete would destroy the target's content with nothing to replace
  // it. copy-fields-from-program.handler.ts guarded exactly this case (its
  // `no_fields` 400, thrown before any mutation); every caller of this core
  // — copy() via copyScopedRows and applyTemplate() via applyScopedTemplate —
  // gets the guard identically. Append mode is unaffected: an empty source
  // there is a legitimate no-op.
  if (mode === 'replace' && sourceRows.length === 0) {
    throw new BadRequestException({
      code: 'empty_replace_source',
      message:
        "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
    });
  }

  const existingRows = await delegate.findMany({ where: { [scopeField]: targetProgramId, ...activeFilter } });

  let replaced = 0;
  if (mode === 'replace') {
    if (beforeReplace) {
      await beforeReplace(existingRows.map(idOf));
    }
    const result = await delegate.updateMany({
      where: { [scopeField]: targetProgramId, ...activeFilter },
      data: replaceData,
    });
    replaced = result.count;
  }

  const existingKeys = new Set(mode === 'append' ? existingRows.map(dedupeKey) : []);
  const baseOrder =
    mode === 'append'
      ? existingRows.reduce((max, row) => Math.max(max, (row as { order: number }).order), -1) + 1
      : 0;

  let created = 0;
  let skipped = 0;
  let placed = 0;

  for (const row of sourceRows) {
    const key = dedupeKey(row);
    if (existingKeys.has(key)) {
      skipped += 1;
      continue;
    }
    await delegate.create({ data: fields(row, baseOrder + placed) });
    existingKeys.add(key);
    created += 1;
    placed += 1;
  }

  return { created, skipped, replaced };
}

export interface CopyScopedRowsConfig<Row> {
  delegate: ScopedRowsDelegate<Row>;
  scopeField: string;
  sourceProgramId: string;
  targetProgramId: string;
  itemIds?: string[];
  mode: CopyMode;
  /** Extra where-clauses beyond scopeField, e.g. { deletedAt: null }. */
  activeFilter: Record<string, unknown>;
  idOf: (row: Row) => string;
  dedupeKey: (row: Row) => string;
  fields: (row: Row, order: number) => Record<string, unknown>;
  /** Data passed to updateMany when mode === 'replace'. */
  replaceData: Record<string, unknown>;
  /**
   * Optional integrity guard run with the target's current live row ids
   * before the replace-mode soft-delete executes. Throw to abort the whole
   * copy before any mutation happens. Only participation-categories uses
   * this today (refusing replace when applications still reference a
   * category); every other copier omits it.
   */
  beforeReplace?: (existingIds: string[]) => Promise<void>;
}

/** Unchanged public behavior from before this task: resolves sourceRows from sourceProgramId, then delegates to the shared core. */
export async function copyScopedRows<Row>(config: CopyScopedRowsConfig<Row>): Promise<CopyResult> {
  const { delegate, scopeField, sourceProgramId, itemIds, idOf } = config;

  let sourceRows = await delegate.findMany({
    where: { [scopeField]: sourceProgramId, ...config.activeFilter },
    orderBy: { order: 'asc' },
  });

  if (itemIds && itemIds.length > 0) {
    const idSet = new Set(itemIds);
    sourceRows = sourceRows.filter((row) => idSet.has(idOf(row)));
  }

  return runScopedInsert({ ...config, sourceRows });
}

export interface ApplyScopedTemplateConfig<Row> {
  delegate: ScopedRowsDelegate<Row>;
  scopeField: string;
  targetProgramId: string;
  /** Already resolved from a TemplatePayload's items — no program to query. */
  sourceRows: Row[];
  mode: CopyMode;
  activeFilter: Record<string, unknown>;
  idOf: (row: Row) => string;
  dedupeKey: (row: Row) => string;
  fields: (row: Row, order: number) => Record<string, unknown>;
  replaceData: Record<string, unknown>;
  beforeReplace?: (existingIds: string[]) => Promise<void>;
}

/**
 * Template-payload counterpart to copyScopedRows, sharing the exact same
 * guarded core (runScopedInsert) — so the empty-replace-source guard, the
 * beforeReplace integrity hook, dedupe, and order-baseline logic can never
 * drift between "copy from a sibling program" and "apply a stored template."
 */
export async function applyScopedTemplate<Row>(config: ApplyScopedTemplateConfig<Row>): Promise<CopyResult> {
  return runScopedInsert(config);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copy-scoped-rows.spec"`
Expected: PASS — the original 6 `copyScopedRows` tests plus the 4 new `applyScopedTemplate` tests, 10 total.

- [ ] **Step 5: Verify no other file broke**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: still the same set of "copier doesn't implement exportTemplate/applyTemplate" errors from Task 2 — nothing new. `copyScopedRows`'s five existing callers (`form-fields.copier.ts`, `participation-categories.copier.ts`, `timelines.copier.ts`, `rundowns.copier.ts`, `faqs.copier.ts`) are untouched by this task and still compile against the unchanged `copyScopedRows` signature.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copy-scoped-rows.ts src/modules/programs/application/copy/copy-scoped-rows.spec.ts
git commit -m "feat(programs): add applyScopedTemplate, sharing copyScopedRows's guarded core"
```

---

## Task 4: Per-entityType zod payload schemas (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/template-payload.schemas.ts`
- Create: `services/api/src/modules/programs/application/copy/template-payload.schemas.spec.ts`

**Interfaces:**
- Consumes: `zod` (Task 1).
- Produces: `parseTemplateItems(entityType: string, items: unknown): Record<string, unknown>[]` (throws `BadRequestException` on an unknown `entityType` or a shape mismatch) — every copier's `applyTemplate` (Tasks 6-12) calls this at the top before touching the database; `CreateContentTemplateHandler` (Task 13) calls it right after `exportTemplate` and before persisting.

One schema per registered copier key, keyed in a `Record<string, z.ZodTypeAny>` so adding an eighth copier later means adding one schema entry, not touching call sites.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/template-payload.schemas.spec.ts
import { BadRequestException } from '@nestjs/common';
import { parseTemplateItems } from './template-payload.schemas';

describe('parseTemplateItems', () => {
  it('throws BadRequestException for an unregistered entityType', () => {
    expect(() => parseTemplateItems('not-a-real-key', [])).toThrow(BadRequestException);
  });

  it('form-fields: accepts a system-sourced item with only the thin shape (no label/type/options)', () => {
    const items = parseTemplateItems('form-fields', [
      { source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 },
    ]);
    expect(items).toHaveLength(1);
  });

  it('form-fields: accepts a custom-sourced item with the full resolved shape', () => {
    const items = parseTemplateItems('form-fields', [
      {
        source: 'custom',
        name: 'tshirt_size',
        label: 'T-Shirt Size',
        type: 'select',
        placeholder: null,
        helpText: null,
        options: [{ label: 'M', value: 'm' }],
        validationRules: {},
        section: 'miscellaneous',
        isRequired: false,
        order: 1,
      },
    ]);
    expect(items).toHaveLength(1);
  });

  it('form-fields: accepts a migrated legacy item carrying labelOverride/helpTextOverride', () => {
    const items = parseTemplateItems('form-fields', [
      {
        source: 'system',
        systemFieldKey: 'full_name',
        name: null,
        label: null,
        type: null,
        placeholder: null,
        helpText: null,
        options: [],
        validationRules: {},
        section: 'personal_details',
        isRequired: true,
        order: 0,
        labelOverride: 'Legal Name',
        helpTextOverride: null,
      },
    ]);
    expect(items).toHaveLength(1);
  });

  it('form-fields: rejects an item missing source', () => {
    expect(() => parseTemplateItems('form-fields', [{ section: 'personal_details', isRequired: true, order: 0 }])).toThrow(
      BadRequestException,
    );
  });

  it('participation-categories: accepts the row shape and rejects a missing name', () => {
    const items = parseTemplateItems('participation-categories', [
      { name: 'High School', description: null, benefits: null, eligibility: null, isActive: true },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('participation-categories', [{ description: null }])).toThrow(BadRequestException);
  });

  it('timelines: accepts the row shape and rejects a non-ISO date', () => {
    const items = parseTemplateItems('timelines', [
      {
        date: '2027-01-01T00:00:00.000Z',
        endDate: null,
        title: 'Kickoff',
        description: null,
        icon: null,
        type: 'milestone',
        completionType: 'manual',
        completionConfig: {},
        targetAudience: 'all',
        isActive: true,
      },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('timelines', [{ date: 'not-a-date', title: 'x' }])).toThrow(BadRequestException);
  });

  it('rundowns: requires day and activity', () => {
    const items = parseTemplateItems('rundowns', [
      { day: 'Day 1', startTime: null, endTime: null, activity: 'Registration', description: null, location: null, speaker: null, isActive: true },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('rundowns', [{ day: 'Day 1' }])).toThrow(BadRequestException);
  });

  it('faqs: requires question and answer', () => {
    const items = parseTemplateItems('faqs', [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('faqs', [{ question: 'Q?' }])).toThrow(BadRequestException);
  });

  it('payments: requires a name, a numeric price, and validates nested validityPeriods', () => {
    const items = parseTemplateItems('payments', [
      {
        name: 'Early Bird',
        description: null,
        price: 100,
        currency: 'USD',
        usdPrice: 100,
        idrPrice: 1500000,
        capacity: null,
        benefits: [],
        requirements: [],
        feeType: 'registration_fee',
        allowedCategories: ['self_funded'],
        icon: null,
        isActive: true,
        validityPeriods: [{ startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z', description: 'Wave 1' }],
      },
    ]);
    expect(items).toHaveLength(1);
    expect(() =>
      parseTemplateItems('payments', [{ name: 'Early Bird', price: 'not-a-number', validityPeriods: [] }]),
    ).toThrow(BadRequestException);
  });

  it('program-details: requires the three scalar fields to be present (string or null)', () => {
    const items = parseTemplateItems('program-details', [
      { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: null },
    ]);
    expect(items).toHaveLength(1);
    expect(() => parseTemplateItems('program-details', [{ requirementsDescription: 1 }])).toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="template-payload.schemas.spec"`
Expected: FAIL — cannot find module `./template-payload.schemas`.

- [ ] **Step 3: Write the schemas**

```typescript
// services/api/src/modules/programs/application/copy/template-payload.schemas.ts
import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

// form-fields: system-sourced items are intentionally thin (see
// program-copier.interface.ts's TemplatePayload doc and this plan's Global
// Constraints) — label/type/helpText/options are always re-resolved from
// SystemFormFieldDefinition at apply time, never frozen at export time.
// Custom-sourced items and migrated legacy items (which may carry
// labelOverride/helpTextOverride from the old ApplicationFormTemplateField
// shape) carry the full shape. All of the "full shape" fields are optional
// so both the thin and the legacy shape validate against one schema.
const formFieldsItemSchema = z.object({
  source: z.enum(['system', 'custom']),
  systemFieldKey: z.string().nullable().optional(),
  name: z.string().nullable().optional(),
  label: z.string().nullable().optional(),
  type: z.string().nullable().optional(),
  placeholder: z.string().nullable().optional(),
  helpText: z.string().nullable().optional(),
  options: z.unknown().optional(),
  validationRules: z.unknown().optional(),
  section: z.string(),
  isRequired: z.boolean(),
  order: z.number(),
  labelOverride: z.string().nullable().optional(),
  helpTextOverride: z.string().nullable().optional(),
});

const participationCategoriesItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  benefits: z.string().nullable(),
  eligibility: z.string().nullable(),
  isActive: z.boolean(),
});

const timelinesItemSchema = z.object({
  date: z.string().datetime(),
  endDate: z.string().datetime().nullable(),
  title: z.string().min(1),
  description: z.string().nullable(),
  icon: z.string().nullable(),
  type: z.string(),
  completionType: z.string(),
  completionConfig: z.unknown(),
  targetAudience: z.string(),
  isActive: z.boolean(),
});

const rundownsItemSchema = z.object({
  day: z.string().min(1),
  startTime: z.string().nullable(),
  endTime: z.string().nullable(),
  activity: z.string().min(1),
  description: z.string().nullable(),
  location: z.string().nullable(),
  speaker: z.string().nullable(),
  isActive: z.boolean(),
});

const faqsItemSchema = z.object({
  question: z.string().min(1),
  answer: z.string().min(1),
  category: z.string(),
  isActive: z.boolean(),
});

const validityPeriodSchema = z.object({
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  description: z.string().nullable(),
});

const paymentsItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().nullable(),
  price: z.number(),
  currency: z.string(),
  usdPrice: z.number().nullable(),
  idrPrice: z.number().nullable(),
  capacity: z.number().nullable(),
  benefits: z.array(z.string()),
  requirements: z.array(z.string()),
  feeType: z.string(),
  allowedCategories: z.array(z.string()),
  icon: z.string().nullable(),
  isActive: z.boolean(),
  validityPeriods: z.array(validityPeriodSchema),
});

const programDetailsItemSchema = z.object({
  requirementsDescription: z.string().nullable(),
  benefitsDescription: z.string().nullable(),
  termsAndConditions: z.string().nullable(),
});

// Keyed by ProgramCopier.key — adding an eighth copier means adding one
// entry here, not touching any call site.
const TEMPLATE_ITEM_SCHEMAS: Record<string, z.ZodTypeAny> = {
  'form-fields': formFieldsItemSchema,
  'participation-categories': participationCategoriesItemSchema,
  timelines: timelinesItemSchema,
  rundowns: rundownsItemSchema,
  faqs: faqsItemSchema,
  payments: paymentsItemSchema,
  'program-details': programDetailsItemSchema,
};

/**
 * Validates a TemplatePayload's `items` array against its entityType's
 * schema. Called on the write path (CreateContentTemplateHandler, right
 * after exportTemplate) and on the apply path (every copier's applyTemplate,
 * before touching the database) — the spec requires both.
 */
export function parseTemplateItems(entityType: string, items: unknown): Record<string, unknown>[] {
  const schema = TEMPLATE_ITEM_SCHEMAS[entityType];
  if (!schema) {
    throw new BadRequestException({
      code: 'unknown_template_entity_type',
      message: `No template payload schema registered for entityType '${entityType}'.`,
    });
  }
  const result = z.array(schema).safeParse(items);
  if (!result.success) {
    throw new BadRequestException({
      code: 'invalid_template_payload',
      message: `Template payload for '${entityType}' failed validation: ${result.error.message}`,
    });
  }
  return result.data as Record<string, unknown>[];
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="template-payload.schemas.spec"`
Expected: PASS — 12 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/template-payload.schemas.ts src/modules/programs/application/copy/template-payload.schemas.spec.ts
git commit -m "feat(programs): add per-entityType zod schemas for template payloads"
```

---

## Task 5: `ContentTemplate` Prisma model + migration

**Files:**
- Modify: `services/api/prisma/schema/content.prisma` (append the model — this file already holds `ProgramFaq`, `ProgramTimeline`, `ProgramSchedule`, `EmailTemplate`, `CertificateTemplate`, `DocumentTemplate`, so `ContentTemplate` belongs alongside its sibling `*Template` models here, not in `applications.prisma` where the model it replaces currently lives — `ContentTemplate` is no longer form-fields-specific)
- Create: `services/api/prisma/migrations/20260824090000_add_content_template/migration.sql`

**Interfaces:**
- Produces: `ContentTemplate` Prisma model (`prisma.contentTemplate.*`) — Task 13's command/query handlers are the first consumers; Task 19's data migration is the first thing to populate it.

This task only **adds** the new table — it does not touch `ApplicationFormTemplate`/`ApplicationFormTemplateField`, which stay live and fully functional until Task 19 migrates their data across and drops them. Compile-verified, not TDD, matching Phase 1 Task 4's precedent for schema-only changes (no handler logic yet to unit test).

- [ ] **Step 1: Add the model to the Prisma schema**

Append to `services/api/prisma/schema/content.prisma`:

```prisma
// Generic, platform-wide template store. Replaces ApplicationFormTemplate /
// ApplicationFormTemplateField (applications.prisma), which were strongly
// typed to form-field shape and had no entityType discriminator. One row per
// template, any entityType; `payload` is JSON but not a free-for-all — each
// entityType has a zod schema (template-payload.schemas.ts) validated on
// write and on apply.
model ContentTemplate {
  id             String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name           String    @db.VarChar(255)
  description    String?   @db.Text
  entityType     String    @map("entity_type") @db.VarChar(64) // matches ProgramCopier.key exactly
  payload        Json // { entityType, payloadVersion, items: [...] } — see TemplatePayload
  payloadVersion Int       @default(1) @map("payload_version")
  isDefault      Boolean   @default(false) @map("is_default")
  createdBy      String?   @map("created_by") @db.Uuid
  createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt      DateTime? @map("deleted_at") @db.Timestamptz(6)

  @@index([entityType, deletedAt])
  @@map("content_templates")
}
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- services/api/prisma/migrations/20260824090000_add_content_template/migration.sql

-- Why: one generic template store replaces the form-field-specific
-- application_form_templates / application_form_template_fields pair, so
-- every content-copy surface (not just form fields) can save/apply a
-- template through the same ProgramCopier.exportTemplate/applyTemplate path.
-- The old tables are migrated into this one and dropped in a later migration
-- (20260824091000_backfill_content_template_from_form_templates,
-- 20260824092000_drop_application_form_template) once app code has fully
-- moved over — this migration only adds the new table.
CREATE TABLE "content_templates" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "name" VARCHAR(255) NOT NULL,
    "description" TEXT,
    "entity_type" VARCHAR(64) NOT NULL,
    "payload" JSONB NOT NULL,
    "payload_version" INTEGER NOT NULL DEFAULT 1,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "deleted_at" TIMESTAMPTZ(6),

    CONSTRAINT "content_templates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "content_templates_entity_type_deleted_at_idx" ON "content_templates"("entity_type", "deleted_at");
```

- [ ] **Step 3: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: same set of "copier doesn't implement exportTemplate/applyTemplate" errors as before this task — `prisma.contentTemplate` now exists as a typed delegate but nothing references it yet, so this task adds zero new errors.

- [ ] **Step 4: Commit**

```bash
cd services/api
git add prisma/schema/content.prisma prisma/migrations/20260824090000_add_content_template/migration.sql
git commit -m "feat(programs): add ContentTemplate model"
```

---

## Task 6: `FormFieldsCopier.exportTemplate`/`applyTemplate` — ports the system-field re-resolution (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts` (add tests; existing tests untouched)

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `applyScopedTemplate`, `ScopedRowsDelegate` (Task 3); `parseTemplateItems` (Task 4).
- Produces: `FormFieldsCopier.exportTemplate`/`applyTemplate` — Task 13's `CreateContentTemplateHandler` and Task 16's `apply-template` route are the callers.

This is the load-bearing copier task: `apply-form-template.handler.ts`'s live catalog re-resolution (source `'system'` fields always re-resolve `type`/`label`/`options`/`helpText` against `SystemFormFieldDefinition`, honoring `labelOverride`/`helpTextOverride`/non-empty `options` exactly as that handler does today) moves here **verbatim** — not generalized, per the spec.

- [ ] **Step 1: Write the failing tests**

Append to `services/api/src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts` (reuses the existing `srcField`/`mkPrisma` helpers already in that file from Phase 1):

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts
describe('FormFieldsCopier.exportTemplate', () => {
  it('exports custom-sourced fields with their full resolved shape', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'tshirt_size', source: 'custom', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'form-fields',
      payloadVersion: 1,
      items: [
        expect.objectContaining({ source: 'custom', name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] }),
      ],
    });
  });

  it('exports system-sourced fields WITHOUT label/type/helpText/options — only systemFieldKey/section/isRequired/order', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'full_name', source: 'system', systemFieldKey: 'full_name', label: 'Full Legal Name (customized on this program)', type: 'text' })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([
      { source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 },
    ]);
    // Explicitly not present — a system field's label is never frozen at export time.
    expect(payload.items[0]).not.toHaveProperty('label');
    expect(payload.items[0]).not.toHaveProperty('type');
  });

  it('honors itemIds', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 0 }), srcField({ id: 'f2', name: 'b', order: 1 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src', ['f2']);
    expect(payload.items).toHaveLength(1);
  });
});

describe('FormFieldsCopier.applyTemplate', () => {
  function mkPrismaWithCatalog(opts: { existingFields?: SourceField[]; catalog?: Record<string, { type: string; label: string; defaultOptions: unknown; helpText: string | null; isActive: boolean; deletedAt: Date | null }> } = {}): PrismaService {
    const base: any = {
      applicationFormField: {
        findMany: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(where.programId === 'tgt' ? (opts.existingFields ?? []) : [])),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      },
      systemFormFieldDefinition: {
        findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(opts.catalog?.[where.key] ? { key: where.key, ...opts.catalog[where.key] } : null)),
      },
    };
    base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
    return base as PrismaService;
  }

  it('re-resolves a thin system-sourced item against the live catalog (type, label, helpText, options all come from the catalog)', async () => {
    const prisma = mkPrismaWithCatalog({
      catalog: { full_name: { type: 'text', label: 'Full Name (catalog, current)', defaultOptions: [], helpText: 'Catalog help', isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'full_name', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'full_name', label: 'Full Name (catalog, current)', type: 'text', helpText: 'Catalog help' }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('a set labelOverride wins over the catalog label; an unset one always follows the catalog', async () => {
    const prisma = mkPrismaWithCatalog({
      catalog: { full_name: { type: 'text', label: 'Catalog Label', defaultOptions: [], helpText: null, isActive: true, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      prisma,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [
          { source: 'system', systemFieldKey: 'full_name', name: null, label: null, type: null, placeholder: null, helpText: null, options: [], validationRules: {}, section: 'personal_details', isRequired: true, order: 0, labelOverride: 'Frozen Legal Name', helpTextOverride: null },
        ],
      },
      'tgt',
      'append',
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('Frozen Legal Name');
  });

  it('skips (does not create) a system-sourced item whose catalog entry is inactive or deleted', async () => {
    const prisma = mkPrismaWithCatalog({
      catalog: { retired_field: { type: 'text', label: 'x', defaultOptions: [], helpText: null, isActive: false, deletedAt: null } },
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'form-fields', payloadVersion: 1, items: [{ source: 'system', systemFieldKey: 'retired_field', section: 'personal_details', isRequired: true, order: 0 }] },
      'tgt',
      'append',
    );
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('applies a custom-sourced item verbatim, no catalog lookup', async () => {
    const prisma = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    await copier.applyTemplate(
      prisma,
      {
        entityType: 'form-fields',
        payloadVersion: 1,
        items: [{ source: 'custom', name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', placeholder: null, helpText: null, options: [{ label: 'M', value: 'm' }], validationRules: {}, section: 'miscellaneous', isRequired: false, order: 0 }],
      },
      'tgt',
      'append',
    );
    expect((prisma as any).systemFormFieldDefinition.findUnique).not.toHaveBeenCalled();
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.label).toBe('T-Shirt Size');
  });

  it('replace with an empty template payload throws BadRequestException before any mutation', async () => {
    const prisma = mkPrismaWithCatalog({ existingFields: [srcField({ id: 't1', name: 'old' })] });
    const copier = new FormFieldsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'form-fields', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
  });

  it('rejects a malformed payload (missing source) via parseTemplateItems before touching the database', async () => {
    const prisma = mkPrismaWithCatalog();
    const copier = new FormFieldsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'form-fields', payloadVersion: 1, items: [{ section: 'personal_details' }] as any }, 'tgt', 'append'),
    ).rejects.toThrow(/invalid_template_payload/);
    expect((prisma as any).applicationFormField.create).not.toHaveBeenCalled();
  });
});

describe('FormFieldsCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces a custom-sourced field on the target program', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'tshirt_size', source: 'custom', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] })],
    });
    const copier = new FormFieldsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(prisma, payload, 'tgt', 'append');
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ name: 'tshirt_size', label: 'T-Shirt Size', type: 'select', options: [{ label: 'M', value: 'm' }] }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/form-fields.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` are not implemented on `FormFieldsCopier` yet (TypeScript compile error inside the test file, surfaced as Jest failures).

- [ ] **Step 3: Implement `exportTemplate`/`applyTemplate`**

Add to `services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts` (append imports and the two new methods; the existing `countFor`/`preview`/`copy` are untouched):

```typescript
// services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type FormFieldRow = {
  id: string;
  name: string;
  label: string;
  type: string;
  section: string;
  isRequired: boolean;
  order: number;
  placeholder: string | null;
  helpText: string | null;
  mediaUrl: string | null;
  mediaAlt: string | null;
  helpAssets: unknown;
  options: unknown;
  validationRules: unknown;
  source: string;
  systemFieldKey: string | null;
};

// The thin exported shape for a system-sourced item — deliberately missing
// label/type/helpText/options (see this plan's Global Constraints and
// template-payload.schemas.ts). The full shape (custom items, or migrated
// legacy items with overrides) is validated by the same schema, which makes
// every field but source/section/isRequired/order optional.
type TemplateItem = {
  source: 'system' | 'custom';
  systemFieldKey?: string | null;
  name?: string | null;
  label?: string | null;
  type?: string | null;
  placeholder?: string | null;
  helpText?: string | null;
  options?: unknown;
  validationRules?: unknown;
  section: string;
  isRequired: boolean;
  order: number;
  labelOverride?: string | null;
  helpTextOverride?: string | null;
};

@Injectable()
export class FormFieldsCopier implements ProgramCopier {
  readonly key = 'form-fields';
  readonly label = 'Application Form Fields';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.applicationFormField.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const fields = await this.prisma.applicationFormField.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (fields as unknown as FormFieldRow[]).map((f) => ({
      id: f.id,
      label: f.label,
      meta: `${f.name} · ${f.type}${f.section ? ` · ${f.section}` : ''}`,
      hasExternalMedia: Boolean(f.mediaUrl) || (Array.isArray(f.helpAssets) && f.helpAssets.length > 0),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.applicationFormField as unknown as ScopedRowsDelegate<FormFieldRow>;
    return copyScopedRows<FormFieldRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        name: row.name,
        label: row.label,
        type: row.type,
        section: row.section,
        isRequired: row.isRequired,
        order,
        placeholder: row.placeholder,
        helpText: row.helpText,
        mediaUrl: row.mediaUrl,
        mediaAlt: row.mediaAlt,
        helpAssets: (row.helpAssets as never) ?? [],
        options: (row.options as never) ?? [],
        validationRules: (row.validationRules as never) ?? {},
        source: row.source,
        systemFieldKey: row.systemFieldKey,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.applicationFormField.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as FormFieldRow[]).map((row) => {
      if (row.source === 'system') {
        // Thin on purpose — see this plan's Global Constraints. label/type/
        // helpText/options are never exported for a system field; applyTemplate
        // always re-resolves them from SystemFormFieldDefinition.
        return {
          source: 'system',
          systemFieldKey: row.systemFieldKey,
          section: row.section,
          isRequired: row.isRequired,
          order: row.order,
        };
      }
      return {
        source: 'custom',
        name: row.name,
        label: row.label,
        type: row.type,
        placeholder: row.placeholder,
        helpText: row.helpText,
        options: row.options,
        validationRules: row.validationRules,
        section: row.section,
        isRequired: row.isRequired,
        order: row.order,
      };
    });
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const delegate = tx.applicationFormField as unknown as ScopedRowsDelegate<FormFieldRow>;

    // Ports apply-form-template.handler.ts's resolution algorithm verbatim —
    // per the spec, this must not be generalised (no other entity has a
    // catalog). `resolved` carries the exact same three-way precedence that
    // handler used: labelOverride/helpTextOverride win when set; type always
    // follows the catalog for system fields; options only falls back to the
    // catalog's defaultOptions when the item's own options are empty/absent.
    const resolved: FormFieldRow[] = [];
    for (const item of items) {
      if (item.source === 'system' && item.systemFieldKey) {
        const def = await tx.systemFormFieldDefinition.findUnique({ where: { key: item.systemFieldKey } });
        if (!def || !def.isActive || def.deletedAt) {
          // Matches apply-form-template.handler.ts: an item whose catalog
          // entry is gone/inactive is skipped, not an error — the rest of
          // the template still applies.
          continue;
        }
        const label = item.labelOverride ?? def.label;
        const options = item.options && (!Array.isArray(item.options) || (item.options as unknown[]).length > 0) ? item.options : def.defaultOptions;
        const helpText = item.helpTextOverride ?? def.helpText;
        resolved.push({
          id: '',
          name: item.systemFieldKey,
          label,
          type: def.type,
          section: item.section,
          isRequired: item.isRequired,
          order: item.order,
          placeholder: item.placeholder ?? null,
          helpText: helpText ?? null,
          mediaUrl: null,
          mediaAlt: null,
          helpAssets: [],
          options: (options as never) ?? [],
          validationRules: (item.validationRules as never) ?? {},
          source: 'system',
          systemFieldKey: item.systemFieldKey,
        });
      } else if (item.source === 'custom' && item.name) {
        resolved.push({
          id: '',
          name: item.name,
          label: item.label ?? item.name,
          type: item.type ?? 'text',
          section: item.section,
          isRequired: item.isRequired,
          order: item.order,
          placeholder: item.placeholder ?? null,
          helpText: item.helpText ?? null,
          mediaUrl: null,
          mediaAlt: null,
          helpAssets: [],
          options: (item.options as never) ?? [],
          validationRules: (item.validationRules as never) ?? {},
          source: 'custom',
          systemFieldKey: null,
        });
      }
    }

    return applyScopedTemplate<FormFieldRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows: resolved,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: targetProgramId,
        name: row.name,
        label: row.label,
        type: row.type,
        section: row.section,
        isRequired: row.isRequired,
        order,
        placeholder: row.placeholder,
        helpText: row.helpText,
        mediaUrl: row.mediaUrl,
        mediaAlt: row.mediaAlt,
        helpAssets: (row.helpAssets as never) ?? [],
        options: (row.options as never) ?? [],
        validationRules: (row.validationRules as never) ?? {},
        source: row.source,
        systemFieldKey: row.systemFieldKey,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/form-fields.copier.spec"`
Expected: PASS — the original 7 Phase 1 tests plus 11 new ones, 18 total.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/form-fields.copier.ts src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts
git commit -m "feat(programs): add FormFieldsCopier.exportTemplate/applyTemplate"
```

---

## Task 7: `ParticipationCategoriesCopier.exportTemplate`/`applyTemplate` (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts`

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `applyScopedTemplate` (Task 3); `parseTemplateItems` (Task 4).
- Produces: `exportTemplate`/`applyTemplate` on `ParticipationCategoriesCopier` — `applyTemplate` reuses the same `beforeReplace` in-use guard as `copy()` (Phase 1 Task 6 / Task 4's `deletedAt` migration), since a template-based replace can strand applications just as easily as a program-to-program one.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts
describe('ParticipationCategoriesCopier.exportTemplate', () => {
  it('exports the full category row shape', async () => {
    const prisma = mkPrisma({ sourceCategories: [category({ id: 's1', name: 'High School', description: '<p>desc</p>' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'participation-categories',
      payloadVersion: 1,
      items: [{ name: 'High School', description: '<p>desc</p>', benefits: null, eligibility: null, isActive: true }],
    });
  });

  it('honors itemIds', async () => {
    const prisma = mkPrisma({ sourceCategories: [category({ id: 's1', name: 'a' }), category({ id: 's2', name: 'b' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const payload = await copier.exportTemplate('src', ['s2']);
    expect(payload.items).toEqual([expect.objectContaining({ name: 'b' })]);
  });
});

describe('ParticipationCategoriesCopier.applyTemplate', () => {
  it('append inserts template categories and dedupes on name', async () => {
    const prisma = mkPrisma({ existingCategories: [category({ id: 't1', name: 'High School' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'participation-categories', payloadVersion: 1, items: [{ name: 'High School', description: null, benefits: null, eligibility: null, isActive: true }, { name: 'University', description: null, benefits: null, eligibility: null, isActive: true }] },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace refuses with ConflictException when existing categories are still referenced by applications', async () => {
    const prisma = mkPrisma({ existingCategories: [category({ id: 't1', name: 'old' })], referencingApplicationCount: 2 });
    const copier = new ParticipationCategoriesCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'participation-categories', payloadVersion: 1, items: [{ name: 'a', description: null, benefits: null, eligibility: null, isActive: true }] }, 'tgt', 'replace'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((prisma as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programParticipationCategory.create).not.toHaveBeenCalled();
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const prisma = mkPrisma({ existingCategories: [category({ id: 't1', name: 'old' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'participation-categories', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
  });
});

describe('ParticipationCategoriesCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the category on the target program', async () => {
    const prisma = mkPrisma({ sourceCategories: [category({ id: 's1', name: 'High School', description: '<p>desc</p>', benefits: '<p>b</p>' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(prisma, payload, 'tgt', 'append');
    const create = (prisma as any).programParticipationCategory.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(expect.objectContaining({ name: 'High School', description: '<p>desc</p>', benefits: '<p>b</p>' }));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/participation-categories.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` not implemented.

- [ ] **Step 3: Implement**

```typescript
// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

const EXTERNAL_MEDIA_PATTERN = /<(img|iframe|video)\b/i;

function hasExternalMedia(row: { description: string | null; benefits: string | null; eligibility: string | null }): boolean {
  return [row.description, row.benefits, row.eligibility].some((value) => value !== null && EXTERNAL_MEDIA_PATTERN.test(value));
}

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  order: number;
  isActive: boolean;
};

type TemplateItem = { name: string; description: string | null; benefits: string | null; eligibility: string | null; isActive: boolean };

async function refuseIfInUse(tx: PrismaTx, existingIds: string[]): Promise<void> {
  if (existingIds.length === 0) return;
  const referencedCount = await tx.participantApplication.count({ where: { participationCategoryId: { in: existingIds } } });
  if (referencedCount > 0) {
    throw new ConflictException({
      code: 'category_in_use',
      message: `Cannot replace: ${referencedCount} application(s) still reference the current participation categories. Use append mode instead, or reassign those applications first.`,
    });
  }
}

@Injectable()
export class ParticipationCategoriesCopier implements ProgramCopier {
  readonly key = 'participation-categories';
  readonly label = 'Participation Categories';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programParticipationCategory.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const categories = await this.prisma.programParticipationCategory.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (categories as unknown as CategoryRow[]).map((c) => ({
      id: c.id,
      label: c.name,
      meta: c.isActive ? 'Active' : 'Inactive',
      hasExternalMedia: hasExternalMedia(c),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programParticipationCategory as unknown as ScopedRowsDelegate<CategoryRow>;
    return copyScopedRows<CategoryRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        name: row.name,
        description: row.description,
        benefits: row.benefits,
        eligibility: row.eligibility,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
      beforeReplace: (existingIds) => refuseIfInUse(tx, existingIds),
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programParticipationCategory.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as CategoryRow[]).map((r) => ({
      name: r.name,
      description: r.description,
      benefits: r.benefits,
      eligibility: r.eligibility,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: CategoryRow[] = items.map((item, index) => ({
      id: '',
      name: item.name,
      description: item.description,
      benefits: item.benefits,
      eligibility: item.eligibility,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programParticipationCategory as unknown as ScopedRowsDelegate<CategoryRow>;
    return applyScopedTemplate<CategoryRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.name,
      fields: (row, order) => ({
        programId: targetProgramId,
        name: row.name,
        description: row.description,
        benefits: row.benefits,
        eligibility: row.eligibility,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
      beforeReplace: (existingIds) => refuseIfInUse(tx, existingIds),
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/participation-categories.copier.spec"`
Expected: PASS — the original 5 Phase 1 tests plus 5 new ones, 10 total.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/participation-categories.copier.ts src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts
git commit -m "feat(programs): add ParticipationCategoriesCopier.exportTemplate/applyTemplate"
```

---

## Task 8: `TimelinesCopier.exportTemplate`/`applyTemplate` (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/timelines.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/timelines.copier.spec.ts`

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `applyScopedTemplate` (Task 3); `parseTemplateItems` (Task 4).
- Produces: `exportTemplate`/`applyTemplate` on `TimelinesCopier`. `date`/`endDate` are `Date` columns; the template payload stores them as ISO strings (JSON has no `Date` type — `ContentTemplate.payload` is `Json`), so `applyTemplate` parses them back with `new Date(...)`.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/timelines.copier.spec.ts
describe('TimelinesCopier.exportTemplate', () => {
  it('exports date/endDate as ISO strings', async () => {
    const prisma = mkPrisma({
      sourceItems: [timelineRow({ id: 's1', title: 'Kickoff', date: new Date('2027-01-01T00:00:00.000Z'), endDate: null })],
    });
    const copier = new TimelinesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items[0]).toEqual(expect.objectContaining({ title: 'Kickoff', date: '2027-01-01T00:00:00.000Z', endDate: null }));
  });
});

describe('TimelinesCopier.applyTemplate', () => {
  it('append parses ISO date strings back into Date values and inserts', async () => {
    const prisma = mkPrisma({ existingItems: [] });
    const copier = new TimelinesCopier(prisma);
    await copier.applyTemplate(
      prisma,
      {
        entityType: 'timelines',
        payloadVersion: 1,
        items: [{ date: '2027-01-01T00:00:00.000Z', endDate: null, title: 'Kickoff', description: null, icon: null, type: 'milestone', completionType: 'manual', completionConfig: {}, targetAudience: 'all', isActive: true }],
      },
      'tgt',
      'append',
    );
    const create = (prisma as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.date).toEqual(new Date('2027-01-01T00:00:00.000Z'));
  });

  it('dedupes on title and skips a collision', async () => {
    const prisma = mkPrisma({ existingItems: [timelineRow({ id: 't1', title: 'Kickoff' })] });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'timelines', payloadVersion: 1, items: [{ date: '2027-01-01T00:00:00.000Z', endDate: null, title: 'Kickoff', description: null, icon: null, type: 'milestone', completionType: 'manual', completionConfig: {}, targetAudience: 'all', isActive: true }] },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const prisma = mkPrisma({ existingItems: [timelineRow({ id: 't1', title: 'old' })] });
    const copier = new TimelinesCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'timelines', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).programTimeline.updateMany).not.toHaveBeenCalled();
  });
});

describe('TimelinesCopier round-trip', () => {
  it('exportTemplate then applyTemplate reproduces the timeline item on the target program, dates included', async () => {
    const prisma = mkPrisma({ sourceItems: [timelineRow({ id: 's1', title: 'Kickoff', date: new Date('2027-01-01T00:00:00.000Z') })] });
    const copier = new TimelinesCopier(prisma);
    const payload = await copier.exportTemplate('src');
    const result = await copier.applyTemplate(prisma, payload, 'tgt', 'append');
    const create = (prisma as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.title).toBe('Kickoff');
    expect(create.mock.calls[0][0].data.date).toEqual(new Date('2027-01-01T00:00:00.000Z'));
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });
});
```

If `timelines.copier.spec.ts` doesn't already have a `timelineRow(over)` fixture builder matching `TimelineRow`'s shape, add one at the top of the file next to `mkPrisma`, following the exact pattern `category()`/`srcField()` use in the other copier specs (default every field, spread `over` on top).

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/timelines.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` not implemented.

- [ ] **Step 3: Implement**

```typescript
// services/api/src/modules/programs/application/copy/copiers/timelines.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type TimelineRow = {
  id: string;
  date: Date;
  endDate: Date | null;
  title: string;
  description: string | null;
  icon: string | null;
  type: string;
  completionType: string;
  completionConfig: unknown;
  targetAudience: string;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  date: string;
  endDate: string | null;
  title: string;
  description: string | null;
  icon: string | null;
  type: string;
  completionType: string;
  completionConfig: unknown;
  targetAudience: string;
  isActive: boolean;
};

@Injectable()
export class TimelinesCopier implements ProgramCopier {
  readonly key = 'timelines';
  readonly label = 'Timelines';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programTimeline.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programTimeline.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    return (items as unknown as TimelineRow[]).map((t) => ({ id: t.id, label: t.title, meta: t.date.toISOString().slice(0, 10) }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programTimeline as unknown as ScopedRowsDelegate<TimelineRow>;
    return copyScopedRows<TimelineRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.title,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        date: row.date,
        endDate: row.endDate,
        title: row.title,
        description: row.description,
        icon: row.icon,
        type: row.type,
        completionType: row.completionType,
        completionConfig: (row.completionConfig as never) ?? {},
        targetAudience: row.targetAudience,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programTimeline.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as TimelineRow[]).map((r) => ({
      date: r.date.toISOString(),
      endDate: r.endDate ? r.endDate.toISOString() : null,
      title: r.title,
      description: r.description,
      icon: r.icon,
      type: r.type,
      completionType: r.completionType,
      completionConfig: r.completionConfig,
      targetAudience: r.targetAudience,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: TimelineRow[] = items.map((item, index) => ({
      id: '',
      date: new Date(item.date),
      endDate: item.endDate ? new Date(item.endDate) : null,
      title: item.title,
      description: item.description,
      icon: item.icon,
      type: item.type,
      completionType: item.completionType,
      completionConfig: item.completionConfig,
      targetAudience: item.targetAudience,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programTimeline as unknown as ScopedRowsDelegate<TimelineRow>;
    return applyScopedTemplate<TimelineRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.title,
      fields: (row, order) => ({
        programId: targetProgramId,
        date: row.date,
        endDate: row.endDate,
        title: row.title,
        description: row.description,
        icon: row.icon,
        type: row.type,
        completionType: row.completionType,
        completionConfig: (row.completionConfig as never) ?? {},
        targetAudience: row.targetAudience,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/timelines.copier.spec"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/timelines.copier.ts src/modules/programs/application/copy/copiers/timelines.copier.spec.ts
git commit -m "feat(programs): add TimelinesCopier.exportTemplate/applyTemplate"
```

---

## Task 9: `RundownsCopier.exportTemplate`/`applyTemplate` — composite dedupe key parity (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/rundowns.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts`

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `applyScopedTemplate` (Task 3); `parseTemplateItems` (Task 4).
- Produces: `exportTemplate`/`applyTemplate` on `RundownsCopier`, reusing the exact same length-prefixed `(day, activity)` composite `dedupeKey` function `copy()` already uses — the whole reason it exists as a standalone module-level function rather than an inline arrow is so both methods share it without risk of drift.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts
describe('RundownsCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const prisma = mkPrisma({ sourceItems: [rundownRow({ id: 's1', day: 'Day 1', activity: 'Registration' })] });
    const copier = new RundownsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items).toEqual([expect.objectContaining({ day: 'Day 1', activity: 'Registration' })]);
  });
});

describe('RundownsCopier.applyTemplate', () => {
  it('dedupes on the composite (day, activity), not on activity alone', async () => {
    const prisma = mkPrisma({ existingItems: [rundownRow({ id: 't1', day: 'Day 1', activity: 'Registration' })] });
    const copier = new RundownsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      {
        entityType: 'rundowns',
        payloadVersion: 1,
        items: [
          { day: 'Day 1', startTime: null, endTime: null, activity: 'Registration', description: null, location: null, speaker: null, isActive: true },
          { day: 'Day 2', startTime: null, endTime: null, activity: 'Registration', description: null, location: null, speaker: null, isActive: true },
        ],
      },
      'tgt',
      'append',
    );
    // Same activity name on a different day is NOT a collision — only the
    // exact (day, activity) pair is.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const prisma = mkPrisma({ existingItems: [rundownRow({ id: 't1', day: 'Day 1', activity: 'old' })] });
    const copier = new RundownsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'rundowns', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).programSchedule.updateMany).not.toHaveBeenCalled();
  });
});
```

If `rundowns.copier.spec.ts` doesn't already have a `rundownRow(over)` fixture builder, add one following the same pattern as the other copier specs.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/rundowns.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` not implemented.

- [ ] **Step 3: Implement**

```typescript
// services/api/src/modules/programs/application/copy/copiers/rundowns.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type RundownRow = {
  id: string;
  day: string;
  startTime: string | null;
  endTime: string | null;
  activity: string;
  description: string | null;
  location: string | null;
  speaker: string | null;
  order: number;
  isActive: boolean;
};

type TemplateItem = {
  day: string;
  startTime: string | null;
  endTime: string | null;
  activity: string;
  description: string | null;
  location: string | null;
  speaker: string | null;
  isActive: boolean;
};

// Identical to the module-level dedupeKey in this file's copy() — shared by
// reference so applyTemplate can never define a subtly different composite
// key than copy() does.
function dedupeKey(row: RundownRow): string {
  return `${row.day.length}:${row.day}:${row.activity}`;
}

@Injectable()
export class RundownsCopier implements ProgramCopier {
  readonly key = 'rundowns';
  readonly label = 'Program Rundowns';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programSchedule.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programSchedule.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    return (items as unknown as RundownRow[]).map((r) => ({ id: r.id, label: r.activity, meta: r.day }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programSchedule as unknown as ScopedRowsDelegate<RundownRow>;
    return copyScopedRows<RundownRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        day: row.day,
        startTime: row.startTime,
        endTime: row.endTime,
        activity: row.activity,
        description: row.description,
        location: row.location,
        speaker: row.speaker,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programSchedule.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as RundownRow[]).map((r) => ({
      day: r.day,
      startTime: r.startTime,
      endTime: r.endTime,
      activity: r.activity,
      description: r.description,
      location: r.location,
      speaker: r.speaker,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: RundownRow[] = items.map((item, index) => ({
      id: '',
      day: item.day,
      startTime: item.startTime,
      endTime: item.endTime,
      activity: item.activity,
      description: item.description,
      location: item.location,
      speaker: item.speaker,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programSchedule as unknown as ScopedRowsDelegate<RundownRow>;
    return applyScopedTemplate<RundownRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey,
      fields: (row, order) => ({
        programId: targetProgramId,
        day: row.day,
        startTime: row.startTime,
        endTime: row.endTime,
        activity: row.activity,
        description: row.description,
        location: row.location,
        speaker: row.speaker,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/rundowns.copier.spec"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/rundowns.copier.ts src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts
git commit -m "feat(programs): add RundownsCopier.exportTemplate/applyTemplate"
```

---

## Task 10: `FaqsCopier.exportTemplate`/`applyTemplate` (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/faqs.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/faqs.copier.spec.ts`

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `applyScopedTemplate` (Task 3); `parseTemplateItems` (Task 4).
- Produces: `exportTemplate`/`applyTemplate` on `FaqsCopier` — the simplest of the seven, no dates, no nested rows, no catalog.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/faqs.copier.spec.ts
describe('FaqsCopier.exportTemplate', () => {
  it('exports the full row shape', async () => {
    const prisma = mkPrisma({ sourceItems: [faqRow({ id: 's1', question: 'Q?', answer: 'A.', category: 'general' })] });
    const copier = new FaqsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({ entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }] });
  });
});

describe('FaqsCopier.applyTemplate', () => {
  it('append inserts and dedupes on question', async () => {
    const prisma = mkPrisma({ existingItems: [faqRow({ id: 't1', question: 'Existing?' })] });
    const copier = new FaqsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Existing?', answer: 'A.', category: 'general', isActive: true }, { question: 'New?', answer: 'A2.', category: 'general', isActive: true }] },
      'tgt',
      'append',
    );
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const prisma = mkPrisma({ existingItems: [faqRow({ id: 't1', question: 'old?' })] });
    const copier = new FaqsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'faqs', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).programFaq.updateMany).not.toHaveBeenCalled();
  });
});
```

If `faqs.copier.spec.ts` doesn't already have a `faqRow(over)` fixture builder, add one following the same pattern as the other copier specs.

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/faqs.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` not implemented.

- [ ] **Step 3: Implement**

```typescript
// services/api/src/modules/programs/application/copy/copiers/faqs.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { applyScopedTemplate, copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';
import { parseTemplateItems } from '../template-payload.schemas';

type FaqRow = { id: string; question: string; answer: string; category: string; order: number; isActive: boolean };
type TemplateItem = { question: string; answer: string; category: string; isActive: boolean };

@Injectable()
export class FaqsCopier implements ProgramCopier {
  readonly key = 'faqs';
  readonly label = 'FAQs';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programFaq.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const items = await this.prisma.programFaq.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    return (items as unknown as FaqRow[]).map((f) => ({ id: f.id, label: f.question, meta: f.category }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const delegate = tx.programFaq as unknown as ScopedRowsDelegate<FaqRow>;
    return copyScopedRows<FaqRow>({
      delegate,
      scopeField: 'programId',
      sourceProgramId: input.sourceProgramId,
      targetProgramId: input.targetProgramId,
      itemIds: input.itemIds,
      mode: input.mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.question,
      fields: (row, order) => ({
        programId: input.targetProgramId,
        question: row.question,
        answer: row.answer,
        category: row.category,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let rows = await this.prisma.programFaq.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      rows = rows.filter((r) => idSet.has(r.id));
    }
    const items: TemplateItem[] = (rows as unknown as FaqRow[]).map((r) => ({
      question: r.question,
      answer: r.answer,
      category: r.category,
      isActive: r.isActive,
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];
    const sourceRows: FaqRow[] = items.map((item, index) => ({
      id: '',
      question: item.question,
      answer: item.answer,
      category: item.category,
      order: index,
      isActive: item.isActive,
    }));
    const delegate = tx.programFaq as unknown as ScopedRowsDelegate<FaqRow>;
    return applyScopedTemplate<FaqRow>({
      delegate,
      scopeField: 'programId',
      targetProgramId,
      sourceRows,
      mode,
      activeFilter: { deletedAt: null },
      idOf: (row) => row.id,
      dedupeKey: (row) => row.question,
      fields: (row, order) => ({
        programId: targetProgramId,
        question: row.question,
        answer: row.answer,
        category: row.category,
        order,
        isActive: row.isActive,
      }),
      replaceData: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/faqs.copier.spec"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/faqs.copier.ts src/modules/programs/application/copy/copiers/faqs.copier.spec.ts
git commit -m "feat(programs): add FaqsCopier.exportTemplate/applyTemplate"
```

---

## Task 11: `PaymentsCopier.exportTemplate`/`applyTemplate` — two-level, explicit guards duplicated (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/payments.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/payments.copier.spec.ts`

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `parseTemplateItems` (Task 4). Does **not** use `applyScopedTemplate` — same reason `copy()` doesn't use `copyScopedRows`: it must insert tiers first, capture generated ids, then insert each tier's validity periods against the new id.
- Produces: `exportTemplate`/`applyTemplate` on `PaymentsCopier`. `applyTemplate` duplicates both of `copy()`'s explicit guards (empty-replace-source, and the invoice/application in-use check before a replace) — this mirrors how `copy()` already duplicates them relative to `copyScopedRows`'s built-in versions rather than routing through it; it is existing, accepted precedent in this file, not new debt.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/payments.copier.spec.ts
describe('PaymentsCopier.exportTemplate', () => {
  it('exports tiers with nested validityPeriods as ISO date strings, and does not export soldCount/currentCount', async () => {
    const prisma = mkPrisma({
      sourceTiers: [
        tier({
          id: 's1',
          name: 'Early Bird',
          soldCount: 30,
          currentCount: 30,
          validityPeriods: [{ id: 'vp1', pricingTierId: 's1', startDate: new Date('2027-01-01T00:00:00.000Z'), endDate: new Date('2027-02-01T00:00:00.000Z'), description: 'Wave 1' }],
        }),
      ],
    });
    const copier = new PaymentsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload.items[0]).toEqual(
      expect.objectContaining({
        name: 'Early Bird',
        validityPeriods: [{ startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z', description: 'Wave 1' }],
      }),
    );
    expect(payload.items[0]).not.toHaveProperty('soldCount');
    expect(payload.items[0]).not.toHaveProperty('currentCount');
  });
});

describe('PaymentsCopier.applyTemplate', () => {
  it('append inserts a tier from the template with soldCount/currentCount at 0, remapping validity periods to the new tier id', async () => {
    const prisma = mkPrisma({ existingTiers: [] });
    const copier = new PaymentsCopier(prisma);
    await copier.applyTemplate(
      prisma,
      {
        entityType: 'payments',
        payloadVersion: 1,
        items: [
          {
            name: 'Early Bird', description: null, price: 100, currency: 'USD', usdPrice: 100, idrPrice: 1500000,
            capacity: null, benefits: [], requirements: [], feeType: 'registration_fee', allowedCategories: ['self_funded'],
            icon: null, isActive: true,
            validityPeriods: [{ startDate: '2027-01-01T00:00:00.000Z', endDate: '2027-02-01T00:00:00.000Z', description: 'Wave 1' }],
          },
        ],
      },
      'tgt',
      'append',
    );
    const tierCreate = (prisma as any).programPricingTier.create as jest.Mock;
    expect(tierCreate.mock.calls[0][0].data).toEqual(expect.objectContaining({ soldCount: 0, currentCount: 0 }));
    const periodCreate = (prisma as any).pricingTierValidityPeriod.create as jest.Mock;
    expect(periodCreate.mock.calls[0][0].data.pricingTierId).toBe('new-Early Bird');
  });

  it('replace refuses with ConflictException when existing tiers are still referenced by invoices/applications', async () => {
    const prisma = mkPrisma({ existingTiers: [tier({ id: 't1', name: 'old' })] });
    (prisma as any).applicationInvoice = { count: jest.fn().mockResolvedValue(1) };
    (prisma as any).participantApplication = { count: jest.fn().mockResolvedValue(0) };
    const copier = new PaymentsCopier(prisma);
    await expect(
      copier.applyTemplate(
        prisma,
        { entityType: 'payments', payloadVersion: 1, items: [{ name: 'a', description: null, price: 1, currency: 'USD', usdPrice: 1, idrPrice: 1, capacity: null, benefits: [], requirements: [], feeType: 'registration_fee', allowedCategories: [], icon: null, isActive: true, validityPeriods: [] }] },
        'tgt',
        'replace',
      ),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((prisma as any).programPricingTier.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programPricingTier.create).not.toHaveBeenCalled();
  });

  it('replace with an empty template throws BadRequestException before any mutation', async () => {
    const prisma = mkPrisma({ existingTiers: [tier({ id: 't1', name: 'old' })] });
    const copier = new PaymentsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'payments', payloadVersion: 1, items: [] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).programPricingTier.updateMany).not.toHaveBeenCalled();
  });
});
```

`ConflictException` must be imported from `@nestjs/common` at the top of the spec file if not already present (it is already imported in `participation-categories.copier.spec.ts`'s equivalent test — mirror that import here).

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/payments.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` not implemented.

- [ ] **Step 3: Implement**

Append to `services/api/src/modules/programs/application/copy/copiers/payments.copier.ts` (imports change; `countFor`/`preview`/`copy` are untouched):

```typescript
// services/api/src/modules/programs/application/copy/copiers/payments.copier.ts
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { parseTemplateItems } from '../template-payload.schemas';

const EXTERNAL_MEDIA_PATTERN = /<(img|iframe|video)\b/i;

type TemplateValidityPeriod = { startDate: string; endDate: string; description: string | null };
type TemplateItem = {
  name: string;
  description: string | null;
  price: number;
  currency: string;
  usdPrice: number | null;
  idrPrice: number | null;
  capacity: number | null;
  benefits: string[];
  requirements: string[];
  feeType: string;
  allowedCategories: string[];
  icon: string | null;
  isActive: boolean;
  validityPeriods: TemplateValidityPeriod[];
};

async function refuseIfTiersInUse(tx: PrismaTx, targetProgramId: string): Promise<void> {
  const existingTierIds = (
    await tx.programPricingTier.findMany({ where: { programId: targetProgramId, deletedAt: null }, select: { id: true } })
  ).map((t) => t.id);
  if (existingTierIds.length === 0) return;
  const [invoiceCount, applicationCount] = await Promise.all([
    tx.applicationInvoice.count({ where: { pricingTierId: { in: existingTierIds } } }),
    tx.participantApplication.count({ where: { pricingTierId: { in: existingTierIds } } }),
  ]);
  const referencedCount = invoiceCount + applicationCount;
  if (referencedCount > 0) {
    throw new ConflictException({
      code: 'pricing_tier_in_use',
      message: `Cannot replace: ${referencedCount} invoice(s)/application(s) still reference the current payment tiers. Use append mode instead, or reassign those records first.`,
    });
  }
}

@Injectable()
export class PaymentsCopier implements ProgramCopier {
  readonly key = 'payments';
  readonly label = 'Payment Options';
  readonly supportsAppend = true;

  constructor(private readonly prisma: PrismaService) {}

  async countFor(programId: string): Promise<number> {
    return this.prisma.programPricingTier.count({ where: { programId, deletedAt: null } });
  }

  async preview(programId: string): Promise<CopyPreviewItem[]> {
    const tiers = await this.prisma.programPricingTier.findMany({ where: { programId, deletedAt: null }, orderBy: { order: 'asc' } });
    return tiers.map((t) => ({
      id: t.id,
      label: t.name,
      meta: `${t.currency} ${t.price.toString()}`,
      hasExternalMedia: t.description !== null && EXTERNAL_MEDIA_PATTERN.test(t.description),
    }));
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    const { sourceProgramId, targetProgramId, itemIds, mode } = input;
    let sourceTiers = await tx.programPricingTier.findMany({
      where: { programId: sourceProgramId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: { validityPeriods: true },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      sourceTiers = sourceTiers.filter((tier) => idSet.has(tier.id));
    }
    if (mode === 'replace' && sourceTiers.length === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message: "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
      });
    }
    if (sourceTiers.length === 0) {
      return { created: 0, skipped: 0, replaced: 0 };
    }
    let replaced = 0;
    if (mode === 'replace') {
      await refuseIfTiersInUse(tx, targetProgramId);
      const result = await tx.programPricingTier.updateMany({
        where: { programId: targetProgramId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      replaced = result.count;
    }
    const existingTiers =
      mode === 'append'
        ? await tx.programPricingTier.findMany({ where: { programId: targetProgramId, deletedAt: null }, select: { name: true, order: true } })
        : [];
    const existingNames = new Set(existingTiers.map((t) => t.name));
    const baseOrder = existingTiers.reduce((max, t) => Math.max(max, t.order), -1) + 1;
    let created = 0;
    let skipped = 0;
    let placed = 0;
    for (const tier of sourceTiers) {
      if (existingNames.has(tier.name)) {
        skipped += 1;
        continue;
      }
      const newTier = await tx.programPricingTier.create({
        data: {
          programId: targetProgramId, name: tier.name, description: tier.description, price: tier.price, currency: tier.currency,
          usdPrice: tier.usdPrice, idrPrice: tier.idrPrice, capacity: tier.capacity, currentCount: 0, benefits: tier.benefits,
          requirements: tier.requirements, feeType: tier.feeType, allowedCategories: tier.allowedCategories, icon: tier.icon,
          soldCount: 0, isActive: tier.isActive, order: baseOrder + placed,
        },
      });
      for (const period of tier.validityPeriods) {
        await tx.pricingTierValidityPeriod.create({
          data: { pricingTierId: newTier.id, startDate: period.startDate, endDate: period.endDate, description: period.description },
        });
      }
      existingNames.add(tier.name);
      created += 1;
      placed += 1;
    }
    return { created, skipped, replaced };
  }

  async exportTemplate(programId: string, itemIds?: string[]): Promise<TemplatePayload> {
    let tiers = await this.prisma.programPricingTier.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
      include: { validityPeriods: true },
    });
    if (itemIds && itemIds.length > 0) {
      const idSet = new Set(itemIds);
      tiers = tiers.filter((t) => idSet.has(t.id));
    }
    // soldCount/currentCount are deliberately not exported — they're live
    // usage counters, not content, exactly as copy() never carries them
    // forward either.
    const items: TemplateItem[] = tiers.map((t) => ({
      name: t.name,
      description: t.description,
      price: Number(t.price),
      currency: t.currency,
      usdPrice: t.usdPrice === null ? null : Number(t.usdPrice),
      idrPrice: t.idrPrice === null ? null : Number(t.idrPrice),
      capacity: t.capacity,
      benefits: t.benefits,
      requirements: t.requirements,
      feeType: t.feeType,
      allowedCategories: t.allowedCategories,
      icon: t.icon,
      isActive: t.isActive,
      validityPeriods: t.validityPeriods.map((p) => ({
        startDate: p.startDate.toISOString(),
        endDate: p.endDate.toISOString(),
        description: p.description,
      })),
    }));
    return { entityType: this.key, payloadVersion: 1, items: items as unknown as Record<string, unknown>[] };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    const items = parseTemplateItems(this.key, payload.items) as unknown as TemplateItem[];

    // Same failure mode copy() guards against — see this plan's Global
    // Constraints on why this is duplicated rather than shared.
    if (mode === 'replace' && items.length === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message: "Replacing from an empty selection would delete the target's existing content without replacing it. Select at least one item to copy, or use append mode.",
      });
    }
    if (items.length === 0) {
      return { created: 0, skipped: 0, replaced: 0 };
    }

    let replaced = 0;
    if (mode === 'replace') {
      await refuseIfTiersInUse(tx, targetProgramId);
      const result = await tx.programPricingTier.updateMany({
        where: { programId: targetProgramId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      replaced = result.count;
    }

    const existingTiers =
      mode === 'append'
        ? await tx.programPricingTier.findMany({ where: { programId: targetProgramId, deletedAt: null }, select: { name: true, order: true } })
        : [];
    const existingNames = new Set(existingTiers.map((t) => t.name));
    const baseOrder = existingTiers.reduce((max, t) => Math.max(max, t.order), -1) + 1;

    let created = 0;
    let skipped = 0;
    let placed = 0;
    for (const item of items) {
      if (existingNames.has(item.name)) {
        skipped += 1;
        continue;
      }
      const newTier = await tx.programPricingTier.create({
        data: {
          programId: targetProgramId, name: item.name, description: item.description, price: item.price, currency: item.currency,
          usdPrice: item.usdPrice, idrPrice: item.idrPrice, capacity: item.capacity, currentCount: 0, benefits: item.benefits,
          requirements: item.requirements, feeType: item.feeType, allowedCategories: item.allowedCategories, icon: item.icon,
          soldCount: 0, isActive: item.isActive, order: baseOrder + placed,
        },
      });
      for (const period of item.validityPeriods) {
        await tx.pricingTierValidityPeriod.create({
          data: { pricingTierId: newTier.id, startDate: new Date(period.startDate), endDate: new Date(period.endDate), description: period.description },
        });
      }
      existingNames.add(item.name);
      created += 1;
      placed += 1;
    }
    return { created, skipped, replaced };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/payments.copier.spec"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/payments.copier.ts src/modules/programs/application/copy/copiers/payments.copier.spec.ts
git commit -m "feat(programs): add PaymentsCopier.exportTemplate/applyTemplate"
```

---

## Task 12: `ProgramDetailsCopier.exportTemplate`/`applyTemplate` — scalar, replace-only (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/application/copy/copiers/program-details.copier.ts`
- Modify: `services/api/src/modules/programs/application/copy/copiers/program-details.copier.spec.ts`

**Interfaces:**
- Consumes: `TemplatePayload` (Task 2); `parseTemplateItems` (Task 4). Does **not** use `applyScopedTemplate` — same reason `copy()` doesn't use `copyScopedRows`: this copier mutates a single `Program` row's scalars, not a collection.
- Produces: `exportTemplate`/`applyTemplate` on `ProgramDetailsCopier`. `applyTemplate` rejects `mode !== 'replace'` exactly like `copy()` does, and reuses the same blank-rich-text detection (`isBlankRichText`) so a template built from a program whose fields are all `<p></p>` is refused the same way an empty source program is refused by `copy()`.

- [ ] **Step 1: Write the failing tests**

```typescript
// Append to services/api/src/modules/programs/application/copy/copiers/program-details.copier.spec.ts
describe('ProgramDetailsCopier.exportTemplate', () => {
  it('exports a single-item payload with the three scalar fields', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>Bring a laptop</p>', benefitsDescription: null, termsAndConditions: '<p>No refunds</p>' } });
    const copier = new ProgramDetailsCopier(prisma);
    const payload = await copier.exportTemplate('src');
    expect(payload).toEqual({
      entityType: 'program-details',
      payloadVersion: 1,
      items: [{ requirementsDescription: '<p>Bring a laptop</p>', benefitsDescription: null, termsAndConditions: '<p>No refunds</p>' }],
    });
  });
});

describe('ProgramDetailsCopier.applyTemplate', () => {
  it('replace writes the template item's three fields onto the target program', async () => {
    const prisma = mkPrisma({ tgt: { requirementsDescription: null, benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const result = await copier.applyTemplate(
      prisma,
      { entityType: 'program-details', payloadVersion: 1, items: [{ requirementsDescription: '<p>x</p>', benefitsDescription: '<p>y</p>', termsAndConditions: null }] },
      'tgt',
      'replace',
    );
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: { requirementsDescription: '<p>x</p>', benefitsDescription: '<p>y</p>', termsAndConditions: null },
    });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('rejects append mode', async () => {
    const prisma = mkPrisma({});
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'program-details', payloadVersion: 1, items: [{ requirementsDescription: 'x', benefitsDescription: null, termsAndConditions: null }] }, 'tgt', 'append'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('rejects a template whose single item is blank in all three fields, before any mutation', async () => {
    const prisma = mkPrisma({});
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.applyTemplate(prisma, { entityType: 'program-details', payloadVersion: 1, items: [{ requirementsDescription: '<p></p>', benefitsDescription: null, termsAndConditions: null }] }, 'tgt', 'replace'),
    ).rejects.toThrow(/empty_replace_source/);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/program-details.copier.spec"`
Expected: FAIL — `exportTemplate`/`applyTemplate` not implemented.

- [ ] **Step 3: Implement**

```typescript
// services/api/src/modules/programs/application/copy/copiers/program-details.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyMode, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier, TemplatePayload } from '../program-copier.interface';
import { parseTemplateItems } from '../template-payload.schemas';

type ProgramContentScalars = { requirementsDescription: string | null; benefitsDescription: string | null; termsAndConditions: string | null };
const SELECT = { requirementsDescription: true, benefitsDescription: true, termsAndConditions: true } as const;

const NON_BLANK_MEDIA_PATTERN = /<(img|iframe|video|hr)\b/i;

function isBlankRichText(value: string | null): boolean {
  if (!value) return true;
  if (NON_BLANK_MEDIA_PATTERN.test(value)) return false;
  return value.replace(/<[^>]*>/g, '').replace(/&nbsp;/gi, ' ').trim().length === 0;
}

function contentFieldCount(program: ProgramContentScalars): number {
  return [program.requirementsDescription, program.benefitsDescription, program.termsAndConditions].filter((v) => !isBlankRichText(v)).length;
}

const EXTERNAL_MEDIA_PATTERN = /<(img|iframe|video)\b/i;
function hasExternalMedia(program: ProgramContentScalars): boolean {
  return [program.requirementsDescription, program.benefitsDescription, program.termsAndConditions].some((v) => v !== null && EXTERNAL_MEDIA_PATTERN.test(v));
}

@Injectable()
export class ProgramDetailsCopier implements ProgramCopier {
  readonly key = 'program-details';
  readonly label = 'Participant-Facing Content';
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
    return [{ id: programId, label: 'Requirements, Benefits & Terms', meta: `${count} field(s) with content`, hasExternalMedia: hasExternalMedia(program) }];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({ code: 'append_not_supported', message: 'program-details only supports replace mode.' });
    }
    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    if (contentFieldCount(source) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message: 'The source program has no content in Requirements, Benefits, or Terms & Conditions to copy. Add content to at least one of those fields on the source program, then try again.',
      });
    }
    const target = await tx.program.findUnique({ where: { id: input.targetProgramId }, select: SELECT });
    const targetHadContent = target !== null && contentFieldCount(target) > 0;
    await tx.program.update({
      where: { id: input.targetProgramId },
      data: { requirementsDescription: source.requirementsDescription, benefitsDescription: source.benefitsDescription, termsAndConditions: source.termsAndConditions },
    });
    return { created: 1, skipped: 0, replaced: targetHadContent ? 1 : 0 };
  }

  async exportTemplate(programId: string): Promise<TemplatePayload> {
    // itemIds is not accepted — this copier has exactly one exportable unit
    // (the whole three-field bundle), matching preview()'s single-item shape.
    const program = await this.prisma.program.findUnique({ where: { id: programId }, select: SELECT });
    if (!program) throw new NotFoundException(`Program ${programId} not found`);
    return {
      entityType: this.key,
      payloadVersion: 1,
      items: [
        {
          requirementsDescription: program.requirementsDescription,
          benefitsDescription: program.benefitsDescription,
          termsAndConditions: program.termsAndConditions,
        },
      ],
    };
  }

  async applyTemplate(tx: PrismaTx, payload: TemplatePayload, targetProgramId: string, mode: CopyMode): Promise<CopyResult> {
    if (mode !== 'replace') {
      throw new BadRequestException({ code: 'append_not_supported', message: 'program-details only supports replace mode.' });
    }
    const items = parseTemplateItems(this.key, payload.items) as unknown as ProgramContentScalars[];
    const item = items[0];
    // Same shape as copy()'s guard: a template with no content in any of the
    // three fields would overwrite the target's populated text with three
    // blanks. Refuse before any mutation.
    if (!item || contentFieldCount(item) === 0) {
      throw new BadRequestException({
        code: 'empty_replace_source',
        message: 'This template has no content in Requirements, Benefits, or Terms & Conditions to apply.',
      });
    }
    await tx.program.update({
      where: { id: targetProgramId },
      data: { requirementsDescription: item.requirementsDescription, benefitsDescription: item.benefitsDescription, termsAndConditions: item.termsAndConditions },
    });
    return { created: 1, skipped: 0, replaced: 0 };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/program-details.copier.spec"`
Expected: PASS.

- [ ] **Step 5: Verify every copier now satisfies the full `ProgramCopier` interface**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: **no errors** — this is the first point since Task 2 where the "copier doesn't implement exportTemplate/applyTemplate" errors are fully resolved, across all seven copiers.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/program-details.copier.ts src/modules/programs/application/copy/copiers/program-details.copier.spec.ts
git commit -m "feat(programs): add ProgramDetailsCopier.exportTemplate/applyTemplate"
```

---

## Task 13: `ContentTemplate` DTOs + create/update/delete command handlers (TDD)

**Files:**
- Create: `services/api/src/modules/programs/presentation/dto/content-template.dto.ts`
- Create: `services/api/src/modules/programs/application/commands/content-template.commands.ts`
- Create: `services/api/src/modules/programs/application/commands/handlers/content-template.handler.ts`
- Create: `services/api/src/modules/programs/application/commands/handlers/content-template.handler.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopierRegistry` (Phase 1); `parseTemplateItems` (Task 4); `TemplatePayload` (Task 2).
- Produces: `CreateContentTemplateCommand`, `UpdateContentTemplateCommand`, `DeleteContentTemplateCommand` + their handlers — Task 15's `ContentTemplatesController` dispatches all three via `CommandBus`.

`CreateContentTemplateHandler` never accepts a client-supplied payload — it always derives one server-side via `registry.get(dto.entityType).exportTemplate(dto.programId, dto.itemIds)`, then validates that output with `parseTemplateItems` (the write-path validation the spec requires) before persisting. `isDefault` is scoped to `entityType` (this plan's Global Constraints) — setting it unsets every other template of the same `entityType`, not the old `category`-scoped behavior `ApplicationFormTemplate` had.

- [ ] **Step 1: Write the DTOs**

```typescript
// services/api/src/modules/programs/presentation/dto/content-template.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateContentTemplateDto {
  @ApiProperty({ description: "Must match a registered ProgramCopier.key, e.g. 'faqs'." })
  @IsString()
  entityType!: string;

  @ApiProperty({ description: 'Program to export the template payload from.' })
  @IsUUID()
  programId!: string;

  @ApiPropertyOptional({ description: 'Specific source item ids to export. Omit to export all.', type: [String] })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itemIds?: string[];

  @ApiProperty()
  @IsString()
  @MaxLength(255)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class UpdateContentTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}

export class ContentTemplateSummaryDto {
  @ApiProperty() id!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string | null;
  @ApiProperty() entityType!: string;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty() itemCount!: number;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

export class ContentTemplateDetailDto extends ContentTemplateSummaryDto {
  @ApiProperty({ description: 'The full stored TemplatePayload.' })
  payload!: { entityType: string; payloadVersion: number; items: Record<string, unknown>[] };
}
```

- [ ] **Step 2: Write the commands**

```typescript
// services/api/src/modules/programs/application/commands/content-template.commands.ts
import { CreateContentTemplateDto, UpdateContentTemplateDto } from '../../presentation/dto/content-template.dto';

export class CreateContentTemplateCommand {
  constructor(public readonly dto: CreateContentTemplateDto) {}
}

export class UpdateContentTemplateCommand {
  constructor(
    public readonly id: string,
    public readonly dto: UpdateContentTemplateDto,
  ) {}
}

export class DeleteContentTemplateCommand {
  constructor(public readonly id: string) {}
}
```

- [ ] **Step 3: Write the failing handler tests**

```typescript
// services/api/src/modules/programs/application/commands/handlers/content-template.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { CreateContentTemplateHandler, UpdateContentTemplateHandler, DeleteContentTemplateHandler } from './content-template.handler';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../content-template.commands';
import { ProgramCopierRegistry } from '../../copy/program-copier.registry';

function mkPrisma(overrides: Partial<{ existing: any }> = {}) {
  const base: any = {
    contentTemplate: {
      create: jest.fn().mockImplementation(({ data }: any) => Promise.resolve({ id: 'new-id', ...data })),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      findFirst: jest.fn().mockResolvedValue(overrides.existing ?? null),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  return base;
}

function mkRegistry(exportTemplate: jest.Mock) {
  return { get: jest.fn().mockReturnValue({ key: 'faqs', exportTemplate }) } as unknown as ProgramCopierRegistry;
}

describe('CreateContentTemplateHandler', () => {
  it('derives the payload via registry.get(entityType).exportTemplate, validates it, and persists', async () => {
    const exportTemplate = jest.fn().mockResolvedValue({
      entityType: 'faqs',
      payloadVersion: 1,
      items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }],
    });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    const result = await handler.execute(
      new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'Standard FAQs', isDefault: false }),
    );
    expect(exportTemplate).toHaveBeenCalledWith('src', undefined);
    expect(prisma.contentTemplate.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ name: 'Standard FAQs', entityType: 'faqs', isDefault: false, payloadVersion: 1 }),
      }),
    );
    expect(result.id).toBe('new-id');
  });

  it('rejects a payload that fails schema validation, before persisting', async () => {
    const exportTemplate = jest.fn().mockResolvedValue({ entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?' }] });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    await expect(
      handler.execute(new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'Bad' })),
    ).rejects.toThrow(/invalid_template_payload/);
    expect(prisma.contentTemplate.create).not.toHaveBeenCalled();
  });

  it('when isDefault is true, unsets isDefault on every other template of the SAME entityType only', async () => {
    const exportTemplate = jest.fn().mockResolvedValue({ entityType: 'faqs', payloadVersion: 1, items: [] });
    const prisma = mkPrisma();
    const handler = new CreateContentTemplateHandler(prisma, mkRegistry(exportTemplate));
    await handler.execute(new CreateContentTemplateCommand({ entityType: 'faqs', programId: 'src', name: 'New Default', isDefault: true }));
    expect(prisma.contentTemplate.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'faqs', isDefault: true, deletedAt: null },
      data: { isDefault: false },
    });
  });
});

describe('UpdateContentTemplateHandler', () => {
  it('throws NotFoundException when the template does not exist or is soft-deleted', async () => {
    const prisma = mkPrisma({ existing: null });
    const handler = new UpdateContentTemplateHandler(prisma);
    await expect(handler.execute(new UpdateContentTemplateCommand('missing', { name: 'x' }))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates name/description/isDefault only — payload is never touched', async () => {
    const prisma = mkPrisma({ existing: { id: 't1', entityType: 'faqs', isDefault: false } });
    const handler = new UpdateContentTemplateHandler(prisma);
    await handler.execute(new UpdateContentTemplateCommand('t1', { name: 'Renamed' }));
    expect(prisma.contentTemplate.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { name: 'Renamed' } });
  });

  it('unsets isDefault on other templates of the same entityType, excluding itself, when set true', async () => {
    const prisma = mkPrisma({ existing: { id: 't1', entityType: 'faqs', isDefault: false } });
    const handler = new UpdateContentTemplateHandler(prisma);
    await handler.execute(new UpdateContentTemplateCommand('t1', { isDefault: true }));
    expect(prisma.contentTemplate.updateMany).toHaveBeenCalledWith({
      where: { entityType: 'faqs', isDefault: true, deletedAt: null, NOT: { id: 't1' } },
      data: { isDefault: false },
    });
  });
});

describe('DeleteContentTemplateHandler', () => {
  it('throws NotFoundException when the template does not exist or is already soft-deleted', async () => {
    const prisma = mkPrisma({ existing: null });
    const handler = new DeleteContentTemplateHandler(prisma as any);
    await expect(handler.execute(new DeleteContentTemplateCommand('missing'))).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes by setting deletedAt', async () => {
    const prisma = mkPrisma({ existing: { id: 't1' } });
    const handler = new DeleteContentTemplateHandler(prisma as any);
    await handler.execute(new DeleteContentTemplateCommand('t1'));
    expect(prisma.contentTemplate.update).toHaveBeenCalledWith({ where: { id: 't1' }, data: { deletedAt: expect.any(Date) } });
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="content-template.handler.spec"`
Expected: FAIL — cannot find module `./content-template.handler`.

- [ ] **Step 5: Write the handlers**

```typescript
// services/api/src/modules/programs/application/commands/handlers/content-template.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../content-template.commands';
import { ProgramCopierRegistry } from '../../copy/program-copier.registry';
import { parseTemplateItems } from '../../copy/template-payload.schemas';

@Injectable()
@CommandHandler(CreateContentTemplateCommand)
export class CreateContentTemplateHandler implements ICommandHandler<CreateContentTemplateCommand> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: ProgramCopierRegistry,
  ) {}

  async execute({ dto }: CreateContentTemplateCommand) {
    const copier = this.registry.get(dto.entityType);
    const payload = await copier.exportTemplate(dto.programId, dto.itemIds);
    // Write-path validation the spec requires — even though exportTemplate is
    // trusted, this catches a malformed shape immediately rather than
    // letting it sit stored until an applyTemplate call fails on it later.
    const validatedItems = parseTemplateItems(dto.entityType, payload.items);

    if (dto.isDefault) {
      await this.prisma.contentTemplate.updateMany({
        where: { entityType: dto.entityType, isDefault: true, deletedAt: null },
        data: { isDefault: false },
      });
    }

    return this.prisma.contentTemplate.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
        entityType: dto.entityType,
        payload: { entityType: dto.entityType, payloadVersion: payload.payloadVersion, items: validatedItems } as never,
        payloadVersion: payload.payloadVersion,
        isDefault: dto.isDefault ?? false,
      },
    });
  }
}

@Injectable()
@CommandHandler(UpdateContentTemplateCommand)
export class UpdateContentTemplateHandler implements ICommandHandler<UpdateContentTemplateCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id, dto }: UpdateContentTemplateCommand) {
    const existing = await this.prisma.contentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Content template ${id} not found`);

    if (dto.isDefault) {
      await this.prisma.contentTemplate.updateMany({
        where: { entityType: existing.entityType, isDefault: true, deletedAt: null, NOT: { id } },
        data: { isDefault: false },
      });
    }

    return this.prisma.contentTemplate.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.isDefault !== undefined && { isDefault: dto.isDefault }),
      },
    });
  }
}

@Injectable()
@CommandHandler(DeleteContentTemplateCommand)
export class DeleteContentTemplateHandler implements ICommandHandler<DeleteContentTemplateCommand> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: DeleteContentTemplateCommand) {
    const existing = await this.prisma.contentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!existing) throw new NotFoundException(`Content template ${id} not found`);
    return this.prisma.contentTemplate.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="content-template.handler.spec"`
Expected: PASS — 8 passing tests.

- [ ] **Step 7: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/dto/content-template.dto.ts src/modules/programs/application/commands/content-template.commands.ts src/modules/programs/application/commands/handlers/content-template.handler.ts src/modules/programs/application/commands/handlers/content-template.handler.spec.ts
git commit -m "feat(programs): add ContentTemplate create/update/delete command handlers"
```

---

## Task 14: `ContentTemplate` list/detail query handlers (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/queries/get-content-templates.query.ts`
- Create: `services/api/src/modules/programs/application/queries/handlers/get-content-templates.handler.ts`
- Create: `services/api/src/modules/programs/application/queries/handlers/get-content-templates.handler.spec.ts`

**Interfaces:**
- Consumes: `ContentTemplateSummaryDto`, `ContentTemplateDetailDto` (Task 13).
- Produces: `GetContentTemplatesQuery` (optional `entityType` filter), `GetContentTemplateByIdQuery` + their handlers — Task 15's controller dispatches both via `QueryBus`. `itemCount` on the summary DTO is derived as `(row.payload as TemplatePayload).items.length` — the one piece of generic information every entity type's payload can report without the caller knowing its shape.

- [ ] **Step 1: Write the query classes**

```typescript
// services/api/src/modules/programs/application/queries/get-content-templates.query.ts
export class GetContentTemplatesQuery {
  constructor(public readonly entityType?: string) {}
}

export class GetContentTemplateByIdQuery {
  constructor(public readonly id: string) {}
}
```

- [ ] **Step 2: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/queries/handlers/get-content-templates.handler.spec.ts
import { NotFoundException } from '@nestjs/common';
import { GetContentTemplatesHandler, GetContentTemplateByIdHandler } from './get-content-templates.handler';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../get-content-templates.query';

function row(over: Partial<{ id: string; entityType: string; payload: unknown; deletedAt: Date | null }> = {}) {
  return {
    id: over.id ?? 't1',
    name: 'Standard FAQs',
    description: null,
    entityType: over.entityType ?? 'faqs',
    payload: over.payload ?? { entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?' }, { question: 'Q2?' }] },
    payloadVersion: 1,
    isDefault: false,
    createdAt: new Date('2026-08-24'),
    updatedAt: new Date('2026-08-24'),
  };
}

describe('GetContentTemplatesHandler', () => {
  it('lists templates, deriving itemCount from payload.items.length', async () => {
    const prisma: any = { contentTemplate: { findMany: jest.fn().mockResolvedValue([row()]) } };
    const handler = new GetContentTemplatesHandler(prisma);
    const result = await handler.execute(new GetContentTemplatesQuery());
    expect(result).toEqual([expect.objectContaining({ id: 't1', itemCount: 2 })]);
  });

  it('filters by entityType when provided', async () => {
    const prisma: any = { contentTemplate: { findMany: jest.fn().mockResolvedValue([]) } };
    const handler = new GetContentTemplatesHandler(prisma);
    await handler.execute(new GetContentTemplatesQuery('faqs'));
    expect(prisma.contentTemplate.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { deletedAt: null, entityType: 'faqs' } }),
    );
  });

  it('omits the entityType filter when not provided', async () => {
    const prisma: any = { contentTemplate: { findMany: jest.fn().mockResolvedValue([]) } };
    const handler = new GetContentTemplatesHandler(prisma);
    await handler.execute(new GetContentTemplatesQuery());
    expect(prisma.contentTemplate.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { deletedAt: null } }));
  });
});

describe('GetContentTemplateByIdHandler', () => {
  it('returns the detail DTO including the full payload', async () => {
    const prisma: any = { contentTemplate: { findFirst: jest.fn().mockResolvedValue(row()) } };
    const handler = new GetContentTemplateByIdHandler(prisma);
    const result = await handler.execute(new GetContentTemplateByIdQuery('t1'));
    expect(result.payload).toEqual({ entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?' }, { question: 'Q2?' }] });
    expect(result.itemCount).toBe(2);
  });

  it('throws NotFoundException when missing or soft-deleted', async () => {
    const prisma: any = { contentTemplate: { findFirst: jest.fn().mockResolvedValue(null) } };
    const handler = new GetContentTemplateByIdHandler(prisma);
    await expect(handler.execute(new GetContentTemplateByIdQuery('missing'))).rejects.toBeInstanceOf(NotFoundException);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="get-content-templates.handler.spec"`
Expected: FAIL — cannot find module `./get-content-templates.handler`.

- [ ] **Step 4: Write the handlers**

```typescript
// services/api/src/modules/programs/application/queries/handlers/get-content-templates.handler.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../get-content-templates.query';
import { ContentTemplateSummaryDto, ContentTemplateDetailDto } from '../../../presentation/dto/content-template.dto';
import { TemplatePayload } from '../../copy/program-copier.interface';

function toSummary(row: {
  id: string; name: string; description: string | null; entityType: string; payload: unknown; isDefault: boolean; createdAt: Date; updatedAt: Date;
}): ContentTemplateSummaryDto {
  const payload = row.payload as unknown as TemplatePayload;
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    entityType: row.entityType,
    isDefault: row.isDefault,
    itemCount: payload.items.length,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

@Injectable()
@QueryHandler(GetContentTemplatesQuery)
export class GetContentTemplatesHandler implements IQueryHandler<GetContentTemplatesQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ entityType }: GetContentTemplatesQuery): Promise<ContentTemplateSummaryDto[]> {
    const rows = await this.prisma.contentTemplate.findMany({
      where: { deletedAt: null, ...(entityType ? { entityType } : {}) },
      orderBy: [{ entityType: 'asc' }, { name: 'asc' }],
    });
    return rows.map(toSummary);
  }
}

@Injectable()
@QueryHandler(GetContentTemplateByIdQuery)
export class GetContentTemplateByIdHandler implements IQueryHandler<GetContentTemplateByIdQuery> {
  constructor(private readonly prisma: PrismaService) {}

  async execute({ id }: GetContentTemplateByIdQuery): Promise<ContentTemplateDetailDto> {
    const row = await this.prisma.contentTemplate.findFirst({ where: { id, deletedAt: null } });
    if (!row) throw new NotFoundException(`Content template ${id} not found`);
    return { ...toSummary(row), payload: row.payload as unknown as TemplatePayload };
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="get-content-templates.handler.spec"`
Expected: PASS — 5 passing tests.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/application/queries/get-content-templates.query.ts src/modules/programs/application/queries/handlers/get-content-templates.handler.ts src/modules/programs/application/queries/handlers/get-content-templates.handler.spec.ts
git commit -m "feat(programs): add ContentTemplate list/detail query handlers"
```

---

## Task 15: `ContentTemplatesController` (TDD)

**Files:**
- Create: `services/api/src/modules/programs/presentation/content-templates.controller.ts`
- Create: `services/api/src/modules/programs/presentation/content-templates.controller.spec.ts`

**Interfaces:**
- Consumes: `CreateContentTemplateCommand`, `UpdateContentTemplateCommand`, `DeleteContentTemplateCommand` (Task 13); `GetContentTemplatesQuery`, `GetContentTemplateByIdQuery` (Task 14); `CreateContentTemplateDto`, `UpdateContentTemplateDto` (Task 13).
- Produces: `GET /content-templates?entityType=`, `GET /content-templates/:id`, `POST /content-templates`, `PATCH /content-templates/:id`, `DELETE /content-templates/:id` — Task 20's frontend `content-templates-api.ts` calls these five routes by exact path.

Mirrors `form-templates.controller.ts`'s structure exactly (same guard/role decorators, same `QueryBus`/`CommandBus` split), generalized to `entityType` instead of being form-fields-only.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/presentation/content-templates.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ContentTemplatesController } from './content-templates.controller';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../application/queries/get-content-templates.query';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../application/commands/content-template.commands';

describe('ContentTemplatesController', () => {
  let controller: ContentTemplatesController;
  const mockQueryExecute = jest.fn();
  const mockCommandExecute = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContentTemplatesController],
      providers: [
        { provide: QueryBus, useValue: { execute: mockQueryExecute } },
        { provide: CommandBus, useValue: { execute: mockCommandExecute } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ContentTemplatesController>(ContentTemplatesController);
    jest.clearAllMocks();
  });

  it('list() dispatches GetContentTemplatesQuery with the entityType query param', async () => {
    mockQueryExecute.mockResolvedValue([]);
    await controller.list('faqs');
    expect(mockQueryExecute).toHaveBeenCalledWith(new GetContentTemplatesQuery('faqs'));
  });

  it('list() passes undefined when entityType is omitted', async () => {
    mockQueryExecute.mockResolvedValue([]);
    await controller.list(undefined);
    expect(mockQueryExecute).toHaveBeenCalledWith(new GetContentTemplatesQuery(undefined));
  });

  it('detail() dispatches GetContentTemplateByIdQuery', async () => {
    mockQueryExecute.mockResolvedValue({ id: 't1' });
    await controller.detail('t1');
    expect(mockQueryExecute).toHaveBeenCalledWith(new GetContentTemplateByIdQuery('t1'));
  });

  it('create() dispatches CreateContentTemplateCommand with the dto', async () => {
    const dto = { entityType: 'faqs', programId: 'src', name: 'x' };
    mockCommandExecute.mockResolvedValue({ id: 'new-id' });
    await controller.create(dto as never);
    expect(mockCommandExecute).toHaveBeenCalledWith(new CreateContentTemplateCommand(dto as never));
  });

  it('update() dispatches UpdateContentTemplateCommand with id and dto', async () => {
    const dto = { name: 'renamed' };
    mockCommandExecute.mockResolvedValue({ id: 't1' });
    await controller.update('t1', dto as never);
    expect(mockCommandExecute).toHaveBeenCalledWith(new UpdateContentTemplateCommand('t1', dto as never));
  });

  it('remove() dispatches DeleteContentTemplateCommand with id', async () => {
    mockCommandExecute.mockResolvedValue({ id: 't1' });
    await controller.remove('t1');
    expect(mockCommandExecute).toHaveBeenCalledWith(new DeleteContentTemplateCommand('t1'));
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="content-templates.controller.spec"`
Expected: FAIL — cannot find module `./content-templates.controller`.

- [ ] **Step 3: Write the controller**

```typescript
// services/api/src/modules/programs/presentation/content-templates.controller.ts
import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { CommandBus, QueryBus } from '@nestjs/cqrs';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CreateContentTemplateCommand, UpdateContentTemplateCommand, DeleteContentTemplateCommand } from '../application/commands/content-template.commands';
import { GetContentTemplatesQuery, GetContentTemplateByIdQuery } from '../application/queries/get-content-templates.query';
import { CreateContentTemplateDto, UpdateContentTemplateDto, ContentTemplateSummaryDto, ContentTemplateDetailDto } from './dto/content-template.dto';

@ApiTags('Content Templates')
@ApiBearerAuth()
@Controller('content-templates')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ContentTemplatesController {
  constructor(
    private readonly queryBus: QueryBus,
    private readonly commandBus: CommandBus,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List content templates, optionally filtered by entityType.' })
  list(@Query('entityType') entityType?: string): Promise<ContentTemplateSummaryDto[]> {
    return this.queryBus.execute(new GetContentTemplatesQuery(entityType));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a content template with its full payload.' })
  detail(@Param('id') id: string): Promise<ContentTemplateDetailDto> {
    return this.queryBus.execute(new GetContentTemplateByIdQuery(id));
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: "Create a content template by exporting a program's current content (super-admin only)." })
  create(@Body() dto: CreateContentTemplateDto) {
    return this.commandBus.execute(new CreateContentTemplateCommand(dto));
  }

  @Patch(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update a content template\'s name/description/isDefault (super-admin only). Payload is immutable after creation.' })
  update(@Param('id') id: string, @Body() dto: UpdateContentTemplateDto) {
    return this.commandBus.execute(new UpdateContentTemplateCommand(id, dto));
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Soft-delete a content template (super-admin only).' })
  remove(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteContentTemplateCommand(id));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="content-templates.controller.spec"`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/content-templates.controller.ts src/modules/programs/presentation/content-templates.controller.spec.ts
git commit -m "feat(programs): add ContentTemplatesController"
```

---

## Task 16: `ProgramCopyController` — `apply-template` route (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts` (add `ApplyTemplateEntityDto`)
- Modify: `services/api/src/modules/programs/presentation/program-copy.controller.ts`
- Modify: `services/api/src/modules/programs/presentation/program-copy.controller.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopierRegistry.get` (Phase 1); `PrismaService.contentTemplate` (Task 5); `invalidateLandingCacheByProgramId` (Phase 1, `manage-program-content.handlers.ts`).
- Produces: `POST /programs/:programId/copy/:entityKey/apply-template` → `CopyResult` — Task 22's frontend `postApplyTemplate` calls this exact path.

Mirrors the existing `copy` route's transaction + gates + post-commit cache invalidation exactly, loading a `ContentTemplate` instead of a sibling program's live rows. A template whose `entityType` doesn't match the `:entityKey` in the URL is rejected — a FAQs template can never be applied through the `payments` route, even if someone crafts the request by hand.

- [ ] **Step 1: Add the DTO**

Append to `services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts` (the existing `CopyEntityDto` stays untouched):

```typescript
// Append to services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts
export class ApplyTemplateEntityDto {
  @ApiProperty({ description: 'ContentTemplate id to apply.' })
  @IsUUID()
  templateId!: string;

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({ description: "Must be true when mode='replace' to guard against accidental data loss." })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
```

- [ ] **Step 2: Write the failing tests**

Append to `services/api/src/modules/programs/presentation/program-copy.controller.spec.ts` (reuses the existing `beforeEach`, `mockRegistryGet`, `mockPrismaTransaction`, `controller`):

```typescript
// Append to services/api/src/modules/programs/presentation/program-copy.controller.spec.ts
describe('applyTemplate', () => {
  const mockPrismaFindTemplate = jest.fn();
  const mockInvalidate = jest.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    (controller as any).prisma.contentTemplate = { findFirst: mockPrismaFindTemplate };
    (controller as any).landingCacheInvalidation = { invalidate: mockInvalidate };
  });

  it('404s when the template does not exist', async () => {
    mockPrismaFindTemplate.mockResolvedValue(null);
    await expect(controller.applyTemplate('tgt', 'faqs', { templateId: 'missing', mode: 'append' })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('rejects when the template\'s entityType does not match the :entityKey in the URL', async () => {
    mockPrismaFindTemplate.mockResolvedValue({ id: 't1', entityType: 'timelines', payload: { entityType: 'timelines', payloadVersion: 1, items: [] } });
    await expect(controller.applyTemplate('tgt', 'faqs', { templateId: 't1', mode: 'append' })).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects replace mode without confirm: true', async () => {
    mockPrismaFindTemplate.mockResolvedValue({ id: 't1', entityType: 'faqs', payload: { entityType: 'faqs', payloadVersion: 1, items: [] } });
    mockRegistryGet.mockReturnValue({ supportsAppend: true, applyTemplate: jest.fn() });
    await expect(controller.applyTemplate('tgt', 'faqs', { templateId: 't1', mode: 'replace' })).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('opens a transaction, calls copier.applyTemplate(tx, payload, programId, mode), then invalidates the landing cache', async () => {
    const payload = { entityType: 'faqs', payloadVersion: 1, items: [{ question: 'Q?', answer: 'A.', category: 'general', isActive: true }] };
    mockPrismaFindTemplate.mockResolvedValue({ id: 't1', entityType: 'faqs', payload });
    const applyTemplate = jest.fn().mockResolvedValue({ created: 1, skipped: 0, replaced: 0 });
    mockRegistryGet.mockReturnValue({ supportsAppend: true, applyTemplate });
    mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

    const result = await controller.applyTemplate('tgt', 'faqs', { templateId: 't1', mode: 'append' });

    expect(applyTemplate).toHaveBeenCalledWith('fake-tx', payload, 'tgt', 'append');
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
    expect(mockInvalidate).toHaveBeenCalled();
  });
});
```

The existing `import` block at the top of the spec file needs `BadRequestException` and `NotFoundException` from `@nestjs/common` if not already both present (`BadRequestException` already is, from Phase 1's `copy` tests).

- [ ] **Step 3: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="program-copy.controller.spec"`
Expected: FAIL — `controller.applyTemplate` does not exist yet.

- [ ] **Step 4: Add the route**

Modify `services/api/src/modules/programs/presentation/program-copy.controller.ts` — add the `NotFoundException` import and the new method (everything else in the file is untouched):

```typescript
// services/api/src/modules/programs/presentation/program-copy.controller.ts
import { BadRequestException, Body, Controller, Get, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../../brands/application/services/landing-cache-invalidation.service';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { CopyEntityDto, ApplyTemplateEntityDto } from './dto/copy-entity.dto';
import { CopyPreviewItem, CopyResult, PrismaTx, TemplatePayload } from '../application/copy/program-copier.interface';
import { invalidateLandingCacheByProgramId } from '../application/commands/handlers/manage-program-content.handlers';

@ApiTags('Program Content Copy')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ProgramCopyController {
  constructor(
    private readonly registry: ProgramCopierRegistry,
    private readonly prisma: PrismaService,
    private readonly landingCacheInvalidation: LandingCacheInvalidationService,
  ) {}

  // ... getCounts, preview, copy: unchanged from Phase 1 — see the existing file ...

  @Post(':programId/copy/:entityKey/apply-template')
  @ApiOperation({ summary: 'Apply a saved content template into this program (append or replace).' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async applyTemplate(
    @Param('programId') programId: string,
    @Param('entityKey') entityKey: string,
    @Body() dto: ApplyTemplateEntityDto,
  ): Promise<CopyResult> {
    const copier = this.registry.get(entityKey);
    const mode = dto.mode ?? 'append';

    const template = await this.prisma.contentTemplate.findFirst({ where: { id: dto.templateId, deletedAt: null } });
    if (!template) {
      throw new NotFoundException({ code: 'template_not_found', message: `Content template ${dto.templateId} not found.` });
    }
    if (template.entityType !== entityKey) {
      throw new BadRequestException({
        code: 'template_entity_mismatch',
        message: `Template ${dto.templateId} is a '${template.entityType}' template and cannot be applied through the '${entityKey}' route.`,
      });
    }
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({ code: 'confirm_required', message: "Replace mode requires 'confirm: true' in the request body." });
    }
    if (mode === 'append' && !copier.supportsAppend) {
      throw new BadRequestException({ code: 'append_not_supported', message: `'${entityKey}' only supports replace mode.` });
    }

    const result = await this.prisma.$transaction((tx: unknown) =>
      copier.applyTemplate(tx as PrismaTx, template.payload as unknown as TemplatePayload, programId, mode),
    );

    // Same reasoning as copy() — see that method's comment on why this runs
    // after commit rather than relying solely on @CacheInvalidate.
    await invalidateLandingCacheByProgramId(programId, this.prisma, this.landingCacheInvalidation);

    return result;
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="program-copy.controller.spec"`
Expected: PASS — the original 8 Phase 1 tests plus 4 new ones, 12 total.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/dto/copy-entity.dto.ts src/modules/programs/presentation/program-copy.controller.ts src/modules/programs/presentation/program-copy.controller.spec.ts
git commit -m "feat(programs): add ProgramCopyController apply-template route"
```

---

## Task 17: `ProgramCopyController` — `registry` and `clone-from` routes (TDD)

**Files:**
- Modify: `services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts` (add `CloneFromProgramDto`, `CloneEntityInputDto`)
- Modify: `services/api/src/modules/programs/presentation/program-copy.controller.ts`
- Modify: `services/api/src/modules/programs/presentation/program-copy.controller.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopierRegistry.list` (Phase 1).
- Produces: `GET /programs/:programId/copy/registry` → `Array<{ key: string; label: string; supportsAppend: boolean; count: number }>`; `POST /programs/:id/clone-from` → `Record<string, CopyResult>` keyed by entity key. Task 22's `fetchCopyRegistry`/`postCloneFrom` and Task 31's `CloneOnCreateDialog` are the frontend callers.

`registry` is `:programId`-scoped because `count` is per-program — its one consumer is the clone-on-create checklist (Task 31), which always has a specific target program (the one just created) to ask "how much does the chosen source have of each entity?". It is **not** used by the content-templates management screen (Task 24): that screen has no program in context for its entity-type tabs, so it uses a small hardcoded `key`/`label` list matching the seven copiers' own `key`/`label` fields instead of calling this endpoint with an arbitrary program id. `clone-from` runs every selected copier's **existing `copy()`** — not `applyTemplate` — in one transaction; a copier that throws rolls back every other copier's writes in the same transaction, since they share one `$transaction` call.

- [ ] **Step 1: Add the DTOs**

Append to `services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts`:

```typescript
// Append to services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts
export class CloneEntityInputDto {
  @ApiProperty({ description: "A registered ProgramCopier.key, e.g. 'faqs'." })
  @IsString()
  key!: string;

  @ApiProperty({ enum: ['append', 'replace'] })
  @IsIn(['append', 'replace'])
  mode!: 'append' | 'replace';
}

export class CloneFromProgramDto {
  @ApiProperty({ description: 'Program to clone content FROM. Same-brand only is enforced by the frontend picker; the API only requires it to differ from the target.' })
  @IsUUID()
  sourceProgramId!: string;

  @ApiProperty({ type: [CloneEntityInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CloneEntityInputDto)
  entities!: CloneEntityInputDto[];

  @ApiPropertyOptional({ description: "Must be true if ANY entity in `entities` uses mode='replace'." })
  @IsOptional()
  @IsBoolean()
  confirmReplace?: boolean;
}
```

Add `IsString`, `ValidateNested` to the existing `class-validator` import and `Type` from `class-transformer` at the top of the file if not already present.

- [ ] **Step 2: Write the failing tests**

Append to `services/api/src/modules/programs/presentation/program-copy.controller.spec.ts`:

```typescript
// Append to services/api/src/modules/programs/presentation/program-copy.controller.spec.ts
describe('getRegistry', () => {
  it('returns key/label/supportsAppend/count for every registered copier against the given program', async () => {
    const faqsCountFor = jest.fn().mockResolvedValue(3);
    const timelinesCountFor = jest.fn().mockResolvedValue(0);
    (controller as any).registry.list = jest.fn().mockReturnValue([
      { key: 'faqs', label: 'FAQs', supportsAppend: true, countFor: faqsCountFor },
      { key: 'timelines', label: 'Timelines', supportsAppend: true, countFor: timelinesCountFor },
    ]);
    const result = await controller.getRegistry('src');
    expect(faqsCountFor).toHaveBeenCalledWith('src');
    expect(result).toEqual([
      { key: 'faqs', label: 'FAQs', supportsAppend: true, count: 3 },
      { key: 'timelines', label: 'Timelines', supportsAppend: true, count: 0 },
    ]);
  });
});

describe('cloneFrom', () => {
  it('rejects when sourceProgramId equals the target :id', async () => {
    await expect(
      controller.cloneFrom('prog-1', { sourceProgramId: 'prog-1', entities: [{ key: 'faqs', mode: 'append' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects when any entity requests replace without top-level confirmReplace: true', async () => {
    mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
    await expect(
      controller.cloneFrom('tgt', { sourceProgramId: 'src', entities: [{ key: 'faqs', mode: 'replace' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('rejects an entity requesting append on a copier that does not support it', async () => {
    mockRegistryGet.mockReturnValue({ supportsAppend: false, copy: jest.fn() });
    await expect(
      controller.cloneFrom('tgt', { sourceProgramId: 'src', entities: [{ key: 'program-details', mode: 'append' }] }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(mockPrismaTransaction).not.toHaveBeenCalled();
  });

  it('runs every selected copier\'s copy() inside ONE transaction and returns results keyed by entity key', async () => {
    const faqsCopy = jest.fn().mockResolvedValue({ created: 2, skipped: 0, replaced: 0 });
    const timelinesCopy = jest.fn().mockResolvedValue({ created: 1, skipped: 1, replaced: 0 });
    mockRegistryGet.mockImplementation((key: string) =>
      key === 'faqs' ? { supportsAppend: true, copy: faqsCopy } : { supportsAppend: true, copy: timelinesCopy },
    );
    mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

    const result = await controller.cloneFrom('tgt', {
      sourceProgramId: 'src',
      entities: [{ key: 'faqs', mode: 'append' }, { key: 'timelines', mode: 'append' }],
    });

    expect(faqsCopy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'append' });
    expect(timelinesCopy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'append' });
    expect(result).toEqual({ faqs: { created: 2, skipped: 0, replaced: 0 }, timelines: { created: 1, skipped: 1, replaced: 0 } });
    // Both copiers ran through the SAME $transaction call — a single commit
    // for the whole batch, not one per entity.
    expect(mockPrismaTransaction).toHaveBeenCalledTimes(1);
  });

  it('a copier throwing mid-batch propagates the error without swallowing it (so $transaction rolls everything back)', async () => {
    const faqsCopy = jest.fn().mockResolvedValue({ created: 1, skipped: 0, replaced: 0 });
    const timelinesCopy = jest.fn().mockRejectedValue(new Error('boom'));
    mockRegistryGet.mockImplementation((key: string) =>
      key === 'faqs' ? { supportsAppend: true, copy: faqsCopy } : { supportsAppend: true, copy: timelinesCopy },
    );
    mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

    await expect(
      controller.cloneFrom('tgt', { sourceProgramId: 'src', entities: [{ key: 'faqs', mode: 'append' }, { key: 'timelines', mode: 'append' }] }),
    ).rejects.toThrow('boom');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="program-copy.controller.spec"`
Expected: FAIL — `controller.getRegistry`/`controller.cloneFrom` do not exist yet.

- [ ] **Step 4: Add the routes**

Append to `services/api/src/modules/programs/presentation/program-copy.controller.ts` (inside the `ProgramCopyController` class, after `applyTemplate`; add `CloneFromProgramDto` to the existing DTO import):

```typescript
// Append inside ProgramCopyController, in services/api/src/modules/programs/presentation/program-copy.controller.ts
  @Get(':programId/copy/registry')
  @ApiOperation({ summary: 'List every registered copier with its label, append support, and item count for this program.' })
  async getRegistry(@Param('programId') programId: string): Promise<Array<{ key: string; label: string; supportsAppend: boolean; count: number }>> {
    const copiers = this.registry.list();
    const counts = await Promise.all(copiers.map((c) => c.countFor(programId)));
    return copiers.map((c, i) => ({ key: c.key, label: c.label, supportsAppend: c.supportsAppend, count: counts[i] }));
  }

  @Post(':id/clone-from')
  @ApiOperation({ summary: 'Clone selected content types from a sibling program into this one, in one transaction.' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async cloneFrom(@Param('id') id: string, @Body() dto: CloneFromProgramDto): Promise<Record<string, CopyResult>> {
    if (dto.sourceProgramId === id) {
      throw new BadRequestException({ code: 'invalid_source', message: 'Source program must differ from the target program.' });
    }

    const anyReplace = dto.entities.some((e) => e.mode === 'replace');
    if (anyReplace && dto.confirmReplace !== true) {
      throw new BadRequestException({ code: 'confirm_required', message: "One or more entities requests replace mode — 'confirmReplace: true' is required." });
    }

    for (const entity of dto.entities) {
      const copier = this.registry.get(entity.key);
      if (entity.mode === 'append' && !copier.supportsAppend) {
        throw new BadRequestException({ code: 'append_not_supported', message: `'${entity.key}' only supports replace mode.` });
      }
    }

    const results = await this.prisma.$transaction(async (tx: unknown) => {
      const entries: Array<[string, CopyResult]> = [];
      for (const entity of dto.entities) {
        const copier = this.registry.get(entity.key);
        const result = await copier.copy(tx as PrismaTx, {
          sourceProgramId: dto.sourceProgramId,
          targetProgramId: id,
          mode: entity.mode,
        });
        entries.push([entity.key, result]);
      }
      return Object.fromEntries(entries);
    });

    await invalidateLandingCacheByProgramId(id, this.prisma, this.landingCacheInvalidation);

    return results;
  }
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="program-copy.controller.spec"`
Expected: PASS — the 12 tests from Task 16 plus 6 new ones, 18 total.

- [ ] **Step 6: Verify the full programs suite and typecheck**

Run (from `services/api/`): `npx jest --testPathPattern="modules/programs"`
Expected: PASS.

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/dto/copy-entity.dto.ts src/modules/programs/presentation/program-copy.controller.ts src/modules/programs/presentation/program-copy.controller.spec.ts
git commit -m "feat(programs): add ProgramCopyController registry and clone-from routes"
```

---

## Task 18: Migrate `ApplicationFormTemplate` data into `ContentTemplate`, then delete the old model and its API surface

**Files:**
- Create: `prisma/migrations/20260824091000_backfill_content_template_from_form_templates/migration.sql`
- Create: `prisma/migrations/20260824092000_drop_application_form_template/migration.sql`
- Modify: `services/api/prisma/schema/applications.prisma` (remove `model ApplicationFormTemplate` and `model ApplicationFormTemplateField`)
- Modify: `services/api/src/modules/programs/presentation/program-form-fields.controller.ts` (remove the `apply-template` route and its two imports)
- Delete: `services/api/src/modules/programs/presentation/form-templates.controller.ts`
- Delete: `services/api/src/modules/programs/presentation/dto/form-template.dto.ts`, `dto/form-template.dto.spec.ts`
- Delete: `services/api/src/modules/programs/presentation/dto/apply-form-template.dto.ts`
- Delete: `services/api/src/modules/programs/application/commands/form-template.commands.ts`
- Delete: `services/api/src/modules/programs/application/commands/handlers/form-template.handler.ts`, `.spec.ts`
- Delete: `services/api/src/modules/programs/application/commands/apply-form-template.command.ts`
- Delete: `services/api/src/modules/programs/application/commands/handlers/apply-form-template.handler.ts`, `.spec.ts`
- Delete: `services/api/src/modules/programs/application/queries/get-form-templates.query.ts`
- Delete: `services/api/src/modules/programs/application/queries/handlers/get-form-templates.handler.ts`, `.spec.ts`

**Interfaces:**
- Produces: every existing `ApplicationFormTemplate` row present as a `ContentTemplate` row with `entityType: 'form-fields'`, same `id`/timestamps/`isDefault`/`createdBy` — Task 19's module wiring removes the now-dead providers; nothing downstream references `applicationFormTemplate` after this task.

This is Phase 2's load-bearing deletion, mirroring how Phase 1 Task 5 deleted the old `copy-fields-from-program.handler.ts` in the same task that introduced its replacement. Not TDD — it's a data migration plus a mechanical deletion sweep, verified by compile + the full existing suite, matching Phase 1 Task 4/12's precedent for non-logic changes. Both new migrations ship in the same deploy as this deletion (Prisma migrations run at deploy startup, before the new build's code executes), so there is no window where old code runs against a schema missing the tables it expects, unlike Phase 3's staged, publicly-observable migration — this is admin-only, internal data.

- [ ] **Step 1: Write the backfill migration**

```sql
-- prisma/migrations/20260824091000_backfill_content_template_from_form_templates/migration.sql

-- Why: one generic template store (content_templates, added in
-- 20260824090000_add_content_template) replaces application_form_templates /
-- application_form_template_fields. This copies every existing template
-- across losslessly — including whatever label_override/help_text_override
-- values already sit in the field rows, even though no UI has ever set a
-- non-null one — before the old tables are dropped
-- (20260824092000_drop_application_form_template). "order" is a reserved
-- word in Postgres and must stay quoted.
INSERT INTO "content_templates" (
    "id", "name", "description", "entity_type", "payload", "payload_version",
    "is_default", "created_by", "created_at", "updated_at", "deleted_at"
)
SELECT
    aft."id",
    aft."name",
    aft."description",
    'form-fields',
    jsonb_build_object(
        'entityType', 'form-fields',
        'payloadVersion', 1,
        'items', COALESCE(
            (
                SELECT jsonb_agg(
                    jsonb_build_object(
                        'source', aftf."source",
                        'systemFieldKey', aftf."system_field_key",
                        'name', aftf."name",
                        'label', aftf."label",
                        'type', aftf."type",
                        'placeholder', aftf."placeholder",
                        'helpText', aftf."help_text",
                        'options', aftf."options",
                        'validationRules', aftf."validation_rules",
                        'section', aftf."section",
                        'isRequired', aftf."is_required",
                        'order', aftf."order",
                        'labelOverride', aftf."label_override",
                        'helpTextOverride', aftf."help_text_override"
                    ) ORDER BY aftf."order"
                )
                FROM "application_form_template_fields" aftf
                WHERE aftf."template_id" = aft."id"
            ),
            '[]'::jsonb
        )
    ),
    1,
    aft."is_default",
    aft."created_by",
    aft."created_at",
    aft."updated_at",
    aft."deleted_at"
FROM "application_form_templates" aft;
```

- [ ] **Step 2: Write the drop migration**

```sql
-- prisma/migrations/20260824092000_drop_application_form_template/migration.sql

-- Why: application_form_template_fields / application_form_templates are
-- fully superseded by content_templates as of the previous migration in this
-- same deploy. Child table dropped first (FK to the parent).
DROP TABLE IF EXISTS "application_form_template_fields";
DROP TABLE IF EXISTS "application_form_templates";
```

- [ ] **Step 3: Remove the old models from the Prisma schema**

In `services/api/prisma/schema/applications.prisma`, delete `model ApplicationFormTemplate { ... }` and `model ApplicationFormTemplateField { ... }` in their entirety (the two models currently sitting right after `SystemFormFieldDefinition`).

- [ ] **Step 4: Remove the old `apply-template` route**

In `services/api/src/modules/programs/presentation/program-form-fields.controller.ts`, remove:

```typescript
import { ApplyFormTemplateCommand } from '../application/commands/apply-form-template.command';
import { ApplyFormTemplateDto } from './dto/apply-form-template.dto';
```

and the entire route method:

```typescript
  @Post(':programId/form-fields/apply-template')
  @ApiOperation({ summary: "Apply a form template to a program's fields (append or replace)." })
  applyTemplate(
    @Param('programId') programId: string,
    @Body() dto: ApplyFormTemplateDto,
  ) {
    const mode = dto.mode ?? 'append';
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({
        code: 'confirm_required',
        message: "Replace mode requires 'confirm: true' in the request body.",
      });
    }
    return this.commandBus.execute(
      new ApplyFormTemplateCommand(programId, dto.templateId, mode),
    );
  }
```

(Exact body may differ slightly from what's shown — remove whatever the live `@Post(':programId/form-fields/apply-template')` method actually contains; the route decorator and method name are load-bearing to identify it, the body is not.) The `copy-from-program` route on this same controller was already removed in Phase 1 Task 5 — after this step, `program-form-fields.controller.ts` should have no remaining POST routes beyond ordinary CRUD, since both copy paths now live on `ProgramCopyController`.

- [ ] **Step 5: Delete the superseded files**

```bash
cd services/api
git rm src/modules/programs/presentation/form-templates.controller.ts
git rm src/modules/programs/presentation/dto/form-template.dto.ts
git rm src/modules/programs/presentation/dto/form-template.dto.spec.ts
git rm src/modules/programs/presentation/dto/apply-form-template.dto.ts
git rm src/modules/programs/application/commands/form-template.commands.ts
git rm src/modules/programs/application/commands/handlers/form-template.handler.ts
git rm src/modules/programs/application/commands/handlers/form-template.handler.spec.ts
git rm src/modules/programs/application/commands/apply-form-template.command.ts
git rm src/modules/programs/application/commands/handlers/apply-form-template.handler.ts
git rm src/modules/programs/application/commands/handlers/apply-form-template.handler.spec.ts
git rm src/modules/programs/application/queries/get-form-templates.query.ts
git rm src/modules/programs/application/queries/handlers/get-form-templates.handler.ts
git rm src/modules/programs/application/queries/handlers/get-form-templates.handler.spec.ts
```

- [ ] **Step 6: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: **errors** — `programs.module.ts` still imports/registers `FormTemplatesController`, `CreateFormTemplateHandler`, `UpdateFormTemplateHandler`, `DeleteFormTemplateHandler`, `ApplyFormTemplateHandler`, `GetFormTemplatesHandler`, `GetFormTemplateByIdHandler`, all now deleted. This is expected and resolved by Task 19; do not patch `programs.module.ts` out of order here.

- [ ] **Step 7: Commit**

```bash
cd services/api
git add prisma/migrations/20260824091000_backfill_content_template_from_form_templates/migration.sql
git add prisma/migrations/20260824092000_drop_application_form_template/migration.sql
git add prisma/schema/applications.prisma src/modules/programs/presentation/program-form-fields.controller.ts
git commit -m "feat(programs): migrate ApplicationFormTemplate data into ContentTemplate, drop the old model and API surface"
```

---

## Task 19: `programs.module.ts` wiring — remove old template providers, register the new ones

**Files:**
- Modify: `services/api/src/modules/programs/programs.module.ts`

**Interfaces:**
- Consumes: `ContentTemplatesController` (Task 15); `CreateContentTemplateHandler`, `UpdateContentTemplateHandler`, `DeleteContentTemplateHandler` (Task 13); `GetContentTemplatesHandler`, `GetContentTemplateByIdHandler` (Task 14).
- Produces: a working DI graph with the old `FormTemplatesController`/template handlers fully removed and the new `ContentTemplatesController`/handlers registered — resolves every compile error left by Task 18.

Compile-verified, not TDD, matching Phase 1 Task 12's precedent — this wires already-tested classes into Nest's DI container.

- [ ] **Step 1: Replace the old template imports**

In `services/api/src/modules/programs/programs.module.ts`, remove:

```typescript
import { FormTemplatesController } from './presentation/form-templates.controller';
import {
  CreateFormTemplateHandler,
  UpdateFormTemplateHandler,
  DeleteFormTemplateHandler,
} from './application/commands/handlers/form-template.handler';
import { ApplyFormTemplateHandler } from './application/commands/handlers/apply-form-template.handler';
import {
  GetFormTemplatesHandler,
  GetFormTemplateByIdHandler,
} from './application/queries/handlers/get-form-templates.handler';
```

and add:

```typescript
import { ContentTemplatesController } from './presentation/content-templates.controller';
import {
  CreateContentTemplateHandler,
  UpdateContentTemplateHandler,
  DeleteContentTemplateHandler,
} from './application/commands/handlers/content-template.handler';
import {
  GetContentTemplatesHandler,
  GetContentTemplateByIdHandler,
} from './application/queries/handlers/get-content-templates.handler';
```

- [ ] **Step 2: Swap the controller**

In the `controllers` array, replace `FormTemplatesController` with `ContentTemplatesController` (same position, right before `ProgramFormFieldsController`):

```typescript
    SystemFormFieldsController,
    ContentTemplatesController,
    ProgramFormFieldsController,
```

- [ ] **Step 3: Swap the providers**

In the `providers` array, replace the "Form Template Handlers" block:

```typescript
    // Form Template Handlers
    CreateFormTemplateHandler,
    UpdateFormTemplateHandler,
    DeleteFormTemplateHandler,
    GetFormTemplatesHandler,
    GetFormTemplateByIdHandler,
    ApplyFormTemplateHandler,
```

with:

```typescript
    // Content Template Handlers
    CreateContentTemplateHandler,
    UpdateContentTemplateHandler,
    DeleteContentTemplateHandler,
    GetContentTemplatesHandler,
    GetContentTemplateByIdHandler,
```

`CreateContentTemplateHandler` additionally depends on `ProgramCopierRegistry`, which is already provided further down the same array (Phase 1 Task 12) — no new registration needed for it.

- [ ] **Step 4: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors — this resolves every "cannot find module" / "not a known provider" error left by Task 18.

- [ ] **Step 5: Run the full programs suite**

Run (from `services/api/`): `npx jest --testPathPattern="modules/programs"`
Expected: PASS.

- [ ] **Step 6: Confirm no stale references to the deleted template code remain**

Run (from the repo root, `ybb-platform/`):

```bash
grep -rn "ApplicationFormTemplate\|FormTemplatesController\|CreateFormTemplateHandler\|ApplyFormTemplateCommand\|ApplyFormTemplateHandler\|GetFormTemplatesHandler\|GetFormTemplateByIdHandler" services/api/src --include="*.ts"
```

Expected: no output.

- [ ] **Step 7: Commit**

```bash
cd services/api
git add src/modules/programs/programs.module.ts
git commit -m "feat(programs): wire ContentTemplatesController and handlers, remove the old form-template registrations"
```

---

## Task 20: Frontend `content-templates-api.ts` client

**Files:**
- Create: `services/admin-dashboard/app/components/shared/content-templates/content-templates-api.ts`

**Interfaces:**
- Consumes: `buildApiUrl`, `getAccessToken`, `readErrorMessage`, `readJsonData` from `@/app/components/submissionsMasterData/api` (same established shared HTTP-helper module Phase 1's `copy-api.ts` already reuses from outside its own folder).
- Produces: `ContentTemplateSummary`, `ContentTemplateDetail` types and `fetchContentTemplates`, `fetchContentTemplateDetail`, `createContentTemplateFromProgram`, `updateContentTemplate`, `deleteContentTemplate` — Task 24's management screen and Task 31's `CloneOnCreateDialog`-adjacent default-template fallback import these.

No FE test runner exists in this repo — verified by `tsc` only, matching Phase 1 Task 14's precedent.

- [ ] **Step 1: Write the client**

```typescript
// services/admin-dashboard/app/components/shared/content-templates/content-templates-api.ts
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";

export type ContentTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  entityType: string;
  isDefault: boolean;
  itemCount: number;
  createdAt: string;
  updatedAt: string;
};

export type ContentTemplateDetail = ContentTemplateSummary & {
  payload: { entityType: string; payloadVersion: number; items: Record<string, unknown>[] };
};

function authHeaders(): { Authorization: string } {
  const token = getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }
  return { Authorization: `Bearer ${token}` };
}

async function jsonOrThrow<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
  return readJsonData<T>(response);
}

/** Lists content templates, optionally filtered to one entity key (e.g. 'faqs'). */
export async function fetchContentTemplates(entityType?: string): Promise<ContentTemplateSummary[]> {
  const qs = entityType ? `?entityType=${encodeURIComponent(entityType)}` : "";
  const response = await fetch(buildApiUrl(`/content-templates${qs}`), { headers: authHeaders() });
  return jsonOrThrow<ContentTemplateSummary[]>(response);
}

/** Gets a single content template, including its full payload. */
export async function fetchContentTemplateDetail(id: string): Promise<ContentTemplateDetail> {
  const response = await fetch(buildApiUrl(`/content-templates/${encodeURIComponent(id)}`), { headers: authHeaders() });
  return jsonOrThrow<ContentTemplateDetail>(response);
}

/**
 * Creates a template by exporting `programId`'s current content for `entityType`
 * (optionally a subset via `itemIds`). The server derives the payload —
 * this never sends one.
 */
export async function createContentTemplateFromProgram(input: {
  entityType: string;
  programId: string;
  itemIds?: string[];
  name: string;
  description?: string;
  isDefault?: boolean;
}): Promise<ContentTemplateDetail> {
  const response = await fetch(buildApiUrl("/content-templates"), {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<ContentTemplateDetail>(response);
}

/** Updates name/description/isDefault only — the payload is immutable after creation. */
export async function updateContentTemplate(
  id: string,
  input: { name?: string; description?: string; isDefault?: boolean },
): Promise<ContentTemplateSummary> {
  const response = await fetch(buildApiUrl(`/content-templates/${encodeURIComponent(id)}`), {
    method: "PATCH",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return jsonOrThrow<ContentTemplateSummary>(response);
}

export async function deleteContentTemplate(id: string): Promise<void> {
  const response = await fetch(buildApiUrl(`/content-templates/${encodeURIComponent(id)}`), {
    method: "DELETE",
    headers: authHeaders(),
  });
  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors referencing `content-templates-api.ts`.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/shared/content-templates/content-templates-api.ts
git commit -m "feat(admin): add content-templates-api client"
```

---

## Task 21: Extend `copy-api.ts` with registry, apply-template, and clone-from clients

**Files:**
- Modify: `services/admin-dashboard/app/components/shared/copy-from-program/copy-api.ts`

**Interfaces:**
- Produces: `CopyRegistryEntry` type, `fetchCopyRegistry`, `postApplyTemplate`, `postCloneFrom` — Task 22's `CopyFromTemplateDialog` uses `postApplyTemplate`; Task 31's `CloneOnCreateDialog` uses `fetchCopyRegistry`/`postCloneFrom`.

- [ ] **Step 1: Append to the client**

```typescript
// Append to services/admin-dashboard/app/components/shared/copy-from-program/copy-api.ts
export type CopyRegistryEntry = {
  key: string;
  label: string;
  supportsAppend: boolean;
  count: number;
};

/** Every registered copier's key/label/supportsAppend/count against one program. */
export async function fetchCopyRegistry(programId: string): Promise<CopyRegistryEntry[]> {
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(programId)}/copy/registry`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<CopyRegistryEntry[]>(response);
}

/**
 * Applies a saved content template into `targetProgramId`. Mirrors
 * postCopyEntity's confirm-on-replace behavior.
 */
export async function postApplyTemplate(
  entityKey: string,
  targetProgramId: string,
  params: { templateId: string; mode: "append" | "replace" },
): Promise<CopyResult> {
  const body: Record<string, unknown> = { templateId: params.templateId, mode: params.mode };
  if (params.mode === "replace") {
    body.confirm = true;
  }
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(targetProgramId)}/copy/${encodeURIComponent(entityKey)}/apply-template`),
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<CopyResult>(response);
}

/** Runs every selected copier's copy() against targetProgramId in one transaction. */
export async function postCloneFrom(
  targetProgramId: string,
  params: { sourceProgramId: string; entities: Array<{ key: string; mode: "append" | "replace" }> },
): Promise<Record<string, CopyResult>> {
  const body: Record<string, unknown> = { sourceProgramId: params.sourceProgramId, entities: params.entities };
  if (params.entities.some((e) => e.mode === "replace")) {
    body.confirmReplace = true;
  }
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(targetProgramId)}/clone-from`),
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<Record<string, CopyResult>>(response);
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/shared/copy-from-program/copy-api.ts
git commit -m "feat(admin): add registry/apply-template/clone-from clients to copy-api"
```

---

## Task 22: Extract the generic `CopyFromTemplateDialog` shell

**Files:**
- Create: `services/admin-dashboard/app/components/shared/copy-from-program/CopyFromTemplateDialog.tsx`

**Interfaces:**
- Consumes: `fetchContentTemplates` (Task 20); `postApplyTemplate` (Task 21); `CopyResult` (Phase 1, `copy-api.ts`).
- Produces: `CopyFromTemplateDialog` React component with props `{ open, entityKey, entityLabel, programId, supportsAppend, onClose, onApplied }` — Task 23 through Task 30 all import this exact component and prop shape.

The existing `submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx` (being deleted in Task 23) is real, working code for one entity — this extracts its shell, parameterized by `entityKey`/`entityLabel`, exactly as Phase 1 Task 15 extracted `CopyFromProgramDialog` from its form-fields-only original. One deliberate simplification versus that extraction: `ProgramCopier.applyTemplate` has no `itemIds` parameter (per the spec's interface — templates apply as a whole), and `ContentTemplateSummary`'s `itemCount` is the only uniformly-shaped piece of information every entity type's payload can report (a form-fields template's items don't even all share a `label` field — see Task 6's Global Constraints on thin system-sourced items). So unlike `CopyFromProgramDialog`, this dialog lists templates by name/description/item-count, not a per-item checkbox list — there is nothing generic to show per item.

- [ ] **Step 1: Create the component**

```tsx
// services/admin-dashboard/app/components/shared/copy-from-program/CopyFromTemplateDialog.tsx
"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import {
  fetchContentTemplates,
  type ContentTemplateSummary,
} from "@/app/components/shared/content-templates/content-templates-api";
import { postApplyTemplate, type CopyResult } from "./copy-api";

interface CopyFromTemplateDialogProps {
  open: boolean;
  entityKey: string;
  entityLabel: string;
  programId: string;
  /** Hides the append/replace toggle and forces mode='replace' when false (e.g. program-details). */
  supportsAppend: boolean;
  onClose: () => void;
  onApplied: (result: CopyResult) => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CopyFromTemplateDialog({
  open,
  entityKey,
  entityLabel,
  programId,
  supportsAppend,
  onClose,
  onApplied,
}: CopyFromTemplateDialogProps) {
  const [templates, setTemplates] = useState<ContentTemplateSummary[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">(supportsAppend ? "append" : "replace");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    if (!open) return;
    setSelectedId(null);
    setTemplates([]);
    setMode(supportsAppend ? "append" : "replace");
    setConfirmText("");
    setListError(null);
    setLoadingList(true);
    fetchContentTemplates(entityKey)
      .then((rows) => setTemplates(rows))
      .catch((err) => setListError(err instanceof Error ? err.message : "Failed to load templates"))
      .finally(() => setLoadingList(false));
  }, [open, entityKey, supportsAppend]);

  const selectedTemplate = templates.find((t) => t.id === selectedId) ?? null;
  const replaceConfirmed = mode !== "replace" || confirmText.trim().toUpperCase() === "REPLACE";
  const canApply = !!selectedId && replaceConfirmed && !applying;

  async function handleApply() {
    if (!selectedId) return;
    setApplying(true);
    try {
      const result = await postApplyTemplate(entityKey, programId, { templateId: selectedId, mode });
      toast.success(
        result.skipped > 0
          ? `Applied "${selectedTemplate?.name}" — added ${result.created}, skipped ${result.skipped} duplicate(s).`
          : `Applied "${selectedTemplate?.name}".`,
      );
      onApplied(result);
      onClose();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to apply ${entityLabel.toLowerCase()} template`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Copy from template</SheetTitle>
          <SheetDescription>Apply a saved {entityLabel.toLowerCase()} template to this program.</SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          {loadingList && <p className="text-xs text-zinc-500">Loading templates…</p>}
          {listError && <p className="text-sm text-rose-600">{listError}</p>}

          {!loadingList && !listError && templates.length === 0 && (
            <p className="text-xs text-zinc-500">No {entityLabel.toLowerCase()} templates exist yet.</p>
          )}

          {!loadingList && !listError && templates.length > 0 && (
            <ul className="space-y-2">
              {templates.map((t) => (
                <li key={t.id}>
                  <label
                    className={
                      selectedId === t.id
                        ? "flex cursor-pointer flex-col gap-1 rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-3"
                        : "flex cursor-pointer flex-col gap-1 rounded-lg border border-zinc-200 bg-white px-3 py-3 hover:border-zinc-300"
                    }
                  >
                    <span className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="content-template"
                        checked={selectedId === t.id}
                        onChange={() => setSelectedId(t.id)}
                      />
                      <span className="text-sm font-semibold text-zinc-900">{t.name}</span>
                      {t.isDefault && (
                        <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                          Default
                        </span>
                      )}
                    </span>
                    {t.description && <span className="pl-6 text-xs text-zinc-500">{t.description}</span>}
                    <span className="pl-6 text-[11px] text-zinc-400">{t.itemCount} item(s)</span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {supportsAppend && selectedId && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">Mode</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setMode("append")}
                  className={
                    mode === "append"
                      ? "rounded-lg border-2 border-blue-500 bg-blue-50 px-3 py-3 text-left"
                      : "rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:border-zinc-300"
                  }
                >
                  <div className="text-sm font-semibold text-zinc-900">Append</div>
                  <p className="mt-1 text-xs text-zinc-500">Add the template's items; skip any whose key already exists.</p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("replace")}
                  className={
                    mode === "replace"
                      ? "rounded-lg border-2 border-rose-500 bg-rose-50 px-3 py-3 text-left"
                      : "rounded-lg border border-zinc-200 bg-white px-3 py-3 text-left hover:border-zinc-300"
                  }
                >
                  <div className="text-sm font-semibold text-rose-700">Replace</div>
                  <p className="mt-1 text-xs text-rose-600">
                    Remove this program&apos;s current {entityLabel.toLowerCase()} first, then apply. Destructive.
                  </p>
                </button>
              </div>
            </section>
          )}

          {mode === "replace" && selectedId && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="mb-2 text-xs text-rose-700">
                This will soft-delete this program&apos;s current {entityLabel.toLowerCase()}. Type <strong>REPLACE</strong> to
                confirm.
              </p>
              <input
                type="text"
                aria-label="Type REPLACE to confirm replacing all items"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="Type REPLACE"
                className={INPUT_CLS}
              />
            </div>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply}
            className={
              mode === "replace"
                ? "rounded-md border border-rose-500 bg-rose-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-rose-600 disabled:opacity-50"
                : "rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
            }
          >
            {applying ? "Applying…" : mode === "replace" ? "Replace" : "Apply"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors referencing `CopyFromTemplateDialog.tsx`.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/shared/copy-from-program/CopyFromTemplateDialog.tsx
git commit -m "feat(admin): extract generic CopyFromTemplateDialog shell"
```

---

## Task 23: Re-point Submission Form Fields' "Copy from template" at the shared dialog

**Files:**
- Delete: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx`
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/catalog-api.ts` (remove the template-only exports, lines documented in Step 2 below; keep `fetchSystemFormFields`, `createSystemFormField`, `updateSystemFormField`, `deleteSystemFormField` and their types, which are unrelated system-field-catalog CRUD, not templates)
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).
- Produces: the Submission Form Fields surface now uses the generic dialog — proves the abstraction before Tasks 25-30 wire it onto the other six surfaces, mirroring Phase 1 Task 16's role for `CopyFromProgramDialog`.

- [ ] **Step 1: Delete the old form-fields-specific dialog**

```bash
cd services/admin-dashboard
git rm app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx
```

- [ ] **Step 2: Remove the template-only exports from `catalog-api.ts`**

In `services/admin-dashboard/app/components/submissionsMasterData/form-fields/catalog-api.ts`, remove these exports (all superseded by `content-templates-api.ts` + `copy-api.ts`'s `postApplyTemplate`): the `FormTemplateSummary`, `FormTemplateField`, `FormTemplateDetail`, `ApplyTemplateResult`, `CreateFormTemplateFieldInput`, `CreateFormTemplateInput`, `UpdateFormTemplateInput` types, and the `fetchFormTemplates`, `fetchFormTemplateDetail`, `applyTemplateToProgram`, `createFormTemplate`, `updateFormTemplate`, `deleteFormTemplate` functions (the entire "Template mutations" section at the bottom of the file, plus the earlier `fetchFormTemplateDetail`/`applyTemplateToProgram` pair and their types near the top). Everything under "Catalog mutations (super-admin only)" (`SystemFormField`, `CreateSystemFormFieldInput`, `UpdateSystemFormFieldInput`, `fetchSystemFormFields`, `createSystemFormField`, `updateSystemFormField`, `deleteSystemFormField`) stays untouched — it's the system-field catalog, unrelated to templates.

- [ ] **Step 3: Re-point `FormFieldsTable.tsx`**

Replace the import at line 21:

```typescript
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

Replace the `<CopyFromTemplateDialog>` element (currently lines 416-424):

```tsx
      <CopyFromTemplateDialog
        open={copyTemplateOpen}
        entityKey="form-fields"
        entityLabel="Application Form Fields"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyTemplateOpen(false)}
        onApplied={() => {
          setCopyTemplateOpen(false);
          void loadFields();
        }}
      />
```

The `<CopyFromProgramDialog>` element right after it (Phase 1's, currently lines 425-438) is untouched.

- [ ] **Step 4: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors. In particular, no dangling references to the deleted `submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx` or the removed `catalog-api.ts` template exports.

- [ ] **Step 5: Commit**

```bash
cd services/admin-dashboard
git add app/components/submissionsMasterData/form-fields/catalog-api.ts app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx
git rm app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx 2>/dev/null || true
git commit -m "refactor(admin): re-point Submission Form Fields at the shared CopyFromTemplateDialog"
```

---

## Task 24: Generic `/platform/content-templates` management screen

**Files:**
- Create: `services/admin-dashboard/app/platform/content-templates/page.tsx`
- Create: `services/admin-dashboard/app/components/shared/content-templates/CreateTemplateFromProgramDialog.tsx`
- Create: `services/admin-dashboard/app/components/shared/content-templates/ContentTemplateDetailDrawer.tsx`
- Delete: `services/admin-dashboard/app/platform/form-templates/` (`page.tsx`, `TemplateFormModal.tsx`, `TemplateDetailDrawer.tsx`)

**Interfaces:**
- Consumes: `fetchContentTemplates`, `updateContentTemplate`, `deleteContentTemplate`, `fetchContentTemplateDetail`, `createContentTemplateFromProgram` (Task 20); `fetchCopyPreview`, `fetchCopySourceCounts` (Phase 1, `copy-api.ts` — reused here for the "create from program" item picker, exactly as `CopyFromProgramDialog` already uses them).
- Produces: `/platform/content-templates`, replacing the currently-unlinked `/platform/form-templates`.

Entity-type tabs are a small hardcoded list matching the seven copiers' `key`/`label` (see Task 17's note on why the `registry` endpoint isn't used here — it needs a `:programId` this screen doesn't have). "Create from program" reuses Phase 1's existing preview/counts endpoints for its source-program-and-item picker rather than inventing a second one — the only new call is the final `createContentTemplateFromProgram`.

- [ ] **Step 1: Create the detail drawer**

```tsx
// services/admin-dashboard/app/components/shared/content-templates/ContentTemplateDetailDrawer.tsx
"use client";

import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { fetchContentTemplateDetail, type ContentTemplateDetail } from "./content-templates-api";

interface Props {
  open: boolean;
  templateId: string | null;
  onClose: () => void;
}

export function ContentTemplateDetailDrawer({ open, templateId, onClose }: Props) {
  const [detail, setDetail] = useState<ContentTemplateDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !templateId) {
      setDetail(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetchContentTemplateDetail(templateId)
      .then(setDetail)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load template"))
      .finally(() => setLoading(false));
  }, [open, templateId]);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>{detail?.name ?? "Template"}</SheetTitle>
          <SheetDescription>
            {detail ? `${detail.entityType} · ${detail.itemCount} item(s) · payload v${detail.payload.payloadVersion}` : "Loading…"}
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-4 px-6 py-6">
          {loading && <p className="text-xs text-zinc-500">Loading…</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {detail && (
            <pre className="max-h-[60vh] overflow-auto rounded-md border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-700">
              {JSON.stringify(detail.payload.items, null, 2)}
            </pre>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

The raw-JSON payload view is deliberate: item shape differs per `entityType` (Task 22's Interfaces note), so a single generic drawer that works for all seven types can't render a bespoke per-field layout without either per-entityType branching (real scope, not asked for) or this — an honest, always-correct fallback.

- [ ] **Step 2: Create the "create from program" dialog**

```tsx
// services/admin-dashboard/app/components/shared/content-templates/CreateTemplateFromProgramDialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { useAuth } from "@/app/contexts/AuthContext";
import { fetchCopyPreview, type CopyPreviewItem } from "@/app/components/shared/copy-from-program/copy-api";
import { createContentTemplateFromProgram } from "./content-templates-api";

interface Props {
  open: boolean;
  entityKey: string;
  entityLabel: string;
  onClose: () => void;
  onCreated: () => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CreateTemplateFromProgramDialog({ open, entityKey, entityLabel, onClose, onCreated }: Props) {
  const { accessiblePrograms } = useAuth();
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [items, setItems] = useState<CopyPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isDefault, setIsDefault] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sortedPrograms = useMemo(
    () =>
      [...accessiblePrograms].sort((a, b) =>
        a.brandName === b.brandName ? b.programYear - a.programYear : a.brandName.localeCompare(b.brandName),
      ),
    [accessiblePrograms],
  );

  useEffect(() => {
    if (!open) return;
    setSourceId(null);
    setItems([]);
    setSelectedIds(new Set());
    setName("");
    setDescription("");
    setIsDefault(false);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!sourceId) {
      setItems([]);
      setSelectedIds(new Set());
      return;
    }
    setLoadingItems(true);
    fetchCopyPreview(entityKey, sourceId)
      .then((rows) => {
        setItems(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load items"))
      .finally(() => setLoadingItems(false));
  }, [entityKey, sourceId]);

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const canSave = !!sourceId && name.trim().length > 0 && selectedIds.size > 0 && !saving;

  async function handleSave() {
    if (!sourceId) return;
    setSaving(true);
    setError(null);
    try {
      const itemIds = selectedIds.size === items.length ? undefined : Array.from(selectedIds);
      await createContentTemplateFromProgram({
        entityType: entityKey,
        programId: sourceId,
        itemIds,
        name: name.trim(),
        description: description.trim() || undefined,
        isDefault,
      });
      toast.success(`Created "${name.trim()}"`);
      onCreated();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to create template";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !saving && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>New {entityLabel} template</SheetTitle>
          <SheetDescription>Export a program's current {entityLabel.toLowerCase()} into a reusable template.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 py-6">
          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Name</label>
            <input className={INPUT_CLS} value={name} onChange={(e) => setName(e.target.value)} placeholder="Template name" />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Description</label>
            <input className={INPUT_CLS} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} />
            Set as default {entityLabel.toLowerCase()} template
          </label>

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Source program</label>
            <select className={INPUT_CLS} value={sourceId ?? ""} onChange={(e) => setSourceId(e.target.value || null)}>
              <option value="">Select a program…</option>
              {sortedPrograms.map((p) => (
                <option key={p.programId} value={p.programId}>
                  {p.programName} · {p.brandName} · {p.programYear}
                </option>
              ))}
            </select>
          </div>

          {loadingItems && <p className="text-xs text-zinc-500">Loading {entityLabel.toLowerCase()}…</p>}
          {!loadingItems && items.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
              {items.map((item) => (
                <li key={item.id}>
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50">
                    <input type="checkbox" checked={selectedIds.has(item.id)} onChange={() => toggleOne(item.id)} />
                    <span className="text-sm text-zinc-800">{item.label}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
          {!loadingItems && sourceId && items.length === 0 && (
            <p className="text-xs text-zinc-500">This program has no {entityLabel.toLowerCase()} to export.</p>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={!canSave}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            {saving ? "Creating…" : "Create Template"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 3: Create the management page**

```tsx
// services/admin-dashboard/app/platform/content-templates/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { PlusIcon, TrashIcon, EyeIcon, StarIcon } from "@heroicons/react/24/outline";
import { toast } from "sonner";
import {
  fetchContentTemplates,
  deleteContentTemplate,
  updateContentTemplate,
  type ContentTemplateSummary,
} from "@/app/components/shared/content-templates/content-templates-api";
import { CreateTemplateFromProgramDialog } from "@/app/components/shared/content-templates/CreateTemplateFromProgramDialog";
import { ContentTemplateDetailDrawer } from "@/app/components/shared/content-templates/ContentTemplateDetailDrawer";

// Matches the seven registered ProgramCopier key/label pairs exactly
// (form-fields.copier.ts, participation-categories.copier.ts, etc.) — not
// fetched from the registry endpoint, which is :programId-scoped and has no
// natural program to call it against on this screen (see Task 17's note).
const ENTITY_TYPES = [
  { key: "form-fields", label: "Application Form Fields" },
  { key: "participation-categories", label: "Participation Categories" },
  { key: "timelines", label: "Timelines" },
  { key: "rundowns", label: "Program Rundowns" },
  { key: "faqs", label: "FAQs" },
  { key: "payments", label: "Payment Options" },
  { key: "program-details", label: "Participant-Facing Content" },
] as const;

export default function ContentTemplatesPage() {
  const [activeKey, setActiveKey] = useState<string>(ENTITY_TYPES[0].key);
  const [templates, setTemplates] = useState<ContentTemplateSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const activeLabel = ENTITY_TYPES.find((e) => e.key === activeKey)?.label ?? activeKey;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await fetchContentTemplates(activeKey);
      setTemplates(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  }, [activeKey]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete(t: ContentTemplateSummary) {
    if (!window.confirm(`Delete "${t.name}"? This cannot be undone via the UI.`)) return;
    try {
      await deleteContentTemplate(t.id);
      toast.success(`Deleted "${t.name}"`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function handleSetDefault(t: ContentTemplateSummary) {
    try {
      await updateContentTemplate(t.id, { isDefault: true });
      toast.success(`"${t.name}" is now the default ${activeLabel.toLowerCase()} template`);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to set default");
    }
  }

  return (
    <section className="mx-auto max-w-5xl space-y-6 p-6">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-bold text-zinc-900">Content Templates</h1>
          <p className="text-sm text-zinc-500">Reusable content sets that admins can apply to any program.</p>
        </div>
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-600"
        >
          <PlusIcon className="h-4 w-4" />
          <span>New Template</span>
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-zinc-200 pb-2">
        {ENTITY_TYPES.map((e) => (
          <button
            key={e.key}
            type="button"
            onClick={() => setActiveKey(e.key)}
            className={
              activeKey === e.key
                ? "rounded-md bg-blue-500 px-3 py-1.5 text-xs font-semibold text-white"
                : "rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-600 hover:bg-zinc-200"
            }
          >
            {e.label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {!loading && templates.length === 0 && <p className="text-sm text-zinc-500">No {activeLabel.toLowerCase()} templates yet.</p>}

      {!loading && templates.length > 0 && (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50/70 text-xs uppercase tracking-wider text-zinc-500">
                <th className="px-4 py-2 font-semibold">Name</th>
                <th className="px-4 py-2 font-semibold">Items</th>
                <th className="px-4 py-2 font-semibold">Default?</th>
                <th className="px-4 py-2 text-right font-semibold">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 bg-white">
              {templates.map((t) => (
                <tr key={t.id} className="hover:bg-zinc-50/50">
                  <td className="px-4 py-2">
                    <div className="font-medium text-zinc-900">{t.name}</div>
                    {t.description && <div className="text-xs text-zinc-500">{t.description}</div>}
                  </td>
                  <td className="px-4 py-2 text-zinc-600">{t.itemCount}</td>
                  <td className="px-4 py-2">
                    {t.isDefault ? (
                      <span className="rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-emerald-700">
                        Default
                      </span>
                    ) : (
                      <span className="text-[10px] text-zinc-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-2 text-right">
                    <div className="inline-flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setDetailId(t.id)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-blue-50 text-blue-600 hover:bg-blue-100"
                        title="View"
                      >
                        <EyeIcon className="h-4 w-4" />
                      </button>
                      {!t.isDefault && (
                        <button
                          type="button"
                          onClick={() => void handleSetDefault(t)}
                          className="flex h-7 w-7 items-center justify-center rounded-md bg-amber-50 text-amber-600 hover:bg-amber-100"
                          title="Set as default"
                        >
                          <StarIcon className="h-4 w-4" />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(t)}
                        className="flex h-7 w-7 items-center justify-center rounded-md bg-rose-50 text-rose-600 hover:bg-rose-100"
                        title="Delete"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CreateTemplateFromProgramDialog
        open={createOpen}
        entityKey={activeKey}
        entityLabel={activeLabel}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void load()}
      />
      <ContentTemplateDetailDrawer open={detailId !== null} templateId={detailId} onClose={() => setDetailId(null)} />
    </section>
  );
}
```

- [ ] **Step 4: Delete the old screen**

```bash
cd services/admin-dashboard
git rm -r app/platform/form-templates
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors. In particular, no dangling references to the deleted `app/platform/form-templates/` directory.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add app/platform/content-templates/page.tsx app/components/shared/content-templates/CreateTemplateFromProgramDialog.tsx app/components/shared/content-templates/ContentTemplateDetailDrawer.tsx
git commit -m "feat(admin): add generic /platform/content-templates screen, remove /platform/form-templates"
```

---

## Task 25: "Copy from template" on Participation Categories

**Files:**
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/categories/ParticipationCategoriesTable.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).

- [ ] **Step 1: Add the import**

After the existing import at line 15:

```typescript
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

- [ ] **Step 2: Add open-state**

Next to `const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);` (line 222):

```typescript
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Right after the existing "Copy from program" button closes (line 402, `</button>`), before `openCreateModal`'s button:

```tsx
          <button
            type="button"
            onClick={() => setCopyFromTemplateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from template</span>
          </button>
```

- [ ] **Step 4: Add the dialog**

Right after the `<CopyFromProgramDialog ... />` element (lines 498-509):

```tsx
      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="participation-categories"
        entityLabel="Participation Categories"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          void loadCategories();
        }}
      />
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add app/components/submissionsMasterData/categories/ParticipationCategoriesTable.tsx
git commit -m "feat(admin): add Copy from template to Participation Categories"
```

---

## Task 26: "Copy from template" on Timelines

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/timelines/page.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).

- [ ] **Step 1: Add the import**

After line 26:

```typescript
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

- [ ] **Step 2: Add open-state**

Next to `const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);` (line 43):

```typescript
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Right after the existing "Copy from program" button closes (line 109, `</button>`), before the "Add" button:

```tsx
            <button
              type="button"
              onClick={() => setCopyFromTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from template</span>
            </button>
```

- [ ] **Step 4: Add the dialog**

Right after the `<CopyFromProgramDialog ... />` element (lines 196-207):

```tsx
      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="timelines"
        entityLabel="Timelines"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          fetch();
        }}
      />
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add "app/programs/[programId]/master-data/timelines/page.tsx"
git commit -m "feat(admin): add Copy from template to Timelines"
```

---

## Task 27: "Copy from template" on FAQs

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/faqs/page.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).

- [ ] **Step 1: Add the import**

After line 25:

```typescript
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

- [ ] **Step 2: Add open-state**

Next to `const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);` (line 52):

```typescript
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Right after the existing "Copy from program" button closes (line 121, `</button>`), before the "Add FAQ" button:

```tsx
            <button
              type="button"
              onClick={() => setCopyFromTemplateOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from template</span>
            </button>
```

- [ ] **Step 4: Add the dialog**

Right after the `<CopyFromProgramDialog ... />` element (lines 219-230):

```tsx
      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="faqs"
        entityLabel="FAQs"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          load();
        }}
      />
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add "app/programs/[programId]/master-data/faqs/page.tsx"
git commit -m "feat(admin): add Copy from template to FAQs"
```

---

## Task 28: "Copy from template" on Program Rundowns

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/program-rundowns/page.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).

- [ ] **Step 1: Add the import**

After line 25:

```typescript
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

- [ ] **Step 2: Add open-state**

Next to `const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);` (line 43):

```typescript
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Right after the existing "Copy from program" button closes (line 135, `</button>`), before the "Add Session" button:

```tsx
              <button
                type="button"
                onClick={() => setCopyFromTemplateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                <span>Copy from template</span>
              </button>
```

- [ ] **Step 4: Add the dialog**

Right after the `<CopyFromProgramDialog ... />` element (lines 262-273):

```tsx
      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="rundowns"
        entityLabel="Program Rundowns"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          fetch();
        }}
      />
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add "app/programs/[programId]/master-data/program-rundowns/page.tsx"
git commit -m "feat(admin): add Copy from template to Program Rundowns"
```

---

## Task 29: "Copy from template" on Payment Options

**Files:**
- Modify: `services/admin-dashboard/app/components/programPaymentsMasterData/options/PaymentOptionTable.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).

- [ ] **Step 1: Add the import**

After line 12:

```typescript
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

- [ ] **Step 2: Add open-state**

Next to `const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);` (line 49):

```typescript
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Right after the existing "Copy from program" button closes (line 64, `</button>`), before `<AddPaymentOptionAction .../>`:

```tsx
          <button
            type="button"
            onClick={() => setCopyFromTemplateOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from template</span>
          </button>
```

- [ ] **Step 4: Add the dialog**

Right after the `<CopyFromProgramDialog ... />` element (lines 180-191). Note this file uses `programId`, not `resolvedProgramId`, unlike the other five surfaces:

```tsx
        <CopyFromTemplateDialog
          open={copyFromTemplateOpen}
          entityKey="payments"
          entityLabel="Payment Options"
          programId={programId}
          supportsAppend
          onClose={() => setCopyFromTemplateOpen(false)}
          onApplied={() => {
            setCopyFromTemplateOpen(false);
            onRefresh?.();
          }}
        />
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add app/components/programPaymentsMasterData/options/PaymentOptionTable.tsx
git commit -m "feat(admin): add Copy from template to Payment Options"
```

---

## Task 30: "Copy from template" on Program Details (Participant-Facing Content)

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/program-details/page.tsx`

**Interfaces:**
- Consumes: `CopyFromTemplateDialog` (Task 22).

`supportsAppend={false}` here, matching the existing `CopyFromProgramDialog` usage on this same surface — `program-details` is replace-only.

- [ ] **Step 1: Add the import**

After line 28:

```typescript
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
import { CopyFromTemplateDialog } from "@/app/components/shared/copy-from-program/CopyFromTemplateDialog";
```

- [ ] **Step 2: Add open-state**

Next to `const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);` (line 282):

```typescript
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
const [copyFromTemplateOpen, setCopyFromTemplateOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Right after the existing "Copy from program" button closes (line 535, `</button>`), before `<EditSpecificsAction .../>`:

```tsx
              <button
                type="button"
                onClick={() => setCopyFromTemplateOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                <span>Copy from template</span>
              </button>
```

- [ ] **Step 4: Add the dialog**

Right after the `<CopyFromProgramDialog ... />` element (lines 570-581):

```tsx
      <CopyFromTemplateDialog
        open={copyFromTemplateOpen}
        entityKey="program-details"
        entityLabel="Participant-Facing Content"
        programId={resolvedProgramId}
        supportsAppend={false}
        onClose={() => setCopyFromTemplateOpen(false)}
        onApplied={() => {
          setCopyFromTemplateOpen(false);
          void refreshProgramDetail();
        }}
      />
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add "app/programs/[programId]/master-data/program-details/page.tsx"
git commit -m "feat(admin): add Copy from template to Program Details"
```

---

## Task 31: Clone-on-create checklist

**Files:**
- Create: `services/admin-dashboard/app/platform/components/programs/CloneOnCreateDialog.tsx`
- Modify: `services/admin-dashboard/app/platform/programs/page.tsx`

**Interfaces:**
- Consumes: `fetchCopyRegistry`, `postCloneFrom`, `CopyRegistryEntry` (Task 21).
- Produces: a checklist shown after creating a program into a brand that already has another program; brands with no existing programs keep the pre-existing `offerDefaultTemplate` `window.confirm` prompt unchanged, since there's nothing to clone from.

**Design decision — per-entity default mode.** The spec says clone-on-create "defaults to all checked, append mode," but `program-details` has `supportsAppend: false` — it only ever accepts `mode: 'replace'` (Task 12), both in `copy()` and `applyTemplate()`. Defaulting it to `'append'` would make every clone-on-create batch that includes it fail its `append_not_supported` gate. This dialog resolves the tension the spec's prose doesn't address: each entity defaults to `'append'` when `supportsAppend` is true, and to `'replace'` when it's false — "append where append is even a valid choice" is the only reading of "append is the safer default" that is actually satisfiable. Because the target program is guaranteed brand-new (this dialog only ever runs immediately after a `POST /programs` that just succeeded), a `program-details` replace against it is harmless — there is nothing on the target to lose — so `postCloneFrom` (Task 21) auto-sets `confirmReplace: true` whenever any selected entity resolves to replace mode, with no separate typed-REPLACE UI step here (unlike every single-surface replace flow elsewhere in this feature, which does require typing REPLACE). This is safe specifically because the target is always empty; it would not be safe to apply the same auto-confirm to the single-surface `CopyFromProgramDialog`/`CopyFromTemplateDialog`, which both still require the typed confirmation.

- [ ] **Step 1: Create the dialog**

```tsx
// services/admin-dashboard/app/platform/components/programs/CloneOnCreateDialog.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/src/ui/sheet";
import { fetchCopyRegistry, postCloneFrom, type CopyRegistryEntry } from "@/app/components/shared/copy-from-program/copy-api";

interface Props {
  open: boolean;
  /** The just-created program to clone content INTO. */
  newProgramId: string;
  /** Other programs in the same brand, most recent first. */
  sourcePrograms: Array<{ id: string; name: string; year: number }>;
  onClose: () => void;
  onDone: () => void;
}

export function CloneOnCreateDialog({ open, newProgramId, sourcePrograms, onClose, onDone }: Props) {
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [entries, setEntries] = useState<CopyRegistryEntry[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sorted = useMemo(() => [...sourcePrograms].sort((a, b) => b.year - a.year), [sourcePrograms]);

  useEffect(() => {
    if (!open) return;
    setSourceId(sorted[0]?.id ?? null);
    setEntries([]);
    setChecked(new Set());
    setError(null);
  }, [open, sorted]);

  useEffect(() => {
    if (!sourceId) {
      setEntries([]);
      return;
    }
    setLoading(true);
    fetchCopyRegistry(sourceId)
      .then((rows) => {
        setEntries(rows);
        // Default-checked: every copier with at least one item to clone.
        setChecked(new Set(rows.filter((r) => r.count > 0).map((r) => r.key)));
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load content counts"))
      .finally(() => setLoading(false));
  }, [sourceId]);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const canApply = !!sourceId && checked.size > 0 && !applying;

  async function handleApply() {
    if (!sourceId) return;
    setApplying(true);
    setError(null);
    try {
      const entities = entries
        .filter((e) => checked.has(e.key))
        // supportsAppend:false entities (program-details) can only ever run
        // as replace — see this task's Design decision note above.
        .map((e) => ({ key: e.key, mode: (e.supportsAppend ? "append" : "replace") as "append" | "replace" }));
      const results = await postCloneFrom(newProgramId, { sourceProgramId: sourceId, entities });
      const totalCreated = Object.values(results).reduce((sum, r) => sum + r.created, 0);
      toast.success(`Cloned ${entities.length} content type(s) — ${totalCreated} item(s) created.`);
      onDone();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to clone content";
      setError(message);
      toast.error(message);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Clone content from another program?</SheetTitle>
          <SheetDescription>This brand already has other programs — copy their content into the new one, or skip and start empty.</SheetDescription>
        </SheetHeader>

        <div className="space-y-4 px-6 py-6">
          {error && <p className="text-sm text-rose-600">{error}</p>}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wider text-zinc-500">Source program</label>
            <select
              className="block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(e.target.value || null)}
            >
              {sorted.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.year}
                </option>
              ))}
            </select>
          </div>

          {loading && <p className="text-xs text-zinc-500">Loading content counts…</p>}

          {!loading && entries.length > 0 && (
            <ul className="space-y-1 rounded-md border border-zinc-200 bg-white p-2">
              {entries.map((e) => (
                <li key={e.key}>
                  <label
                    className={
                      e.count === 0
                        ? "flex cursor-not-allowed items-center gap-2 rounded px-2 py-1.5 opacity-50"
                        : "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-zinc-50"
                    }
                  >
                    <input
                      type="checkbox"
                      disabled={e.count === 0}
                      checked={checked.has(e.key)}
                      onChange={() => toggle(e.key)}
                    />
                    <span className="text-sm text-zinc-800">{e.label}</span>
                    <span className="ml-auto text-xs text-zinc-400">{e.count}</span>
                  </label>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="sticky bottom-0 z-10 flex items-center justify-end gap-3 border-t border-zinc-200 bg-white px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={applying}
            className="rounded-md border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-100 disabled:opacity-50"
          >
            Skip
          </button>
          <button
            type="button"
            onClick={() => void handleApply()}
            disabled={!canApply}
            className="rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600 disabled:opacity-50"
          >
            {applying ? "Cloning…" : "Clone Selected"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Hook it into program creation**

In `services/admin-dashboard/app/platform/programs/page.tsx`, add the import:

```typescript
import { CloneOnCreateDialog } from "../components/programs/CloneOnCreateDialog";
```

Add state (next to the other `useState` declarations, e.g. after `selectedStatus`):

```typescript
const [cloneDialogOpen, setCloneDialogOpen] = useState(false);
const [cloneNewProgramId, setCloneNewProgramId] = useState<string | null>(null);
const [cloneBrandId, setCloneBrandId] = useState<string | null>(null);
```

Replace `handleCreateProgram`'s body (currently lines 145-173) — the only change is inserting the sibling check between `setPrograms` and the old unconditional `offerDefaultTemplate` call:

```typescript
  const handleCreateProgram = async (data: ProgramFormData) => {
    setIsSubmitting(true);
    setFormError(null);

    try {
      const createdProgram = await createPlatformProgram({
        brandId: data.brandId,
        name: data.name,
        slug: data.slug,
        description: data.description || undefined,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        applicationDeadline: data.applicationDeadline,
        status: data.status,
        isPublished: data.isPublished,
        isActive: data.isActive,
      });

      // Checked against the PRE-update `programs` list (captured by this
      // closure before setPrograms below runs) — this tells us whether the
      // brand had any OTHER program before this one, which is exactly what
      // decides whether there's anything to clone from.
      const brandHasSiblings = programs.some((p) => p.brandId === data.brandId);

      setPrograms((current) => [mapProgram(createdProgram), ...current]);

      if (brandHasSiblings) {
        setCloneBrandId(data.brandId);
        setCloneNewProgramId(createdProgram.id);
        setCloneDialogOpen(true);
      } else {
        // No sibling programs in this brand — nothing to clone from, so keep
        // offering the existing default-template prompt.
        await offerDefaultTemplate(createdProgram.id);
      }

      setIsFormModalOpen(false);
      setSelectedProgram(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Failed to create program.");
    } finally {
      setIsSubmitting(false);
    }
  };
```

Render the dialog (near the other modals at the bottom of the returned JSX, alongside `<ProgramFormModal .../>`):

```tsx
      <CloneOnCreateDialog
        open={cloneDialogOpen}
        newProgramId={cloneNewProgramId ?? ""}
        sourcePrograms={programs.filter((p) => p.brandId === cloneBrandId && p.id !== cloneNewProgramId).map((p) => ({ id: p.id, name: p.name, year: p.year }))}
        onClose={() => setCloneDialogOpen(false)}
        onDone={() => setCloneDialogOpen(false)}
      />
```

- [ ] **Step 3: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd services/admin-dashboard
git add app/platform/components/programs/CloneOnCreateDialog.tsx app/platform/programs/page.tsx
git commit -m "feat(admin): add clone-on-create checklist for programs created into an existing brand"
```

---

## Task 32: Full verification sweep

**Files:** None — this task only runs verification commands across `services/api` and `services/admin-dashboard`; it creates or modifies nothing unless a lint autofix in Step 3 or Step 5 touches a file, handled in Step 7.

**Interfaces:**
- Consumes: everything Tasks 1-31 produced.

- [ ] **Step 1: Run the full API test suite**

Run (from `services/api/`): `npx jest`
Expected: PASS — every spec passes, including all seven copiers' extended specs (Tasks 6-12), `copy-scoped-rows.spec.ts`'s new `applyScopedTemplate` tests (Task 3), `template-payload.schemas.spec.ts` (Task 4), `content-template.handler.spec.ts` (Task 13), `get-content-templates.handler.spec.ts` (Task 14), `content-templates.controller.spec.ts` (Task 15), `program-copy.controller.spec.ts`'s extended tests (Tasks 16-17), plus every pre-existing suite elsewhere in the API (unaffected by this plan).

- [ ] **Step 2: Run the API typecheck**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. In particular, no dangling references to the deleted `ApplicationFormTemplate`/`ApplicationFormTemplateField` models or the old template controller/handlers (Task 18).

- [ ] **Step 3: Run the API lint**

Run (from `services/api/`): `npm run lint`
Expected: no errors after autofix. Review any autofix diff before Step 7.

- [ ] **Step 4: Run the admin dashboard typecheck**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors. In particular, no dangling references to the deleted `app/platform/form-templates/` directory or the removed `catalog-api.ts` template exports (Tasks 23-24).

- [ ] **Step 5: Run the admin dashboard lint**

Run (from `services/admin-dashboard/`): `npm run lint`
Expected: no errors.

- [ ] **Step 6: Confirm no stale references to the deleted template code remain**

Run (from the repo root, `ybb-platform/`):

```bash
grep -rn "ApplicationFormTemplate\|FormTemplatesController\|apply-form-template\|form-template.commands\|form-template.handler\|get-form-templates" services/api/src --include="*.ts"
grep -rn "platform/form-templates\|fetchFormTemplates\|applyTemplateToProgram\|createFormTemplate\b" services/admin-dashboard/app --include="*.ts" --include="*.tsx"
```

Expected: no output from either command.

- [ ] **Step 7: Manually verify the migration order against a fresh database**

Run (from `services/api/`): `npx prisma migrate status`
Expected: the three new migrations (`20260824090000_add_content_template`, `20260824091000_backfill_content_template_from_form_templates`, `20260824092000_drop_application_form_template`) are listed in that exact order and apply cleanly. If run against a database that still has `ApplicationFormTemplate` rows from real use, spot-check a handful of migrated `content_templates` rows against their source `application_form_templates` rows (matching `id`, `name`, field count) before trusting the drop step.

- [ ] **Step 8: Commit any autofix changes**

If Step 3 or Step 5 modified any files, stage and commit them separately from the feature work already committed in Tasks 1-31:

```bash
cd services/api
git status --short
# only if the above shows changes:
git add -u
git commit -m "chore(api): apply lint autofixes"

cd services/admin-dashboard
git status --short
# only if the above shows changes:
git add -u
git commit -m "chore(admin): apply lint autofixes"
```

If neither `git status --short` shows any output, there is nothing to commit — Phase 2 is done.

