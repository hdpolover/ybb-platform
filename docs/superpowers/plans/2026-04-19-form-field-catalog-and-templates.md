# Form Field Catalog & Templates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the free-form `Field Key` input in the admin form-field editor with a System Field Catalog + Form Field Templates, enforcing validation and per-program uniqueness server-side while preserving all existing submission data.

**Architecture:** Hybrid catalog — a small set of code-backed "magic" keys (`category`, `program_subtheme_id`, `program_id`) with runtime behavior, plus a DB-backed `system_form_field_definitions` table for generic canonical fields. Per-program `application_form_fields` rows gain a `source` column (`system` | `custom`). Templates live in two new tables and apply via a one-shot copy (no retroactive link). Migration reclassifies existing fields through a small legacy-alias map and rewrites `personalData` JSON keys in-place.

**Tech Stack:** NestJS 10 + CQRS + Prisma 7 on the API side (Jest for tests); Next.js 16 App Router + Radix UI + TanStack Query + react-hook-form + zod + sonner on the admin dashboard. Source of truth spec: `docs/superpowers/specs/2026-04-19-form-field-catalog-and-templates-design.md`.

**Conventions this plan follows:**
- API paths are relative to `ybb-platform/services/api/`.
- Admin paths are relative to `ybb-platform/services/admin-dashboard/`.
- Prisma schema files live in `prisma/schema/` (multi-file).
- Tests are colocated with handlers (`*.spec.ts`).
- Commits use conventional-commit style (`feat:`, `fix:`, `refactor:`, `test:`, `chore:`).
- Run all commands from the service directory unless stated otherwise.

---

## Phase 0: Pre-work

### Task 0.1: Verify the dev environment

**Files:** none (read-only checks)

- [ ] **Step 1: Confirm API builds**

Run from `ybb-platform/services/api`:
```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 2: Confirm admin dashboard builds**

Run from `ybb-platform/services/admin-dashboard`:
```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Run existing test suite to establish baseline**

Run from `ybb-platform/services/api`:
```bash
npm test -- --listTests 2>/dev/null | head -5
npm test -- --silent 2>&1 | tail -20
```
Expected: baseline pass count recorded. Capture the numbers — we compare against these at the end.

If any of these fail, stop and fix before proceeding — we need a green baseline.

---

## Phase 1: Schema, Constants, and Utilities

### Task 1.1: Add Prisma models and modify `ApplicationFormField`

**Files:**
- Modify: `ybb-platform/services/api/prisma/schema/applications.prisma`

- [ ] **Step 1: Edit `ApplicationFormField` model**

In `prisma/schema/applications.prisma`, find the `ApplicationFormField` model (lines 86-113) and add two columns plus a composite unique index. Replace the existing model block with:

```prisma
model ApplicationFormField {
  id              String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  programId       String    @map("program_id") @db.Uuid
  section         String    @default("personal_info") @db.VarChar(50)
  label           String    @db.VarChar(255)
  name            String    @db.VarChar(100)
  type            String    @db.VarChar(50)
  placeholder     String?   @db.VarChar(255)
  helpText        String?   @map("help_text") @db.Text
  mediaUrl        String?   @map("media_url") @db.Text
  mediaAlt        String?   @map("media_alt") @db.VarChar(255)
  options         Json?     @default("[]") @db.Json
  validationRules Json?     @default("{}") @map("validation_rules") @db.Json
  isRequired      Boolean   @default(true) @map("is_required")
  order           Int       @default(0)
  isActive        Boolean   @default(true) @map("is_active")

  // NEW: catalog linkage
  source          String    @default("custom") @db.VarChar(16)
  // Intentionally no FK to system_form_field_definitions.key — loose coupling
  // so catalog soft-deletes don't cascade-break existing program fields.
  systemFieldKey  String?   @map("system_field_key") @db.VarChar(64)

  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz(6)

  program Program @relation(fields: [programId], references: [id], onDelete: Cascade)

  // Enforced as a partial UNIQUE index in the migration SQL:
  //   CREATE UNIQUE INDEX application_form_fields_program_name_uq
  //     ON application_form_fields (program_id, name) WHERE deleted_at IS NULL;
  // Prisma 7 DSL cannot express partial indexes, so this @@index is non-unique;
  // uniqueness is DB-enforced only.
  @@index([programId, name], map: "application_form_fields_program_name_uq")
  @@index([programId])
  @@index([section])
  @@index([order])
  @@index([source])
  @@map("application_form_fields")
}
```

**Note on the partial unique index:** Postgres treats each `NULL` in a composite UNIQUE index as distinct, so a plain `UNIQUE(program_id, name, deleted_at)` would silently allow duplicate active rows (both having `deleted_at = NULL`). The partial index `WHERE deleted_at IS NULL` is the correct way to express "per-program name uniqueness for active rows." This must be hand-edited into the generated migration SQL (see Step 6).

- [ ] **Step 2: Add `SystemFormFieldDefinition` model**

Append to `prisma/schema/applications.prisma`:

```prisma
model SystemFormFieldDefinition {
  id              String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  key             String    @unique @db.VarChar(64)
  label           String    @db.VarChar(255)
  category        String    @db.VarChar(32)
  type            String    @db.VarChar(32)
  defaultOptions  Json?     @default("[]") @map("default_options") @db.Json
  validationRules Json?     @default("{}") @map("validation_rules") @db.Json
  helpText        String?   @map("help_text") @db.Text
  placeholder     String?   @db.VarChar(255)
  isMagic         Boolean   @default(false) @map("is_magic")
  isActive        Boolean   @default(true) @map("is_active")
  order           Int       @default(0)
  createdAt       DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt       DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt       DateTime? @map("deleted_at") @db.Timestamptz(6)

  @@index([category])
  @@index([isActive])
  @@map("system_form_field_definitions")
}
```

- [ ] **Step 3: Add template models**

Append to the same file:

```prisma
model ApplicationFormTemplate {
  id          String    @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  name        String    @db.VarChar(255)
  description String?   @db.Text
  category    String?   @db.VarChar(64)
  isDefault   Boolean   @default(false) @map("is_default")
  createdBy   String?   @map("created_by") @db.Uuid
  createdAt   DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt   DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt   DateTime? @map("deleted_at") @db.Timestamptz(6)

  fields ApplicationFormTemplateField[]

  @@index([category])
  @@map("application_form_templates")
}

model ApplicationFormTemplateField {
  id               String  @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  templateId       String  @map("template_id") @db.Uuid
  source           String  @db.VarChar(16)
  systemFieldKey   String? @map("system_field_key") @db.VarChar(64)

  name             String? @db.VarChar(100)
  label            String? @db.VarChar(255)
  type             String? @db.VarChar(50)
  placeholder      String? @db.VarChar(255)
  helpText         String? @map("help_text") @db.Text
  options          Json?   @default("[]") @db.Json
  validationRules  Json?   @default("{}") @map("validation_rules") @db.Json

  section          String  @default("personal_details") @db.VarChar(50)
  isRequired       Boolean @default(false) @map("is_required")
  order            Int     @default(0)
  labelOverride    String? @map("label_override") @db.VarChar(255)
  helpTextOverride String? @map("help_text_override") @db.Text

  template ApplicationFormTemplate @relation(fields: [templateId], references: [id], onDelete: Cascade)

  @@index([templateId])
  @@map("application_form_template_fields")
}
```

- [ ] **Step 4: Generate the migration**

Run from `ybb-platform/services/api`:
```bash
npx prisma migrate dev --name add_form_field_catalog_and_templates --create-only
```
Expected: a new directory under `prisma/migrations/` with a `migration.sql` that creates two tables, adds two columns to `application_form_fields`, and adds the composite unique index.

- [ ] **Step 5: Review the generated SQL**

Open the generated `migration.sql`. Verify:
- `CREATE TABLE "system_form_field_definitions"` with `key` unique.
- `CREATE TABLE "application_form_templates"` + `"application_form_template_fields"`.
- `ALTER TABLE "application_form_fields" ADD COLUMN "source" ...` and `"system_field_key"`.
- `CREATE UNIQUE INDEX "application_form_fields_program_name_uq" ON ...`.

**Hand-edit the generated unique-index line** to make it a partial unique index. Change:

```sql
CREATE UNIQUE INDEX "application_form_fields_program_name_uq" ON "application_form_fields"("program_id", "name", "deleted_at");
```

to:

```sql
CREATE UNIQUE INDEX "application_form_fields_program_name_uq" ON "application_form_fields" ("program_id", "name") WHERE "deleted_at" IS NULL;
```

Without this edit, Postgres will allow duplicate active rows (NULL-distinctness rule on composite unique indexes).

If anything else is off (Prisma sometimes splits into separate migrations), regenerate.

- [ ] **Step 6: Apply the migration**

```bash
npx prisma migrate dev
```
Expected: migration applied cleanly against local dev DB. `prisma generate` runs automatically.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema/applications.prisma prisma/migrations/
git commit -m "feat(schema): add system form field catalog and template tables"
```

### Task 1.2: Create magic form fields constants module

**Files:**
- Create: `ybb-platform/services/api/src/modules/programs/application/constants/magic-form-fields.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/constants/magic-form-fields.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `src/modules/programs/application/constants/magic-form-fields.spec.ts`:

```typescript
import {
  MAGIC_FORM_FIELD_KEYS,
  MAGIC_FIELD_DEFINITIONS,
  isMagicFormFieldKey,
} from './magic-form-fields';

describe('magic-form-fields', () => {
  it('exposes the known magic keys', () => {
    expect(MAGIC_FORM_FIELD_KEYS).toEqual(
      expect.arrayContaining(['category', 'program_subtheme_id', 'program_id']),
    );
  });

  it('describes category as radio-type with its enum-backed behavior', () => {
    const def = MAGIC_FIELD_DEFINITIONS.find((d) => d.key === 'category');
    expect(def).toBeDefined();
    expect(def?.type).toBe('radio');
    expect(def?.behavior).toBe('application_category_enum');
  });

  it('describes program_subtheme_id with dynamic_subtheme_options behavior', () => {
    const def = MAGIC_FIELD_DEFINITIONS.find((d) => d.key === 'program_subtheme_id');
    expect(def?.behavior).toBe('dynamic_subtheme_options');
  });

  it('excludes program_id from the catalog picker', () => {
    const def = MAGIC_FIELD_DEFINITIONS.find((d) => d.key === 'program_id');
    expect(def?.catalogVisible).toBe(false);
  });

  it('isMagicFormFieldKey returns true for reserved keys and false otherwise', () => {
    expect(isMagicFormFieldKey('category')).toBe(true);
    expect(isMagicFormFieldKey('program_id')).toBe(true);
    expect(isMagicFormFieldKey('tshirt_size')).toBe(false);
    expect(isMagicFormFieldKey('')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- magic-form-fields.spec.ts
```
Expected: FAIL — cannot resolve `./magic-form-fields`.

- [ ] **Step 3: Write the implementation**

Create `src/modules/programs/application/constants/magic-form-fields.ts`:

```typescript
export type MagicFieldBehavior =
  | 'application_category_enum'
  | 'dynamic_subtheme_options'
  | 'current_program_id';

export interface MagicFieldDefinition {
  key: string;
  label: string;
  type: 'radio' | 'select' | 'hidden';
  behavior: MagicFieldBehavior;
  category: 'program_structure';
  catalogVisible: boolean;
}

export const MAGIC_FIELD_DEFINITIONS: readonly MagicFieldDefinition[] = [
  {
    key: 'category',
    label: 'Application Category',
    type: 'radio',
    behavior: 'application_category_enum',
    category: 'program_structure',
    catalogVisible: true,
  },
  {
    key: 'program_subtheme_id',
    label: 'Subtheme Selection',
    type: 'select',
    behavior: 'dynamic_subtheme_options',
    category: 'program_structure',
    catalogVisible: true,
  },
  {
    key: 'program_id',
    label: 'Program ID',
    type: 'hidden',
    behavior: 'current_program_id',
    category: 'program_structure',
    catalogVisible: false,
  },
] as const;

export const MAGIC_FORM_FIELD_KEYS: readonly string[] = MAGIC_FIELD_DEFINITIONS.map(
  (d) => d.key,
);

const MAGIC_KEY_SET = new Set(MAGIC_FORM_FIELD_KEYS);

export function isMagicFormFieldKey(key: string): boolean {
  return MAGIC_KEY_SET.has(key);
}
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
npm test -- magic-form-fields.spec.ts
```
Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/programs/application/constants/
git commit -m "feat(api): add magic form field constants module"
```

### Task 1.3: Auto-slug utility

**Files:**
- Create: `ybb-platform/services/api/src/shared/utils/auto-slug.ts`
- Create: `ybb-platform/services/api/src/shared/utils/auto-slug.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { autoSlug, autoSlugWithCollisionSuffix } from './auto-slug';

