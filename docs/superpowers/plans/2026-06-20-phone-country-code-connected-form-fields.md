# Phone Country Code & Catalog-Canonical Form Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the system form-field catalog the single source of truth for a system field's `type`, so any program that adds a catalog `phone`/`country` field automatically renders the country-code dropdown and country selector — and fix the already-broken IYS 2027 program.

**Architecture:** The participant frontend already renders `type:"phone"` (PhoneField with dial-code dropdown) and `type:"country"` (CountryField) correctly; the defect is purely backend. The single-add system-field creation path drops the catalog `type`, materializing catalog `phone`/`country` fields as `type:"text"`. We (1) fix that creation path to derive type/options/placeholder/helpText from the catalog, (2) add a pure, tested reconcile function plus a DB runner script that re-syncs existing `source:system` fields to the catalog, and (3) run it against IYS 2027 and soft-delete two stray leftover custom fields.

**Tech Stack:** NestJS + CQRS, Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`, `pg`), Jest + ts-jest, TypeScript. Repo: `ybb-platform`, API at `ybb-platform/services/api`.

## Global Constraints

- All paths below are relative to `ybb-platform/services/api/` unless stated otherwise.
- Run all commands from `ybb-platform/services/api/`.
- Jest config is inline in `package.json`: `rootDir: "src"`, `testRegex: ".*\\.spec\\.ts$"`. **Specs MUST live under `src/`** to be collected. Path aliases: `@core/*`, `@modules/*`, `@shared/*`, `@common/*` map under `src/`.
- Conventional commit messages (`feat:`, `fix:`, `refactor:`, `chore:`, `test:`). Git attribution is disabled globally — do not add co-author trailers.
- The system catalog is canonical for a `source:system` field's `type`. A client DTO must never set the `type` of a system field. Custom (`source:custom`) fields are unchanged — they own their own `type`.
- Reconcile and cleanup scripts MUST support `--dry-run` and be idempotent. Never hard-delete form fields — soft-delete by setting `deletedAt` (the program/name unique index is partial: `WHERE deleted_at IS NULL`).
- Prod DB is only reachable from inside the API container (`ybb-platform-api-yeghdi-api-1`, host `postgres-api:5432`). Local dry-runs use `ts-node`; prod application uses the compile→`scp`→`docker cp`→`docker exec node` flow.
- Catalog field types relevant here: `phone → type:"phone"`, `emergency_contact_phone → type:"phone"`, `nationality → type:"country"`. Note `FormFieldType` enum (DTO) does NOT include `country`; the DB column is a free `VarChar(50)`, so the backend writes the catalog string directly.

---

## File Structure

| File | Responsibility |
|---|---|
| `src/modules/programs/application/commands/handlers/application-form-field.handler.ts` (modify) | Fix the `source:system` branch to derive `type`/`options`/`placeholder`/`helpText` from the catalog definition |
| `src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts` (modify) | Add test: catalog type wins over a conflicting client `fieldType` |
| `src/modules/programs/application/services/system-field-type-reconciler.ts` (create) | Pure function `computeSystemFieldTypeFixes()` — compute the change set from system fields + catalog map (no DB, no Prisma import) |
| `src/modules/programs/application/services/system-field-type-reconciler.spec.ts` (create) | Unit tests for the pure function |
| `prisma/migration-scripts/reconcile-system-field-types.ts` (create) | DB runner: load catalog + system fields, call the pure function, apply (or dry-run). Reusable across all programs |
| `prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.ts` (create) | DB runner: soft-delete IYS 2027's two stray custom phone fields |
| `package.json` (modify) | Add `migrate:reconcile-system-field-types` and `migrate:cleanup-iys-2027-stray-phone-fields` scripts |

---

## Task 1: Make the catalog canonical for system-field type on creation

**Files:**
- Modify: `src/modules/programs/application/commands/handlers/application-form-field.handler.ts:96-114`
- Test: `src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts` (add one test in the existing `CreateApplicationFormFieldHandler` describe block)

**Interfaces:**
- Consumes: existing `CreateApplicationFormFieldHandler.execute(command)`, `definition` from `prisma.systemFormFieldDefinition.findUnique` (has `key`, `type`, `placeholder`, `helpText`, `defaultOptions`, `isActive`, `deletedAt`).
- Produces: no new exports. After this task, `createFormField` is called with `type: definition.type` for system fields.

- [ ] **Step 1: Write the failing test**

Add this test inside the existing `describe('CreateApplicationFormFieldHandler', ...)` block in `application-form-field.handler.spec.ts` (after the test at line 127):

```typescript
  it('uses the catalog type for a system field, ignoring a conflicting client fieldType', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue({
      key: 'phone',
      type: 'phone',
      placeholder: null,
      helpText: null,
      defaultOptions: [],
      isActive: true,
      deletedAt: null,
    });
    mockRepo.createFormField.mockResolvedValue({ id: 'f3' });

    await handler.execute(
      new CreateApplicationFormFieldCommand(
        'p1',
        {
          source: 'system',
          systemFieldKey: 'phone',
          label: 'Phone Number',
          fieldType: FormFieldType.TEXT, // client sends the wrong type
        },
        'u1',
      ),
    );

    expect(mockRepo.createFormField).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'system',
        systemFieldKey: 'phone',
        name: 'phone',
        type: 'phone', // catalog wins
      }),
    );
  });
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts -t "catalog type for a system field"`
Expected: FAIL — `createFormField` received `type: 'text'` (from the DTO) instead of `'phone'`.

- [ ] **Step 3: Write minimal implementation**

In `application-form-field.handler.ts`, replace the system-field block at lines 96-114 with:

```typescript
      const systemDto: Partial<CreateApplicationFormFieldDto> = {
        ...dto,
        options:
          dto.options !== undefined
            ? dto.options
            : ((Array.isArray(definition.defaultOptions)
                ? (definition.defaultOptions as unknown[])
                : []) as string[] | Record<string, unknown>[]),
        placeholder: dto.placeholder ?? definition.placeholder ?? undefined,
        helpText: dto.helpText ?? definition.helpText ?? undefined,
      };

      return this.repository.createFormField({
        ...mapDtoToField(systemDto, definition.key),
        // The system catalog is the single source of truth for a system
        // field's type. A stale or wrong client fieldType must not downgrade
        // e.g. a phone field to text (which breaks the country-code dropdown
        // on the participant submission form).
        type: definition.type,
        source: 'system',
        systemFieldKey: definition.key,
        name: definition.key,
        programId,
      } as Partial<ApplicationFormField>);
```

- [ ] **Step 4: Run the full handler spec to verify all tests pass**

Run: `npx jest src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts`
Expected: PASS — all tests in both describe blocks green (the existing "backfills name from systemFieldKey" test still passes because catalog type `radio` equals its `fieldType`).

- [ ] **Step 5: Commit**

```bash
git add src/modules/programs/application/commands/handlers/application-form-field.handler.ts \
        src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts
git commit -m "fix: derive system form field type from catalog on creation"
```

---

## Task 2: Pure reconcile logic (compute the type-fix change set)

**Files:**
- Create: `src/modules/programs/application/services/system-field-type-reconciler.ts`
- Test: `src/modules/programs/application/services/system-field-type-reconciler.spec.ts`

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces:
  - `interface CatalogEntry { type: string; defaultOptions?: unknown }`
  - `interface ReconcilableField { id: string; systemFieldKey: string | null; type: string; options: unknown }`
  - `interface FieldTypeFix { id: string; key: string; fromType: string; toType: string; fillOptions: boolean; newOptions?: unknown }`
  - `function computeSystemFieldTypeFixes(fields: ReconcilableField[], catalogByKey: Map<string, CatalogEntry>): FieldTypeFix[]`
  - These names/types are consumed verbatim by Task 3.

- [ ] **Step 1: Write the failing tests**

Create `src/modules/programs/application/services/system-field-type-reconciler.spec.ts`:

```typescript
import {
  computeSystemFieldTypeFixes,
  type CatalogEntry,
  type ReconcilableField,
} from './system-field-type-reconciler';

const catalog = new Map<string, CatalogEntry>([
  ['phone', { type: 'phone', defaultOptions: [] }],
  ['nationality', { type: 'country', defaultOptions: [] }],
  ['gender', {
    type: 'radio',
    defaultOptions: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
    ],
  }],
]);

describe('computeSystemFieldTypeFixes', () => {
  it('emits a fix when a system field type diverges from the catalog', () => {
    const fields: ReconcilableField[] = [
      { id: 'f1', systemFieldKey: 'phone', type: 'text', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([
      { id: 'f1', key: 'phone', fromType: 'text', toType: 'phone', fillOptions: false },
    ]);
  });

  it('emits no fix when type already matches and options are non-empty (idempotent)', () => {
    const fields: ReconcilableField[] = [
      { id: 'f2', systemFieldKey: 'phone', type: 'phone', options: [] },
      {
        id: 'f3',
        systemFieldKey: 'gender',
        type: 'radio',
        options: [{ label: 'Male', value: 'male' }],
      },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([]);
  });

  it('fills options from the catalog when the field options are empty', () => {
    const fields: ReconcilableField[] = [
      { id: 'f4', systemFieldKey: 'gender', type: 'radio', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([
      {
        id: 'f4',
        key: 'gender',
        fromType: 'radio',
        toType: 'radio',
        fillOptions: true,
        newOptions: [
          { label: 'Male', value: 'male' },
          { label: 'Female', value: 'female' },
        ],
      },
    ]);
  });

  it('skips fields with a null systemFieldKey (custom fields)', () => {
    const fields: ReconcilableField[] = [
      { id: 'f5', systemFieldKey: null, type: 'text', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([]);
  });

  it('skips fields whose key is absent from the catalog', () => {
    const fields: ReconcilableField[] = [
      { id: 'f6', systemFieldKey: 'unknown_key', type: 'text', options: [] },
    ];
    expect(computeSystemFieldTypeFixes(fields, catalog)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest src/modules/programs/application/services/system-field-type-reconciler.spec.ts`
Expected: FAIL — cannot find module `./system-field-type-reconciler`.

- [ ] **Step 3: Write minimal implementation**

Create `src/modules/programs/application/services/system-field-type-reconciler.ts`:

```typescript
export interface CatalogEntry {
  type: string;
  defaultOptions?: unknown;
}

export interface ReconcilableField {
  id: string;
  systemFieldKey: string | null;
  type: string;
  options: unknown;
}

export interface FieldTypeFix {
  id: string;
  key: string;
  fromType: string;
  toType: string;
  fillOptions: boolean;
  newOptions?: unknown;
}

function isEmptyOptions(options: unknown): boolean {
  return (
    options === null ||
    options === undefined ||
    (Array.isArray(options) && options.length === 0)
  );
}

/**
 * Given the live system fields of one or more programs and the canonical
 * catalog (keyed by system field key), return the set of fields whose `type`
 * diverges from the catalog, or whose options are empty while the catalog
 * defines defaults. Pure and idempotent: a field already in sync yields no fix.
 */
