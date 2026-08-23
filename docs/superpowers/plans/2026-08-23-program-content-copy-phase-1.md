# Program Content Copy — Phase 1: Copy Engine and Program-Scoped Surfaces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `ProgramCopier` registry with a shared `copyScopedRows` helper, implement copiers for the seven program-scoped surfaces (form fields, participation categories, timelines, rundowns, FAQs, payments, program details), expose three generic endpoints (list sibling sources with counts, preview an entity, copy an entity), and extract the "Copy from program" dialog into a reusable shell used by all seven surfaces.

**Architecture:** A `ProgramCopierRegistry` (NestJS provider) holds seven `ProgramCopier` implementations keyed by entity (`form-fields`, `participation-categories`, `timelines`, `rundowns`, `faqs`, `payments`, `program-details`). Five of them (all but payments and program-details) delegate their row-copying logic to a shared `copyScopedRows(config)` function; payments owns a two-level tier-then-validity-period insert; program-details does a scalar replace. A single `ProgramCopyController` exposes `GET /programs/copy/:entityKey/counts`, `GET /programs/:programId/copy/:entityKey/preview`, and `POST /programs/:programId/copy/:entityKey`, reusing the copy-then-insert / soft-delete-then-insert semantics that `copy-fields-from-program.handler.ts` already established. On the frontend, a generic `CopyFromProgramDialog` shell (parameterized by `entityKey`, `entityLabel`, `supportsAppend`, and an optional `referenceBrandName`) is extracted from the existing form-fields-only dialog, proven by re-pointing the Submission Form Fields surface at it first, then wired into the other six surfaces.

**Tech Stack:** NestJS + `@nestjs/cqrs` + Prisma 7 (API, Jest via `npx jest`). Next.js 16 + React + Tailwind + sonner (admin dashboard, verified via `npx tsc --noEmit`, no FE test runner in this repo).

**Spec:** `docs/superpowers/specs/2026-08-23-program-content-copy-design.md` (commit `04a0f80f`, "docs: correct spec after adversarial review of its destructive claims" — this plan is written against the corrected version; see Global Constraints below for what changed).

## Global Constraints

- Copy semantics are unchanged from `copy-fields-from-program.handler.ts:22-116`: **replace** soft-deletes the target's existing rows then inserts; **append** keeps existing rows, computes the next `order`, and skips source rows whose dedupe key collides with an existing row (no merge).
- Dedupe comparison is **case-sensitive**, using exact `Set.has()` with no normalization — `Email` and `email` do not collide. This mirrors `ApplicationFormField`'s DB-enforced partial unique index `(program_id, name) WHERE deleted_at IS NULL` (`applications.prisma:122-131`).
- **Dedupe keys, corrected against the real schema (not the per-surface table's original shorthand):** `participation-categories` dedupes on `name` (the model has no `category` column). `rundowns` (`ProgramSchedule`) dedupes on the **composite** `(day, activity)` (the model has no `title` column).
- **The type-`REPLACE` confirmation gate lives only at the API boundary** (`ProgramCopyController`), checked once per request before any copier runs. `ProgramCopier.copy()` and `CopyInput` never carry a `confirm` field — this mirrors how `program-form-fields.controller.ts:65-70` already keeps `confirm` out of the command it builds.
- `ProgramParticipationCategory` has no `deletedAt` column today (`program.prisma:326-345`) and has an inbound FK from `ParticipantApplication.participationCategoryId` with no `onDelete` clause (`applications.prisma:148-149`). This plan adds `deletedAt` via migration (Task 4) so participation-categories can soft-delete like every sibling copier, and adds an application-level guard that refuses `replace` (and the existing single-row delete) when live applications still reference the categories being removed.
- `program-details` copies **three** scalar fields — `requirementsDescription`, `benefitsDescription`, `termsAndConditions` — not two. All three live in the same "Participant-Facing Content" section (`ProgramSpecificsTab.tsx:156-186`) and the same edit modal.
- `CopyResult` is exactly `{ created: number; skipped: number; replaced: number }` per the spec's `ProgramCopier` interface — no item-name arrays. The Submission Form Fields toast changes from naming skipped fields to a count-only message; this is a deliberate, spec-driven trade-off, not an oversight.
- Phase 1's `ProgramCopier` interface is a **subset** of the spec's full interface: `exportTemplate`/`applyTemplate` are Phase 2 concerns (they depend on `ContentTemplate`, which does not exist yet) and are omitted here entirely, not stubbed.
- Out of scope for this plan: `ContentTemplate`, `exportTemplate`/`applyTemplate`, clone-on-create, the `contact`/`landing` copiers, the Brand/Program ownership split, `PlatformSetting`. The existing "Copy from template" feature (`apply-form-template.handler.ts`, `CopyFromTemplateDialog.tsx`) is untouched.
- API test command: `npx jest --testPathPattern="<pattern>"` from `services/api/`. Typecheck: `npx tsc --noEmit -p tsconfig.json` from `services/api/`. Admin dashboard has no test runner; verify with `npx tsc --noEmit` from `services/admin-dashboard/`.

---

## File Structure

**API (`services/api/`) — new copy engine:**
- `src/modules/programs/application/copy/program-copier.interface.ts` — `ProgramCopier`, `CopyMode`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx`.
- `src/modules/programs/application/copy/copy-scoped-rows.ts` + `.spec.ts` — the shared helper used by five of the seven copiers.
- `src/modules/programs/application/copy/program-copier.registry.ts` + `.spec.ts` — key-to-copier lookup.
- `src/modules/programs/application/copy/copiers/form-fields.copier.ts` + `.spec.ts` — refactor of `copy-fields-from-program.handler.ts`.
- `src/modules/programs/application/copy/copiers/participation-categories.copier.ts` + `.spec.ts`.
- `src/modules/programs/application/copy/copiers/timelines.copier.ts` + `.spec.ts`.
- `src/modules/programs/application/copy/copiers/rundowns.copier.ts` + `.spec.ts` — composite dedupe key.
- `src/modules/programs/application/copy/copiers/faqs.copier.ts` + `.spec.ts`.
- `src/modules/programs/application/copy/copiers/payments.copier.ts` + `.spec.ts` — owns its own two-level insert.
- `src/modules/programs/application/copy/copiers/program-details.copier.ts` + `.spec.ts` — scalar, replace-only.
- `src/modules/programs/presentation/program-copy.controller.ts` + `.spec.ts` — the three generic endpoints.
- `src/modules/programs/presentation/dto/copy-entity.dto.ts` — request body for the `POST` endpoint.

**API — migration + modified files:**
- `prisma/schema/program.prisma` — add `deletedAt` to `ProgramParticipationCategory`.
- `prisma/migrations/20260823150000_add_participation_category_deleted_at/migration.sql` — the column add.
- `src/modules/programs/infrastructure/persistence/program-content.repository.ts` — filter `deletedAt` in the list query; soft-delete + guard in `deleteParticipationCategory`.
- `src/modules/programs/programs.module.ts` — register the controller, registry, and seven copiers; remove the old handler.
- `src/modules/programs/presentation/program-form-fields.controller.ts` — remove the `copy-from-program` route.

**API — deleted (superseded by the `form-fields` copier):**
- `src/modules/programs/application/commands/copy-fields-from-program.command.ts`
- `src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts` + `.spec.ts`
- `src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts`

**Admin dashboard (`services/admin-dashboard/`) — new shared shell:**
- `app/components/shared/copy-from-program/copy-api.ts` — generic `fetchCopySourceCounts` / `fetchCopyPreview` / `postCopyEntity`.
- `app/components/shared/copy-from-program/CopyFromProgramDialog.tsx` — the extracted, parameterized dialog.

**Admin dashboard — modified (add the button) or deleted:**
- Delete: `app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx`.
- Modify: `app/components/submissionsMasterData/form-fields/catalog-api.ts` — remove `copyFieldsFromProgram`, `fetchProgramFormFields`, `ProgramFormFieldRow`.
- Modify: `app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx` — re-point at the shared dialog (proves the abstraction first).
- Modify: `app/components/submissionsMasterData/categories/ParticipationCategoriesTable.tsx`.
- Modify: `app/programs/[programId]/master-data/timelines/page.tsx`.
- Modify: `app/programs/[programId]/master-data/faqs/page.tsx`.
- Modify: `app/programs/[programId]/master-data/program-rundowns/page.tsx`.
- Modify: `app/components/programPaymentsMasterData/options/PaymentOptionTable.tsx`.
- Modify: `app/programs/[programId]/master-data/program-details/page.tsx`.

Note: `TimelinesTable.tsx`, `ProgramFaqsTable.tsx`, `ProgramRundownsTable.tsx` and their `*Actions.tsx` siblings are **dead code** — not imported by any page (verified by grep across `app/`). The live surfaces for those three entities are the self-contained `"use client"` `page.tsx` files listed above. This plan does not touch the dead components.

---

## Task 1: Shared copier types

**Files:**
- Create: `services/api/src/modules/programs/application/copy/program-copier.interface.ts`

**Interfaces:**
- Produces: `CopyMode`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx`, `ProgramCopier` — every later task imports these exact names from this file.

- [ ] **Step 1: Create the types file**

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
  // Set true only by copiers whose rows can carry cross-brand media
  // (currently just form-fields). Lets the generic dialog show the
  // cross-brand warning without knowing which entity it's rendering.
  hasExternalMedia?: boolean;
}

/**
 * Phase 1 subset of the spec's full ProgramCopier contract
 * (docs/superpowers/specs/2026-08-23-program-content-copy-design.md). The
 * spec's interface also has exportTemplate/applyTemplate, added in Phase 2
 * once ContentTemplate exists. Every copier below implements only the six
 * members here — there is no stub for the template methods.
 */
export interface ProgramCopier {
  readonly key: string;
  readonly label: string;
  readonly supportsAppend: boolean;