describe('autoSlug', () => {
  it('lowercases and underscore-separates basic labels', () => {
    expect(autoSlug('T-Shirt Size')).toBe('tshirt_size');
    expect(autoSlug('Full Name')).toBe('full_name');
  });

  it('strips non-alphanumeric characters', () => {
    expect(autoSlug("Participant's Nickname!")).toBe('participants_nickname');
  });

  it('collapses whitespace and hyphens into single underscores', () => {
    expect(autoSlug('Foo   bar - baz')).toBe('foo_bar_baz');
  });

  it('prefixes a leading digit with f_', () => {
    expect(autoSlug('123 go')).toBe('f_123_go');
  });

  it('truncates to 64 chars', () => {
    const long = 'a'.repeat(200);
    expect(autoSlug(long).length).toBeLessThanOrEqual(64);
  });

  it('returns empty string for empty / whitespace-only input', () => {
    expect(autoSlug('')).toBe('');
    expect(autoSlug('   ')).toBe('');
  });

  it('handles non-ASCII by stripping accents', () => {
    expect(autoSlug('Niño Müller')).toBe('nino_muller');
  });
});

describe('autoSlugWithCollisionSuffix', () => {
  it('returns base slug when no collision', () => {
    expect(autoSlugWithCollisionSuffix('T-Shirt Size', new Set())).toBe('tshirt_size');
  });

  it('appends _2, _3, ... until unique', () => {
    const taken = new Set(['tshirt_size', 'tshirt_size_2']);
    expect(autoSlugWithCollisionSuffix('T-Shirt Size', taken)).toBe('tshirt_size_3');
  });
});
```

- [ ] **Step 2: Run test — fails**

```bash
npm test -- auto-slug.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// src/shared/utils/auto-slug.ts

const MAX_LEN = 64;

export function autoSlug(input: string): string {
  if (!input) return '';
  const normalized = input
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  if (!normalized) return '';
  const prefixed = /^[0-9]/.test(normalized) ? `f_${normalized}` : normalized;
  return prefixed.slice(0, MAX_LEN);
}