export function computeSystemFieldTypeFixes(
  fields: ReconcilableField[],
  catalogByKey: Map<string, CatalogEntry>,
): FieldTypeFix[] {
  const fixes: FieldTypeFix[] = [];
  for (const field of fields) {
    if (!field.systemFieldKey) continue;
    const entry = catalogByKey.get(field.systemFieldKey);
    if (!entry) continue;

    const typeDiffers = field.type !== entry.type;
    const catalogHasOptions =
      Array.isArray(entry.defaultOptions) && entry.defaultOptions.length > 0;
    const fillOptions = isEmptyOptions(field.options) && catalogHasOptions;

    if (!typeDiffers && !fillOptions) continue;

    fixes.push({
      id: field.id,
      key: field.systemFieldKey,
      fromType: field.type,
      toType: entry.type,
      fillOptions,
      ...(fillOptions ? { newOptions: entry.defaultOptions } : {}),
    });
  }
  return fixes;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx jest src/modules/programs/application/services/system-field-type-reconciler.spec.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/modules/programs/application/services/system-field-type-reconciler.ts \
        src/modules/programs/application/services/system-field-type-reconciler.spec.ts
git commit -m "feat: add pure reconcile logic for system field types"
```

---

## Task 3: Reconcile runner script (DB I/O)

**Files:**
- Create: `prisma/migration-scripts/reconcile-system-field-types.ts`
- Modify: `package.json` (add a script entry)

**Interfaces:**
- Consumes: `computeSystemFieldTypeFixes`, `CatalogEntry`, `FieldTypeFix` from Task 2 (imported via relative path `../../src/modules/programs/application/services/system-field-type-reconciler`).
- Produces: `reconcileSystemFieldTypes(prisma, { programSlug?, dryRun? }): Promise<{ fixes: FieldTypeFix[]; appliedCount: number }>`.

> No unit test: this file is thin DB I/O around the already-tested pure function, matching the repo precedent (`remove-cys-2026-legacy-essays.ts`). It is validated by the local dry-run in Step 3 and Task 5.

- [ ] **Step 1: Write the runner**

Create `prisma/migration-scripts/reconcile-system-field-types.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  computeSystemFieldTypeFixes,
  type CatalogEntry,
  type FieldTypeFix,
} from '../../src/modules/programs/application/services/system-field-type-reconciler';