  countFor(programId: string): Promise<number>;
  preview(programId: string): Promise<CopyPreviewItem[]>;
  copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult>;
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing `program-copier.interface.ts`.

- [ ] **Step 3: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/program-copier.interface.ts
git commit -m "feat(programs): add ProgramCopier interface and shared copy types"
```

---

## Task 2: `copyScopedRows` shared helper (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copy-scoped-rows.ts`
- Create: `services/api/src/modules/programs/application/copy/copy-scoped-rows.spec.ts`

**Interfaces:**
- Consumes: `CopyMode`, `CopyResult` from `./program-copier.interface` (Task 1).
- Produces: `ScopedRowsDelegate<Row>`, `CopyScopedRowsConfig<Row>`, `copyScopedRows<Row>(config): Promise<CopyResult>` — every list-copier task (4-8) imports these exact names.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copy-scoped-rows.spec.ts
import { copyScopedRows } from './copy-scoped-rows';

type Row = { id: string; name: string; order: number; programId: string };

// A minimal fake delegate — copyScopedRows only needs findMany/updateMany/create,
// so the fake mirrors those three Prisma-model-delegate methods without pulling
// in a real Prisma model. Rows live in a plain array; findMany filters by the
// where clause's `programId` (the only field these tests vary).
function fakeDelegate(initialRows: Row[]) {
  let rows = [...initialRows];
  let nextId = rows.length + 1;
  return {
    findMany: jest.fn(async ({ where }: { where: { programId: string } }) =>
      rows.filter((r) => r.programId === where.programId),
    ),
    updateMany: jest.fn(async ({ where, data }: { where: { programId: string }; data: Partial<Row> & { deletedAt?: Date; isActive?: boolean } }) => {
      const matched = rows.filter((r) => r.programId === where.programId);
      rows = rows.map((r) => (r.programId === where.programId ? { ...r, ...data } : r));
      return { count: matched.length };
    }),
    create: jest.fn(async ({ data }: { data: Omit<Row, 'id'> }) => {
      const row = { ...data, id: `new-${nextId++}` } as Row;
      rows.push(row);
      return row;
    }),
    _rows: () => rows,
  };
}

describe('copyScopedRows', () => {
  it('append copies new rows and skips exact dedupe-key collisions (case-sensitive)', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'Email', order: 0, programId: 'src' },
      { id: 's2', name: 'email', order: 1, programId: 'src' },
      { id: 't1', name: 'email', order: 0, programId: 'tgt' },
    ]);
    const result = await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    // 'Email' (capital E) does not collide with the existing lowercase
    // 'email' row — dedupe is exact Set.has(), matching the DB-enforced
    // partial unique index on ApplicationFormField.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
    expect(delegate.create).toHaveBeenCalledTimes(1);
    expect(delegate.create.mock.calls[0][0].data.name).toBe('Email');
  });

  it('append renumbers new rows after the target\'s current max order', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 0, programId: 'src' },
      { id: 's2', name: 'b', order: 1, programId: 'src' },
      { id: 't1', name: 'x', order: 5, programId: 'tgt' },
    ]);
    await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    expect(delegate.create.mock.calls[0][0].data.order).toBe(6);
    expect(delegate.create.mock.calls[1][0].data.order).toBe(7);
  });

  it('replace soft-deletes existing target rows via replaceData, then inserts from order 0', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 3, programId: 'src' },
      { id: 't1', name: 'old', order: 0, programId: 'tgt' },
    ]);
    const replaceData = { deletedAt: new Date('2026-08-23'), isActive: false };
    const result = await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'replace',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData,
    });
    expect(delegate.updateMany).toHaveBeenCalledWith({
      where: { programId: 'tgt' },
      data: replaceData,
    });
    expect(delegate.create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('empty source is a no-op: no create/updateMany calls beyond the initial lookups', async () => {
    const delegate = fakeDelegate([{ id: 't1', name: 'x', order: 0, programId: 'tgt' }]);
    const result = await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
    expect(delegate.create).not.toHaveBeenCalled();
  });

  it('itemIds filters the source rows before copying', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 0, programId: 'src' },
      { id: 's2', name: 'b', order: 1, programId: 'src' },
      { id: 's3', name: 'c', order: 2, programId: 'src' },
    ]);
    await copyScopedRows({
      delegate,
      scopeField: 'programId',
      sourceProgramId: 'src',
      targetProgramId: 'tgt',
      itemIds: ['s1', 's3'],
      mode: 'append',
      activeFilter: {},
      idOf: (r: Row) => r.id,
      dedupeKey: (r: Row) => r.name,
      fields: (r: Row, order: number) => ({ programId: 'tgt', name: r.name, order }),
      replaceData: { deletedAt: new Date() },
    });
    expect(delegate.create).toHaveBeenCalledTimes(2);
    expect(delegate.create.mock.calls.map((c: any) => c[0].data.name)).toEqual(['a', 'c']);
  });

  it('replace calls beforeReplace with the existing target row ids before deleting, and aborts if it throws', async () => {
    const delegate = fakeDelegate([
      { id: 's1', name: 'a', order: 0, programId: 'src' },
      { id: 't1', name: 'old', order: 0, programId: 'tgt' },
    ]);
    const beforeReplace = jest.fn(async () => {
      throw new Error('blocked');
    });
    await expect(
      copyScopedRows({
        delegate,
        scopeField: 'programId',
        sourceProgramId: 'src',
        targetProgramId: 'tgt',
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
Expected: FAIL — cannot find module `./copy-scoped-rows`.

- [ ] **Step 3: Write the helper**

```typescript
// services/api/src/modules/programs/application/copy/copy-scoped-rows.ts
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

export async function copyScopedRows<Row>(config: CopyScopedRowsConfig<Row>): Promise<CopyResult> {
  const {
    delegate, scopeField, sourceProgramId, targetProgramId, itemIds, mode,
    activeFilter, idOf, dedupeKey, fields, replaceData, beforeReplace,
  } = config;

  let sourceRows = await delegate.findMany({
    where: { [scopeField]: sourceProgramId, ...activeFilter },
    orderBy: { order: 'asc' },
  });

  if (itemIds && itemIds.length > 0) {
    const idSet = new Set(itemIds);
    sourceRows = sourceRows.filter((row) => idSet.has(idOf(row)));
  }

  // Always load the target's current live rows: append needs them for the
  // dedupe set + order baseline, replace needs them for the integrity guard
  // and to know what it is about to soft-delete.
  const existingRows = await delegate.findMany({
    where: { [scopeField]: targetProgramId, ...activeFilter },
  });

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
  // order is a plain int column on every one of these models; base it on the
  // current max so appended rows land after what's already there — matches
  // copy-fields-from-program.handler.ts, which admins already know.
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copy-scoped-rows.spec"`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copy-scoped-rows.ts src/modules/programs/application/copy/copy-scoped-rows.spec.ts
git commit -m "feat(programs): add shared copyScopedRows copy helper"
```

---

## Task 3: `ProgramCopierRegistry` (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/program-copier.registry.ts`
- Create: `services/api/src/modules/programs/application/copy/program-copier.registry.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyPreviewItem`, `CopyInput`, `CopyResult`, `PrismaTx` from `./program-copier.interface` (Task 1).
- Produces: `ProgramCopierRegistry` with `get(key: string): ProgramCopier` (throws `NotFoundException` for unknown keys) and `list(): ProgramCopier[]` — Task 12's controller and Task 11's module wiring depend on this exact class name and these two method signatures.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/program-copier.registry.spec.ts
import { NotFoundException } from '@nestjs/common';
import { ProgramCopierRegistry } from './program-copier.registry';
import { ProgramCopier } from './program-copier.interface';

function fakeCopier(key: string): ProgramCopier {
  return {
    key,
    label: key,
    supportsAppend: true,
    countFor: jest.fn(),
    preview: jest.fn(),
    copy: jest.fn(),
  };
}

describe('ProgramCopierRegistry', () => {
  it('get() returns the copier registered under that key', () => {
    const faqs = fakeCopier('faqs');
    const timelines = fakeCopier('timelines');
    const registry = new ProgramCopierRegistry(faqs, timelines);
    expect(registry.get('faqs')).toBe(faqs);
    expect(registry.get('timelines')).toBe(timelines);
  });

  it('get() throws NotFoundException for an unknown key', () => {
    const registry = new ProgramCopierRegistry(fakeCopier('faqs'));
    expect(() => registry.get('not-a-real-key')).toThrow(NotFoundException);
  });

  it('list() returns every registered copier', () => {
    const faqs = fakeCopier('faqs');
    const timelines = fakeCopier('timelines');
    const registry = new ProgramCopierRegistry(faqs, timelines);
    expect(registry.list()).toEqual([faqs, timelines]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="program-copier.registry.spec"`
Expected: FAIL — cannot find module `./program-copier.registry`.

- [ ] **Step 3: Write the registry**

The constructor takes the seven copiers as ordinary constructor parameters (not a variadic array) so NestJS DI can inject each concrete class; the spec test above calls the constructor directly with fakes, which works identically since the constructor signature accepts any `ProgramCopier[]`-compatible list of arguments.

```typescript
// services/api/src/modules/programs/application/copy/program-copier.registry.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { ProgramCopier } from './program-copier.interface';

@Injectable()
export class ProgramCopierRegistry {
  private readonly copiers: Map<string, ProgramCopier>;

  constructor(...copiers: ProgramCopier[]) {
    this.copiers = new Map(copiers.map((copier) => [copier.key, copier]));
  }

  get(key: string): ProgramCopier {
    const copier = this.copiers.get(key);
    if (!copier) {
      throw new NotFoundException({
        code: 'unknown_copy_entity',
        message: `No copier registered for entity key '${key}'.`,
      });
    }
    return copier;
  }

  list(): ProgramCopier[] {
    return Array.from(this.copiers.values());
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="program-copier.registry.spec"`
Expected: PASS — 3 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/program-copier.registry.ts src/modules/programs/application/copy/program-copier.registry.spec.ts
git commit -m "feat(programs): add ProgramCopierRegistry"
```

---

## Task 4: Migration — `ProgramParticipationCategory.deletedAt`

**Files:**
- Modify: `services/api/prisma/schema/program.prisma` (the `ProgramParticipationCategory` model, currently `program.prisma:326-345`)
- Create: `services/api/prisma/migrations/20260823150000_add_participation_category_deleted_at/migration.sql`
- Modify: `services/api/src/modules/programs/infrastructure/persistence/program-content.repository.ts` (`findParticipationCategoriesByProgramId` at line 327, `deleteParticipationCategory` at line 355)

**Interfaces:**
- Produces: `ProgramParticipationCategory.deletedAt: DateTime | null` on the Prisma model — Task 6 (the participation-categories copier) filters and sets this field.

This task is not TDD in the usual sense (schema + repository changes verified by compile + existing suite, matching how `2026-04-19-form-field-catalog-and-templates.md`-style migration tasks in this repo are structured) because `program-content.repository.ts` has no existing spec file to extend — repositories in this codebase are exercised through their command handlers' mocked-repository specs, not unit-tested directly.

- [ ] **Step 1: Add the column to the Prisma schema**

In `services/api/prisma/schema/program.prisma`, inside `model ProgramParticipationCategory { ... }`, add `deletedAt` after `updatedAt`:

```prisma
model ProgramParticipationCategory {
  id          String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  programId   String  @map("program_id") @db.Uuid
  name        String  @db.VarChar(255) // "Future Innovators", "High School Students"
  description String? @db.Text
  benefits    String? @db.Text
  eligibility String? @db.Text

  order     Int       @default(0)
  isActive  Boolean   @default(true) @map("is_active")
  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)

  // Relations
  program      Program                  @relation(fields: [programId], references: [id], onDelete: Cascade)
  applications ParticipantApplication[]

  @@index([programId])
  @@map("program_participation_categories")
}
```

- [ ] **Step 2: Write the migration SQL**

```sql
-- services/api/prisma/migrations/20260823150000_add_participation_category_deleted_at/migration.sql

-- Why: ProgramParticipationCategory was the only content model without a
-- deleted_at column, so both the participation-categories copier (this
-- plan) and the existing single-row delete handler had to hard DELETE
-- instead of soft-deleting like every sibling table (program_faqs,
-- program_timeline, program_schedules, application_form_fields). A hard
-- delete against a category still referenced by
-- participant_applications.participation_category_id (FK with no onDelete
-- clause) fails at the database with a raw constraint violation instead of
-- a clear application error. Adding deleted_at lets both paths soft-delete
-- uniformly; the application-level guard added alongside this migration
-- turns that raw Postgres error into a clear 409 before it can happen.
ALTER TABLE "program_participation_categories"
  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ(6);
```

- [ ] **Step 3: Update the repository's list query to filter `deletedAt`**

In `services/api/src/modules/programs/infrastructure/persistence/program-content.repository.ts`, replace the existing `findParticipationCategoriesByProgramId` (currently lines 327-332):

```typescript
async findParticipationCategoriesByProgramId(programId: string, includeInactive = false): Promise<ProgramParticipationCategory[]> {
    return this.prisma.programParticipationCategory.findMany({
        where: includeInactive
            ? { programId, deletedAt: null }
            : { programId, isActive: true, deletedAt: null },
        orderBy: { order: 'asc' },
    });
}
```

- [ ] **Step 4: Soft-delete + guard in `deleteParticipationCategory`**

Replace the existing hard-delete implementation (currently lines 355-357). Add `ConflictException` to this file's `@nestjs/common` import if not already present.

```typescript
async deleteParticipationCategory(id: string): Promise<void> {
    // A hard delete here would hit the FK from ParticipantApplication.participationCategoryId
    // (no onDelete clause) as a raw Postgres constraint violation. Guard explicitly so the
    // admin gets a clear message instead of a 500.
    const referencedCount = await this.prisma.participantApplication.count({
        where: { participationCategoryId: id },
    });
    if (referencedCount > 0) {
        throw new ConflictException({
            code: 'category_in_use',
            message: `Cannot delete: ${referencedCount} application(s) still reference this participation category.`,
        });
    }
    await this.prisma.programParticipationCategory.update({
        where: { id },
        data: { deletedAt: new Date(), isActive: false },
    });
}
```

- [ ] **Step 5: Verify it compiles and existing tests still pass**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run (from `services/api/`): `npx jest --testPathPattern="manage-program-content.handlers.spec"`
Expected: PASS — the handler spec mocks `IProgramContentRepository.deleteParticipationCategory` as `jest.fn()`, so it is unaffected by the repository's internal soft-delete change; only the interface's return type (`Promise<void>`) matters there, and that is unchanged.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add prisma/schema/program.prisma prisma/migrations/20260823150000_add_participation_category_deleted_at/migration.sql src/modules/programs/infrastructure/persistence/program-content.repository.ts
git commit -m "feat(programs): add deletedAt to ProgramParticipationCategory, soft-delete + guard on delete"
```

---

## Task 5: `FormFieldsCopier` — refactor the existing handler onto the interface (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts`
- Delete: `services/api/src/modules/programs/application/commands/copy-fields-from-program.command.ts`
- Delete: `services/api/src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts`
- Delete: `services/api/src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.spec.ts`
- Delete: `services/api/src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts`
- Modify: `services/api/src/modules/programs/presentation/program-form-fields.controller.ts` (remove `copyFromProgram`, currently lines 17-18, 49-79)

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1); `copyScopedRows`, `ScopedRowsDelegate` (Task 2).
- Produces: `FormFieldsCopier` class (`key = 'form-fields'`, `label = 'Application Form Fields'`, `supportsAppend = true`) — Task 11 registers it, Task 12's controller tests reference `'form-fields'` as a valid entity key.

This is the load-bearing refactor: it proves the abstraction generalizes the one handler that already works in production. The old bespoke command/handler/DTO/route are deleted, not kept alongside — their logic now lives entirely in `FormFieldsCopier`, wired through the generic `ProgramCopyController` (Task 12). The "Copy from template" feature (`apply-form-template.handler.ts`, `ApplyFormTemplateCommand`, the `/apply-template` route) is untouched.

- [ ] **Step 1: Write the failing tests**

These port the 7 scenarios from the deleted `copy-fields-from-program.handler.spec.ts` onto the new class, plus the case-sensitivity pin and the `preview`/`countFor` shape.

```typescript
// services/api/src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts
import { FormFieldsCopier } from './form-fields.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type SourceField = {
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
  source: 'system' | 'custom';
  systemFieldKey: string | null;
};

function srcField(over: Partial<SourceField>): SourceField {
  return {
    id: over.id ?? 'f1',
    name: over.name ?? 'field_one',
    label: over.label ?? 'Field One',
    type: over.type ?? 'text',
    section: over.section ?? 'personal_details',
    isRequired: over.isRequired ?? true,
    order: over.order ?? 0,
    placeholder: over.placeholder ?? null,
    helpText: over.helpText ?? null,
    mediaUrl: over.mediaUrl ?? null,
    mediaAlt: over.mediaAlt ?? null,
    helpAssets: over.helpAssets ?? [],
    options: over.options ?? [],
    validationRules: over.validationRules ?? {},
    source: over.source ?? 'custom',
    systemFieldKey: over.systemFieldKey ?? null,
  };
}

// Mocks Prisma: applicationFormField.findMany branches on where.programId
// ('src' => source fields, 'tgt' => existing target fields).
function mkPrisma(opts: { sourceFields?: SourceField[]; existingFields?: SourceField[] } = {}): PrismaService {
  const base: any = {
    applicationFormField: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve(
          (where.programId === 'src' ? opts.sourceFields : opts.existingFields) ?? [],
        ),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceFields ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('FormFieldsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new FormFieldsCopier(mkPrisma());
    expect(copier.key).toBe('form-fields');
    expect(copier.label).toBe('Application Form Fields');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append adds new fields and skips exact-name collisions, case-sensitively', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'Email', order: 0 }), srcField({ id: 'f2', name: 'phone', order: 1 })],
      existingFields: [srcField({ id: 't1', name: 'email', order: 5 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // 'Email' does not collide with existing 'email' — exact match only.
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 0 });
  });

  it('replace soft-deletes existing fields then inserts all source fields from order 0', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 3 }), srcField({ id: 'f2', name: 'b', order: 9 })],
      existingFields: [srcField({ id: 't1', name: 'old', order: 0 })],
    });
    const copier = new FormFieldsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).applicationFormField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(create.mock.calls[1][0].data.order).toBe(1);
    expect(result).toEqual({ created: 2, skipped: 0, replaced: 1 });
  });

  it('copies media and helpAssets verbatim', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({
          id: 'f1',
          name: 'tshirt_size',
          mediaUrl: 'https://cdn/x.png',
          mediaAlt: 'Size guide',
          helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
        }),
      ],
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        mediaUrl: 'https://cdn/x.png',
        mediaAlt: 'Size guide',
        helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
      }),
    );
  });

  it('copies only the selected itemIds, preserving source order', async () => {
    const prisma = mkPrisma({
      sourceFields: [srcField({ id: 'f1', name: 'a', order: 0 }), srcField({ id: 'f2', name: 'b', order: 1 }), srcField({ id: 'f3', name: 'c', order: 2 })],
    });
    const copier = new FormFieldsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: ['f1', 'f3'], mode: 'append' });
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls.map((c: any) => c[0].data.name)).toEqual(['a', 'c']);
  });

  it('preview() maps rows to CopyPreviewItem with hasExternalMedia set from mediaUrl/helpAssets', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'plain', label: 'Plain Field' }),
        srcField({ id: 'f2', name: 'tshirt_size', label: 'T-Shirt Size', mediaUrl: 'https://cdn/x.png' }),
      ],
    });
    const copier = new FormFieldsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([
      { id: 'f1', label: 'Plain Field', meta: 'plain · text · personal_details', hasExternalMedia: false },
      { id: 'f2', label: 'T-Shirt Size', meta: 'tshirt_size · text · personal_details', hasExternalMedia: true },
    ]);
  });

  it('countFor() counts active (non-deleted) fields for the program', async () => {
    const prisma = mkPrisma({ sourceFields: [srcField({}), srcField({ id: 'f2', name: 'b' })] });
    const copier = new FormFieldsCopier(prisma);
    const count = await copier.countFor('src');
    expect(count).toBe(2);
    expect((prisma as any).applicationFormField.count).toHaveBeenCalledWith({ where: { programId: 'src', deletedAt: null } });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/form-fields.copier.spec"`
Expected: FAIL — cannot find module `./form-fields.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/form-fields.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

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
      // Media and help assets are copied verbatim by design; the shared
      // dialog shows a cross-brand caveat when any selected item flags this.
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
        // Media and help assets are copied verbatim by design; when the source
        // is a different brand the admin UI shows a cross-brand caveat.
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
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Delete the superseded command/handler/DTO and remove the old route**

```bash
cd services/api
git rm src/modules/programs/application/commands/copy-fields-from-program.command.ts
git rm src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts
git rm src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.spec.ts
git rm src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts
```

In `services/api/src/modules/programs/presentation/program-form-fields.controller.ts`, remove the two imports at lines 17-18:

```typescript
import { CopyFieldsFromProgramCommand } from '../application/commands/copy-fields-from-program.command';
import { CopyFieldsFromProgramDto } from './dto/copy-fields-from-program.dto';
```

and remove the entire `copyFromProgram` method (currently lines 49-79):

```typescript
  @Post(':programId/form-fields/copy-from-program')
  @ApiOperation({
    summary:
      "Copy another program's form fields into this program (append or replace).",
  })
  copyFromProgram(
    @Param('programId') programId: string,
    @Body() dto: CopyFieldsFromProgramDto,
  ) {
    const mode = dto.mode ?? 'append';
    if (dto.sourceProgramId === programId) {
      throw new BadRequestException({
        code: 'invalid_source',
        message: 'Source program must differ from the target program.',
      });
    }
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({
        code: 'confirm_required',
        message: "Replace mode requires 'confirm: true' in the request body.",
      });
    }
    return this.commandBus.execute(
      new CopyFieldsFromProgramCommand(
        programId,
        dto.sourceProgramId,
        dto.fieldIds,
        mode,
      ),
    );
  }
```

The `apply-template` route (lines 28-47) and its imports stay untouched — the "Copy from template" feature is out of scope for this plan.

- [ ] **Step 6: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. (`programs.module.ts` still references `CopyFieldsFromProgramHandler` at this point — Task 11 removes that registration. If `tsc` fails here on that reference, that is expected and will be resolved by Task 11; do not fix it out of order.)

- [ ] **Step 7: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/form-fields.copier.ts src/modules/programs/application/copy/copiers/form-fields.copier.spec.ts src/modules/programs/presentation/program-form-fields.controller.ts
git commit -m "refactor(programs): replace copy-fields-from-program handler with FormFieldsCopier"
```

---

## Task 6: `ParticipationCategoriesCopier` with in-use guard (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1); `copyScopedRows`, `ScopedRowsDelegate` (Task 2); `ProgramParticipationCategory.deletedAt` (Task 4).
- Produces: `ParticipationCategoriesCopier` (`key = 'participation-categories'`, `label = 'Participation Categories'`, `supportsAppend = true`) — Task 11 registers it.

Dedupes on `name` (the model has no `category` column). Replace mode refuses when the target's current categories are still referenced by any `ParticipantApplication`, via `copyScopedRows`'s `beforeReplace` hook (Task 2) — the same guard reasoning as `deleteParticipationCategory` (Task 4), applied to the bulk case.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts
import { ConflictException } from '@nestjs/common';
import { ParticipationCategoriesCopier } from './participation-categories.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  order: number;
  isActive: boolean;
};

function category(over: Partial<CategoryRow>): CategoryRow {
  return {
    id: over.id ?? 'c1',
    name: over.name ?? 'Category One',
    description: over.description ?? null,
    benefits: over.benefits ?? null,
    eligibility: over.eligibility ?? null,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

function mkPrisma(opts: {
  sourceCategories?: CategoryRow[];
  existingCategories?: CategoryRow[];
  referencingApplicationCount?: number;
} = {}): PrismaService {
  const base: any = {
    programParticipationCategory: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceCategories : opts.existingCategories) ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceCategories ?? []).length),
    },
    participantApplication: {
      count: jest.fn().mockResolvedValue(opts.referencingApplicationCount ?? 0),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('ParticipationCategoriesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ParticipationCategoriesCopier(mkPrisma());
    expect(copier.key).toBe('participation-categories');
    expect(copier.label).toBe('Participation Categories');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new categories and dedupes on name', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'High School' }), category({ id: 's2', name: 'University' })],
      existingCategories: [category({ id: 't1', name: 'High School' })],
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing categories via deletedAt + isActive when none are referenced by applications', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 0,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programParticipationCategory.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('replace refuses with ConflictException when existing categories are still referenced by applications', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 3,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect((prisma as any).programParticipationCategory.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).programParticipationCategory.create).not.toHaveBeenCalled();
  });

  it('append never runs the in-use guard even when existing categories are referenced', async () => {
    const prisma = mkPrisma({
      sourceCategories: [category({ id: 's1', name: 'a' })],
      existingCategories: [category({ id: 't1', name: 'old' })],
      referencingApplicationCount: 3,
    });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('empty source is a no-op', async () => {
    const prisma = mkPrisma({ sourceCategories: [], existingCategories: [category({ id: 't1', name: 'old' })] });
    const copier = new ParticipationCategoriesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/participation-categories.copier.spec"`
Expected: FAIL — cannot find module `./participation-categories.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/participation-categories.copier.ts
import { ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  benefits: string | null;
  eligibility: string | null;
  order: number;
  isActive: boolean;
};

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
      beforeReplace: async (existingIds) => {
        if (existingIds.length === 0) return;
        const referencedCount = await tx.participantApplication.count({
          where: { participationCategoryId: { in: existingIds } },
        });
        if (referencedCount > 0) {
          throw new ConflictException({
            code: 'category_in_use',
            message: `Cannot replace: ${referencedCount} application(s) still reference the current participation categories. Use append mode instead, or reassign those applications first.`,
          });
        }
      },
    });
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/participation-categories.copier.spec"`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/participation-categories.copier.ts src/modules/programs/application/copy/copiers/participation-categories.copier.spec.ts
git commit -m "feat(programs): add ParticipationCategoriesCopier with in-use replace guard"
```

---

## Task 7: `TimelinesCopier` (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/timelines.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/timelines.copier.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1); `copyScopedRows`, `ScopedRowsDelegate` (Task 2).
- Produces: `TimelinesCopier` (`key = 'timelines'`, `label = 'Timelines'`, `supportsAppend = true`) — Task 11 registers it.

Dedupes on `title` (`ProgramTimeline.title`, `content.prisma:45-68`).

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copiers/timelines.copier.spec.ts
import { TimelinesCopier } from './timelines.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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

function timeline(over: Partial<TimelineRow>): TimelineRow {
  return {
    id: over.id ?? 't1',
    date: over.date ?? new Date('2027-01-01T00:00:00Z'),
    endDate: over.endDate ?? null,
    title: over.title ?? 'Registration Opens',
    description: over.description ?? null,
    icon: over.icon ?? null,
    type: over.type ?? 'custom',
    completionType: over.completionType ?? 'date_passed',
    completionConfig: over.completionConfig ?? {},
    targetAudience: over.targetAudience ?? 'all',
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

function mkPrisma(opts: { sourceItems?: TimelineRow[]; existingItems?: TimelineRow[] } = {}): PrismaService {
  const base: any = {
    programTimeline: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.title}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('TimelinesCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new TimelinesCopier(mkPrisma());
    expect(copier.key).toBe('timelines');
    expect(copier.label).toBe('Timelines');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new items and dedupes on title', async () => {
    const prisma = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'Registration Opens' }), timeline({ id: 's2', title: 'Interview Week' })],
      existingItems: [timeline({ id: 't1', title: 'Registration Opens' })],
    });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing items then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceItems: [timeline({ id: 's1', title: 'a', order: 3 })],
      existingItems: [timeline({ id: 't1', title: 'old' })],
    });
    const copier = new TimelinesCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programTimeline.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (prisma as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('copies date, completionConfig, and targetAudience verbatim', async () => {
    const prisma = mkPrisma({
      sourceItems: [
        timeline({
          id: 's1',
          title: 'Payment Deadline',
          date: new Date('2027-03-15T00:00:00Z'),
          completionType: 'payment_completed',
          completionConfig: { feeType: 'registration_fee' },
          targetAudience: 'accepted',
        }),
      ],
    });
    const copier = new TimelinesCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programTimeline.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        date: new Date('2027-03-15T00:00:00Z'),
        completionType: 'payment_completed',
        completionConfig: { feeType: 'registration_fee' },
        targetAudience: 'accepted',
      }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with the ISO date as meta', async () => {
    const prisma = mkPrisma({ sourceItems: [timeline({ id: 's1', title: 'Registration Opens', date: new Date('2027-01-01T00:00:00Z') })] });
    const copier = new TimelinesCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Registration Opens', meta: '2027-01-01' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/timelines.copier.spec"`
Expected: FAIL — cannot find module `./timelines.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/timelines.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

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
    const items = await this.prisma.programTimeline.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as TimelineRow[]).map((t) => ({
      id: t.id,
      label: t.title,
      meta: t.date.toISOString().slice(0, 10),
    }));
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/timelines.copier.spec"`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/timelines.copier.ts src/modules/programs/application/copy/copiers/timelines.copier.spec.ts
git commit -m "feat(programs): add TimelinesCopier"
```

---

## Task 8: `RundownsCopier` — composite dedupe key (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/rundowns.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1); `copyScopedRows`, `ScopedRowsDelegate` (Task 2).
- Produces: `RundownsCopier` (`key = 'rundowns'`, `label = 'Program Rundowns'`, `supportsAppend = true`) — Task 11 registers it.

The backend model for "rundowns" is `ProgramSchedule` (`content.prisma:79-99`), which has no `title` column — its columns are `day`, `startTime`, `endTime`, `activity`, `description`, `location`, `speaker`. The dedupe key is the composite `(day, activity)`, built as a single string inside `dedupeKey` — `copyScopedRows` (Task 2) already accepts any string-returning function, so no changes to the shared helper are needed for a composite key.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts
import { RundownsCopier } from './rundowns.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

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

function rundown(over: Partial<RundownRow>): RundownRow {
  return {
    id: over.id ?? 'r1',
    day: over.day ?? 'Day 1',
    startTime: over.startTime ?? '09:00',
    endTime: over.endTime ?? '10:00',
    activity: over.activity ?? 'Opening Ceremony',
    description: over.description ?? null,
    location: over.location ?? null,
    speaker: over.speaker ?? null,
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

function mkPrisma(opts: { sourceItems?: RundownRow[]; existingItems?: RundownRow[] } = {}): PrismaService {
  const base: any = {
    programSchedule: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.activity}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('RundownsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new RundownsCopier(mkPrisma());
    expect(copier.key).toBe('rundowns');
    expect(copier.label).toBe('Program Rundowns');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append dedupes on the (day, activity) composite, not activity alone', async () => {
    const prisma = mkPrisma({
      sourceItems: [
        rundown({ id: 's1', day: 'Day 1', activity: 'Opening Ceremony' }),
        // Same activity name on a different day is NOT a collision.
        rundown({ id: 's2', day: 'Day 2', activity: 'Opening Ceremony' }),
      ],
      existingItems: [rundown({ id: 't1', day: 'Day 1', activity: 'Opening Ceremony' })],
    });
    const copier = new RundownsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    // Day 1 collides with the existing row; Day 2 does not.
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing items then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceItems: [rundown({ id: 's1', activity: 'a', order: 3 })],
      existingItems: [rundown({ id: 't1', activity: 'old' })],
    });
    const copier = new RundownsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programSchedule.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (prisma as any).programSchedule.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('copies day/startTime/endTime/location/speaker verbatim', async () => {
    const prisma = mkPrisma({
      sourceItems: [rundown({ id: 's1', day: 'Day 2', startTime: '13:00', endTime: '14:30', location: 'Main Hall', speaker: 'Jane Doe' })],
    });
    const copier = new RundownsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programSchedule.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ day: 'Day 2', startTime: '13:00', endTime: '14:30', location: 'Main Hall', speaker: 'Jane Doe' }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with day as meta', async () => {
    const prisma = mkPrisma({ sourceItems: [rundown({ id: 's1', day: 'Day 1', activity: 'Opening Ceremony' })] });
    const copier = new RundownsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Opening Ceremony', meta: 'Day 1' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/rundowns.copier.spec"`
Expected: FAIL — cannot find module `./rundowns.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/rundowns.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

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

// The backend model for "rundowns" is ProgramSchedule — it has no title
// column, so the dedupe key is the composite (day, activity) rather than a
// single field. "::" is not a valid character in either source column, so
// this join cannot accidentally produce a false collision.
function dedupeKey(row: RundownRow): string {
  return `${row.day}::${row.activity}`;
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
    const items = await this.prisma.programSchedule.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as RundownRow[]).map((r) => ({
      id: r.id,
      label: r.activity,
      meta: r.day,
    }));
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/rundowns.copier.spec"`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/rundowns.copier.ts src/modules/programs/application/copy/copiers/rundowns.copier.spec.ts
git commit -m "feat(programs): add RundownsCopier with composite (day, activity) dedupe key"
```

---

## Task 9: `FaqsCopier` (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/faqs.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/faqs.copier.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1); `copyScopedRows`, `ScopedRowsDelegate` (Task 2).
- Produces: `FaqsCopier` (`key = 'faqs'`, `label = 'FAQs'`, `supportsAppend = true`) — Task 11 registers it.

Dedupes on `question` (`ProgramFaq.question`, `content.prisma:22-40`).

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copiers/faqs.copier.spec.ts
import { FaqsCopier } from './faqs.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
};

function faq(over: Partial<FaqRow>): FaqRow {
  return {
    id: over.id ?? 'q1',
    question: over.question ?? 'How do I apply?',
    answer: over.answer ?? 'Fill out the form.',
    category: over.category ?? 'general',
    order: over.order ?? 0,
    isActive: over.isActive ?? true,
  };
}

function mkPrisma(opts: { sourceItems?: FaqRow[]; existingItems?: FaqRow[] } = {}): PrismaService {
  const base: any = {
    programFaq: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceItems : opts.existingItems) ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.question}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceItems ?? []).length),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('FaqsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new FaqsCopier(mkPrisma());
    expect(copier.key).toBe('faqs');
    expect(copier.label).toBe('FAQs');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new FAQs and dedupes on question', async () => {
    const prisma = mkPrisma({
      sourceItems: [faq({ id: 's1', question: 'How do I apply?' }), faq({ id: 's2', question: 'When is the deadline?' })],
      existingItems: [faq({ id: 't1', question: 'How do I apply?' })],
    });
    const copier = new FaqsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 1, skipped: 1, replaced: 0 });
  });

  it('replace soft-deletes existing FAQs then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceItems: [faq({ id: 's1', question: 'a', order: 3 })],
      existingItems: [faq({ id: 't1', question: 'old' })],
    });
    const copier = new FaqsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programFaq.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }) }),
    );
    const create = (prisma as any).programFaq.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('copies answer and category verbatim', async () => {
    const prisma = mkPrisma({
      sourceItems: [faq({ id: 's1', question: 'Refund policy?', answer: 'Non-refundable after acceptance.', category: 'payment' })],
    });
    const copier = new FaqsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programFaq.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({ answer: 'Non-refundable after acceptance.', category: 'payment' }),
    );
  });

  it('preview() maps rows to CopyPreviewItem with category as meta', async () => {
    const prisma = mkPrisma({ sourceItems: [faq({ id: 's1', question: 'How do I apply?', category: 'registration' })] });
    const copier = new FaqsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'How do I apply?', meta: 'registration' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/faqs.copier.spec"`
Expected: FAIL — cannot find module `./faqs.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/faqs.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';
import { copyScopedRows, ScopedRowsDelegate } from '../copy-scoped-rows';

type FaqRow = {
  id: string;
  question: string;
  answer: string;
  category: string;
  order: number;
  isActive: boolean;
};

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
    const items = await this.prisma.programFaq.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return (items as unknown as FaqRow[]).map((f) => ({
      id: f.id,
      label: f.question,
      meta: f.category,
    }));
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
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/faqs.copier.spec"`
Expected: PASS — 5 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/faqs.copier.ts src/modules/programs/application/copy/copiers/faqs.copier.spec.ts
git commit -m "feat(programs): add FaqsCopier"
```

---

## Task 10: `PaymentsCopier` — two-level tier + validity-period insert (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/payments.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/payments.copier.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1). Does **not** use `copyScopedRows` — the spec calls this out explicitly ("Payments does not use it") because it must insert tiers first, capture generated ids, then insert each tier's validity periods against the new id.
- Produces: `PaymentsCopier` (`key = 'payments'`, `label = 'Payment Options'`, `supportsAppend = true`) — Task 11 registers it.

Dedupes on tier `name` (`ProgramPricingTier.name`, `applications.prisma:5-44`). Must not copy `soldCount` or `currentCount` — those are live usage counters, not content; a copied tier always starts at zero.

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copiers/payments.copier.spec.ts
import { PaymentsCopier } from './payments.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type ValidityPeriodRow = { id: string; pricingTierId: string; startDate: Date; endDate: Date; description: string | null };
type TierRow = {
  id: string;
  name: string;
  description: string | null;
  price: number;
  currency: string;
  usdPrice: number | null;
  idrPrice: number | null;
  capacity: number | null;
  currentCount: number;
  benefits: string[];
  requirements: string[];
  feeType: string;
  allowedCategories: string[];
  icon: string | null;
  soldCount: number;
  isActive: boolean;
  order: number;
  validityPeriods: ValidityPeriodRow[];
};

function tier(over: Partial<TierRow>): TierRow {
  return {
    id: over.id ?? 'p1',
    name: over.name ?? 'Early Bird',
    description: over.description ?? null,
    price: over.price ?? 100,
    currency: over.currency ?? 'USD',
    usdPrice: over.usdPrice ?? 100,
    idrPrice: over.idrPrice ?? 1500000,
    capacity: over.capacity ?? null,
    currentCount: over.currentCount ?? 42,
    benefits: over.benefits ?? [],
    requirements: over.requirements ?? [],
    feeType: over.feeType ?? 'registration_fee',
    allowedCategories: over.allowedCategories ?? ['self_funded'],
    icon: over.icon ?? null,
    soldCount: over.soldCount ?? 17,
    isActive: over.isActive ?? true,
    order: over.order ?? 0,
    validityPeriods: over.validityPeriods ?? [],
  };
}

function mkPrisma(opts: { sourceTiers?: TierRow[]; existingTiers?: TierRow[] } = {}): PrismaService {
  const base: any = {
    programPricingTier: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        Promise.resolve((where.programId === 'src' ? opts.sourceTiers : opts.existingTiers) ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `new-${data.name}`, ...data })),
      count: jest.fn().mockResolvedValue((opts.sourceTiers ?? []).length),
    },
    pricingTierValidityPeriod: {
      create: jest.fn().mockImplementation(({ data }: { data: any }) => Promise.resolve({ id: `period-${Math.random()}`, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('PaymentsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new PaymentsCopier(mkPrisma());
    expect(copier.key).toBe('payments');
    expect(copier.label).toBe('Payment Options');
    expect(copier.supportsAppend).toBe(true);
  });

  it('append copies new tiers, dedupes on name, and resets soldCount/currentCount to 0', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'Early Bird', soldCount: 30, currentCount: 30 })],
      existingTiers: [],
    });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const create = (prisma as any).programPricingTier.create as jest.Mock;
    expect(create.mock.calls[0][0].data.soldCount).toBe(0);
    expect(create.mock.calls[0][0].data.currentCount).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 0 });
  });

  it('append skips a tier whose name collides with an existing tier', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'Early Bird' })],
      existingTiers: [tier({ id: 't1', name: 'Early Bird' })],
    });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 1, replaced: 0 });
  });

  it('remaps validity periods to the newly created tier id, not the source tier id', async () => {
    const prisma = mkPrisma({
      sourceTiers: [
        tier({
          id: 's1',
          name: 'Early Bird',
          validityPeriods: [
            { id: 'vp1', pricingTierId: 's1', startDate: new Date('2027-01-01'), endDate: new Date('2027-02-01'), description: 'Wave 1' },
            { id: 'vp2', pricingTierId: 's1', startDate: new Date('2027-02-01'), endDate: new Date('2027-03-01'), description: 'Wave 2' },
          ],
        }),
      ],
    });
    const copier = new PaymentsCopier(prisma);
    await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    const periodCreate = (prisma as any).pricingTierValidityPeriod.create as jest.Mock;
    expect(periodCreate).toHaveBeenCalledTimes(2);
    expect(periodCreate.mock.calls[0][0].data.pricingTierId).toBe('new-Early Bird');
    expect(periodCreate.mock.calls[0][0].data.pricingTierId).not.toBe('s1');
    expect(periodCreate.mock.calls[0][0].data.description).toBe('Wave 1');
  });

  it('replace soft-deletes existing tiers then inserts from order 0', async () => {
    const prisma = mkPrisma({
      sourceTiers: [tier({ id: 's1', name: 'a', order: 3 })],
      existingTiers: [tier({ id: 't1', name: 'old' })],
    });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).programPricingTier.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (prisma as any).programPricingTier.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(result).toEqual({ created: 1, skipped: 0, replaced: 1 });
  });

  it('empty source is a no-op', async () => {
    const prisma = mkPrisma({ sourceTiers: [] });
    const copier = new PaymentsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 0 });
    expect((prisma as any).programPricingTier.create).not.toHaveBeenCalled();
  });

  it('preview() maps rows to CopyPreviewItem with currency+price as meta', async () => {
    const prisma = mkPrisma({ sourceTiers: [tier({ id: 's1', name: 'Early Bird', currency: 'USD', price: 150 })] });
    const copier = new PaymentsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 's1', label: 'Early Bird', meta: 'USD 150' }]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/payments.copier.spec"`
Expected: FAIL — cannot find module `./payments.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/payments.copier.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';

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
    const tiers = await this.prisma.programPricingTier.findMany({
      where: { programId, deletedAt: null },
      orderBy: { order: 'asc' },
    });
    return tiers.map((t) => ({
      id: t.id,
      label: t.name,
      meta: `${t.currency} ${t.price.toString()}`,
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

    if (sourceTiers.length === 0) {
      return { created: 0, skipped: 0, replaced: 0 };
    }

    let replaced = 0;
    if (mode === 'replace') {
      const result = await tx.programPricingTier.updateMany({
        where: { programId: targetProgramId, deletedAt: null },
        data: { deletedAt: new Date(), isActive: false },
      });
      replaced = result.count;
    }

    const existingTiers =
      mode === 'append'
        ? await tx.programPricingTier.findMany({
            where: { programId: targetProgramId, deletedAt: null },
            select: { name: true, order: true },
          })
        : [];
    const existingNames = new Set(existingTiers.map((t) => t.name));
    const baseOrder =
      mode === 'append' ? existingTiers.reduce((max, t) => Math.max(max, t.order), -1) + 1 : 0;

    let created = 0;
    let skipped = 0;
    let placed = 0;

    for (const tier of sourceTiers) {
      if (existingNames.has(tier.name)) {
        skipped += 1;
        continue;
      }

      // soldCount/currentCount are live usage counters, not content — a
      // copied tier always starts at zero regardless of how much the
      // source tier sold.
      const newTier = await tx.programPricingTier.create({
        data: {
          programId: targetProgramId,
          name: tier.name,
          description: tier.description,
          price: tier.price,
          currency: tier.currency,
          usdPrice: tier.usdPrice,
          idrPrice: tier.idrPrice,
          capacity: tier.capacity,
          currentCount: 0,
          benefits: tier.benefits,
          requirements: tier.requirements,
          feeType: tier.feeType,
          allowedCategories: tier.allowedCategories,
          icon: tier.icon,
          soldCount: 0,
          isActive: tier.isActive,
          order: baseOrder + placed,
        },
      });

      for (const period of tier.validityPeriods) {
        await tx.pricingTierValidityPeriod.create({
          data: {
            pricingTierId: newTier.id,
            startDate: period.startDate,
            endDate: period.endDate,
            description: period.description,
          },
        });
      }

      existingNames.add(tier.name);
      created += 1;
      placed += 1;
    }

    return { created, skipped, replaced };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/payments.copier.spec"`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/payments.copier.ts src/modules/programs/application/copy/copiers/payments.copier.spec.ts
git commit -m "feat(programs): add PaymentsCopier with two-level tier + validity-period insert"
```

---

## Task 11: `ProgramDetailsCopier` — scalar, replace-only (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/copy/copiers/program-details.copier.ts`
- Create: `services/api/src/modules/programs/application/copy/copiers/program-details.copier.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopier`, `CopyInput`, `CopyResult`, `CopyPreviewItem`, `PrismaTx` (Task 1).
- Produces: `ProgramDetailsCopier` (`key = 'program-details'`, `label = 'Participant-Facing Content'`, `supportsAppend = false`) — Task 11's module registration and Task 22's frontend surface reference this key.

Copies three `Program` scalars — `requirementsDescription`, `benefitsDescription`, `termsAndConditions` (`program.prisma:191-194`) — all three of which render together in the "Participant-Facing Content" section (`ProgramSpecificsTab.tsx:156-186`). `supportsAppend = false`: appending to scalars is meaningless, so `copy()` rejects any `mode !== 'replace'` even though the API boundary should already prevent this (Task 13 checks `supportsAppend` before calling `copy()` — this is the copier-level belt-and-suspenders check, matching the existing double-checked `sourceProgramId !== targetProgramId` validation pattern in `program-form-fields.controller.ts` + `copy-fields-from-program.handler.ts`).

- [ ] **Step 1: Write the failing tests**

```typescript
// services/api/src/modules/programs/application/copy/copiers/program-details.copier.spec.ts
import { BadRequestException } from '@nestjs/common';
import { ProgramDetailsCopier } from './program-details.copier';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(programs: Record<string, { requirementsDescription: string | null; benefitsDescription: string | null; termsAndConditions: string | null }>): PrismaService {
  const base: any = {
    program: {
      findUnique: jest.fn().mockImplementation(({ where }: any) => Promise.resolve(programs[where.id] ?? null)),
      update: jest.fn().mockImplementation(({ where, data }: any) => Promise.resolve({ id: where.id, ...data })),
    },
  };
  base.$transaction = jest.fn().mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('ProgramDetailsCopier', () => {
  it('has the expected key/label/supportsAppend', () => {
    const copier = new ProgramDetailsCopier(mkPrisma({}));
    expect(copier.key).toBe('program-details');
    expect(copier.label).toBe('Participant-Facing Content');
    expect(copier.supportsAppend).toBe(false);
  });

  it('replace copies all three scalar fields from the source onto the target', async () => {
    const prisma = mkPrisma({
      src: { requirementsDescription: '<p>Bring a laptop</p>', benefitsDescription: '<p>Certificate</p>', termsAndConditions: '<p>No refunds</p>' },
    });
    const copier = new ProgramDetailsCopier(prisma);
    const result = await copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'replace' });
    expect((prisma as any).program.update).toHaveBeenCalledWith({
      where: { id: 'tgt' },
      data: {
        requirementsDescription: '<p>Bring a laptop</p>',
        benefitsDescription: '<p>Certificate</p>',
        termsAndConditions: '<p>No refunds</p>',
      },
    });
    expect(result).toEqual({ created: 0, skipped: 0, replaced: 1 });
  });

  it('rejects append mode', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: 'x', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    await expect(
      copier.copy(prisma, { sourceProgramId: 'src', targetProgramId: 'tgt', mode: 'append' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect((prisma as any).program.update).not.toHaveBeenCalled();
  });

  it('preview() returns an empty array when the source program has no content in any of the three fields', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: null, benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([]);
  });

  it('preview() returns one item describing how many of the three fields have content', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: '<p>y</p>' } });
    const copier = new ProgramDetailsCopier(prisma);
    const items = await copier.preview('src');
    expect(items).toEqual([{ id: 'src', label: 'Requirements, Benefits & Terms', meta: '2 field(s) with content' }]);
  });

  it('countFor() returns 1 when any field has content, 0 when the program has none or does not exist', async () => {
    const prisma = mkPrisma({ src: { requirementsDescription: '<p>x</p>', benefitsDescription: null, termsAndConditions: null } });
    const copier = new ProgramDetailsCopier(prisma);
    expect(await copier.countFor('src')).toBe(1);
    expect(await copier.countFor('missing')).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/program-details.copier.spec"`
Expected: FAIL — cannot find module `./program-details.copier`.

- [ ] **Step 3: Write the copier**

```typescript
// services/api/src/modules/programs/application/copy/copiers/program-details.copier.ts
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyInput, CopyPreviewItem, CopyResult, PrismaTx, ProgramCopier } from '../program-copier.interface';

type ProgramContentScalars = {
  requirementsDescription: string | null;
  benefitsDescription: string | null;
  termsAndConditions: string | null;
};

const SELECT = { requirementsDescription: true, benefitsDescription: true, termsAndConditions: true } as const;

function contentFieldCount(program: ProgramContentScalars): number {
  return [program.requirementsDescription, program.benefitsDescription, program.termsAndConditions].filter(Boolean).length;
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
    return [
      {
        id: programId,
        label: 'Requirements, Benefits & Terms',
        meta: `${count} field(s) with content`,
      },
    ];
  }

  async copy(tx: PrismaTx, input: CopyInput): Promise<CopyResult> {
    if (input.mode !== 'replace') {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: 'program-details only supports replace mode.',
      });
    }

    const source = await tx.program.findUnique({ where: { id: input.sourceProgramId }, select: SELECT });
    if (!source) {
      throw new NotFoundException(`Program ${input.sourceProgramId} not found`);
    }

    await tx.program.update({
      where: { id: input.targetProgramId },
      data: {
        requirementsDescription: source.requirementsDescription,
        benefitsDescription: source.benefitsDescription,
        termsAndConditions: source.termsAndConditions,
      },
    });

    // There is no per-row count for a scalar copy — replaced: 1 signals
    // "the program row was updated" so a 0 doesn't read as a no-op.
    return { created: 0, skipped: 0, replaced: 1 };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="copiers/program-details.copier.spec"`
Expected: PASS — 6 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/copy/copiers/program-details.copier.ts src/modules/programs/application/copy/copiers/program-details.copier.spec.ts
git commit -m "feat(programs): add ProgramDetailsCopier (requirements, benefits, terms — replace only)"
```

---

## Task 12: Register the registry and all seven copiers in `programs.module.ts`

**Files:**
- Modify: `services/api/src/modules/programs/programs.module.ts`

**Interfaces:**
- Consumes: `ProgramCopierRegistry` (Task 3); `FormFieldsCopier` (Task 5); `ParticipationCategoriesCopier` (Task 6); `TimelinesCopier` (Task 7); `RundownsCopier` (Task 8); `FaqsCopier` (Task 9); `PaymentsCopier` (Task 10); `ProgramDetailsCopier` (Task 11).
- Produces: a working DI graph where `ProgramCopierRegistry` resolves all seven copiers by key — Task 13's controller injects `ProgramCopierRegistry` directly.

This task is compile-verified rather than TDD (it wires existing, already-tested classes into Nest's DI container; there is no new logic to unit test).

- [ ] **Step 1: Replace the old handler import and add the new ones**

In `services/api/src/modules/programs/programs.module.ts`, replace the import at line 33:

```typescript
import { CopyFieldsFromProgramHandler } from './application/commands/handlers/copy-fields-from-program.handler';
```

with:

```typescript
import { ProgramCopierRegistry } from './application/copy/program-copier.registry';
import { FormFieldsCopier } from './application/copy/copiers/form-fields.copier';
import { ParticipationCategoriesCopier } from './application/copy/copiers/participation-categories.copier';
import { TimelinesCopier } from './application/copy/copiers/timelines.copier';
import { RundownsCopier } from './application/copy/copiers/rundowns.copier';
import { FaqsCopier } from './application/copy/copiers/faqs.copier';
import { PaymentsCopier } from './application/copy/copiers/payments.copier';
import { ProgramDetailsCopier } from './application/copy/copiers/program-details.copier';
import { ProgramCopyController } from './presentation/program-copy.controller';
```

- [ ] **Step 2: Add the controller**

In the `controllers` array (currently lines 130-145), add `ProgramCopyController` after `ProgramFormFieldsController` (line 143):

```typescript
    ProgramFormFieldsController,
    ProgramCopyController,
    ProgramScoringController,
```

- [ ] **Step 3: Replace the old handler registration with the registry + copiers**

In the `providers` array, replace line 208 (`CopyFieldsFromProgramHandler,`) with:

```typescript
    ApplyFormTemplateHandler,
    FormFieldsCopier,
    ParticipationCategoriesCopier,
    TimelinesCopier,
    RundownsCopier,
    FaqsCopier,
    PaymentsCopier,
    ProgramDetailsCopier,
    ProgramCopierRegistry,
```

`ProgramCopierRegistry`'s constructor takes the seven copiers as ordinary constructor parameters (Task 3); NestJS resolves them positionally by type from this same `providers` array, so `ProgramCopierRegistry` must be declared after (or anywhere among) the seven copier providers — order within the array does not matter for Nest's DI resolution, only that all eight are present.

- [ ] **Step 4: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. This also resolves the expected `tsc` failure noted at the end of Task 5 Step 6 (the dangling `CopyFieldsFromProgramHandler` reference is now gone).

- [ ] **Step 5: Run the full programs test suite to confirm nothing broke**

Run (from `services/api/`): `npx jest --testPathPattern="modules/programs"`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd services/api
git add src/modules/programs/programs.module.ts
git commit -m "feat(programs): register ProgramCopierRegistry and the seven copiers"
```

---

## Task 13: `ProgramCopyController` — counts, preview, copy (TDD)

**Files:**
- Create: `services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts`
- Create: `services/api/src/modules/programs/presentation/program-copy.controller.ts`
- Create: `services/api/src/modules/programs/presentation/program-copy.controller.spec.ts`

**Interfaces:**
- Consumes: `ProgramCopierRegistry` (Task 3, registered in Task 12); `PrismaService` (for the transaction wrapper); `CopyMode`, `CopyResult`, `CopyPreviewItem` (Task 1).
- Produces: three routes Task 14 (frontend `copy-api.ts`) calls by exact path:
  - `GET /programs/copy/:entityKey/counts?programIds=id1,id2` → `Array<{ programId: string; count: number }>`
  - `GET /programs/:programId/copy/:entityKey/preview` → `CopyPreviewItem[]` (`:programId` here is the program being previewed — typically a candidate *source*, matching `ProgramCopier.preview(programId)`'s single-argument signature)
  - `POST /programs/:programId/copy/:entityKey` (`:programId` is the *target*) with body `CopyEntityDto` → `CopyResult`

The `counts` endpoint takes `programIds` from the client rather than re-deriving "programs this admin can access" server-side: `accessiblePrograms` (used by the dialog for the source picker, Task 15) is already resolved at login and carries no server-side per-program ACL today — every one of the existing content-management routes (`participation-categories`, `faqs`, `timeline`, `pricing-tiers`, the now-removed `copy-from-program`) is gated only by role (`ADMIN`/`SUPER_ADMIN`), not by admin-to-program assignment. This endpoint keeps that same security model rather than inventing a new one.

- [ ] **Step 1: Write the request DTO**

```typescript
// services/api/src/modules/programs/presentation/dto/copy-entity.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CopyEntityDto {
  @ApiProperty({ description: 'Program to copy items FROM.' })
  @IsUUID()
  sourceProgramId!: string;

  @ApiPropertyOptional({
    description: 'Specific source item ids to copy. Omit to copy all.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  itemIds?: string[];

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({
    description: "Must be true when mode='replace' to guard against accidental data loss.",
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
```

- [ ] **Step 2: Write the failing controller tests**

```typescript
// services/api/src/modules/programs/presentation/program-copy.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ProgramCopyController } from './program-copy.controller';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { JwtAuthGuard } from '../../auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../auth/infrastructure/guards/roles.guard';

describe('ProgramCopyController', () => {
  let controller: ProgramCopyController;
  const mockRegistryGet = jest.fn();
  const mockPrismaTransaction = jest.fn();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramCopyController],
      providers: [
        { provide: ProgramCopierRegistry, useValue: { get: mockRegistryGet, list: jest.fn() } },
        { provide: PrismaService, useValue: { $transaction: mockPrismaTransaction } },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgramCopyController>(ProgramCopyController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getCounts', () => {
    it('calls countFor for each program id in the comma-separated query param', async () => {
      const countFor = jest.fn().mockImplementation((id: string) => Promise.resolve(id === 'p1' ? 3 : 0));
      mockRegistryGet.mockReturnValue({ countFor });
      const result = await controller.getCounts('faqs', 'p1,p2');
      expect(mockRegistryGet).toHaveBeenCalledWith('faqs');
      expect(result).toEqual([
        { programId: 'p1', count: 3 },
        { programId: 'p2', count: 0 },
      ]);
    });

    it('returns an empty array when programIds is missing', async () => {
      mockRegistryGet.mockReturnValue({ countFor: jest.fn() });
      const result = await controller.getCounts('faqs', undefined);
      expect(result).toEqual([]);
    });
  });

  describe('preview', () => {
    it('delegates to the copier registered under entityKey', async () => {
      const preview = jest.fn().mockResolvedValue([{ id: 'x', label: 'X' }]);
      mockRegistryGet.mockReturnValue({ preview });
      const result = await controller.preview('prog-1', 'faqs');
      expect(mockRegistryGet).toHaveBeenCalledWith('faqs');
      expect(preview).toHaveBeenCalledWith('prog-1');
      expect(result).toEqual([{ id: 'x', label: 'X' }]);
    });
  });

  describe('copy', () => {
    it('rejects when sourceProgramId equals the target programId', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('prog-1', 'faqs', { sourceProgramId: 'prog-1', mode: 'append' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects replace mode without confirm: true', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy: jest.fn() });
      await expect(
        controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'replace' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('rejects append mode when the copier does not support it', async () => {
      mockRegistryGet.mockReturnValue({ supportsAppend: false, copy: jest.fn() });
      await expect(
        controller.copy('tgt', 'program-details', { sourceProgramId: 'src', mode: 'append' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(mockPrismaTransaction).not.toHaveBeenCalled();
    });

    it('opens a transaction and calls the copier with sourceProgramId/targetProgramId/itemIds/mode (no confirm)', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 2, skipped: 1, replaced: 0 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.copy('tgt', 'faqs', {
        sourceProgramId: 'src',
        itemIds: ['a', 'b'],
        mode: 'append',
      });

      expect(copy).toHaveBeenCalledWith('fake-tx', {
        sourceProgramId: 'src',
        targetProgramId: 'tgt',
        itemIds: ['a', 'b'],
        mode: 'append',
      });
      expect(result).toEqual({ created: 2, skipped: 1, replaced: 0 });
    });

    it('accepts replace mode when confirm is true', async () => {
      const copy = jest.fn().mockResolvedValue({ created: 0, skipped: 0, replaced: 4 });
      mockRegistryGet.mockReturnValue({ supportsAppend: true, copy });
      mockPrismaTransaction.mockImplementation((cb: (tx: unknown) => Promise<unknown>) => cb('fake-tx'));

      const result = await controller.copy('tgt', 'faqs', { sourceProgramId: 'src', mode: 'replace', confirm: true });

      expect(copy).toHaveBeenCalledWith('fake-tx', { sourceProgramId: 'src', targetProgramId: 'tgt', itemIds: undefined, mode: 'replace' });
      expect(result).toEqual({ created: 0, skipped: 0, replaced: 4 });
    });
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run (from `services/api/`): `npx jest --testPathPattern="program-copy.controller.spec"`
Expected: FAIL — cannot find module `./program-copy.controller`.

- [ ] **Step 4: Write the controller**

```typescript
// services/api/src/modules/programs/presentation/program-copy.controller.ts
import { BadRequestException, Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { CacheInvalidate } from '../../../shared/decorators/cache-invalidate.decorator';
import { PROGRAM_CONTENT_PATTERNS } from '@shared/constants/cache-patterns';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { ProgramCopierRegistry } from '../application/copy/program-copier.registry';
import { CopyEntityDto } from './dto/copy-entity.dto';
import { CopyPreviewItem, CopyResult, PrismaTx } from '../application/copy/program-copier.interface';

@ApiTags('Program Content Copy')
@ApiBearerAuth()
@Controller('programs')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class ProgramCopyController {
  constructor(
    private readonly registry: ProgramCopierRegistry,
    private readonly prisma: PrismaService,
  ) {}

  @Get('copy/:entityKey/counts')
  @ApiOperation({ summary: 'Count how many items of one entity type each candidate source program has.' })
  async getCounts(
    @Param('entityKey') entityKey: string,
    @Query('programIds') programIds?: string,
  ): Promise<Array<{ programId: string; count: number }>> {
    const ids = (programIds ?? '').split(',').map((id) => id.trim()).filter(Boolean);
    if (ids.length === 0) return [];
    const copier = this.registry.get(entityKey);
    const counts = await Promise.all(ids.map((id) => copier.countFor(id)));
    return ids.map((programId, index) => ({ programId, count: counts[index] }));
  }

  @Get(':programId/copy/:entityKey/preview')
  @ApiOperation({ summary: 'Preview the copyable items of one entity type for a program.' })
  async preview(
    @Param('programId') programId: string,
    @Param('entityKey') entityKey: string,
  ): Promise<CopyPreviewItem[]> {
    const copier = this.registry.get(entityKey);
    return copier.preview(programId);
  }

  @Post(':programId/copy/:entityKey')
  @ApiOperation({ summary: 'Copy one entity type from another program into this program (append or replace).' })
  @CacheInvalidate(PROGRAM_CONTENT_PATTERNS)
  async copy(
    @Param('programId') programId: string,
    @Param('entityKey') entityKey: string,
    @Body() dto: CopyEntityDto,
  ): Promise<CopyResult> {
    const copier = this.registry.get(entityKey);
    const mode = dto.mode ?? 'append';

    if (dto.sourceProgramId === programId) {
      throw new BadRequestException({
        code: 'invalid_source',
        message: 'Source program must differ from the target program.',
      });
    }
    if (mode === 'replace' && dto.confirm !== true) {
      throw new BadRequestException({
        code: 'confirm_required',
        message: "Replace mode requires 'confirm: true' in the request body.",
      });
    }
    if (mode === 'append' && !copier.supportsAppend) {
      throw new BadRequestException({
        code: 'append_not_supported',
        message: `'${entityKey}' only supports replace mode.`,
      });
    }

    return this.prisma.$transaction((tx: unknown) =>
      copier.copy(tx as PrismaTx, {
        sourceProgramId: dto.sourceProgramId,
        targetProgramId: programId,
        itemIds: dto.itemIds,
        mode,
      }),
    );
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run (from `services/api/`): `npx jest --testPathPattern="program-copy.controller.spec"`
Expected: PASS — 8 passing tests.

- [ ] **Step 6: Register the controller and run the full programs suite**

The controller and DTO were already added to `programs.module.ts`'s imports/`controllers` array in Task 12 Step 1-2; if executing tasks out of order, add them now following those same steps.

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

Run (from `services/api/`): `npx jest --testPathPattern="modules/programs"`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/dto/copy-entity.dto.ts src/modules/programs/presentation/program-copy.controller.ts src/modules/programs/presentation/program-copy.controller.spec.ts
git commit -m "feat(programs): add ProgramCopyController (counts, preview, copy)"
```

---

## Task 14: Frontend shared `copy-api.ts` client

**Files:**
- Create: `services/admin-dashboard/app/components/shared/copy-from-program/copy-api.ts`

**Interfaces:**
- Consumes: `buildApiUrl`, `getAccessToken`, `readErrorMessage`, `readJsonData` from `@/app/components/submissionsMasterData/api` (already used outside its own folder — e.g. `program-details/page.tsx:25` — so it is the established shared HTTP-helper module, not folder-scoped despite its path).
- Produces: `CopyPreviewItem`, `CopyResult`, `SourceCount` types and `fetchCopySourceCounts`, `fetchCopyPreview`, `postCopyEntity` functions — Task 15's dialog shell imports these exact names.

No FE test runner exists in this repo (confirmed by the 2026-06-15 copy-form-fields plan's own tech-stack line); this task is verified by `tsc` only, matching that precedent.

- [ ] **Step 1: Write the client**

```typescript
// services/admin-dashboard/app/components/shared/copy-from-program/copy-api.ts
import {
  buildApiUrl,
  getAccessToken,
  readErrorMessage,
  readJsonData,
} from "@/app/components/submissionsMasterData/api";

export type CopyPreviewItem = {
  id: string;
  label: string;
  meta?: string;
  hasExternalMedia?: boolean;
};

export type CopyResult = {
  created: number;
  skipped: number;
  replaced: number;
};

export type SourceCount = {
  programId: string;
  count: number;
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

/** Counts how many items of `entityKey` each of `programIds` currently has. */
export async function fetchCopySourceCounts(
  entityKey: string,
  programIds: string[],
): Promise<SourceCount[]> {
  if (programIds.length === 0) return [];
  const qs = `?programIds=${programIds.map(encodeURIComponent).join(",")}`;
  const response = await fetch(
    buildApiUrl(`/programs/copy/${encodeURIComponent(entityKey)}/counts${qs}`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<SourceCount[]>(response);
}

/** Previews the copyable items of `entityKey` on `programId` (typically a candidate source). */
export async function fetchCopyPreview(
  entityKey: string,
  programId: string,
): Promise<CopyPreviewItem[]> {
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(programId)}/copy/${encodeURIComponent(entityKey)}/preview`),
    { headers: authHeaders() },
  );
  return jsonOrThrow<CopyPreviewItem[]>(response);
}

/**
 * Copies `entityKey` from `params.sourceProgramId` into `targetProgramId`.
 * - `append` (default, safe): add selected items; skip any whose dedupe key already exists.
 * - `replace`: soft-delete the target's existing items, then insert. Requires `confirm: true`;
 *   this helper sets it automatically when mode is 'replace'.
 */
export async function postCopyEntity(
  entityKey: string,
  targetProgramId: string,
  params: { sourceProgramId: string; itemIds?: string[]; mode: "append" | "replace" },
): Promise<CopyResult> {
  const body: Record<string, unknown> = {
    sourceProgramId: params.sourceProgramId,
    mode: params.mode,
  };
  if (params.itemIds) {
    body.itemIds = params.itemIds;
  }
  if (params.mode === "replace") {
    body.confirm = true;
  }
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(targetProgramId)}/copy/${encodeURIComponent(entityKey)}`),
    {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<CopyResult>(response);
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors referencing `copy-api.ts`.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/shared/copy-from-program/copy-api.ts
git commit -m "feat(admin): add generic copy-from-program API client"
```

---

## Task 15: Extract the generic `CopyFromProgramDialog` shell

**Files:**
- Create: `services/admin-dashboard/app/components/shared/copy-from-program/CopyFromProgramDialog.tsx`

**Interfaces:**
- Consumes: `CopyPreviewItem`, `CopyResult`, `fetchCopySourceCounts`, `fetchCopyPreview`, `postCopyEntity` (Task 14); `useAuth` from `@/app/contexts/AuthContext` (unchanged shape: `accessiblePrograms: AdminProgram[]` with `programId`, `brandId`, `brandName`, `programName`, `programYear`).
- Produces: `CopyFromProgramDialog` React component with props `{ open, entityKey, entityLabel, programId, supportsAppend, referenceBrandName?, onClose, onApplied }` — Task 16 through Task 22 all import this exact component and prop shape.

The existing `submissionsMasterData/form-fields/CopyFromProgramDialog.tsx` (395 lines) is real, working code — this task extracts its shell rather than relocating it verbatim, because three things in it are form-fields-specific and must become parameters or be pushed server-side instead of copied as-is:

1. **`REFERENCE_BRAND_NAME = 'China Youth Summit'`** is woven through four places (the reference/other option split, `defaultReferenceId`, the auto-select-on-open effect, and the `★ Reference` label). Extracting it verbatim would silently pin every new surface's default source to China Youth Summit. It becomes the optional `referenceBrandName` prop — only the form-fields call site (Task 16) passes `'China Youth Summit'`; every other surface (Tasks 17-22) omits it, so their source picker has no pinned default and no `★ Reference` grouping.
2. **The item list renders `f.label` / `f.fieldName` / `f.fieldType` / `f.section` directly** — fields that exist only on form fields. This plan avoids needing a per-entity row-renderer prop by having each copier's `preview()` (Tasks 5-11) format its own `label`/`meta` string server-side into the entity-agnostic `CopyPreviewItem` shape; the shell only ever renders `item.label` (bold) and `item.meta` (muted secondary line), which already carries whatever detail each entity wants to show.
3. **The cross-brand media warning tests `f.mediaUrl` / `f.helpAssets`**, which exist only on form fields. This becomes generic via `CopyPreviewItem.hasExternalMedia` (Task 1): the `FormFieldsCopier` sets it from `mediaUrl`/`helpAssets` (Task 5); every other copier's `preview()` simply omits the field, so the warning never fires for them.

- [ ] **Step 1: Create the component**

```tsx
// services/admin-dashboard/app/components/shared/copy-from-program/CopyFromProgramDialog.tsx
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
import {
  fetchCopyPreview,
  fetchCopySourceCounts,
  postCopyEntity,
  type CopyPreviewItem,
  type CopyResult,
} from "./copy-api";

interface CopyFromProgramDialogProps {
  open: boolean;
  entityKey: string;
  entityLabel: string;
  programId: string;
  /** Hides the append/replace toggle and forces mode='replace' when false (e.g. program-details). */
  supportsAppend: boolean;
  /**
   * When set, programs from this brand (case-insensitive match) are pinned to
   * the top of the source picker and the newest one is pre-selected on open.
   * Omit for surfaces that should not default to any particular source.
   */
  referenceBrandName?: string;
  onClose: () => void;
  onApplied: (result: CopyResult) => void;
}

const INPUT_CLS =
  "block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 shadow-sm outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

export function CopyFromProgramDialog({
  open,
  entityKey,
  entityLabel,
  programId,
  supportsAppend,
  referenceBrandName,
  onClose,
  onApplied,
}: CopyFromProgramDialogProps) {
  const { accessiblePrograms } = useAuth();

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [items, setItems] = useState<CopyPreviewItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingItems, setLoadingItems] = useState(false);
  const [itemsError, setItemsError] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">(supportsAppend ? "append" : "replace");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceCounts, setSourceCounts] = useState<Map<string, number>>(new Map());

  const currentBrandId = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId)?.brandId ?? null,
    [accessiblePrograms, programId],
  );

  function isReferenceProgram(brandName: string): boolean {
    if (!referenceBrandName) return false;
    return brandName.trim().toLowerCase() === referenceBrandName.trim().toLowerCase();
  }

  // All eligible source programs (excluding the current one), split into
  // reference and non-reference groups when referenceBrandName is set.
  const { referenceOptions, otherOptions } = useMemo(() => {
    const eligible = accessiblePrograms.filter((p) => p.programId !== programId);

    if (!referenceBrandName) {
      const all = eligible
        .slice()
        .sort((a, b) =>
          a.brandName === b.brandName ? b.programYear - a.programYear : a.brandName.localeCompare(b.brandName),
        );
      return { referenceOptions: [], otherOptions: all };
    }

    const ref = eligible
      .filter((p) => isReferenceProgram(p.brandName))
      .slice()
      .sort((a, b) => b.programYear - a.programYear); // newest first

    const other = eligible
      .filter((p) => !isReferenceProgram(p.brandName))
      .slice()
      .sort((a, b) =>
        a.brandName === b.brandName ? b.programYear - a.programYear : a.brandName.localeCompare(b.brandName),
      );

    return { referenceOptions: ref, otherOptions: other };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessiblePrograms, programId, referenceBrandName]);

  const allSourceOptions = useMemo(
    () => [...referenceOptions, ...otherOptions],
    [referenceOptions, otherOptions],
  );

  const defaultReferenceId = useMemo(
    () => referenceOptions[0]?.programId ?? null,
    [referenceOptions],
  );

  const filteredSourceOptions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return allSourceOptions;
    return allSourceOptions.filter((p) =>
      [p.programName, p.brandName, String(p.programYear)].some((s) => s.toLowerCase().includes(q)),
    );
  }, [allSourceOptions, search]);

  const selectedSource = useMemo(
    () => accessiblePrograms.find((p) => p.programId === sourceId) ?? null,
    [accessiblePrograms, sourceId],
  );

  // Reset everything when the dialog opens; default-select the newest
  // reference program if this surface has one configured.
  useEffect(() => {
    if (!open) return;
    setSourceId(defaultReferenceId);
    setItems([]);
    setSelectedIds(new Set());
    setLoadingItems(false);
    setItemsError(null);
    setMode(supportsAppend ? "append" : "replace");
    setConfirmText("");
    setSearch("");
  }, [open, defaultReferenceId, supportsAppend]);

  // Fetch per-source counts for the candidate list in the background once
  // the dialog opens, so the dropdown can show "(N items)" per option.
  useEffect(() => {
    if (!open || allSourceOptions.length === 0) return;
    let cancelled = false;
    fetchCopySourceCounts(entityKey, allSourceOptions.map((p) => p.programId))
      .then((counts) => {
        if (cancelled) return;
        setSourceCounts(new Map(counts.map((c) => [c.programId, c.count])));
      })
      .catch(() => {
        // Counts are a display nicety, not required to use the dialog.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entityKey]);

  // Load the source program's items when the source changes.
  useEffect(() => {
    if (!sourceId) {
      setItems([]);
      setSelectedIds(new Set());
      return;
    }
    let cancelled = false;
    setLoadingItems(true);
    setItemsError(null);
    fetchCopyPreview(entityKey, sourceId)
      .then((rows) => {
        if (cancelled) return;
        setItems(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
      })
      .catch((err) => {
        if (cancelled) return;
        setItemsError(err instanceof Error ? err.message : "Failed to load items");
      })
      .finally(() => {
        if (!cancelled) setLoadingItems(false);
      });
    return () => {
      cancelled = true;
    };
  }, [entityKey, sourceId]);

  const allSelected = items.length > 0 && selectedIds.size === items.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(items.map((i) => i.id)));
  }

  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const crossBrandMediaWarning = useMemo(() => {
    if (!selectedSource || !currentBrandId) return false;
    if (selectedSource.brandId === currentBrandId) return false;
    return items.some((i) => selectedIds.has(i.id) && i.hasExternalMedia);
  }, [selectedSource, currentBrandId, items, selectedIds]);

  const replaceConfirmed = mode !== "replace" || confirmText.trim().toUpperCase() === "REPLACE";
  const canApply = !!sourceId && selectedIds.size > 0 && replaceConfirmed && !applying;

  async function handleApply() {
    if (!sourceId) return;
    setApplying(true);
    try {
      const itemIds = selectedIds.size === items.length ? undefined : Array.from(selectedIds);
      const result = await postCopyEntity(entityKey, programId, { sourceProgramId: sourceId, itemIds, mode });
      toast.success(
        result.skipped > 0
          ? `Copied ${result.created} item(s). Skipped ${result.skipped} duplicate(s).`
          : `Copied ${result.created} item(s).`,
      );
      onApplied(result);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to copy ${entityLabel.toLowerCase()}`);
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && !applying && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto p-0">
        <SheetHeader className="sticky top-0 z-10 border-b border-zinc-200 bg-white px-6 py-4">
          <SheetTitle>Copy from another program</SheetTitle>
          <SheetDescription>
            Copy {entityLabel.toLowerCase()} from any program you can access into this one.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-6 py-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Source program
            </h3>

            <input
              type="search"
              aria-label="Search programs"
              placeholder="Search by name, brand, or year…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={`${INPUT_CLS} mb-2`}
            />

            <select
              className={INPUT_CLS}
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(e.target.value || null)}
            >
              <option value="">Select a program…</option>
              {filteredSourceOptions.map((p) => {
                const isRef = isReferenceProgram(p.brandName);
                const count = sourceCounts.get(p.programId);
                const countSuffix = count === undefined ? "" : ` (${count})`;
                const label = isRef
                  ? `★ Reference · ${p.programName} · ${p.brandName} · ${p.programYear}${countSuffix}`
                  : `${p.programName} · ${p.brandName} · ${p.programYear}${countSuffix}`;
                return (
                  <option key={p.programId} value={p.programId}>
                    {label}
                  </option>
                );
              })}
            </select>
          </section>

          {loadingItems && <p className="text-xs text-zinc-500">Loading {entityLabel.toLowerCase()}…</p>}
          {itemsError && <p className="text-sm text-rose-600">{itemsError}</p>}

          {!loadingItems && !itemsError && items.length > 0 && (
            <section>
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
                  {entityLabel} ({selectedIds.size}/{items.length})
                </h3>
                <button type="button" className="text-xs text-blue-600 hover:underline" onClick={toggleAll}>
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-zinc-200 bg-white p-2">
                {items.map((item) => (
                  <li key={item.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-zinc-50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(item.id)}
                        onChange={() => toggleOne(item.id)}
                      />
                      <span className="text-sm text-zinc-800">{item.label}</span>
                      {item.meta ? <span className="ml-auto text-[11px] text-zinc-400">{item.meta}</span> : null}
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!loadingItems && !itemsError && sourceId && items.length === 0 && (
            <p className="text-xs text-zinc-500">This program has no {entityLabel.toLowerCase()} to copy.</p>
          )}

          {supportsAppend && items.length > 0 && (
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
                  <p className="mt-1 text-xs text-zinc-500">
                    Add selected items; skip any whose key already exists in this program.
                  </p>
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
                    Remove this program&apos;s current {entityLabel.toLowerCase()} first, then copy. Destructive.
                  </p>
                </button>
              </div>
            </section>
          )}

          {mode === "replace" && items.length > 0 && (
            <div className="rounded-md border border-rose-200 bg-rose-50 px-3 py-2">
              <p className="mb-2 text-xs text-rose-700">
                This will soft-delete this program&apos;s current {entityLabel.toLowerCase()}. Type{" "}
                <strong>REPLACE</strong> to confirm.
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

          {crossBrandMediaWarning && (
            <p className="text-xs text-zinc-500">
              Some selected items reference media from another brand&apos;s storage. The images will work, but
              consider re-uploading them under this brand.
            </p>
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
            {applying ? "Copying…" : mode === "replace" ? "Replace" : "Copy"}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors referencing `CopyFromProgramDialog.tsx`.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/shared/copy-from-program/CopyFromProgramDialog.tsx
git commit -m "feat(admin): extract generic CopyFromProgramDialog shell"
```

---

## Task 16: Re-point Submission Form Fields at the shared dialog (proves the abstraction)

**Files:**
- Delete: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx`
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/catalog-api.ts` (remove lines 256-307, the `Copy-from-program` section)
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx` (import at line 22; render block at lines 425-433)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'form-fields', entityLabel: 'Application Form Fields', programId, supportsAppend: true, referenceBrandName: 'China Youth Summit', onClose, onApplied }`.

This is the surface the spec calls out by name: extract the shell from the working dialog, re-point this exact page at it, and verify it still works **before** any other surface reuses it. Verification here is what proves the abstraction, not a formality — Tasks 17-22 depend on this step actually having caught a regression if there were one.

- [ ] **Step 1: Delete the old bespoke dialog**

```bash
cd services/admin-dashboard
git rm app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx
```

- [ ] **Step 2: Remove the copy-specific exports from `catalog-api.ts`**

In `services/admin-dashboard/app/components/submissionsMasterData/form-fields/catalog-api.ts`, delete the entire `// -------- Copy-from-program --------` section (currently lines 256-307):

```typescript
// -------- Copy-from-program --------

export type ProgramFormFieldRow = {
  id: string;
  fieldName: string;
  label: string;
  section?: string;
  fieldType: string;
  isRequired: boolean;
  mediaUrl?: string;
  helpAssets?: unknown[];
};

export async function fetchProgramFormFields(
  programId: string,
): Promise<ProgramFormFieldRow[]> {
  const url = buildApiUrl(`/programs/${encodeURIComponent(programId)}/form-fields`);
  const response = await fetch(url, { headers: authHeaders() });
  return jsonOrThrow<ProgramFormFieldRow[]>(response);
}

export async function copyFieldsFromProgram(
  programId: string,
  params: {
    sourceProgramId: string;
    fieldIds?: string[];
    mode: "append" | "replace";
  },
): Promise<{ mode: string; sourceProgramId: string; added: string[]; skipped: string[] }> {
  const body: Record<string, unknown> = {
    sourceProgramId: params.sourceProgramId,
    mode: params.mode,
  };
  if (params.fieldIds) {
    body.fieldIds = params.fieldIds;
  }
  if (params.mode === "replace") {
    body.confirm = true;
  }
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(programId)}/form-fields/copy-from-program`),
    {
      method: "POST",
      headers: {
        ...authHeaders(),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    },
  );
  return jsonOrThrow<{ mode: string; sourceProgramId: string; added: string[]; skipped: string[] }>(response);
}
```

(This endpoint no longer exists after Task 5; leaving this code in place would call a 404.)

- [ ] **Step 3: Re-point `FormFieldsTable.tsx` at the shared dialog**

Replace the import at line 22:

```tsx
import { CopyFromProgramDialog } from "./CopyFromProgramDialog";
```

with:

```tsx
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

Replace the render block (currently lines 425-433):

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        programId={resolvedProgramId}
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          void loadFields();
        }}
      />
```

with:

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="form-fields"
        entityLabel="Application Form Fields"
        programId={resolvedProgramId}
        supportsAppend
        referenceBrandName="China Youth Summit"
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          void loadFields();
        }}
      />
```

The `onApplied` callback keeps its existing zero-argument signature — TypeScript allows a callback with fewer declared parameters than the prop type provides, so this compiles unchanged even though `CopyFromProgramDialog`'s `onApplied` prop is typed `(result: CopyResult) => void`.

- [ ] **Step 4: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors. If any remain referencing the deleted `catalog-api.ts` exports, confirm nothing else in the repo imports `copyFieldsFromProgram` or `fetchProgramFormFields` (verified during research: only the deleted dialog referenced them).

- [ ] **Step 5: Manual verification against a running dev stack — this is the abstraction proof, do not skip**

1. Open a program's Master Data > Submission Form > Form Fields tab.
2. Click "Copy from program". Confirm the source dropdown lists other programs across brands, excludes the current one, pins China Youth Summit programs to the top with the `★ Reference` prefix, and pre-selects the newest one.
3. Confirm each dropdown option now shows a `(N)` count suffix once counts load.
4. Pick a source with fields; confirm fields load, all are pre-selected, and each row shows `fieldName · fieldType · section` as before.
5. Deselect a few fields, append mode → "Copy". Confirm new fields appear, duplicates by exact name are skipped (toast now reads "Copied N item(s). Skipped M duplicate(s)." — count-only, no longer names the skipped fields), and ordering lands after existing fields.
6. Repeat with Replace mode into a throwaway program; confirm the REPLACE-to-confirm gate still works and the table is replaced.
7. Copy a field with media from a different brand; confirm the cross-brand media note still appears.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add app/components/submissionsMasterData/form-fields/catalog-api.ts app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx
git commit -m "refactor(admin): re-point Submission Form Fields at the shared CopyFromProgramDialog"
```


---

## Task 17: "Copy from program" on Participation Categories

**Files:**
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/categories/ParticipationCategoriesTable.tsx` (import after line 14; state after line 220; header block replaces lines 393-396; dialog render after line 486)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'participation-categories', entityLabel: 'Participation Categories', programId, supportsAppend: true, onClose, onApplied }` — matches `ParticipationCategoriesCopier`'s `key = 'participation-categories'`, `label = 'Participation Categories'`, `supportsAppend = true` (Task 6).

This surface omits `referenceBrandName` — only the Submission Form Fields call site (Task 16) pins a reference brand; every other surface, including this one, leaves the source picker unpinned per Task 15's design. The in-use guard on `ParticipationCategoriesCopier.copy()` (Task 6) needs no special handling here: a blocked replace throws a `ConflictException` that surfaces through `postCopyEntity`'s existing `jsonOrThrow` into `CopyFromProgramDialog`'s existing `catch` → `toast.error(err.message)` path (Task 15), the same as any other copy failure.

- [ ] **Step 1: Add the import**

In `services/admin-dashboard/app/components/submissionsMasterData/categories/ParticipationCategoriesTable.tsx`, insert after line 14 (`import { RichTextEditor } from "@/src/admin/components/rich-text-editor";`):

```tsx
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

- [ ] **Step 2: Add the dialog-open state**

Insert after line 220 (`const [deletingId, setDeletingId] = useState<string | null>(null);`):

```tsx
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add the "Copy from program" button next to "Add Category"**

Replace lines 393-396:

```tsx
        <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
          <PlusIcon className="h-4 w-4" />
          <span>Add Category</span>
        </button>
```

with:

```tsx
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCopyFromProgramOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from program</span>
          </button>
          <button type="button" onClick={openCreateModal} className="inline-flex items-center gap-1.5 rounded-md border border-blue-500 bg-blue-500 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-600">
            <PlusIcon className="h-4 w-4" />
            <span>Add Category</span>
          </button>
        </div>
```

This reuses `FormFieldsTable.tsx`'s "Copy from program" button verbatim (`FormFieldsTable.tsx:274-280`) — same classes, same "secondary action before the primary Add button" position — so the affordance reads as the same feature wherever it appears.

- [ ] **Step 4: Render the dialog**

Insert after line 486 (the `<CategoryModal ... />` closing `/>`), before line 487 (`</section>`):

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="participation-categories"
        entityLabel="Participation Categories"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
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
git commit -m "feat(admin): add Copy from program to Participation Categories"
```

---

## Task 18: "Copy from program" on Timelines

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/timelines/page.tsx` (import after line 25; state after line 41; header buttons at lines 99-102; dialog render after line 185)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'timelines', entityLabel: 'Timelines', programId, supportsAppend: true, onClose, onApplied }` — matches `TimelinesCopier`'s `key = 'timelines'`, `label = 'Timelines'`, `supportsAppend = true` (Task 7).

`TimelinesTable.tsx` and its `TimelinesActions.tsx` sibling (the dead code noted in the plan's File Structure section) are not touched — `timelines/page.tsx` is the only live surface for this entity.

- [ ] **Step 1: Add the import**

Insert after line 25 (`} from "@/src/ui/sheet";`):

```tsx
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

- [ ] **Step 2: Add the dialog-open state**

Insert after line 41 (`const [deleteLoading, setDeleteLoading] = useState(false);`):

```tsx
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add the "Copy from program" button next to Refresh/Add**

Replace lines 99-102:

```tsx
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add</button>
          </div>
```

with:

```tsx
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button
              type="button"
              onClick={() => setCopyFromProgramOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from program</span>
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add</button>
          </div>
```

This page's own buttons use a smaller `text-[11px]` compact treatment throughout, but the "Copy from program" trigger reuses `FormFieldsTable.tsx`'s exact classes (`FormFieldsTable.tsx:274-280`) instead of the local compact style, so this one shared action looks and behaves identically on every surface that offers it — a deliberate consistency call, not an oversight.

- [ ] **Step 4: Render the dialog**

Insert after line 185 (the `<TimelineSheet ... />` closing `/>`), before line 187 (`{deleteTarget && ...}`):

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="timelines"
        entityLabel="Timelines"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
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
git commit -m "feat(admin): add Copy from program to Timelines"
```

---

## Task 19: "Copy from program" on FAQs

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/faqs/page.tsx` (import after line 24; state after line 50; header buttons at lines 111-114; dialog render after line 208)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'faqs', entityLabel: 'FAQs', programId, supportsAppend: true, onClose, onApplied }` — matches `FaqsCopier`'s `key = 'faqs'`, `label = 'FAQs'`, `supportsAppend = true` (Task 9).

Same dead-code note as Task 18 — `ProgramFaqsTable.tsx`/`ProgramFaqsActions.tsx` are untouched; `faqs/page.tsx` is the only live surface.

- [ ] **Step 1: Add the import**

Insert after line 24 (`} from "@/src/ui/sheet";`):

```tsx
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

- [ ] **Step 2: Add the dialog-open state**

Insert after line 50 (`const [deleteLoading, setDeleteLoading] = useState(false);`):

```tsx
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add the "Copy from program" button next to Refresh/Add FAQ**

Replace lines 111-114:

```tsx
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add FAQ</button>
          </div>
```

with:

```tsx
          <div className="flex gap-2">
            <button type="button" onClick={load} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button
              type="button"
              onClick={() => setCopyFromProgramOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from program</span>
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add FAQ</button>
          </div>
```

Same `FormFieldsTable.tsx:274-280` button reused verbatim as Task 18, for the same consistency reason.

- [ ] **Step 4: Render the dialog**

Insert after line 208 (the `<FaqSheet ... />` closing `/>`), before line 210 (`{deleteTarget && (`):

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="faqs"
        entityLabel="FAQs"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
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
git commit -m "feat(admin): add Copy from program to FAQs"
```

---

## Task 20: "Copy from program" on Program Rundowns

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/program-rundowns/page.tsx` (import after line 24; state after line 41; header buttons at lines 125-128; dialog render after line 251)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'rundowns', entityLabel: 'Program Rundowns', programId, supportsAppend: true, onClose, onApplied }` — matches `RundownsCopier`'s `key = 'rundowns'`, `label = 'Program Rundowns'`, `supportsAppend = true` (Task 8).

`RundownsCopier` dedupes on the composite `(day, activity)` key (Task 8), not a single field — this is entirely server-side and invisible to the dialog, which already renders whatever `preview()` puts in `label`/`meta` (Task 15). Same dead-code note as Tasks 18-19 — `ProgramRundownsTable.tsx`/`ProgramRundownsActions.tsx` are untouched; `program-rundowns/page.tsx` is the only live surface.

- [ ] **Step 1: Add the import**

Insert after line 24 (`} from "@/src/ui/sheet";`):

```tsx
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

- [ ] **Step 2: Add the dialog-open state**

Insert after line 41 (`const [deleteLoading, setDeleteLoading] = useState(false);`):

```tsx
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add the "Copy from program" button next to Refresh/Add Session**

Replace lines 125-128:

```tsx
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Session</button>
          </div>
```

with:

```tsx
          <div className="flex gap-2">
            <button type="button" onClick={fetch} className="inline-flex items-center gap-1 rounded-md border border-zinc-200 px-2.5 py-1.5 text-[11px] font-medium text-zinc-600 hover:bg-zinc-50"><ArrowPathIcon className="h-3.5 w-3.5" />Refresh</button>
            <button
              type="button"
              onClick={() => setCopyFromProgramOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
            >
              <span>Copy from program</span>
            </button>
            <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-1 rounded-md bg-blue-500 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-600"><PlusIcon className="h-3.5 w-3.5" />Add Session</button>
          </div>
```

Same `FormFieldsTable.tsx:274-280` button reused verbatim, for the same consistency reason as Tasks 18-19.

- [ ] **Step 4: Render the dialog**

Insert after line 251 (the `<ScheduleSheet ... />` closing `/>`), before line 253 (`{deleteTarget && <ConfirmDelete ... />}`):

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="rundowns"
        entityLabel="Program Rundowns"
        programId={resolvedProgramId}
        supportsAppend
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
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
git commit -m "feat(admin): add Copy from program to Program Rundowns"
```

---

## Task 21: "Copy from program" on Payment Options

**Files:**
- Modify: `services/admin-dashboard/app/components/programPaymentsMasterData/options/PaymentOptionTable.tsx` (directive + imports replace lines 1-8; state after line 44; header block replaces line 52; dialog render after line 164)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'payments', entityLabel: 'Payment Options', programId, supportsAppend: true, onClose, onApplied }` — matches `PaymentsCopier`'s `key = 'payments'`, `label = 'Payment Options'`, `supportsAppend = true` (Task 10).

`ProgramPaymentsTable` (exported from this file) has no `"use client"` directive of its own today — it compiles because it's only ever imported from `ProgramPaymentsClient.tsx`, which already has the directive (confirmed: `grep -rn "ProgramPaymentsTable" app` outside this file matches only that one import site), so the whole tree it renders in is already client-side. It also has no `useState` today. Since this task adds one, this task adds the directive explicitly too, matching its sibling `PaymentOptionActions.tsx:1`, which already declares it — removing any ambiguity now that this file owns state. `programId` is typed `programId?: string` on `ProgramPaymentsTable` (it's optional there for reasons unrelated to this task), but `CopyFromProgramDialog.programId` is a required `string` (Task 15) — Step 4 guards the dialog's render on `programId` being truthy rather than widening the shared dialog's prop type.

- [ ] **Step 1: Add the "use client" directive and the new imports**

Replace lines 1-8:

```tsx
import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import { 
  PaymentOptionSearch,
  AddPaymentOptionAction, 
  EditPaymentOptionAction, 
  DeletePaymentOptionAction,
  ManagePeriodsAction
} from "./PaymentOptionActions";
```

with:

```tsx
"use client";

import { useState } from "react";
import { CalendarDaysIcon } from "@heroicons/react/24/solid";
import { 
  PaymentOptionSearch,
  AddPaymentOptionAction, 
  EditPaymentOptionAction, 
  DeletePaymentOptionAction,
  ManagePeriodsAction
} from "./PaymentOptionActions";
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

- [ ] **Step 2: Add the dialog-open state**

Insert after line 44 (`}) {`), before line 45 (`return (`):

```tsx
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add the "Copy from program" button next to "Add Payment Option"**

Replace line 52:

```tsx
        <AddPaymentOptionAction programId={programId} programUsdInIdr={programUsdInIdr} onSaved={onRefresh} />
```

with:

```tsx
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCopyFromProgramOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
          >
            <span>Copy from program</span>
          </button>
          <AddPaymentOptionAction programId={programId} programUsdInIdr={programUsdInIdr} onSaved={onRefresh} />
        </div>
```

Same `FormFieldsTable.tsx:274-280` button reused verbatim, for the same consistency reason as Tasks 18-20.

- [ ] **Step 4: Render the dialog, guarded on `programId`**

Insert after line 164 (the closing `</div>` of the table wrapper), before line 165 (the closing `</div>` of the outer `space-y-4` container):

```tsx
      {programId ? (
        <CopyFromProgramDialog
          open={copyFromProgramOpen}
          entityKey="payments"
          entityLabel="Payment Options"
          programId={programId}
          supportsAppend
          onClose={() => setCopyFromProgramOpen(false)}
          onApplied={() => {
            setCopyFromProgramOpen(false);
            onRefresh?.();
          }}
        />
      ) : null}
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add app/components/programPaymentsMasterData/options/PaymentOptionTable.tsx
git commit -m "feat(admin): add Copy from program to Payment Options"
```

---

## Task 22: "Copy from program" on Program Details (Participant-Facing Content)

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/master-data/program-details/page.tsx` (import after line 27; state after line 280; `refreshProgramDetail` helper after line 471; specifics-tab action block replaces lines 509-516; dialog render after line 540)

**Interfaces:**
- Consumes: `CopyFromProgramDialog` (Task 15) with props `{ open, entityKey: 'program-details', entityLabel: 'Participant-Facing Content', programId, supportsAppend: false, onClose, onApplied }` — matches `ProgramDetailsCopier`'s `key = 'program-details'`, `label = 'Participant-Facing Content'`, `supportsAppend = false` (Task 11).

`ProgramSpecificsTab.tsx` (the read-only display, `ProgramSpecificsTab.tsx:152-187`) and `EditProgramSpecificsModal.tsx` (the existing edit-in-place form) are both left untouched — neither owns a natural "copy from elsewhere" affordance, and the modal already edits a program's own scalar fields in place, not another program's. The button belongs beside `EditSpecificsAction` in `program-details/page.tsx`'s tab-action row instead: that row already renders exactly one action for whichever tab is active — `EditGeneralAction` for "general", `EditSpecificsAction` for "specifics" (`page.tsx:481-517`) — and this task adds a second action to the "specifics" branch only, since `requirementsDescription`/`benefitsDescription`/`termsAndConditions` are the fields shown there and nowhere else. `supportsAppend={false}` (not the `supportsAppend` shorthand every other surface in Tasks 17-21 uses) because `ProgramDetailsCopier.copy()` rejects `mode !== 'replace'` (Task 11) — `CopyFromProgramDialog` reads `supportsAppend` to hide its append/replace toggle and force `mode: 'replace'` (Task 15), so passing `false` here is load-bearing, not decorative.

This page has no existing reusable "refetch the program" function — `loadProgramDetail` (in the initial `useEffect`) and the `refreshedResponse` blocks inside `handleSaveSpecifics`/`handleSaveGeneral` each inline the same fetch-and-set-envelope logic separately. Step 3 adds one more small dedicated function rather than threading a fourth inline copy through `onApplied`, following the same fetch → `readErrorMessage` → `ApiEnvelope<ProgramDetail>` → `setProgramDetail` shape already used three times in this file.

- [ ] **Step 1: Add the import**

Insert after line 27 (`import { formatInBusinessTz } from "@/lib/datetime";`):

```tsx
import { CopyFromProgramDialog } from "@/app/components/shared/copy-from-program/CopyFromProgramDialog";
```

- [ ] **Step 2: Add the dialog-open state**

Insert after line 280 (`const [isGeneralSaving, setIsGeneralSaving] = useState(false);`):

```tsx
  const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add a `refreshProgramDetail` helper**

Insert after line 471 (the closing `};` of `handleSaveGeneral`), before line 473 (`return (`):

```tsx
  const refreshProgramDetail = async () => {
    try {
      const token = getAccessToken();
      const response = await fetch(buildApiUrl(`/admin/programs/${encodeURIComponent(resolvedProgramId)}`), {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        throw new Error(await readErrorMessage(response));
      }
      const envelope = (await response.json()) as ApiEnvelope<ProgramDetail>;
      setProgramDetail(envelope.data);
    } catch (error) {
      setPageError(error instanceof Error ? error.message : "Failed to refresh program details.");
    }
  };
```

- [ ] **Step 4: Add the "Copy from program" button next to "Edit Operational Settings"**

Replace lines 509-516:

```tsx
          ) : activeTab === "specifics" && specificsFormValues ? (
            <EditSpecificsAction
              programName={programName}
              initialValues={specificsFormValues}
              onSave={handleSaveSpecifics}
              isSaving={isSaving}
              errorMessage={saveError}
            />
```

with:

```tsx
          ) : activeTab === "specifics" && specificsFormValues ? (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCopyFromProgramOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 shadow-sm transition hover:bg-zinc-50"
              >
                <span>Copy from program</span>
              </button>
              <EditSpecificsAction
                programName={programName}
                initialValues={specificsFormValues}
                onSave={handleSaveSpecifics}
                isSaving={isSaving}
                errorMessage={saveError}
              />
            </div>
```

Line 517 (`) : activeTab === "exchange-rate" ? null : null}`) is unchanged and still closes this ternary. Same `FormFieldsTable.tsx:274-280` button reused verbatim, for the same consistency reason as Tasks 18-21.

- [ ] **Step 5: Render the dialog**

Insert after line 540 (`</section>`), before line 541 (`</main>`):

```tsx
      <CopyFromProgramDialog
        open={copyFromProgramOpen}
        entityKey="program-details"
        entityLabel="Participant-Facing Content"
        programId={resolvedProgramId}
        supportsAppend={false}
        onClose={() => setCopyFromProgramOpen(false)}
        onApplied={() => {
          setCopyFromProgramOpen(false);
          void refreshProgramDetail();
        }}
      />
```

- [ ] **Step 6: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd services/admin-dashboard
git add "app/programs/[programId]/master-data/program-details/page.tsx"
git commit -m "feat(admin): add Copy from program to Program Details (Participant-Facing Content)"
```

---

## Task 23: Full verification sweep

**Files:** None — this task only runs verification commands across `services/api` and `services/admin-dashboard`; it creates or modifies nothing unless a lint autofix in Step 3 or Step 5 touches a file, handled in Step 7.

**Interfaces:**
- Consumes: everything Tasks 1-22 produced — the shared copier types (Task 1), `copyScopedRows` (Task 2), `ProgramCopierRegistry` (Task 3), the `ProgramParticipationCategory.deletedAt` migration (Task 4), all seven copiers (Tasks 5-11), the module registration (Task 12), `ProgramCopyController` (Task 13), the frontend `copy-api.ts` client (Task 14), `CopyFromProgramDialog` (Task 15), and all seven of its call sites (Tasks 16-22).

`services/admin-dashboard/package.json` defines only `dev`, `build`, `start`, and `lint` — there is no `test` or `type-check` script (confirmed by reading the file directly). This matches the plan's own Global Constraints line: "Admin dashboard has no test runner; verify with `npx tsc --noEmit` from `services/admin-dashboard/`." This task therefore runs `npx tsc --noEmit` (not a nonexistent `npm run type-check`) and `npm run lint` for the frontend, and `npx jest` plus `npx tsc --noEmit -p tsconfig.json` for the API — the exact commands every earlier task in this plan already uses, run here without a `--testPathPattern` filter so the whole suite is exercised at once.

- [ ] **Step 1: Run the full API test suite**

Run (from `services/api/`): `npx jest`
Expected: PASS — every spec passes, including the seven copier specs (Tasks 5-11), `copy-scoped-rows.spec.ts` (Task 2), `program-copier.registry.spec.ts` (Task 3), and `program-copy.controller.spec.ts` (Task 13), plus every pre-existing suite elsewhere in the API (unaffected by this plan).

- [ ] **Step 2: Run the API typecheck**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors. In particular, no dangling references to the deleted `CopyFieldsFromProgramHandler`, `CopyFieldsFromProgramCommand`, or `CopyFieldsFromProgramDto` (removed in Task 5, superseded by `FormFieldsCopier`).

- [ ] **Step 3: Run the API lint**

Run (from `services/api/`): `npm run lint`
Expected: no errors after autofix. The `lint` script itself runs `eslint ... --fix` (`package.json:15`); if it modifies any file, review the diff before Step 7.

- [ ] **Step 4: Run the admin dashboard typecheck**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors. In particular, no dangling references to the deleted `submissionsMasterData/form-fields/CopyFromProgramDialog.tsx` or the removed `catalog-api.ts` exports (`copyFieldsFromProgram`, `fetchProgramFormFields`, `ProgramFormFieldRow` — Task 16).

- [ ] **Step 5: Run the admin dashboard lint**

Run (from `services/admin-dashboard/`): `npm run lint`
Expected: no errors.

- [ ] **Step 6: Confirm no stale references to the deleted copy-from-program code remain**

Run (from the repo root, `ybb-platform/`):

```bash
grep -rn "CopyFieldsFromProgramHandler\|CopyFieldsFromProgramCommand\|copy-fields-from-program" services/api/src --include="*.ts"
grep -rn "copyFieldsFromProgram\|fetchProgramFormFields\|ProgramFormFieldRow" services/admin-dashboard/app --include="*.ts" --include="*.tsx"
```

Expected: no output from either command — both were fully removed in Task 5 (backend) and Task 16 (frontend), and nothing outside those two tasks ever referenced them (verified during Task 16's own research).

- [ ] **Step 7: Commit any autofix changes**

If Step 3 or Step 5 modified any files, stage and commit them separately from the feature work already committed in Tasks 1-22:

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

If neither `git status --short` shows any output, there is nothing to commit — Phase 1 is done.