export function autoSlugWithCollisionSuffix(
  label: string,
  taken: Set<string>,
): string {
  const base = autoSlug(label);
  if (!base || !taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}_${i}`)) i += 1;
  return `${base}_${i}`;
}
```

- [ ] **Step 4: Run test — passes**

```bash
npm test -- auto-slug.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/shared/utils/auto-slug.ts src/shared/utils/auto-slug.spec.ts
git commit -m "feat(api): add auto-slug utility"
```

### Task 1.4: Reserved-key validator and format regex

**Files:**
- Create: `ybb-platform/services/api/src/modules/programs/application/validators/form-field-key.validator.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/validators/form-field-key.validator.spec.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import {
  FormFieldKeyValidator,
  FIELD_KEY_FORMAT,
  FieldKeyValidationError,
} from './form-field-key.validator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('FIELD_KEY_FORMAT', () => {
  it.each([
    ['tshirt_size', true],
    ['full_name', true],
    ['a', true],
    ['a1', true],
    ['field_64__' + 'x'.repeat(54), true],
    ['TShirtSize', false],
    ['_leading', false],
    ['1leading', false],
    ['has space', false],
    ['has-hyphen', false],
    ['', false],
    ['x'.repeat(65), false],
  ])('matches %s → %s', (key, expected) => {
    expect(FIELD_KEY_FORMAT.test(key)).toBe(expected);
  });
});

describe('FormFieldKeyValidator', () => {
  const mkPrisma = (rows: Array<{ key: string; isActive: boolean }>) =>
    ({
      systemFormFieldDefinition: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    }) as unknown as PrismaService;

  it('rejects invalid format', async () => {
    const validator = new FormFieldKeyValidator(mkPrisma([]));
    await expect(validator.validateCustomKey('Bad Key')).rejects.toBeInstanceOf(
      FieldKeyValidationError,
    );
  });

  it('rejects a magic key', async () => {
    const validator = new FormFieldKeyValidator(mkPrisma([]));
    await expect(validator.validateCustomKey('category')).rejects.toBeInstanceOf(
      FieldKeyValidationError,
    );
  });

  it('rejects an active DB catalog key', async () => {
    const validator = new FormFieldKeyValidator(
      mkPrisma([{ key: 'tshirt_size', isActive: true }]),
    );
    await expect(validator.validateCustomKey('tshirt_size')).rejects.toBeInstanceOf(
      FieldKeyValidationError,
    );
  });

  it('allows a key matching only an INACTIVE catalog entry', async () => {
    const validator = new FormFieldKeyValidator(
      mkPrisma([{ key: 'tshirt_size', isActive: false }]),
    );
    await expect(validator.validateCustomKey('tshirt_size')).resolves.toBeUndefined();
  });

  it('allows a fresh custom key', async () => {
    const validator = new FormFieldKeyValidator(mkPrisma([]));
    await expect(
      validator.validateCustomKey('custom_field_x'),
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run — fails**

```bash
npm test -- form-field-key.validator.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 3: Implement**

```typescript
// src/modules/programs/application/validators/form-field-key.validator.ts
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { isMagicFormFieldKey } from '../constants/magic-form-fields';

export const FIELD_KEY_FORMAT = /^[a-z][a-z0-9_]{0,63}$/;

export class FieldKeyValidationError extends Error {
  constructor(
    public readonly code:
      | 'invalid_format'
      | 'reserved_magic'
      | 'reserved_catalog',
    message: string,
  ) {
    super(message);
    this.name = 'FieldKeyValidationError';
  }
}

@Injectable()
export class FormFieldKeyValidator {
  constructor(private readonly prisma: PrismaService) {}

  async validateCustomKey(key: string): Promise<void> {
    if (!FIELD_KEY_FORMAT.test(key)) {
      throw new FieldKeyValidationError(
        'invalid_format',
        `Field key "${key}" is invalid. Use lowercase letters, digits, and underscores; must start with a letter; max 64 chars.`,
      );
    }
    if (isMagicFormFieldKey(key)) {
      throw new FieldKeyValidationError(
        'reserved_magic',
        `"${key}" is a reserved system key — pick it from the System Field catalog instead.`,
      );
    }
    const catalogHits = await this.prisma.systemFormFieldDefinition.findMany({
      where: { key, isActive: true, deletedAt: null },
      select: { key: true, isActive: true },
    });
    if (catalogHits.length > 0) {
      throw new FieldKeyValidationError(
        'reserved_catalog',
        `"${key}" is a system field — pick it from the catalog instead.`,
      );
    }
  }
}
```

- [ ] **Step 4: Run — passes**

```bash
npm test -- form-field-key.validator.spec.ts
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/modules/programs/application/validators/
git commit -m "feat(api): add form field key validator with reserved-word blocking"
```

---

## Phase 2: Seed Data

### Task 2.1: Seed the System Field catalog

**Files:**
- Create: `ybb-platform/services/api/prisma/seeds/seed-system-form-fields.ts`
- Modify: `ybb-platform/services/api/prisma/seeds/main.ts`

- [ ] **Step 1: Write the seeder**

Create `prisma/seeds/seed-system-form-fields.ts`:

```typescript
import { PrismaClient } from '@prisma/client';

type SeedEntry = {
  key: string;
  label: string;
  category: string;
  type: string;
  defaultOptions?: Array<{ label: string; value: string }>;
  isMagic?: boolean;
  helpText?: string;
  order?: number;
};

const GENERIC_CATALOG: SeedEntry[] = [
  // Identity
  { key: 'full_name', label: 'Full Name', category: 'identity', type: 'text', order: 1 },
  { key: 'nickname', label: 'Nickname / Preferred Name', category: 'identity', type: 'text', order: 2 },
  { key: 'email', label: 'Email Address', category: 'identity', type: 'email', order: 3 },
  { key: 'phone', label: 'Phone Number', category: 'identity', type: 'phone', order: 4 },
  { key: 'date_of_birth', label: 'Date of Birth', category: 'identity', type: 'date', order: 5 },
  {
    key: 'gender',
    label: 'Gender',
    category: 'identity',
    type: 'radio',
    defaultOptions: [
      { label: 'Male', value: 'male' },
      { label: 'Female', value: 'female' },
      { label: 'Prefer not to say', value: 'prefer-not' },
      { label: 'Other', value: 'other' },
    ],
    order: 6,
  },
  { key: 'nationality', label: 'Nationality', category: 'identity', type: 'text', order: 7 },
  { key: 'origin_address', label: 'Origin Address', category: 'identity', type: 'textarea', order: 8, helpText: 'Hometown / permanent address.' },
  { key: 'current_address', label: 'Current Address', category: 'identity', type: 'textarea', order: 9 },
  { key: 'profile_picture', label: 'Profile Picture', category: 'identity', type: 'file', order: 10 },
  { key: 'instagram_account', label: 'Instagram Handle', category: 'identity', type: 'text', order: 11 },

  // Professional
  { key: 'occupation', label: 'Occupation', category: 'professional', type: 'text', order: 20 },
  { key: 'institution', label: 'Institution / University', category: 'professional', type: 'text', order: 21 },
  { key: 'major', label: 'Major / Field of Study', category: 'professional', type: 'text', order: 22 },
  {
    key: 'education_level',
    label: 'Highest Education Level',
    category: 'professional',
    type: 'select',
    defaultOptions: [
      { label: 'High School', value: 'high_school' },
      { label: 'Diploma', value: 'diploma' },
      { label: "Bachelor's", value: 'bachelors' },
      { label: "Master's", value: 'masters' },
      { label: 'Doctorate', value: 'doctorate' },
      { label: 'Other', value: 'other' },
    ],
    order: 23,
  },
  { key: 'organizations', label: 'Organizations / Extracurriculars', category: 'professional', type: 'textarea', order: 24 },
  { key: 'linkedin_url', label: 'LinkedIn URL', category: 'professional', type: 'url', order: 25 },
  { key: 'cv_upload', label: 'CV / Resume', category: 'professional', type: 'file', order: 26 },

  // Logistics
  {
    key: 'tshirt_size',
    label: 'T-Shirt Size',
    category: 'logistics',
    type: 'radio',
    defaultOptions: [
      { label: 'XS', value: 'XS' },
      { label: 'S', value: 'S' },
      { label: 'M', value: 'M' },
      { label: 'L', value: 'L' },
      { label: 'XL', value: 'XL' },
      { label: 'XXL', value: 'XXL' },
    ],
    order: 40,
  },
  { key: 'dietary_restrictions', label: 'Dietary Restrictions', category: 'logistics', type: 'text', order: 41 },
  { key: 'disease_history', label: 'Medical / Health History', category: 'logistics', type: 'textarea', order: 42 },
  { key: 'emergency_contact_name', label: 'Emergency Contact Name', category: 'logistics', type: 'text', order: 43 },
  { key: 'emergency_contact_phone', label: 'Emergency Contact Phone', category: 'logistics', type: 'phone', order: 44 },
  { key: 'emergency_contact_relation', label: 'Relation to Emergency Contact', category: 'logistics', type: 'text', order: 45 },

  // Misc
  {
    key: 'referral_source',
    label: 'How did you hear about us?',
    category: 'misc',
    type: 'select',
    defaultOptions: [
      { label: 'Instagram', value: 'instagram' },
      { label: 'Twitter/X', value: 'twitter' },
      { label: 'Friend', value: 'friend' },
      { label: 'School', value: 'school' },
      { label: 'Ambassador', value: 'ambassador' },
      { label: 'Other', value: 'other' },
    ],
    order: 60,
  },
  { key: 'referral_source_detail', label: 'Referral source detail', category: 'misc', type: 'text', order: 61 },
  { key: 'ambassador_referral_code', label: 'Ambassador Referral Code', category: 'misc', type: 'text', order: 62 },
  { key: 'twibbon_link', label: 'Twibbon / Social Media Post Link', category: 'misc', type: 'url', order: 63 },
];

const MAGIC_SEED: SeedEntry[] = [
  {
    key: 'category',
    label: 'Application Category',
    category: 'program_structure',
    type: 'radio',
    isMagic: true,
    order: 30,
  },
  {
    key: 'program_subtheme_id',
    label: 'Subtheme Selection',
    category: 'program_structure',
    type: 'select',
    isMagic: true,
    order: 31,
  },
  // NOTE: program_id is intentionally NOT seeded into the catalog — it is
  // a reserved, non-admin-facing key managed entirely in code.
];

export async function seedSystemFormFields(prisma: PrismaClient) {
  const entries = [...GENERIC_CATALOG, ...MAGIC_SEED];
  for (const e of entries) {
    await prisma.systemFormFieldDefinition.upsert({
      where: { key: e.key },
      update: {
        label: e.label,
        category: e.category,
        type: e.type,
        defaultOptions: e.defaultOptions ?? [],
        helpText: e.helpText ?? null,
        isMagic: e.isMagic ?? false,
        isActive: true,
        order: e.order ?? 0,
        deletedAt: null,
      },
      create: {
        key: e.key,
        label: e.label,
        category: e.category,
        type: e.type,
        defaultOptions: e.defaultOptions ?? [],
        helpText: e.helpText ?? null,
        isMagic: e.isMagic ?? false,
        order: e.order ?? 0,
      },
    });
  }
  // eslint-disable-next-line no-console
  console.log(`✓ Seeded ${entries.length} system form field definitions`);
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedSystemFormFields(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 2: Wire it into `main.ts`**

Open `prisma/seeds/main.ts`. Find the imports section and add:

```typescript
import { seedSystemFormFields } from './seed-system-form-fields';
```

Find the main seeding sequence (look for where other seeders like `seedPrograms` are invoked) and add a call in an appropriate order (after programs exist, but idempotent regardless):

```typescript
await seedSystemFormFields(prisma);
```

- [ ] **Step 3: Run the seed against dev DB**

```bash
npm run prisma:seed
```
Expected: logs `✓ Seeded N system form field definitions` and exits 0.

- [ ] **Step 4: Verify via Prisma Studio or psql**

```bash
npx prisma studio
```
Open the `SystemFormFieldDefinition` table, confirm 30 rows (28 generic + 2 magic), `category` enum-backed fields have options in `defaultOptions`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seeds/seed-system-form-fields.ts prisma/seeds/main.ts
git commit -m "feat(seed): seed system form field catalog"
```

### Task 2.2: Seed the Standard Program Application template

**Files:**
- Create: `ybb-platform/services/api/prisma/seeds/seed-form-templates.ts`
- Modify: `ybb-platform/services/api/prisma/seeds/main.ts`

- [ ] **Step 1: Write the seeder**

```typescript
// prisma/seeds/seed-form-templates.ts
import { PrismaClient } from '@prisma/client';

const STANDARD_TEMPLATE_NAME = 'Standard Program Application';

type TemplateField = {
  key: string;           // system field key
  section: string;
  isRequired: boolean;
  order: number;
};

const STANDARD_FIELDS: TemplateField[] = [
  { key: 'full_name',                 section: 'personal_details',     isRequired: true,  order: 1 },
  { key: 'nickname',                  section: 'personal_details',     isRequired: false, order: 2 },
  { key: 'email',                     section: 'personal_details',     isRequired: true,  order: 3 },
  { key: 'phone',                     section: 'personal_details',     isRequired: true,  order: 4 },
  { key: 'date_of_birth',             section: 'personal_details',     isRequired: true,  order: 5 },
  { key: 'gender',                    section: 'personal_details',     isRequired: true,  order: 6 },
  { key: 'nationality',               section: 'personal_details',     isRequired: true,  order: 7 },
  { key: 'origin_address',            section: 'personal_details',     isRequired: true,  order: 8 },
  { key: 'current_address',           section: 'personal_details',     isRequired: false, order: 9 },
  { key: 'profile_picture',           section: 'personal_details',     isRequired: false, order: 10 },
  { key: 'instagram_account',         section: 'personal_details',     isRequired: false, order: 11 },
  { key: 'occupation',                section: 'professional_profile', isRequired: false, order: 20 },
  { key: 'institution',               section: 'professional_profile', isRequired: true,  order: 21 },
  { key: 'major',                     section: 'professional_profile', isRequired: false, order: 22 },
  { key: 'education_level',           section: 'professional_profile', isRequired: true,  order: 23 },
  { key: 'organizations',             section: 'professional_profile', isRequired: false, order: 24 },
  { key: 'cv_upload',                 section: 'professional_profile', isRequired: true,  order: 25 },
  { key: 'category',                  section: 'entry_information',    isRequired: true,  order: 30 },
  { key: 'program_subtheme_id',       section: 'entry_information',    isRequired: true,  order: 31 },
  { key: 'tshirt_size',               section: 'miscellaneous',        isRequired: false, order: 40 },
  { key: 'disease_history',           section: 'miscellaneous',        isRequired: false, order: 41 },
  { key: 'emergency_contact_name',    section: 'miscellaneous',        isRequired: true,  order: 42 },
  { key: 'emergency_contact_phone',   section: 'miscellaneous',        isRequired: true,  order: 43 },
  { key: 'emergency_contact_relation',section: 'miscellaneous',        isRequired: true,  order: 44 },
  { key: 'referral_source',           section: 'miscellaneous',        isRequired: true,  order: 50 },
  { key: 'referral_source_detail',    section: 'miscellaneous',        isRequired: false, order: 51 },
  { key: 'ambassador_referral_code',  section: 'miscellaneous',        isRequired: false, order: 52 },
  { key: 'twibbon_link',              section: 'miscellaneous',        isRequired: false, order: 53 },
];

export async function seedFormTemplates(prisma: PrismaClient) {
  const template = await prisma.applicationFormTemplate.upsert({
    where: { id: await resolveExistingTemplateId(prisma, STANDARD_TEMPLATE_NAME) ?? '00000000-0000-0000-0000-000000000000' },
    update: {
      name: STANDARD_TEMPLATE_NAME,
      description:
        'Default template covering the full set of fields historically collected on the participants table.',
      category: 'standard',
      isDefault: true,
    },
    create: {
      name: STANDARD_TEMPLATE_NAME,
      description:
        'Default template covering the full set of fields historically collected on the participants table.',
      category: 'standard',
      isDefault: true,
    },
  });

  // Idempotent: wipe existing template fields, then recreate from source list.
  await prisma.applicationFormTemplateField.deleteMany({
    where: { templateId: template.id },
  });

  await prisma.applicationFormTemplateField.createMany({
    data: STANDARD_FIELDS.map((f) => ({
      templateId: template.id,
      source: 'system',
      systemFieldKey: f.key,
      section: f.section,
      isRequired: f.isRequired,
      order: f.order,
    })),
  });

  // eslint-disable-next-line no-console
  console.log(`✓ Seeded template "${STANDARD_TEMPLATE_NAME}" with ${STANDARD_FIELDS.length} fields`);
}

async function resolveExistingTemplateId(prisma: PrismaClient, name: string): Promise<string | null> {
  const row = await prisma.applicationFormTemplate.findFirst({
    where: { name, deletedAt: null },
    select: { id: true },
  });
  return row?.id ?? null;
}

if (require.main === module) {
  const prisma = new PrismaClient();
  seedFormTemplates(prisma)
    .catch((e) => {
      console.error(e);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 2: Wire into main seed**

Edit `prisma/seeds/main.ts`, add to the import block:

```typescript
import { seedFormTemplates } from './seed-form-templates';
```

Add after `seedSystemFormFields`:

```typescript
await seedFormTemplates(prisma);
```

- [ ] **Step 3: Run seed**

```bash
npm run prisma:seed
```
Expected: logs successful seed lines, no errors.

- [ ] **Step 4: Verify**

```bash
npx prisma studio
```
Open `ApplicationFormTemplate` — 1 row ("Standard Program Application"). Open `ApplicationFormTemplateField` — 28 rows, all `source = 'system'`.

- [ ] **Step 5: Commit**

```bash
git add prisma/seeds/seed-form-templates.ts prisma/seeds/main.ts
git commit -m "feat(seed): seed standard program application template"
```

---

## Phase 3: API — Backend

### Task 3.1: Update `ApplicationFormField` DTO and command handler

**Files:**
- Modify: `ybb-platform/services/api/src/modules/programs/application/dto/application-form-field/create-application-form-field.dto.ts`
- Modify: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/application-form-field.handler.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/application-form-field.handler.spec.ts`

- [ ] **Step 1: Extend the DTO**

Edit `dto/application-form-field/create-application-form-field.dto.ts`. Below the existing properties, add:

```typescript
  @ApiPropertyOptional({ description: 'Field source: system or custom. Defaults to custom.' })
  @IsOptional()
  @IsString()
  source?: 'system' | 'custom';

  @ApiPropertyOptional({ description: 'When source=system, the system catalog key this field references.' })
  @IsOptional()
  @IsString()
  systemFieldKey?: string;
```

- [ ] **Step 2: Write a failing test for the command handler**

Create `commands/handlers/application-form-field.handler.spec.ts`:

```typescript
import { Test } from '@nestjs/testing';
import { ConflictException } from '@nestjs/common';
import {
  CreateApplicationFormFieldHandler,
} from './application-form-field.handler';
import { CreateApplicationFormFieldCommand } from '../application-form-field.commands';
import { FormFieldKeyValidator, FieldKeyValidationError } from '../../validators/form-field-key.validator';

describe('CreateApplicationFormFieldHandler', () => {
  const mockRepo = {
    createFormField: jest.fn(),
  };
  const mockValidator = {
    validateCustomKey: jest.fn(),
    resolveSystemFieldKey: jest.fn(),
  };
  const mockPrisma = {
    systemFormFieldDefinition: {
      findUnique: jest.fn(),
    },
  };

  let handler: CreateApplicationFormFieldHandler;

  beforeEach(async () => {
    jest.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [
        CreateApplicationFormFieldHandler,
        { provide: 'IProgramContentRepository', useValue: mockRepo },
        { provide: FormFieldKeyValidator, useValue: mockValidator },
        { provide: 'PrismaService', useValue: mockPrisma },
      ],
    }).compile();
    handler = moduleRef.get(CreateApplicationFormFieldHandler);
  });

  it('accepts a valid custom field', async () => {
    mockValidator.validateCustomKey.mockResolvedValue(undefined);
    mockRepo.createFormField.mockResolvedValue({ id: 'f1' });

    await handler.execute(
      new CreateApplicationFormFieldCommand('p1', {
        fieldName: 'volunteer_experience',
        label: 'Volunteer Experience',
        fieldType: 'textarea' as never,
      }),
    );

    expect(mockValidator.validateCustomKey).toHaveBeenCalledWith('volunteer_experience');
    expect(mockRepo.createFormField).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'custom', name: 'volunteer_experience' }),
    );
  });

  it('rejects a custom field with a reserved key', async () => {
    mockValidator.validateCustomKey.mockRejectedValue(
      new FieldKeyValidationError('reserved_magic', 'nope'),
    );

    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand('p1', {
          fieldName: 'category',
          label: 'Category',
          fieldType: 'radio' as never,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('accepts a system field and backfills name from systemFieldKey', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue({
      key: 'tshirt_size',
      type: 'radio',
      defaultOptions: [{ label: 'S', value: 'S' }],
    });
    mockRepo.createFormField.mockResolvedValue({ id: 'f2' });

    await handler.execute(
      new CreateApplicationFormFieldCommand('p1', {
        source: 'system',
        systemFieldKey: 'tshirt_size',
        label: 'T-Shirt Size',
        fieldType: 'radio' as never,
      }),
    );

    expect(mockValidator.validateCustomKey).not.toHaveBeenCalled();
    expect(mockRepo.createFormField).toHaveBeenCalledWith(
      expect.objectContaining({
        source: 'system',
        systemFieldKey: 'tshirt_size',
        name: 'tshirt_size',
      }),
    );
  });

  it('rejects a system field with unknown systemFieldKey', async () => {
    mockPrisma.systemFormFieldDefinition.findUnique.mockResolvedValue(null);

    await expect(
      handler.execute(
        new CreateApplicationFormFieldCommand('p1', {
          source: 'system',
          systemFieldKey: 'nonexistent_key',
          label: 'X',
          fieldType: 'text' as never,
        }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
```

- [ ] **Step 3: Run — fails**

```bash
npm test -- application-form-field.handler.spec.ts
```
Expected: FAIL (handler doesn't yet accept the validator/prisma deps or enforce the rules).

- [ ] **Step 4: Update the handler**

Replace the contents of `commands/handlers/application-form-field.handler.ts` with:

```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject } from '@nestjs/common';
import { IProgramContentRepository } from '@core/interfaces/repositories/program-content.repository.interface';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  CreateApplicationFormFieldCommand,
  UpdateApplicationFormFieldCommand,
  DeleteApplicationFormFieldCommand,
} from '../application-form-field.commands';
import { CreateApplicationFormFieldDto } from '../../dto/application-form-field/create-application-form-field.dto';
import { ApplicationFormField } from '@prisma/client';
import {
  FormFieldKeyValidator,
  FieldKeyValidationError,
} from '../../validators/form-field-key.validator';

function buildValidationRules(dto: Partial<CreateApplicationFormFieldDto>) {
  if (dto.defaultValue === undefined) {
    return dto.validationRules;
  }
  return {
    ...(dto.validationRules && typeof dto.validationRules === 'object'
      ? dto.validationRules
      : {}),
    defaultValue: dto.defaultValue,
  };
}

function mapDtoToField(dto: Partial<CreateApplicationFormFieldDto>, nameOverride?: string) {
  return {
    ...(dto.section !== undefined ? { section: dto.section } : {}),
    ...(dto.fieldName !== undefined || nameOverride !== undefined
      ? { name: nameOverride ?? dto.fieldName }
      : {}),
    ...(dto.label !== undefined ? { label: dto.label } : {}),
    ...(dto.placeholder !== undefined ? { placeholder: dto.placeholder } : {}),
    ...(dto.helpText !== undefined ? { helpText: dto.helpText } : {}),
    ...(dto.mediaUrl !== undefined ? { mediaUrl: dto.mediaUrl } : {}),
    ...(dto.mediaAlt !== undefined ? { mediaAlt: dto.mediaAlt } : {}),
    ...(dto.fieldType !== undefined ? { type: dto.fieldType } : {}),
    ...(dto.isRequired !== undefined ? { isRequired: dto.isRequired } : {}),
    ...(dto.options !== undefined ? { options: dto.options } : {}),
    ...(dto.order !== undefined ? { order: dto.order } : {}),
    ...(dto.validationRules !== undefined || dto.defaultValue !== undefined
      ? { validationRules: buildValidationRules(dto) }
      : {}),
  };
}

function translateValidationError(err: unknown): ConflictException {
  if (err instanceof FieldKeyValidationError) {
    return new ConflictException({
      code: err.code,
      message: err.message,
    });
  }
  throw err;
}

@CommandHandler(CreateApplicationFormFieldCommand)
export class CreateApplicationFormFieldHandler
  implements ICommandHandler<CreateApplicationFormFieldCommand>
{
  constructor(
    @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
    private readonly keyValidator: FormFieldKeyValidator,
    @Inject('PrismaService') private readonly prisma: PrismaService,
  ) {}

  async execute(command: CreateApplicationFormFieldCommand) {
    const { programId, dto } = command;
    const source = dto.source ?? 'custom';

    if (source === 'system') {
      if (!dto.systemFieldKey) {
        throw new ConflictException({
          code: 'missing_system_field_key',
          message: 'System fields require a systemFieldKey.',
        });
      }
      const definition = await this.prisma.systemFormFieldDefinition.findUnique({
        where: { key: dto.systemFieldKey },
      });
      if (!definition || !definition.isActive || definition.deletedAt) {
        throw new ConflictException({
          code: 'unknown_system_field_key',
          message: `Unknown system field key: ${dto.systemFieldKey}`,
        });
      }
      return this.repository.createFormField({
        ...mapDtoToField(dto, definition.key),
        source: 'system',
        systemFieldKey: definition.key,
        name: definition.key,
        programId,
      } as Partial<ApplicationFormField>);
    }

    // custom
    if (!dto.fieldName) {
      throw new ConflictException({
        code: 'missing_field_name',
        message: 'Custom fields require a fieldName.',
      });
    }
    try {
      await this.keyValidator.validateCustomKey(dto.fieldName);
    } catch (err) {
      throw translateValidationError(err);
    }
    return this.repository.createFormField({
      ...mapDtoToField(dto),
      source: 'custom',
      programId,
    } as Partial<ApplicationFormField>);
  }
}

@CommandHandler(UpdateApplicationFormFieldCommand)
export class UpdateApplicationFormFieldHandler
  implements ICommandHandler<UpdateApplicationFormFieldCommand>
{
  constructor(
    @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
    private readonly keyValidator: FormFieldKeyValidator,
  ) {}

  async execute(command: UpdateApplicationFormFieldCommand) {
    const { fieldId, dto } = command;
    if (dto.fieldName) {
      try {
        await this.keyValidator.validateCustomKey(dto.fieldName);
      } catch (err) {
        throw translateValidationError(err);
      }
    }
    return this.repository.updateFormField(
      fieldId,
      mapDtoToField(dto) as Partial<ApplicationFormField>,
    );
  }
}

@CommandHandler(DeleteApplicationFormFieldCommand)
export class DeleteApplicationFormFieldHandler
  implements ICommandHandler<DeleteApplicationFormFieldCommand>
{
  constructor(
    @Inject('IProgramContentRepository') private readonly repository: IProgramContentRepository,
  ) {}

  async execute(command: DeleteApplicationFormFieldCommand) {
    return this.repository.deleteFormField(command.fieldId);
  }
}
```

- [ ] **Step 5: Wire providers into the module**

Open `src/modules/programs/programs.module.ts`. Ensure `FormFieldKeyValidator` is in the providers list, and `PrismaService` is available (it likely is via a shared module). Add an import:

```typescript
import { FormFieldKeyValidator } from './application/validators/form-field-key.validator';
```

Add to `providers`:

```typescript
FormFieldKeyValidator,
{ provide: 'PrismaService', useExisting: PrismaService },
```

(The `useExisting` alias lets us inject via the `'PrismaService'` string token in the handler specs; if the module already exports `PrismaService` directly, this token aliasing can be skipped — update the handler to `@Inject(PrismaService)` instead. Choose one convention and be consistent.)

- [ ] **Step 6: Run test — passes**

```bash
npm test -- application-form-field.handler.spec.ts
```
Expected: all four tests PASS.

- [ ] **Step 7: Commit**

```bash
git add src/modules/programs/application/commands/handlers/ \
        src/modules/programs/application/dto/application-form-field/ \
        src/modules/programs/programs.module.ts
git commit -m "feat(api): enforce key validation and system-field linkage on form field create/update"
```

### Task 3.2: System field catalog read endpoint

**Files:**
- Create: `ybb-platform/services/api/src/modules/programs/application/queries/get-system-form-fields.query.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/queries/handlers/get-system-form-fields.handler.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/queries/handlers/get-system-form-fields.handler.spec.ts`
- Create: `ybb-platform/services/api/src/modules/programs/presentation/dto/system-form-field.dto.ts`
- Modify: `ybb-platform/services/api/src/modules/programs/presentation/admin-programs.controller.ts` (or create a new `system-form-fields.controller.ts`)
- Modify: `ybb-platform/services/api/src/modules/programs/programs.module.ts`

- [ ] **Step 1: Write the query object**

```typescript
// src/modules/programs/application/queries/get-system-form-fields.query.ts
export class GetSystemFormFieldsQuery {
  constructor(public readonly includeInactive = false) {}
}
```

- [ ] **Step 2: Write the response DTO**

```typescript
// src/modules/programs/presentation/dto/system-form-field.dto.ts
import { ApiProperty } from '@nestjs/swagger';

export class SystemFormFieldDto {
  @ApiProperty() id!: string;
  @ApiProperty() key!: string;
  @ApiProperty() label!: string;
  @ApiProperty() category!: string;
  @ApiProperty() type!: string;
  @ApiProperty({ type: 'array', items: { type: 'object' } }) defaultOptions!: unknown[];
  @ApiProperty() helpText?: string | null;
  @ApiProperty() isMagic!: boolean;
  @ApiProperty() isActive!: boolean;
  @ApiProperty() order!: number;
}
```

- [ ] **Step 3: Failing test for the handler**

```typescript
// src/modules/programs/application/queries/handlers/get-system-form-fields.handler.spec.ts
import { GetSystemFormFieldsHandler } from './get-system-form-fields.handler';
import { GetSystemFormFieldsQuery } from '../get-system-form-fields.query';

describe('GetSystemFormFieldsHandler', () => {
  const mkPrisma = (rows: unknown[]) =>
    ({
      systemFormFieldDefinition: {
        findMany: jest.fn().mockResolvedValue(rows),
      },
    }) as never;

  it('returns only active definitions by default', async () => {
    const prisma = mkPrisma([
      { id: '1', key: 'full_name', label: 'Full Name', category: 'identity', type: 'text',
        defaultOptions: [], helpText: null, isMagic: false, isActive: true, order: 1 },
    ]);
    const handler = new GetSystemFormFieldsHandler(prisma);
    const result = await handler.execute(new GetSystemFormFieldsQuery());
    expect(result).toHaveLength(1);
    expect(prisma.systemFormFieldDefinition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, deletedAt: null },
      }),
    );
  });
});
```

- [ ] **Step 4: Run — fails**

```bash
npm test -- get-system-form-fields.handler.spec.ts
```
Expected: FAIL (module not found).

- [ ] **Step 5: Implement the handler**

```typescript
// src/modules/programs/application/queries/handlers/get-system-form-fields.handler.ts
import { Inject, Injectable } from '@nestjs/common';
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { GetSystemFormFieldsQuery } from '../get-system-form-fields.query';
import { SystemFormFieldDto } from '../../../presentation/dto/system-form-field.dto';

@Injectable()
@QueryHandler(GetSystemFormFieldsQuery)
export class GetSystemFormFieldsHandler
  implements IQueryHandler<GetSystemFormFieldsQuery>
{
  constructor(
    @Inject('PrismaService') private readonly prisma: PrismaService,
  ) {}

  async execute(query: GetSystemFormFieldsQuery): Promise<SystemFormFieldDto[]> {
    const rows = await this.prisma.systemFormFieldDefinition.findMany({
      where: query.includeInactive
        ? { deletedAt: null }
        : { isActive: true, deletedAt: null },
      orderBy: [{ category: 'asc' }, { order: 'asc' }, { label: 'asc' }],
    });
    return rows.map((row) => ({
      id: row.id,
      key: row.key,
      label: row.label,
      category: row.category,
      type: row.type,
      defaultOptions: (row.defaultOptions as unknown[]) ?? [],
      helpText: row.helpText,
      isMagic: row.isMagic,
      isActive: row.isActive,
      order: row.order,
    }));
  }
}
```

- [ ] **Step 6: Run — passes**

```bash
npm test -- get-system-form-fields.handler.spec.ts
```
Expected: PASS.

- [ ] **Step 7: Add controller endpoint**

Create `src/modules/programs/presentation/system-form-fields.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { QueryBus } from '@nestjs/cqrs';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@shared/guards/jwt-auth.guard';
import { GetSystemFormFieldsQuery } from '../application/queries/get-system-form-fields.query';
import { SystemFormFieldDto } from './dto/system-form-field.dto';

@ApiTags('System Form Fields')
@ApiBearerAuth()
@Controller('system-form-fields')
@UseGuards(JwtAuthGuard)
export class SystemFormFieldsController {
  constructor(private readonly queryBus: QueryBus) {}

  @Get()
  list(@Query('includeInactive') includeInactive?: string): Promise<SystemFormFieldDto[]> {
    return this.queryBus.execute(
      new GetSystemFormFieldsQuery(includeInactive === 'true'),
    );
  }
}
```

(Verify the `JwtAuthGuard` import path against existing controllers — it may live at `src/shared/guards/` or be aliased via `@shared/guards`. Follow the pattern used by `program-application.controller.ts`.)

- [ ] **Step 8: Register the controller and handler in the module**

Edit `programs.module.ts`:

```typescript
import { SystemFormFieldsController } from './presentation/system-form-fields.controller';
import { GetSystemFormFieldsHandler } from './application/queries/handlers/get-system-form-fields.handler';
```

Add `SystemFormFieldsController` to `controllers`; add `GetSystemFormFieldsHandler` to `providers`.

- [ ] **Step 9: Smoke test via HTTP**

Start the API (`npm run start:dev`), then:

```bash
curl -s http://localhost:3001/system-form-fields -H "Authorization: Bearer $TOKEN" | jq '.[0:3]'
```
Expected: JSON array with the catalog entries.

- [ ] **Step 10: Commit**

```bash
git add src/modules/programs/application/queries/ \
        src/modules/programs/presentation/system-form-fields.controller.ts \
        src/modules/programs/presentation/dto/system-form-field.dto.ts \
        src/modules/programs/programs.module.ts
git commit -m "feat(api): add GET /system-form-fields endpoint"
```

### Task 3.3: System field catalog write endpoints (super-admin)

**Files:**
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/system-form-field.commands.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/system-form-field.handler.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/system-form-field.handler.spec.ts`
- Create: `ybb-platform/services/api/src/modules/programs/presentation/dto/manage-system-form-field.dto.ts`
- Modify: `ybb-platform/services/api/src/modules/programs/presentation/system-form-fields.controller.ts`
- Modify: `ybb-platform/services/api/src/modules/programs/programs.module.ts`

- [ ] **Step 1: Super-admin guard audit**

Locate the existing super-admin/role guard. Search:

```bash
grep -R "SuperAdmin\|super_admin\|RolesGuard" src/shared/guards/ src/shared/decorators/ | head
```

Identify the decorator (likely `@Roles('super_admin')` or similar) used for super-admin endpoints. Note the exact import path. If no decorator exists, locate the permission system and introduce a `manage_system_form_fields` permission — this must be decided with the team before writing code. (Spec §8.2 lists this permission.)

- [ ] **Step 2: Command DTOs**

```typescript
// src/modules/programs/presentation/dto/manage-system-form-field.dto.ts
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsBoolean, IsOptional, IsNumber, Matches, MaxLength } from 'class-validator';

export class CreateSystemFormFieldDto {
  @ApiProperty()
  @IsString() @Matches(/^[a-z][a-z0-9_]{0,63}$/) @MaxLength(64)
  key!: string;

  @ApiProperty() @IsString() @MaxLength(255)
  label!: string;

  @ApiProperty() @IsString() @MaxLength(32)
  category!: string;

  @ApiProperty() @IsString() @MaxLength(32)
  type!: string;

  @ApiPropertyOptional() @IsOptional()
  defaultOptions?: unknown[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  helpText?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  order?: number;
}

export class UpdateSystemFormFieldDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(255)
  label?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  category?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32)
  type?: string;

  @ApiPropertyOptional() @IsOptional()
  defaultOptions?: unknown[];

  @ApiPropertyOptional() @IsOptional() @IsString()
  helpText?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional() @IsOptional() @IsNumber()
  order?: number;
}
```

- [ ] **Step 3: Commands**

```typescript
// src/modules/programs/application/commands/system-form-field.commands.ts
import {
  CreateSystemFormFieldDto,
  UpdateSystemFormFieldDto,
} from '../../presentation/dto/manage-system-form-field.dto';