function parseArgs() {
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  const programArg = process.argv.find((a) => a.startsWith('--program='));
  const programSlug = programArg ? programArg.split('=')[1] : undefined;
  return { dryRun, programSlug };
}

export async function reconcileSystemFieldTypes(
  prisma: PrismaClient,
  options: { programSlug?: string; dryRun?: boolean } = {},
): Promise<{ fixes: FieldTypeFix[]; appliedCount: number }> {
  const dryRun = options.dryRun ?? false;

  const defs = await prisma.systemFormFieldDefinition.findMany({
    where: { isActive: true, deletedAt: null },
    select: { key: true, type: true, defaultOptions: true },
  });
  const catalogByKey = new Map<string, CatalogEntry>(
    defs.map((d) => [d.key, { type: d.type, defaultOptions: d.defaultOptions }]),
  );

  const fields = await prisma.applicationFormField.findMany({
    where: {
      source: 'system',
      deletedAt: null,
      ...(options.programSlug
        ? { program: { slug: options.programSlug } }
        : {}),
    },
    select: { id: true, systemFieldKey: true, type: true, options: true },
  });

  const fixes = computeSystemFieldTypeFixes(fields, catalogByKey);

  if (dryRun || fixes.length === 0) {
    return { fixes, appliedCount: 0 };
  }

  for (const fix of fixes) {
    await prisma.applicationFormField.update({
      where: { id: fix.id },
      data: {
        type: fix.toType,
        ...(fix.fillOptions ? { options: fix.newOptions as never } : {}),
      },
    });
  }

  return { fixes, appliedCount: fixes.length };
}

if (require.main === module) {
  const { dryRun, programSlug } = parseArgs();
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // eslint-disable-next-line no-console
  console.log(
    `${dryRun ? '>>> DRY RUN' : '>>> APPLYING'} system field type reconcile` +
      `${programSlug ? ` for program "${programSlug}"` : ' (all programs)'}.`,
  );

  reconcileSystemFieldTypes(prisma, { programSlug, dryRun })
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('Fixes:', JSON.stringify(result.fixes, null, 2));
      // eslint-disable-next-line no-console
      console.log(
        dryRun
          ? `Dry run: ${result.fixes.length} field(s) would change. Re-run without --dry-run to apply.`
          : `Applied ${result.appliedCount} field type fix(es).`,
      );
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
```

- [ ] **Step 2: Add the package.json script**

In `package.json`, under `"scripts"`, add after the existing `migrate:submission-form-normalization` line:

```json
    "migrate:reconcile-system-field-types": "ts-node -r tsconfig-paths/register prisma/migration-scripts/reconcile-system-field-types.ts",
```

- [ ] **Step 3: Verify it compiles and dry-runs against a reachable DB**

Run (against local dev DB, or skip to Task 5 for prod): `npm run migrate:reconcile-system-field-types -- --dry-run`
Expected: prints `>>> DRY RUN ...` and a (possibly empty) `Fixes:` array, then disconnects cleanly. No write occurs. If no local DB is available, instead verify TypeScript compiles: `npx tsc --noEmit -p tsconfig.json` exits 0.

- [ ] **Step 4: Commit**

```bash
git add prisma/migration-scripts/reconcile-system-field-types.ts package.json
git commit -m "feat: add system field type reconcile runner script"
```

---

## Task 4: IYS 2027 stray-field cleanup script

**Files:**
- Create: `prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.ts`
- Modify: `package.json` (add a script entry)

**Interfaces:**
- Consumes: nothing from other tasks.
- Produces: `cleanupIys2027StrayPhoneFields(prisma, { dryRun? }): Promise<{ matched: { id: string; name: string }[]; softDeletedCount: number }>`.

> Soft-delete only (sets `deletedAt`). Scoped to `istanbul-youth-summit-2027` and the two known stray custom field names. Modeled on `remove-cys-2026-legacy-essays.ts`.

- [ ] **Step 1: Write the runner**

Create `prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.ts`:

```typescript
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const PROGRAM_SLUG = 'istanbul-youth-summit-2027';
// Leftovers from an earlier half-done manual fix. Redundant once the unified
// `phone` / `emergency_contact_phone` fields (type:phone) render their own
// country-code dropdown.
const STRAY_FIELD_NAMES = [
  'phone_country_code',
  'emergency_contact_country_code',
] as const;

function parseArgs() {
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  return { dryRun };
}

export async function cleanupIys2027StrayPhoneFields(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<{ matched: { id: string; name: string }[]; softDeletedCount: number }> {
  const dryRun = options.dryRun ?? false;

  const matched = await prisma.applicationFormField.findMany({
    where: {
      program: { slug: PROGRAM_SLUG },
      source: 'custom',
      deletedAt: null,
      name: { in: [...STRAY_FIELD_NAMES] },
    },
    select: { id: true, name: true },
  });

  if (dryRun || matched.length === 0) {
    return { matched, softDeletedCount: 0 };
  }

  const res = await prisma.applicationFormField.updateMany({
    where: { id: { in: matched.map((m) => m.id) } },
    data: { deletedAt: new Date() },
  });

  return { matched, softDeletedCount: res.count };
}

if (require.main === module) {
  const { dryRun } = parseArgs();
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // eslint-disable-next-line no-console
  console.log(
    dryRun
      ? '>>> DRY RUN: no IYS 2027 stray fields will be soft-deleted.'
      : '>>> APPLYING IYS 2027 stray phone field cleanup.',
  );

  cleanupIys2027StrayPhoneFields(prisma, { dryRun })
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('Matched stray fields:', result.matched);
      // eslint-disable-next-line no-console
      console.log(
        dryRun
          ? `Dry run: ${result.matched.length} field(s) would be soft-deleted.`
          : `Soft-deleted ${result.softDeletedCount} field(s).`,
      );
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
```

- [ ] **Step 2: Add the package.json script**

In `package.json`, under `"scripts"`, add immediately after the `migrate:reconcile-system-field-types` line from Task 3:

```json
    "migrate:cleanup-iys-2027-stray-phone-fields": "ts-node -r tsconfig-paths/register prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.ts",
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: exits 0 (no type errors).

- [ ] **Step 4: Commit**

```bash
git add prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.ts package.json
git commit -m "feat: add IYS 2027 stray phone field cleanup script"
```

---

## Task 5: Apply the fix to production IYS 2027 (operational)

**Files:** none (operational task). Uses the scripts from Tasks 3 and 4.

> Prod DB is only reachable from inside the API container. Per the established prod-script flow: build the TS to JS, copy into the container, run with the container's `DATABASE_URL`. Dry-run and review BEFORE applying. This task is irreversible-ish (soft-delete is reversible by clearing `deletedAt`; type edits are reversible by re-running with corrected catalog) — but treat it as production data and verify each diff.

- [ ] **Step 1: Build the scripts to JS**

Run: `npm run build:seed`
Expected: emits compiled JS under `dist/` including `dist/prisma/migration-scripts/reconcile-system-field-types.js` and `dist/prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.js`. If `tsconfig.seed.json` does not include `prisma/migration-scripts`, compile directly instead: `npx tsc prisma/migration-scripts/reconcile-system-field-types.ts prisma/migration-scripts/cleanup-iys-2027-stray-phone-fields.ts --outDir /tmp/iys-fix --module commonjs --target es2020 --esModuleInterop --skipLibCheck` (the relative import of the src pure function will be compiled alongside).

- [ ] **Step 2: Copy into the prod API container and dry-run the reconcile (scoped to IYS)**

```bash
# from the api dir, with the compiled JS available locally
scp -r <compiled-dir> ybb:/tmp/iys-fix
ssh ybb 'docker cp /tmp/iys-fix ybb-platform-api-yeghdi-api-1:/tmp/iys-fix'
ssh ybb 'docker exec -e NODE_PATH=/app/node_modules -w /tmp/iys-fix ybb-platform-api-yeghdi-api-1 node reconcile-system-field-types.js --program=istanbul-youth-summit-2027 --dry-run'
```
Expected: `Fixes:` lists `phone: text→phone`, `emergency_contact_phone: text→phone`, `nationality: text→country` (and possibly `gender`/`tshirt_size` if they diverge). Review the list — it must contain ONLY `source:system` fields.

- [ ] **Step 3: Apply the reconcile**

Re-run Step 2's last command WITHOUT `--dry-run`. Expected: `Applied N field type fix(es).`

- [ ] **Step 4: Dry-run then apply the stray-field cleanup**

```bash
ssh ybb 'docker exec -e NODE_PATH=/app/node_modules -w /tmp/iys-fix ybb-platform-api-yeghdi-api-1 node cleanup-iys-2027-stray-phone-fields.js --dry-run'
# review: should match exactly phone_country_code and emergency_contact_country_code
ssh ybb 'docker exec -e NODE_PATH=/app/node_modules -w /tmp/iys-fix ybb-platform-api-yeghdi-api-1 node cleanup-iys-2027-stray-phone-fields.js'
```
Expected: dry-run lists exactly the two stray custom fields; apply reports `Soft-deleted 2 field(s).`

- [ ] **Step 5: Verify the DB state and clean up temp files**

```bash
ssh ybb "docker exec ybb-platform-api-yeghdi-postgres-api-1 psql -U ybb_api_user -d ybb_platform_db -t -A -F'|' -c \"SELECT f.name, f.type FROM application_form_fields f JOIN programs p ON p.id=f.program_id WHERE p.slug='istanbul-youth-summit-2027' AND f.deleted_at IS NULL AND f.name IN ('phone','emergency_contact_phone','nationality','phone_country_code','emergency_contact_country_code') ORDER BY f.name;\""
```
Expected: `phone|phone`, `emergency_contact_phone|phone`, `nationality|country`; the two stray rows absent. Then remove temp files: `ssh ybb 'rm -rf /tmp/iys-fix' && ssh ybb 'docker exec ybb-platform-api-yeghdi-api-1 rm -rf /tmp/iys-fix'`.

---

## Task 6: Verify the participant form renders correctly (verification, no code)

**Files:** none expected. If a gap is found, harden `ybb-program-next/components/dashboard/sections/SubmissionEditSection.tsx` (`field.type === "phone"` branch, ~line 1030).

> The single dynamic-field renderer already supports `type:phone`/`type:country`. This task confirms the live result. No code change is anticipated.

- [ ] **Step 1: Load the IYS 2027 submission edit form as a participant**

Open the participant dashboard submission edit page for an IYS 2027 applicant (or a test account enrolled in IYS 2027). The relevant component is mounted at `app/(dashboard)/dashboard/submission/edit/page.tsx`.

- [ ] **Step 2: Confirm phone rendering**

Expected: the `phone` and `emergency_contact_phone` fields render a `<PhoneField>` with a country flag + dial-code dropdown (not a plain text box). The `nationality` field renders a country selector (`<CountryField>`).

- [ ] **Step 3: Confirm default country and submission**

Expected: selecting a nationality sets the phone default country accordingly (falls back to `ID` if none). Entering a number and saving persists an E.164 value; reloading the read view shows the formatted number with country code.

- [ ] **Step 4: If (and only if) a gap is found**

If a phone field still renders as plain text or a stored value fails to parse, harden the `type:"phone"` branch's value handling in `SubmissionEditSection.tsx` and add a matching test in `ybb-program-next` (e.g. alongside `PhoneField.test.tsx`). Otherwise, record that no frontend change was required.

---

## Self-Review Notes

- **Spec coverage:** Part 1 (creation-path fix) → Task 1. Part 2 (reconcile backbone) → Tasks 2+3. Part 3 (copy handler unchanged) → no task by design (documented). Part 4 (IYS patch: type fixes + stray soft-delete) → Tasks 3+4 applied in Task 5. Part 5 (frontend verify) → Task 6. Testing/Rollout → embedded per task + Task 5/6.
- **Scope tightening note:** Task 1 also derives `placeholder`/`helpText` from the catalog when the client omits them (spec Part 1) in addition to the critical `type` fix.
- **Type consistency:** `computeSystemFieldTypeFixes`, `CatalogEntry`, `ReconcilableField`, `FieldTypeFix` are defined in Task 2 and consumed with identical names/shapes in Task 3. The runner's `select` (`id`, `systemFieldKey`, `type`, `options`) matches `ReconcilableField`.
- **Known consideration:** the existing `application-form-field.handler.spec.ts` test "backfills name from systemFieldKey" passes `fieldType: RADIO` with catalog `type:'radio'`, so it stays green after the fix (catalog type equals provided type).