export class CreateSystemFormFieldCommand {
  constructor(public readonly dto: CreateSystemFormFieldDto) {}
}

export class UpdateSystemFormFieldCommand {
  constructor(public readonly id: string, public readonly dto: UpdateSystemFormFieldDto) {}
}

export class DeleteSystemFormFieldCommand {
  constructor(public readonly id: string) {}
}
```

- [ ] **Step 4: Write the handler spec**

```typescript
// src/modules/programs/application/commands/handlers/system-form-field.handler.spec.ts
import { ConflictException, NotFoundException } from '@nestjs/common';
import {
  CreateSystemFormFieldHandler,
  UpdateSystemFormFieldHandler,
  DeleteSystemFormFieldHandler,
} from './system-form-field.handler';
import {
  CreateSystemFormFieldCommand,
  UpdateSystemFormFieldCommand,
  DeleteSystemFormFieldCommand,
} from '../system-form-field.commands';

describe('System form field handlers', () => {
  const mkPrisma = (opts: Partial<{
    findUnique: unknown;
    create: unknown;
    update: unknown;
  }> = {}) =>
    ({
      systemFormFieldDefinition: {
        findUnique: jest.fn().mockResolvedValue(opts.findUnique ?? null),
        create: jest.fn().mockResolvedValue(opts.create ?? { id: 'new' }),
        update: jest.fn().mockResolvedValue(opts.update ?? { id: 'upd' }),
      },
    }) as never;

  it('creates when key is free', async () => {
    const prisma = mkPrisma();
    const h = new CreateSystemFormFieldHandler(prisma);
    await h.execute(
      new CreateSystemFormFieldCommand({
        key: 'new_key',
        label: 'New',
        category: 'misc',
        type: 'text',
      }),
    );
    expect(prisma.systemFormFieldDefinition.create).toHaveBeenCalled();
  });

  it('rejects create when key already exists and is active', async () => {
    const prisma = mkPrisma({ findUnique: { key: 'x', isActive: true, deletedAt: null } });
    const h = new CreateSystemFormFieldHandler(prisma);
    await expect(
      h.execute(
        new CreateSystemFormFieldCommand({ key: 'x', label: 'X', category: 'misc', type: 'text' }),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('rejects update on nonexistent id', async () => {
    const prisma = mkPrisma();
    const h = new UpdateSystemFormFieldHandler(prisma);
    await expect(
      h.execute(new UpdateSystemFormFieldCommand('nope', { label: 'Y' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft-deletes on delete', async () => {
    const prisma = mkPrisma({ findUnique: { id: '1', isMagic: false } });
    const h = new DeleteSystemFormFieldHandler(prisma);
    await h.execute(new DeleteSystemFormFieldCommand('1'));
    expect(prisma.systemFormFieldDefinition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: '1' },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
  });

  it('rejects deleting a magic entry', async () => {
    const prisma = mkPrisma({ findUnique: { id: '1', isMagic: true } });
    const h = new DeleteSystemFormFieldHandler(prisma);
    await expect(
      h.execute(new DeleteSystemFormFieldCommand('1')),
    ).rejects.toBeInstanceOf(ConflictException);
  });
});
```

- [ ] **Step 5: Run — fails**

```bash
npm test -- system-form-field.handler.spec.ts
```
Expected: FAIL.

- [ ] **Step 6: Implement handlers**

```typescript
// src/modules/programs/application/commands/handlers/system-form-field.handler.ts
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ConflictException, Inject, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  CreateSystemFormFieldCommand,
  UpdateSystemFormFieldCommand,
  DeleteSystemFormFieldCommand,
} from '../system-form-field.commands';
import { isMagicFormFieldKey } from '../../constants/magic-form-fields';

@CommandHandler(CreateSystemFormFieldCommand)
export class CreateSystemFormFieldHandler
  implements ICommandHandler<CreateSystemFormFieldCommand>
{
  constructor(@Inject('PrismaService') private readonly prisma: PrismaService) {}

  async execute({ dto }: CreateSystemFormFieldCommand) {
    if (isMagicFormFieldKey(dto.key)) {
      throw new ConflictException({
        code: 'reserved_magic_key',
        message: `${dto.key} is a magic key and cannot be managed as a catalog entry.`,
      });
    }
    const existing = await this.prisma.systemFormFieldDefinition.findUnique({
      where: { key: dto.key },
    });
    if (existing && existing.isActive && !existing.deletedAt) {
      throw new ConflictException({
        code: 'duplicate_key',
        message: `System field "${dto.key}" already exists.`,
      });
    }
    return this.prisma.systemFormFieldDefinition.create({
      data: {
        key: dto.key,
        label: dto.label,
        category: dto.category,
        type: dto.type,
        defaultOptions: dto.defaultOptions ?? [],
        helpText: dto.helpText ?? null,
        order: dto.order ?? 0,
      },
    });
  }
}

@CommandHandler(UpdateSystemFormFieldCommand)
export class UpdateSystemFormFieldHandler
  implements ICommandHandler<UpdateSystemFormFieldCommand>
{
  constructor(@Inject('PrismaService') private readonly prisma: PrismaService) {}

  async execute({ id, dto }: UpdateSystemFormFieldCommand) {
    const row = await this.prisma.systemFormFieldDefinition.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`System field ${id} not found`);
    return this.prisma.systemFormFieldDefinition.update({
      where: { id },
      data: {
        ...(dto.label !== undefined && { label: dto.label }),
        ...(dto.category !== undefined && { category: dto.category }),
        ...(dto.type !== undefined && { type: dto.type }),
        ...(dto.defaultOptions !== undefined && { defaultOptions: dto.defaultOptions }),
        ...(dto.helpText !== undefined && { helpText: dto.helpText }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.order !== undefined && { order: dto.order }),
      },
    });
  }
}

@CommandHandler(DeleteSystemFormFieldCommand)
export class DeleteSystemFormFieldHandler
  implements ICommandHandler<DeleteSystemFormFieldCommand>
{
  constructor(@Inject('PrismaService') private readonly prisma: PrismaService) {}

  async execute({ id }: DeleteSystemFormFieldCommand) {
    const row = await this.prisma.systemFormFieldDefinition.findUnique({ where: { id } });
    if (!row) throw new NotFoundException(`System field ${id} not found`);
    if (row.isMagic) {
      throw new ConflictException({
        code: 'cannot_delete_magic',
        message: `${row.key} is a magic field and cannot be deleted.`,
      });
    }
    return this.prisma.systemFormFieldDefinition.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }
}
```

- [ ] **Step 7: Run — passes**

```bash
npm test -- system-form-field.handler.spec.ts
```
Expected: PASS.

- [ ] **Step 8: Add write endpoints to the controller**

Extend `system-form-fields.controller.ts`:

```typescript
import { Body, Delete, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import { Roles } from '@shared/decorators/roles.decorator'; // adjust to real path
import { RolesGuard } from '@shared/guards/roles.guard';    // adjust to real path
import {
  CreateSystemFormFieldCommand,
  UpdateSystemFormFieldCommand,
  DeleteSystemFormFieldCommand,
} from '../application/commands/system-form-field.commands';
import {
  CreateSystemFormFieldDto,
  UpdateSystemFormFieldDto,
} from './dto/manage-system-form-field.dto';

// inject CommandBus alongside QueryBus in the constructor
// then add:
@Post()
@UseGuards(RolesGuard)
@Roles('super_admin')
create(@Body() dto: CreateSystemFormFieldDto) {
  return this.commandBus.execute(new CreateSystemFormFieldCommand(dto));
}

@Patch(':id')
@UseGuards(RolesGuard)
@Roles('super_admin')
update(@Param('id') id: string, @Body() dto: UpdateSystemFormFieldDto) {
  return this.commandBus.execute(new UpdateSystemFormFieldCommand(id, dto));
}

@Delete(':id')
@UseGuards(RolesGuard)
@Roles('super_admin')
remove(@Param('id') id: string) {
  return this.commandBus.execute(new DeleteSystemFormFieldCommand(id));
}
```

If the real super-admin gating pattern is different (e.g. a permission rather than a role), translate the decorators accordingly. Mirror the pattern used elsewhere in this codebase — grep for `Roles('` under `src/modules/` for an example.

- [ ] **Step 9: Register the handlers in the module**

Edit `programs.module.ts` — add all three handlers to providers.

- [ ] **Step 10: Commit**

```bash
git add src/modules/programs/application/commands/ \
        src/modules/programs/presentation/ \
        src/modules/programs/programs.module.ts
git commit -m "feat(api): super-admin system form field CRUD endpoints"
```

### Task 3.4: Template CRUD endpoints

**Files:**
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/form-template.commands.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/form-template.handler.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/form-template.handler.spec.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/queries/get-form-templates.query.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/queries/handlers/get-form-templates.handler.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/queries/handlers/get-form-templates.handler.spec.ts`
- Create: `ybb-platform/services/api/src/modules/programs/presentation/form-templates.controller.ts`
- Create: `ybb-platform/services/api/src/modules/programs/presentation/dto/form-template.dto.ts`
- Modify: `ybb-platform/services/api/src/modules/programs/programs.module.ts`

Follow the exact same TDD pattern as Task 3.3 (spec first, then implement, then register). Endpoints to implement:

- `GET /form-templates` — list (paginated or simple; keep simple for MVP). Auth required.
- `GET /form-templates/:id` — detail with fields included.
- `POST /form-templates` — super-admin only. Body: `{ name, description?, category?, isDefault?, fields: TemplateFieldInput[] }`.
- `PATCH /form-templates/:id` — super-admin only. Same body, update-style.
- `DELETE /form-templates/:id` — super-admin only. Soft-delete.

Rules to enforce in the create/update handlers:
- Each template field has `source = 'system' | 'custom'`.
- For `source='system'`: `systemFieldKey` must reference an active catalog entry (reuse the lookup from Task 3.1).
- For `source='custom'`: `name`, `type`, `label` required; `name` must pass `FIELD_KEY_FORMAT`; keys must be unique within the template.
- At most one template per category may have `isDefault=true`. Setting a new default clears the flag on others in the same category in the same transaction.

- [ ] **Step 1: Write handler spec**

Full file — follow pattern of `system-form-field.handler.spec.ts`, covering create happy path, unknown-systemFieldKey rejection, invalid custom-key format rejection, duplicate-within-template rejection, default-flag exclusivity.

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement handlers using `prisma.$transaction` for the create/update (template + nested fields atomic).**

Inside the transaction for `POST`:
1. Validate every field's `systemFieldKey` or custom-key.
2. Check within-template uniqueness of the computed `name` (= `systemFieldKey` for system rows, `name` from dto for custom rows).
3. If `isDefault=true`, set all other templates in the same category to `isDefault=false`.
4. Create the template record + `createMany` for fields.

For `PATCH`, also wrap in a transaction: update template scalar fields, optionally replace `application_form_template_fields` rows atomically (delete-all-then-insert keeps the code simple; the tables are small).

- [ ] **Step 4: Write query handler for list + detail.**

- [ ] **Step 5: Write controller** exposing the five endpoints with the same role-guard pattern as Task 3.3.

- [ ] **Step 6: Register in module.**

- [ ] **Step 7: Run full test file — passes.**

- [ ] **Step 8: Smoke test via curl** — list, create (super-admin token), update, delete.

- [ ] **Step 9: Commit**

```bash
git commit -m "feat(api): form template CRUD endpoints"
```

### Task 3.5: Apply-template endpoint

**Files:**
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/apply-form-template.command.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/apply-form-template.handler.ts`
- Create: `ybb-platform/services/api/src/modules/programs/application/commands/handlers/apply-form-template.handler.spec.ts`
- Modify: `ybb-platform/services/api/src/modules/programs/presentation/admin-programs.controller.ts` (or wherever `POST /programs/:id/form-fields` lives)

- [ ] **Step 1: Failing spec**

```typescript
describe('ApplyFormTemplateHandler', () => {
  // Mock prisma with $transaction that just invokes the callback with the same
  // prisma mock, so the handler's transactional reads/writes land on the mock.

  it('append mode adds new fields and skips colliding keys', async () => {
    // existing fields: [{ name: 'email' }]
    // template fields: [email, phone]
    // expected: { added: ['phone'], skipped: ['email'] }
  });

  it('replace mode soft-deletes existing fields and inserts template', async () => {
    // verify updateMany called with { deletedAt: Date, isActive: false } on existing rows
    // verify createMany called with template fields
  });

  it('replace mode rolls back on partial failure', async () => {
    // inject a failure in createMany; verify updateMany changes are not visible
    // (easiest: test that $transaction rethrows the error)
  });

  it('rejects unknown templateId', async () => {
    // prisma returns null for template lookup
    // expect NotFoundException
  });
});
```

- [ ] **Step 2: Implement**

Sketch:

```typescript
@CommandHandler(ApplyFormTemplateCommand)
export class ApplyFormTemplateHandler implements ICommandHandler<ApplyFormTemplateCommand> {
  constructor(@Inject('PrismaService') private readonly prisma: PrismaService) {}

  async execute({ programId, templateId, mode }: ApplyFormTemplateCommand) {
    return this.prisma.$transaction(async (tx) => {
      const template = await tx.applicationFormTemplate.findFirst({
        where: { id: templateId, deletedAt: null },
        include: { fields: { orderBy: { order: 'asc' } } },
      });
      if (!template) throw new NotFoundException('Template not found');

      if (mode === 'replace') {
        await tx.applicationFormField.updateMany({
          where: { programId, deletedAt: null },
          data: { deletedAt: new Date(), isActive: false },
        });
      }

      const existing = await tx.applicationFormField.findMany({
        where: { programId, deletedAt: null },
        select: { name: true },
      });
      const existingNames = new Set(existing.map((f) => f.name));

      const added: string[] = [];
      const skipped: string[] = [];

      for (const tf of template.fields) {
        const name =
          tf.source === 'system' ? (tf.systemFieldKey as string) : (tf.name as string);
        if (existingNames.has(name)) {
          skipped.push(name);
          continue;
        }
        existingNames.add(name);
        // Resolve defaults from catalog if system
        let type = tf.type;
        let label = tf.labelOverride ?? tf.label;
        let options = tf.options;
        let helpText = tf.helpTextOverride ?? tf.helpText;
        if (tf.source === 'system' && tf.systemFieldKey) {
          const def = await tx.systemFormFieldDefinition.findUnique({
            where: { key: tf.systemFieldKey },
          });
          if (!def || !def.isActive) continue;
          type = def.type;
          if (!tf.labelOverride) label = def.label;
          if (!options || (Array.isArray(options) && options.length === 0)) {
            options = def.defaultOptions;
          }
          if (!tf.helpTextOverride) helpText = def.helpText;
        }
        await tx.applicationFormField.create({
          data: {
            programId,
            name,
            label: label ?? name,
            type: type ?? 'text',
            section: tf.section,
            isRequired: tf.isRequired,
            order: tf.order,
            options: (options as never) ?? [],
            helpText: helpText ?? null,
            source: tf.source,
            systemFieldKey: tf.systemFieldKey ?? null,
          },
        });
        added.push(name);
      }

      return { added, skipped, mode, templateId: template.id };
    });
  }
}
```

- [ ] **Step 3: Register command + handler in module.**

- [ ] **Step 4: Add controller endpoint**

In the same controller that owns `POST /programs/:id/form-fields`:

```typescript
@Post(':id/form-fields/apply-template')
@UseGuards(JwtAuthGuard)
apply(
  @Param('id') programId: string,
  @Body() dto: { templateId: string; mode?: 'append' | 'replace' },
) {
  return this.commandBus.execute(
    new ApplyFormTemplateCommand(
      programId,
      dto.templateId,
      dto.mode ?? 'append',
    ),
  );
}
```

Destructive `replace` mode should require an additional confirmation token or an explicit body flag (e.g. `confirm: true`) to reduce accidental invocation. Add a 400 if `mode === 'replace'` and `confirm !== true`.

- [ ] **Step 5: Run handler spec — passes.**

- [ ] **Step 6: Commit**

```bash
git commit -m "feat(api): apply form template to program (append/replace)"
```

---

## Phase 4: Admin Dashboard UI

> The existing `FormFieldEditor.tsx` (at `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldEditor.tsx`) is the per-field editor today. We keep it as the **custom field editor internals** and introduce a catalog-first entry flow that wraps it.

### Task 4.1: System field catalog API client

**Files:**
- Create: `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/catalog-api.ts`

- [ ] **Step 1: Implement the client**

```typescript
// app/components/submissionsMasterData/form-fields/catalog-api.ts
import { buildApiUrl, getAccessToken, readErrorMessage } from '@/app/components/submissionsMasterData/api';

export type SystemFormField = {
  id: string;
  key: string;
  label: string;
  category: string;
  type: string;
  defaultOptions: Array<{ label: string; value: string }>;
  helpText: string | null;
  isMagic: boolean;
  isActive: boolean;
  order: number;
};

export async function fetchSystemFormFields(): Promise<SystemFormField[]> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(buildApiUrl('/system-form-fields'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as SystemFormField[];
}

export type FormTemplateSummary = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  isDefault: boolean;
  fieldCount: number;
};

export type FormTemplateDetail = FormTemplateSummary & {
  fields: Array<{
    id: string;
    source: 'system' | 'custom';
    systemFieldKey: string | null;
    name: string | null;
    label: string | null;
    type: string | null;
    section: string;
    isRequired: boolean;
    order: number;
  }>;
};

export async function fetchFormTemplates(): Promise<FormTemplateSummary[]> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(buildApiUrl('/form-templates'), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as FormTemplateSummary[];
}

export async function fetchFormTemplateDetail(id: string): Promise<FormTemplateDetail> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(buildApiUrl(`/form-templates/${encodeURIComponent(id)}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as FormTemplateDetail;
}

export async function applyTemplateToProgram(
  programId: string,
  templateId: string,
  mode: 'append' | 'replace',
): Promise<{ added: string[]; skipped: string[]; mode: string }> {
  const token = getAccessToken();
  if (!token) throw new Error('Not authenticated');
  const response = await fetch(
    buildApiUrl(`/programs/${encodeURIComponent(programId)}/form-fields/apply-template`),
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ templateId, mode, confirm: mode === 'replace' ? true : undefined }),
    },
  );
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return (await response.json()) as { added: string[]; skipped: string[]; mode: string };
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/submissionsMasterData/form-fields/catalog-api.ts
git commit -m "feat(admin): add system form field and template API client"
```

### Task 4.2: Catalog picker dialog

**Files:**
- Create: `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/AddFieldDialog.tsx`

- [ ] **Step 1: Implement the picker**

The dialog has three states: **picker** (default), **systemConfig** (after selecting a system field), **customEditor** (after clicking "Create custom field"). Uses existing Radix Dialog patterns (search the repo for `Dialog` usage to match).

```tsx
// app/components/submissionsMasterData/form-fields/AddFieldDialog.tsx
'use client';

import { useEffect, useMemo, useState } from 'react';
import { fetchSystemFormFields, type SystemFormField } from './catalog-api';
import { SystemFieldConfigSheet } from './SystemFieldConfigSheet';
import { FormFieldEditor } from './FormFieldEditor';
import type { ApplicationFormFieldRow } from './FormFieldsTable';

type Mode = 'picker' | 'system' | 'custom';

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  program_structure: 'Program Structure',
  professional: 'Professional',
  logistics: 'Logistics',
  misc: 'Misc',
};

const CATEGORY_ORDER = ['identity', 'program_structure', 'professional', 'logistics', 'misc'];

export function AddFieldDialog({
  open,
  programId,
  onClose,
  onSaved,
}: {
  open: boolean;
  programId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [mode, setMode] = useState<Mode>('picker');
  const [catalog, setCatalog] = useState<SystemFormField[]>([]);
  const [query, setQuery] = useState('');
  const [selectedSystem, setSelectedSystem] = useState<SystemFormField | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode('picker');
    setQuery('');
    setSelectedSystem(null);
    setError(null);
    fetchSystemFormFields()
      .then((rows) => setCatalog(rows.filter((r) => r.isActive)))
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load catalog'));
  }, [open]);

  const grouped = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? catalog.filter((f) => f.label.toLowerCase().includes(q) || f.key.includes(q))
      : catalog;
    const byCategory = new Map<string, SystemFormField[]>();
    for (const f of filtered) {
      if (!byCategory.has(f.category)) byCategory.set(f.category, []);
      byCategory.get(f.category)!.push(f);
    }
    return CATEGORY_ORDER
      .filter((c) => byCategory.has(c))
      .map((c) => [c, byCategory.get(c)!] as const);
  }, [catalog, query]);

  if (!open) return null;

  if (mode === 'system' && selectedSystem) {
    return (
      <SystemFieldConfigSheet
        open
        programId={programId}
        systemField={selectedSystem}
        onClose={() => {
          setMode('picker');
          setSelectedSystem(null);
        }}
        onSaved={onSaved}
      />
    );
  }

  if (mode === 'custom') {
    return (
      <FormFieldEditor
        open
        programId={programId}
        initialField={null}
        onClose={() => setMode('picker')}
        onSaved={onSaved}
      />
    );
  }

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-xl border border-zinc-200 bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-zinc-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-zinc-900">Add Form Field</h2>
            <p className="mt-1 text-sm text-zinc-500">
              Choose a field from the catalog, or create a custom one for anything not in the list.
            </p>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600">✕</button>
        </div>

        <div className="px-6 py-4">
          {error && (
            <div className="mb-3 rounded-md border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {error}
            </div>
          )}
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="🔍 Search — e.g. email, subtheme, t-shirt..."
            className="mb-4 block w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          />

          <div className="max-h-[60vh] space-y-5 overflow-y-auto">
            {grouped.map(([category, fields]) => (
              <section key={category}>
                <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  {CATEGORY_LABELS[category] ?? category}
                </h3>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                  {fields.map((f) => (
                    <button
                      key={f.id}
                      onClick={() => {
                        setSelectedSystem(f);
                        setMode('system');
                      }}
                      className={
                        f.isMagic
                          ? 'rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:border-blue-400 hover:bg-blue-100 transition'
                          : 'rounded-lg border border-zinc-200 bg-white px-3 py-2 text-left hover:border-zinc-300 hover:bg-zinc-50 transition'
                      }
                    >
                      <div className={f.isMagic ? 'text-sm font-semibold text-blue-900' : 'text-sm font-semibold text-zinc-900'}>
                        {f.label}{f.isMagic ? ' ⚙️' : ''}
                      </div>
                      <div className={f.isMagic ? 'text-[11px] text-blue-700' : 'text-[11px] text-zinc-500'}>
                        {f.type} · {f.isMagic ? 'system · auto-synced' : 'built-in'}
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="mt-5 border-t border-dashed border-zinc-200 pt-4">
            <button
              onClick={() => setMode('custom')}
              className="w-full rounded-md border border-zinc-300 bg-white px-4 py-2 text-sm font-semibold text-zinc-800 hover:bg-zinc-50"
            >
              ＋ Create custom field
            </button>
            <p className="mt-1.5 text-center text-[11px] text-zinc-500">
              For questions not covered by the catalog above.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/submissionsMasterData/form-fields/AddFieldDialog.tsx
git commit -m "feat(admin): catalog picker dialog for add form field"
```

### Task 4.3: System field configuration sheet

**Files:**
- Create: `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/SystemFieldConfigSheet.tsx`

- [ ] **Step 1: Implement**

The sheet offers: section dropdown, required toggle, label override, help-text override. A read-only preview shows the field's type and default options (if any). Submit posts to `POST /programs/:id/form-fields` with `source: 'system'` and `systemFieldKey`.

Use `FormFieldEditor.tsx` as a styling reference. Fields visible:
- Section (select — reuse `SECTION_OPTIONS` from `FormFieldEditor.tsx`; export the constant from there if not already exported).
- Required? (Optional / Required)
- Label override (defaulted from system label, admin can edit)
- Help text override (defaulted from system helpText, admin can edit)
- Preview block: shows `Type: Radio`, `Choices: XS, S, M, L, XL, XXL`.

Caption at top: _Stored as `tshirt_size` — consistent across all programs._

The save button calls the same API endpoint as `FormFieldEditor.tsx` (`POST /programs/:id/form-fields`) but with body:

```javascript
{
  source: 'system',
  systemFieldKey: systemField.key,
  section, isRequired, order,
  label: labelOverride || undefined,   // only if different from system default
  helpText: helpTextOverride || undefined,
  fieldType: systemField.type,          // server uses systemFieldKey, but DTO still wants fieldType
}
```

- [ ] **Step 2: Commit**

```bash
git add app/components/submissionsMasterData/form-fields/SystemFieldConfigSheet.tsx
git commit -m "feat(admin): system field configuration sheet"
```

### Task 4.4: Refactor `FormFieldEditor.tsx` — custom-field mode

**Files:**
- Modify: `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldEditor.tsx`

- [ ] **Step 1: Remove the visible `Field Key` input by default**

In `FormFieldEditor.tsx` (current lines 301-312), replace the visible `Field Key` input with:

```tsx
<div className="sm:col-span-2">
  <label className="mb-1.5 block text-xs font-medium text-zinc-600">
    Label <span className="text-rose-500">*</span>
  </label>
  <input
    type="text"
    value={state.label}
    onChange={(e) => {
      const newLabel = e.target.value;
      patch('label', newLabel);
      // Auto-slug: only update fieldName if user hasn't manually edited it.
      if (!state.fieldNameTouched) {
        patch('fieldName', autoSlug(newLabel));
      }
    }}
    placeholder="T-Shirt Size"
    className={INPUT_CLS}
  />
  <p className="mt-1 text-[11px] text-zinc-400">
    Will be stored as <code className="rounded bg-zinc-100 px-1.5 py-0.5 text-[10px]">
      {state.fieldName || 'enter_a_label'}
    </code>{' '}
    <button
      type="button"
      className="text-blue-600 hover:underline"
      onClick={() => patch('advancedOpen', !state.advancedOpen)}
    >
      {state.advancedOpen ? 'hide advanced' : 'advanced'}
    </button>
  </p>
</div>

{state.advancedOpen && (
  <div className="sm:col-span-2 rounded-md border border-zinc-200 bg-zinc-50 px-3 py-3">
    <label className="mb-1.5 block text-xs font-medium text-zinc-600">
      Storage key (advanced)
    </label>
    <input
      type="text"
      value={state.fieldName}
      onChange={(e) => {
        patch('fieldName', e.target.value);
        patch('fieldNameTouched', true);
      }}
      placeholder="tshirt_size"
      className={INPUT_CLS}
    />
    <p className="mt-1 text-[11px] text-zinc-500">
      Auto-generated from the label. Only change if you need to align with an existing
      integration. Must match <code>a-z 0-9 _</code>, start with a letter.
    </p>
  </div>
)}
```

- [ ] **Step 2: Add autoSlug helper**

Create `app/components/submissionsMasterData/form-fields/auto-slug.ts` with the same implementation as the API auto-slug (duplication is acceptable — kept synchronous and client-friendly). Import into `FormFieldEditor.tsx`.

- [ ] **Step 3: Extend `EditorState` with tracking flags**

In the `type EditorState` (around line 58), add:

```typescript
fieldNameTouched: boolean;
advancedOpen: boolean;
```

In `toEditorState`, initialize them to `false` (new field) or `true` (existing field — we treat edits as already touched).

- [ ] **Step 4: Remove the label input that was adjacent to Field Key (old lines 313-321).**

We just absorbed the label into the same column above, so the old input is redundant — delete it.

- [ ] **Step 5: Add `source: 'custom'` to the POST body in `handleSave`.**

Around line 210-228, extend:

```typescript
const body: Record<string, unknown> = {
  source: 'custom',
  // ... rest of existing body ...
};
```

- [ ] **Step 6: Visual check**

Start the admin dashboard:

```bash
npm run dev
```

Navigate to a program's form fields. Click "Add Form Field" (once Task 4.5 rewires it) or open the editor directly — confirm the storage key is hidden by default, the label auto-slugs into the caption, and the Advanced toggle reveals the override input.

- [ ] **Step 7: Commit**

```bash
git add app/components/submissionsMasterData/form-fields/FormFieldEditor.tsx \
        app/components/submissionsMasterData/form-fields/auto-slug.ts
git commit -m "refactor(admin): hide field key behind advanced toggle, auto-slug from label"
```

### Task 4.5: Wire the catalog picker as the "Add Form Field" entry point

**Files:**
- Modify: `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx`

- [ ] **Step 1: Find the current "Add Form Field" trigger**

Search for the button that opens `FormFieldEditor` today:

```bash
grep -n "Add Form Field\|FormFieldEditor" app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx
```

- [ ] **Step 2: Replace the trigger to open `AddFieldDialog` instead**

Replace the state that toggles `editorOpen` for the create case with a new `addDialogOpen` flag that renders `AddFieldDialog`. Keep `FormFieldEditor` open-state for the edit case — editing an existing field still uses the full editor.

Example change:

```tsx
// before:
<button onClick={() => setEditorOpen(true)}>Add Form Field</button>
{editorOpen && <FormFieldEditor open programId={programId} initialField={null} ... />}

// after:
<button onClick={() => setAddDialogOpen(true)}>Add Form Field</button>
{addDialogOpen && (
  <AddFieldDialog
    open
    programId={programId}
    onClose={() => setAddDialogOpen(false)}
    onSaved={() => {
      setAddDialogOpen(false);
      refetch();
    }}
  />
)}
{editingField && (
  <FormFieldEditor
    open
    programId={programId}
    initialField={editingField}
    onClose={() => setEditingField(null)}
    onSaved={() => {
      setEditingField(null);
      refetch();
    }}
  />
)}
```

- [ ] **Step 3: Also add a "Copy from template" button next to "Add Form Field"**

Include a second button that opens `CopyFromTemplateDialog` (Task 4.6):

```tsx
<button
  onClick={() => setCopyTemplateOpen(true)}
  className="rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm"
>
  Copy from template
</button>
{copyTemplateOpen && (
  <CopyFromTemplateDialog
    open
    programId={programId}
    onClose={() => setCopyTemplateOpen(false)}
    onApplied={() => {
      setCopyTemplateOpen(false);
      refetch();
    }}
  />
)}
```

- [ ] **Step 4: Commit**

```bash
git add app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx
git commit -m "feat(admin): open catalog picker as add-field trigger; surface copy-from-template"
```

### Task 4.6: Copy-from-template dialog

**Files:**
- Create: `ybb-platform/services/admin-dashboard/app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx`

- [ ] **Step 1: Implement**

Component states: list of templates (from `fetchFormTemplates`), selected template (show preview via `fetchFormTemplateDetail`), mode selector (append / replace). Replace mode requires a typed confirmation ("type REPLACE to confirm").

After submit, call `applyTemplateToProgram` and display a sonner toast summarizing:
- "Added N fields"
- If skipped: "Skipped M fields that already exist: email, phone…"

- [ ] **Step 2: Commit**

```bash
git add app/components/submissionsMasterData/form-fields/CopyFromTemplateDialog.tsx
git commit -m "feat(admin): copy-from-template dialog with append/replace modes"
```

### Task 4.7: Super-admin: system field catalog management page

**Files:**
- Create: `ybb-platform/services/admin-dashboard/app/(super-admin)/system-form-fields/page.tsx`
- Create: `ybb-platform/services/admin-dashboard/app/(super-admin)/system-form-fields/SystemFieldEditor.tsx`

- [ ] **Step 1: Add the route**

Follow existing super-admin page patterns (search for other super-admin-gated routes). The page should:
- List catalog entries grouped by category.
- Show magic entries as read-only (they're code-backed; only the DB row for UX metadata can be tweaked, but for simplicity we treat them as view-only here).
- "New System Field" button opens `SystemFieldEditor`.
- Row actions: Edit (opens editor), Archive (soft-delete).

- [ ] **Step 2: SystemFieldEditor** reuses the same field-editor visual language from `FormFieldEditor` but writes to `POST/PATCH /system-form-fields`. Fields: key (create-only, validated against format), label, category (dropdown), type (dropdown), defaultOptions (repeater for option types), helpText.

- [ ] **Step 3: Commit**

```bash
git add app/\(super-admin\)/system-form-fields/
git commit -m "feat(admin): super-admin catalog management page"
```

### Task 4.8: Super-admin: template management page

**Files:**
- Create: `ybb-platform/services/admin-dashboard/app/(super-admin)/form-templates/page.tsx`
- Create: `ybb-platform/services/admin-dashboard/app/(super-admin)/form-templates/TemplateEditor.tsx`

- [ ] **Step 1: Implement**

The page lists templates. Clicking a row opens `TemplateEditor`, which reuses `AddFieldDialog` and `FormFieldEditor` components but scopes writes to `application_form_template_fields` via the template API.

Key behavior: the editor lets the super-admin pick system fields from the catalog OR add custom field snapshots. The template acts like a per-program form builder but the save target is a template record.

- [ ] **Step 2: Commit**

```bash
git add app/\(super-admin\)/form-templates/
git commit -m "feat(admin): super-admin template management page"
```

### Task 4.9: New-program wizard hook — offer default template

**Files:**
- Modify: whichever page/route contains the "Create program" flow. Find it:

```bash
grep -Rn "Create Program\|createProgram" ybb-platform/services/admin-dashboard/app | head
```

- [ ] **Step 1: After a program is created, offer to apply the default template**

In the success handler of the "Create program" action, after the program is persisted and we have `newProgramId`, call `fetchFormTemplates()` and look for an entry where `isDefault === true` and `category` matches the new program's category (fall back to any `isDefault` entry).

If found, open a confirm dialog: _"Start this program with the `<template name>` template? It will pre-populate ~N fields — you can edit or remove any of them later."_ Default answer: **Yes**. On confirm, call `applyTemplateToProgram(newProgramId, defaultTemplate.id, 'append')`. On skip, proceed without changes.

- [ ] **Step 2: Commit**

```bash
git add app/  # paths depend on where create-program lives
git commit -m "feat(admin): offer default template on new-program creation"
```

---

## Phase 5: Legacy Field Migration

### Task 5.1: Classifier utility

**Files:**
- Create: `ybb-platform/services/api/prisma/migration-scripts/classify-existing-form-fields.ts`
- Create: `ybb-platform/services/api/prisma/migration-scripts/classify-existing-form-fields.spec.ts`

- [ ] **Step 1: Failing test**

```typescript
import { classifyLegacyFieldName, LEGACY_ALIASES, KnownCatalogKeys } from './classify-existing-form-fields';

const catalogKeys: KnownCatalogKeys = new Set([
  'full_name', 'email', 'tshirt_size', 'profile_picture', 'cv_upload',
  'date_of_birth', 'emergency_contact_relation', 'ambassador_referral_code',
  'referral_source', 'referral_source_detail',
]);
const magicKeys = new Set(['category', 'program_subtheme_id', 'program_id']);

describe('classifyLegacyFieldName', () => {
  it('aliases birthdate → date_of_birth', () => {
    expect(classifyLegacyFieldName('birthdate', catalogKeys, magicKeys)).toEqual({
      status: 'aliased_to_system', canonical: 'date_of_birth', source: 'system',
    });
  });

  it('aliases resume_url → cv_upload', () => {
    expect(classifyLegacyFieldName('resume_url', catalogKeys, magicKeys)).toEqual({
      status: 'aliased_to_system', canonical: 'cv_upload', source: 'system',
    });
  });

  it('passes through a known catalog key unchanged', () => {
    expect(classifyLegacyFieldName('full_name', catalogKeys, magicKeys)).toEqual({
      status: 'system', canonical: 'full_name', source: 'system',
    });
  });

  it('passes through a magic key unchanged', () => {
    expect(classifyLegacyFieldName('category', catalogKeys, magicKeys)).toEqual({
      status: 'system', canonical: 'category', source: 'system',
    });
  });

  it('keeps custom keys that match format but are not in catalog', () => {
    expect(classifyLegacyFieldName('some_custom_field', catalogKeys, magicKeys)).toEqual({
      status: 'custom', canonical: 'some_custom_field', source: 'custom', valid: true,
    });
  });

  it('flags invalid custom keys', () => {
    expect(classifyLegacyFieldName('BadKey!', catalogKeys, magicKeys)).toEqual({
      status: 'custom', canonical: 'BadKey!', source: 'custom', valid: false,
    });
  });

  it('covers all required legacy aliases', () => {
    expect(LEGACY_ALIASES).toMatchObject({
      birthdate: 'date_of_birth',
      resume_url: 'cv_upload',
      picture_url: 'profile_picture',
      contact_relation: 'emergency_contact_relation',
      ref_code_ambassador: 'ambassador_referral_code',
      source_account_name: 'referral_source_detail',
      knowledge_source: 'referral_source',
    });
  });
});
```

- [ ] **Step 2: Run — fails**

- [ ] **Step 3: Implement**

```typescript
// prisma/migration-scripts/classify-existing-form-fields.ts
import { FIELD_KEY_FORMAT } from '../../src/modules/programs/application/validators/form-field-key.validator';

export const LEGACY_ALIASES: Readonly<Record<string, string>> = {
  birthdate: 'date_of_birth',
  resume_url: 'cv_upload',
  picture_url: 'profile_picture',
  contact_relation: 'emergency_contact_relation',
  ref_code_ambassador: 'ambassador_referral_code',
  source_account_name: 'referral_source_detail',
  knowledge_source: 'referral_source',
};

export type KnownCatalogKeys = Set<string>;

export type Classification =
  | { status: 'system'; canonical: string; source: 'system' }
  | { status: 'aliased_to_system'; canonical: string; source: 'system' }
  | { status: 'custom'; canonical: string; source: 'custom'; valid: boolean };

export function classifyLegacyFieldName(
  rawName: string,
  catalogKeys: KnownCatalogKeys,
  magicKeys: Set<string>,
): Classification {
  if (LEGACY_ALIASES[rawName]) {
    return { status: 'aliased_to_system', canonical: LEGACY_ALIASES[rawName], source: 'system' };
  }
  if (magicKeys.has(rawName) || catalogKeys.has(rawName)) {
    return { status: 'system', canonical: rawName, source: 'system' };
  }
  return {
    status: 'custom',
    canonical: rawName,
    source: 'custom',
    valid: FIELD_KEY_FORMAT.test(rawName),
  };
}
```

- [ ] **Step 4: Run — passes**

- [ ] **Step 5: Commit**

```bash
git add prisma/migration-scripts/
git commit -m "feat(migration): legacy form field name classifier"
```

### Task 5.2: Migration runner with personalData JSON key rewrite

**Files:**
- Create: `ybb-platform/services/api/prisma/migration-scripts/migrate-form-field-catalog.ts`
- Modify: `ybb-platform/services/api/package.json` — add `"migrate:form-field-catalog"` script

- [ ] **Step 1: Implement**

```typescript
// prisma/migration-scripts/migrate-form-field-catalog.ts
import { PrismaClient, ApplicationFormField } from '@prisma/client';
import { classifyLegacyFieldName, LEGACY_ALIASES } from './classify-existing-form-fields';
import { MAGIC_FORM_FIELD_KEYS } from '../../src/modules/programs/application/constants/magic-form-fields';

type Report = {
  migratedToSystem: number;
  aliasedAndRenamed: number;
  keptAsCustom: number;
  flaggedInvalid: number;
  deduped: number;
  personalDataRowsUpdated: number;
};

async function loadCatalogKeys(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.systemFormFieldDefinition.findMany({
    where: { isActive: true, deletedAt: null },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key));
}

async function renamePersonalDataKeysForProgram(
  prisma: PrismaClient,
  programId: string,
  renames: Map<string, string>,
): Promise<number> {
  if (renames.size === 0) return 0;
  // Load only the JSON we need, in batches
  const BATCH = 200;
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const apps = await prisma.participantApplication.findMany({
      where: { programId, deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) },
      orderBy: { id: 'asc' },
      take: BATCH,
      select: { id: true, personalData: true },
    });
    if (apps.length === 0) break;
    for (const app of apps) {
      const data = (app.personalData as Record<string, unknown> | null) ?? {};
      let changed = false;
      const next: Record<string, unknown> = { ...data };
      for (const [legacy, canonical] of renames) {
        if (legacy in next && !(canonical in next)) {
          next[canonical] = next[legacy];
          delete next[legacy];
          changed = true;
        } else if (legacy in next && canonical in next) {
          // Canonical already present — preserve canonical, drop legacy.
          delete next[legacy];
          changed = true;
        }
      }
      if (changed) {
        await prisma.participantApplication.update({
          where: { id: app.id },
          data: { personalData: next },
        });
        total += 1;
      }
    }
    cursor = apps[apps.length - 1].id;
    if (apps.length < BATCH) break;
  }
  return total;
}

async function dedupePerProgram(
  prisma: PrismaClient,
  programId: string,
): Promise<number> {
  const rows = await prisma.applicationFormField.findMany({
    where: { programId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true, updatedAt: true },
  });
  const seen = new Set<string>();
  let removed = 0;
  for (const r of rows) {
    if (seen.has(r.name)) {
      await prisma.applicationFormField.update({
        where: { id: r.id },
        data: { deletedAt: new Date(), isActive: false },
      });
      removed += 1;
    } else {
      seen.add(r.name);
    }
  }
  return removed;
}

export async function migrateFormFieldCatalog(prisma: PrismaClient): Promise<Report> {
  const report: Report = {
    migratedToSystem: 0,
    aliasedAndRenamed: 0,
    keptAsCustom: 0,
    flaggedInvalid: 0,
    deduped: 0,
    personalDataRowsUpdated: 0,
  };

  const catalogKeys = await loadCatalogKeys(prisma);
  const magicKeys = new Set<string>(MAGIC_FORM_FIELD_KEYS);

  const programs = await prisma.program.findMany({ select: { id: true } });

  for (const { id: programId } of programs) {
    const fields = await prisma.applicationFormField.findMany({
      where: { programId, deletedAt: null },
    });

    const renames = new Map<string, string>();
    for (const f of fields) {
      const c = classifyLegacyFieldName(f.name, catalogKeys, magicKeys);
      if (c.status === 'aliased_to_system') {
        await prisma.applicationFormField.update({
          where: { id: f.id },
          data: {
            name: c.canonical,
            source: 'system',
            systemFieldKey: c.canonical,
            validationRules: mergeLegacyMarker(f.validationRules, { _legacy_name: f.name }),
          },
        });
        renames.set(f.name, c.canonical);
        report.aliasedAndRenamed += 1;
      } else if (c.status === 'system') {
        if (f.source !== 'system' || f.systemFieldKey !== c.canonical) {
          await prisma.applicationFormField.update({
            where: { id: f.id },
            data: { source: 'system', systemFieldKey: c.canonical },
          });
        }
        report.migratedToSystem += 1;
      } else {
        // custom
        if (!c.valid) {
          await prisma.applicationFormField.update({
            where: { id: f.id },
            data: {
              source: 'custom',
              validationRules: mergeLegacyMarker(f.validationRules, {
                _legacy_invalid_key: true,
              }),
            },
          });
          report.flaggedInvalid += 1;
        } else {
          if (f.source !== 'custom') {
            await prisma.applicationFormField.update({
              where: { id: f.id },
              data: { source: 'custom' },
            });
          }
          report.keptAsCustom += 1;
        }
      }
    }

    // Rewrite JSON keys in personalData
    report.personalDataRowsUpdated += await renamePersonalDataKeysForProgram(
      prisma,
      programId,
      renames,
    );

    // Dedupe
    report.deduped += await dedupePerProgram(prisma, programId);
  }

  return report;
}

function mergeLegacyMarker(
  existing: unknown,
  marker: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...marker };
}

if (require.main === module) {
  const prisma = new PrismaClient();
  migrateFormFieldCatalog(prisma)
    .then((report) => {
      // eslint-disable-next-line no-console
      console.log('Form field catalog migration complete:', report);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    })
    .finally(() => prisma.$disconnect());
}
```

- [ ] **Step 2: Add package.json script**

Add to `scripts` in `services/api/package.json`:

```json
"migrate:form-field-catalog": "ts-node prisma/migration-scripts/migrate-form-field-catalog.ts"
```

- [ ] **Step 3: Dry-run on staging**

```bash
DATABASE_URL=$STAGING_URL npm run migrate:form-field-catalog
```
Expected: prints a report with non-negative counts. No errors.

- [ ] **Step 4: Sanity-check personalData rewrite**

After the staging run, pick 3 applications that were in programs with aliased fields. Verify in psql that `personalData` contains the canonical key, not the legacy one:

```sql
SELECT id, personal_data->'date_of_birth' as dob, personal_data->'birthdate' as legacy_dob
FROM participant_applications
LIMIT 10;
```

Expected: `dob` populated; `legacy_dob` null for affected rows.

- [ ] **Step 5: Commit**

```bash
git add prisma/migration-scripts/migrate-form-field-catalog.ts package.json
git commit -m "feat(migration): classify existing form fields and rewrite personalData keys"
```

---

## Phase 6: Integration Tests and Rollout

### Task 6.1: Portal submission snapshot regression test

**Files:**
- Create: `ybb-platform/services/api/test/integration/portal-submission-snapshot.spec.ts`

- [ ] **Step 1: Implement**

The test picks 2 programs (real or seeded), queries `GET /portal/submissions/:programId` for a synthetic participant, and snapshots the response. Run once pre-migration, once post-migration; assert deep-equal minus:
- `field.id` values (UUIDs change)
- `field.systemFieldKey` / `field.source` (newly surfaced)
- `validationRules._legacy_*` markers (newly added)

The test is the fence that proves the migration preserves applicant-facing behavior.

- [ ] **Step 2: Run the full test suite**

```bash
npm test
```
Expected: all tests pass, including the new snapshot.

- [ ] **Step 3: Commit**

```bash
git add test/integration/portal-submission-snapshot.spec.ts
git commit -m "test(api): portal submission snapshot regression guard"
```

### Task 6.2: E2E admin dashboard tests (smoke)

**Files:**
- (Depends on whether an e2e runner exists in admin-dashboard — check `package.json`. If none, skip this task and add manual test steps instead.)

- [ ] **Step 1: Check for e2e tooling**

```bash
cd services/admin-dashboard && cat package.json | grep -E "playwright|cypress|vitest"
```

If nothing, write a manual test plan file `docs/testing/manual-form-field-catalog.md` covering:
1. Open a program's form-fields page. Click Add Form Field. Verify catalog appears grouped. Pick "T-Shirt Size". Verify simplified sheet. Save. Verify field appears in the table.
2. Click Add Form Field again. Click "Create custom field". Enter label "Volunteer Experience". Verify caption shows `volunteer_experience`. Save. Field appears.
3. Click Add Form Field. Click "Create custom field". Enter label "T-Shirt Size". Verify the caption shows `tshirt_size` and Save returns a 409 with the "system field" message.
4. Click "Copy from template". Pick "Standard Program Application". Apply append. Verify count of added / skipped.

- [ ] **Step 2: Commit**

```bash
git add docs/testing/manual-form-field-catalog.md
git commit -m "test: manual test plan for form field catalog and templates"
```

### Task 6.3: Feature flag gate + rollout

**Files:**
- Modify: `ybb-platform/services/admin-dashboard/...FormFieldsTable.tsx` (gate the catalog picker behind a flag)
- Modify: whichever config module provides feature flags — likely `app/config/flags.ts` or similar. Grep to confirm.

- [ ] **Step 1: Introduce a flag `FORM_FIELD_CATALOG_V2`**

In the feature flag config, add:

```typescript
export const FLAGS = {
  // ... existing flags ...
  FORM_FIELD_CATALOG_V2: process.env.NEXT_PUBLIC_FF_CATALOG_V2 === 'true',
};
```

In `FormFieldsTable.tsx`, toggle between old and new entry points:

```tsx
{FLAGS.FORM_FIELD_CATALOG_V2 ? (
  <button onClick={() => setAddDialogOpen(true)}>Add Form Field</button>
) : (
  <button onClick={() => setEditorOpen(true)}>Add Form Field</button>
)}
```

- [ ] **Step 2: Rollout steps**

Document in `docs/DEPLOYMENT_NOTES.md`:

```markdown
## Form Field Catalog V2 rollout

1. Merge to staging. Run `npm run prisma:migrate:prod` and `npm run migrate:form-field-catalog`.
2. Verify portal submission snapshot test in staging CI.
3. Set `NEXT_PUBLIC_FF_CATALOG_V2=true` in admin-dashboard for internal users only (use conditional env by user role if the flag system supports it).
4. Collect feedback for 3-5 days.
5. Flip flag to true for all admins. Monitor `_legacy_invalid_key` counts in logs for 1 week.
6. Remove the flag and old code path in a follow-up PR.
```

- [ ] **Step 3: Commit**

```bash
git add app/ docs/
git commit -m "chore(admin): gate catalog picker behind FORM_FIELD_CATALOG_V2 flag"
```

### Task 6.4: Final regression sweep

- [ ] **Step 1: Run all tests in API**

```bash
cd ybb-platform/services/api && npm test
```
Expected: all pass. Compare pass count to Phase 0 baseline + new tests added.

- [ ] **Step 2: Build admin dashboard**

```bash
cd ybb-platform/services/admin-dashboard && npm run build
```
Expected: build succeeds with no new TypeScript errors.

- [ ] **Step 3: Manual walkthrough** (per Task 6.2 test plan).

- [ ] **Step 4: Tag the completion**

```bash
git log --oneline -30 | head -30
# Inspect the commit chain — everything should be coherent.
```

No commit here; this is a verification gate.

---

## Summary of deliverables

- **Schema:** 2 new tables (`system_form_field_definitions`, `application_form_templates`, `application_form_template_fields`), 2 new columns on `application_form_fields`, 1 composite unique index.
- **Backend:** magic-fields constants, auto-slug util, reserved-key validator, 3 new endpoints (system-fields, templates, apply-template) with full CRUD on the first two, extended form-field create/update.
- **Admin UI:** catalog picker dialog, system-field config sheet, refactored custom-field editor (hidden key, advanced toggle), copy-from-template dialog, super-admin pages for catalog and templates, new-program wizard hook for default template.
- **Migration:** classifier + runner + personalData JSON rewrite + CLI script.
- **Tests:** 6 new test files (unit + integration) + manual test plan + portal snapshot regression.
- **Rollout:** feature-flag gated, documented rollout steps.
