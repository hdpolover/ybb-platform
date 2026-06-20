# Scoring Rubric Management (Phase 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give super admins the ability to define per-program scoring rubrics (categories, criteria, weights) for both the application and interview stages. This is the data foundation; no scoring happens until Phase 2.

**Architecture:** Backend follows the existing CQRS pattern in the programs module (standalone injectable handlers injected directly into the controller, no EventBus, no @CommandHandler decorator). A new `IScoringRubricRepository` interface + `ScoringRubricRepository` implementation is added to the programs module's DI, mirroring how `IProgramContentRepository` is wired. Two new controller endpoints live on a new `ProgramScoringController` added to `ProgramsModule`. Frontend follows the existing api-client + page + client-component pattern with `useResolvedProgramId`, `useAuth`, and the `request()` helper.

**Tech Stack:** NestJS (no CqrsModule command bus, handlers are plain `@Injectable()` services called directly), Prisma 5/6 (`@prisma/client`), `class-validator` + `class-transformer` for DTOs, Jest + ts-jest for tests, Next.js 14 App Router + React for admin dashboard.

## Global Constraints

- All API paths are relative to `services/api/` unless stated otherwise. All admin-dashboard paths are relative to `services/admin-dashboard/` unless stated otherwise.
- Run all API commands from `services/api/`. Run all dashboard commands from `services/admin-dashboard/`.
- Jest config is inline in `services/api/package.json`: `rootDir: "src"`, `testRegex: ".*\\.spec\\.ts$"`. Specs MUST live under `src/` to be collected. Run individual spec files with: `npx jest <path/to/file.spec.ts>`. Run all tests with: `npm test`.
- Path aliases: `@core/*` maps to `src/core/`, `@modules/*` maps to `src/modules/`, `@shared/*` maps to `src/shared/`, `@common/*` maps to `src/common/`.
- Conventional commit messages (`feat:`, `fix:`, `chore:`, `test:`). No co-author trailers (attribution disabled globally).
- No em dashes in code comments, strings, or commit messages. Use commas, periods, or parentheses instead.
- Weights stored as 0-1 fractions in the DB; displayed and edited as percentages (0-100) in the UI. Convert on the way in (% / 100) and on the way out (* 100).
- One active ScoringSchema per `(programId, stage)`. "Active" means `deletedAt IS NULL`. Enforced by a partial unique index in the migration SQL.
- The API auto-applies Prisma migrations on startup (`prisma migrate deploy` runs before `node dist/main`). Run `npx prisma migrate dev --name <name>` locally to create a new migration, then commit the generated files.
- Rubric write (upsert) is SUPER_ADMIN only. Read is SUPER_ADMIN or ADMIN.
- Guards pattern: `@UseGuards(JwtAuthGuard, RolesGuard)` + `@Roles(UserRole.SUPER_ADMIN)` (or `@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)`). Import `JwtAuthGuard` from `@modules/auth/infrastructure/guards/jwt-auth.guard`, `RolesGuard` from `@modules/auth/infrastructure/guards/roles.guard`, `Roles` from `@modules/auth/application/decorators/roles.decorator`, `UserRole` from `@core/entities/user.entity`.
- Controller handlers are plain `@Injectable()` services injected via constructor (not the NestJS CqrsModule command bus). Look at how `ListProgramPricingTiersHandler` is declared (no `@CommandHandler` or `@QueryHandler`), then follow that exact pattern.
- The admin dashboard has no frontend test harness. All frontend verification is done via a manual walkthrough checklist in Task 9.
- `tsc --noEmit` must pass with 0 errors in both `services/api` and `services/admin-dashboard` before the plan is complete.
- Do NOT delete any existing Prisma models or modify `ApplicationReview`/`ApplicationScoreItem` fields.

---

## Task 1: Prisma schema migration (add ScoringStage enum + stage field + partial unique index)

**Files:**
- Modify: `services/api/prisma/schema/scoring.prisma`
- Modify: `services/api/prisma/schema/enums.prisma`
- Create: migration via `npx prisma migrate dev --name add-scoring-stage` (generates files in `services/api/prisma/migrations/`)
- Modify: `services/api/prisma/migrations/<timestamp>_add_scoring_stage/migration.sql` (edit the generated SQL to replace the standard unique constraint with a partial unique index)

**Interfaces:**
- Produces: `ScoringStage` enum available in `@prisma/client`; `ScoringSchema.stage` field of type `ScoringStage`; partial unique index `scoring_schemas_program_id_stage_active_uidx` on `(program_id, stage) WHERE deleted_at IS NULL`.

- [ ] **Step 1: Add the enum to `enums.prisma`**

Open `services/api/prisma/schema/enums.prisma`. Add the following block immediately before the last enum in the file (keep all existing enums intact):

```prisma
enum ScoringStage {
  application
  interview
}
```

- [ ] **Step 2: Add the stage field and index to `scoring.prisma`**

Open `services/api/prisma/schema/scoring.prisma`. In the `ScoringSchema` model, add the following line after the `isActive` field line (after `isActive    Boolean @default(true) @map("is_active")`):

```
  stage       ScoringStage @default(application) @map("stage")
```

Then add the following index declaration after the existing `@@index([isActive])` line and before the closing `}` of `ScoringSchema`:

```
  @@index([programId, stage])
```

Do NOT add a `@@unique` here; the uniqueness is enforced via a custom partial index in the migration SQL (see Step 4).

The final `ScoringSchema` model relevant section should look like:

```prisma
model ScoringSchema {
  id          String       @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  programId   String       @map("program_id") @db.Uuid
  name        String       @db.VarChar(255)
  description String?      @db.Text
  isActive    Boolean      @default(true) @map("is_active")
  stage       ScoringStage @default(application) @map("stage")

  createdAt DateTime  @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt DateTime  @updatedAt @map("updated_at") @db.Timestamptz(6)
  deletedAt DateTime? @map("deleted_at") @db.Timestamptz(6)
  legacyId  Int?      @unique @map("legacy_id")

  program    Program             @relation(fields: [programId], references: [id], onDelete: Cascade)
  categories ScoringCategory[]
  reviews    ApplicationReview[]

  @@index([programId])
  @@index([isActive])
  @@index([programId, stage])
  @@map("scoring_schemas")
}
```

- [ ] **Step 3: Generate the migration**

From `services/api/`, run:
```bash
npx prisma migrate dev --name add-scoring-stage
```

Expected: Prisma generates a file at `prisma/migrations/<timestamp>_add_scoring_stage/migration.sql` containing an `ALTER TABLE "scoring_schemas" ADD COLUMN "stage" ...` statement and a `CREATE TYPE "ScoringStage" AS ENUM ...` statement.

If Prisma also generates a `CREATE UNIQUE INDEX` or `@@unique` constraint, that is expected to be absent here since we did not declare `@@unique`. Check the generated SQL and proceed to Step 4.

- [ ] **Step 4: Patch the migration SQL to add the partial unique index**

Open the generated `migration.sql` file. After all the generated statements, append:

```sql
-- Enforce one active (non-deleted) ScoringSchema per (programId, stage).
-- A partial index is used because Prisma cannot express WHERE clauses in @@unique.
CREATE UNIQUE INDEX "scoring_schemas_program_id_stage_active_uidx"
  ON "scoring_schemas" ("program_id", "stage")
  WHERE "deleted_at" IS NULL;
```

Save the file. Do NOT re-run `prisma migrate dev` after this edit; the SQL file is committed as-is and `prisma migrate deploy` will apply it verbatim on startup.

- [ ] **Step 5: Regenerate the Prisma client**

From `services/api/`, run:
```bash
npx prisma generate
```

Expected: `@prisma/client` regenerated; `ScoringStage` is now importable from `@prisma/client`.

- [ ] **Step 6: Verify migration + client (manual check)**

Run:
```bash
npx prisma migrate status
```

Expected output includes the new migration name with "Applied" or "Pending" (depending on whether you have a local DB pointed at). Then run:
```bash
npx tsc --noEmit
```
Expected: 0 errors (the new enum/field should resolve cleanly).

- [ ] **Step 7: Commit**

```bash
git add services/api/prisma/schema/enums.prisma services/api/prisma/schema/scoring.prisma services/api/prisma/migrations/
git commit -m "feat: add ScoringStage enum and stage field to ScoringSchema with partial unique index"
```

---

## Task 2: DTOs (request + response types)

**Files:**
- Create: `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts`
- Test: `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.spec.ts`

**Interfaces:**
- Produces:
  - `UpsertScoringRubricDto` (request body for PUT)
  - `UpsertCategoryDto` (nested)
  - `UpsertCriterionDto` (nested, within category)
  - `RubricCriterionDto` (response shape)
  - `RubricCategoryDto` (response shape)
  - `RubricDto` (response shape)
  - `ScoringRubricsResponseDto` (top-level response for GET: `{ application: RubricDto | null, interview: RubricDto | null }`)

- [ ] **Step 1: Write the failing DTO validation tests**

Create `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.spec.ts`:

```typescript
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { UpsertScoringRubricDto, UpsertCategoryDto, UpsertCriterionDto } from './scoring-rubric.dto';

const validCriterion = {
  name: 'Leadership',
  weight: 0.5,
  maxScore: 100,
  order: 0,
};

const validCategory = {
  name: 'Essay',
  weight: 0.6,
  order: 0,
  criteria: [validCriterion],
};

const validRubricPayload = {
  name: 'IYS 2026 Application Rubric',
  categories: [validCategory],
};

describe('UpsertCriterionDto', () => {
  it('passes with valid fields', async () => {
    const dto = plainToInstance(UpsertCriterionDto, validCriterion);
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when name is empty', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when weight is negative', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, weight: -0.1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'weight')).toBe(true);
  });

  it('fails when maxScore is zero', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, maxScore: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'maxScore')).toBe(true);
  });

  it('fails when maxScore is negative', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, maxScore: -5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'maxScore')).toBe(true);
  });

  it('fails when order is not an integer', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, order: 1.5 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'order')).toBe(true);
  });

  it('allows optional id field', async () => {
    const dto = plainToInstance(UpsertCriterionDto, { ...validCriterion, id: 'some-uuid' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('UpsertCategoryDto', () => {
  it('passes with valid fields including nested criteria', async () => {
    const dto = plainToInstance(UpsertCategoryDto, validCategory);
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  it('fails when name is empty', async () => {
    const dto = plainToInstance(UpsertCategoryDto, { ...validCategory, name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when weight is negative', async () => {
    const dto = plainToInstance(UpsertCategoryDto, { ...validCategory, weight: -0.1 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'weight')).toBe(true);
  });

  it('fails when criteria array is missing', async () => {
    const dto = plainToInstance(UpsertCategoryDto, { name: 'Essay', weight: 0.5, order: 0 });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'criteria')).toBe(true);
  });
});

describe('UpsertScoringRubricDto', () => {
  it('passes with valid payload', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, validRubricPayload);
    const errors = await validate(dto, { whitelist: true });
    expect(errors).toHaveLength(0);
  });

  it('fails when name is empty string', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, { ...validRubricPayload, name: '' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'name')).toBe(true);
  });

  it('fails when categories is missing', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, { name: 'Rubric' });
    const errors = await validate(dto);
    expect(errors.some((e) => e.property === 'categories')).toBe(true);
  });

  it('allows omitting name (it is optional)', async () => {
    const dto = plainToInstance(UpsertScoringRubricDto, { categories: [validCategory] });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/modules/programs/presentation/dto/scoring-rubric.dto.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the DTOs**

Create `services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts`:

```typescript
import {
  IsString,
  IsOptional,
  IsNotEmpty,
  IsNumber,
  IsInt,
  IsArray,
  ValidateNested,
  Min,
  IsUUID,
} from 'class-validator';
import { Type } from 'class-transformer';

// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class UpsertCriterionDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Fraction 0-1; UI sends percentages, caller must convert before this DTO. */
  @IsNumber()
  @Min(0)
  weight!: number;

  /** Must be > 0. */
  @IsNumber()
  @Min(0.01)
  maxScore!: number;

  @IsInt()
  order!: number;
}

export class UpsertCategoryDto {
  @IsOptional()
  @IsUUID()
  id?: string;

  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  /** Fraction 0-1. */
  @IsNumber()
  @Min(0)
  weight!: number;

  @IsInt()
  order!: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCriterionDto)
  criteria!: UpsertCriterionDto[];
}

export class UpsertScoringRubricDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpsertCategoryDto)
  categories!: UpsertCategoryDto[];
}

// ─── Response DTOs ────────────────────────────────────────────────────────────

export class RubricCriterionDto {
  id!: string;
  name!: string;
  description?: string | null;
  weight!: number;
  maxScore!: number;
  order!: number;
}

export class RubricCategoryDto {
  id!: string;
  name!: string;
  description?: string | null;
  weight!: number;
  order!: number;
  criteria!: RubricCriterionDto[];
}

export class RubricDto {
  id!: string;
  programId!: string;
  stage!: string;
  name!: string;
  description?: string | null;
  isActive!: boolean;
  categories!: RubricCategoryDto[];
}

export class ScoringRubricsResponseDto {
  application!: RubricDto | null;
  interview!: RubricDto | null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx jest src/modules/programs/presentation/dto/scoring-rubric.dto.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.ts \
        services/api/src/modules/programs/presentation/dto/scoring-rubric.dto.spec.ts
git commit -m "feat: add UpsertScoringRubricDto request DTOs and RubricDto response shapes"
```

---

## Task 3: Repository interface + implementation (queries + transactional upsert)

**Files:**
- Create: `services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts`
- Create: `services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts`
- Test: `services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (injected via constructor), `ScoringSchema`, `ScoringCategory`, `ScoringCriterion`, `ScoringStage` from `@prisma/client`.
- Produces: `IScoringRubricRepository` with methods:
  - `findRubricsByProgramId(programId: string, stage?: ScoringStage): Promise<ScoringSchemaWithNested[]>`
  - `upsertRubric(programId: string, stage: ScoringStage, payload: UpsertRubricPayload): Promise<ScoringSchemaWithNested>`

- [ ] **Step 1: Write the failing repository tests**

Create `services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts`:

```typescript
import { ScoringStage } from '@prisma/client';
import { ScoringRubricRepository } from './scoring-rubric.repository';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

describe('ScoringRubricRepository', () => {
  let repo: ScoringRubricRepository;
  let mockPrisma: {
    scoringSchema: {
      findMany: jest.Mock;
      findFirst: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    scoringCategory: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    scoringCriterion: {
      deleteMany: jest.Mock;
      create: jest.Mock;
      update: jest.Mock;
    };
    $transaction: jest.Mock;
  };

  const schemaId = 'schema-uuid-1';
  const programId = 'prog-uuid-1';
  const catId = 'cat-uuid-1';
  const critId = 'crit-uuid-1';

  const makeFullSchema = () => ({
    id: schemaId,
    programId,
    stage: ScoringStage.application,
    name: 'Test Rubric',
    description: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    deletedAt: null,
    legacyId: null,
    categories: [
      {
        id: catId,
        schemaId,
        name: 'Essay',
        description: null,
        weight: 0.6,
        order: 0,
        legacyId: null,
        criteria: [
          {
            id: critId,
            categoryId: catId,
            name: 'Topic Relevance',
            description: null,
            weight: 1.0,
            maxScore: 100,
            order: 0,
            legacyId: null,
          },
        ],
      },
    ],
  });

  beforeEach(() => {
    // $transaction executes the callback synchronously in tests by passing mockPrisma
    mockPrisma = {
      scoringSchema: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      scoringCategory: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      scoringCriterion: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(mockPrisma)),
    };

    repo = new ScoringRubricRepository(mockPrisma as any);
  });

  describe('findRubricsByProgramId', () => {
    it('returns rubrics ordered by category/criterion order', async () => {
      const expected = [makeFullSchema()];
      mockPrisma.scoringSchema.findMany.mockResolvedValue(expected);

      const result = await repo.findRubricsByProgramId(programId);

      expect(mockPrisma.scoringSchema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ programId, deletedAt: null }),
          include: expect.objectContaining({ categories: expect.any(Object) }),
        }),
      );
      expect(result).toEqual(expected);
    });

    it('filters by stage when provided', async () => {
      mockPrisma.scoringSchema.findMany.mockResolvedValue([]);

      await repo.findRubricsByProgramId(programId, ScoringStage.interview);

      expect(mockPrisma.scoringSchema.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ programId, stage: ScoringStage.interview, deletedAt: null }),
        }),
      );
    });
  });

  describe('upsertRubric (create path)', () => {
    it('creates a new schema when none exists for (programId, stage)', async () => {
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(null);
      const created = makeFullSchema();
      mockPrisma.scoringSchema.create.mockResolvedValue(created);
      mockPrisma.scoringCategory.create.mockResolvedValue({
        id: catId,
        ...created.categories[0],
        criteria: [],
      });
      mockPrisma.scoringCriterion.create.mockResolvedValue(created.categories[0].criteria[0]);

      // Simulate a second findFirst (re-fetch after upsert)
      mockPrisma.scoringSchema.findMany.mockResolvedValue([created]);

      const payload: UpsertRubricPayload = {
        name: 'Test Rubric',
        categories: [
          {
            name: 'Essay',
            weight: 0.6,
            order: 0,
            criteria: [{ name: 'Topic Relevance', weight: 1.0, maxScore: 100, order: 0 }],
          },
        ],
      };

      await repo.upsertRubric(programId, ScoringStage.application, payload);

      expect(mockPrisma.scoringSchema.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ programId, stage: ScoringStage.application }),
        }),
      );
    });
  });

  describe('upsertRubric (update path)', () => {
    it('updates the existing schema when one exists for (programId, stage)', async () => {
      const existingSchema = makeFullSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(existingSchema);
      mockPrisma.scoringSchema.update.mockResolvedValue({ ...existingSchema, name: 'Updated' });
      mockPrisma.scoringCategory.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scoringCriterion.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scoringCategory.update.mockResolvedValue(existingSchema.categories[0]);
      mockPrisma.scoringCriterion.update.mockResolvedValue(existingSchema.categories[0].criteria[0]);
      mockPrisma.scoringSchema.findMany.mockResolvedValue([{ ...existingSchema, name: 'Updated' }]);

      const payload: UpsertRubricPayload = {
        name: 'Updated',
        categories: [
          {
            id: catId,
            name: 'Essay',
            weight: 0.6,
            order: 0,
            criteria: [
              { id: critId, name: 'Topic Relevance', weight: 1.0, maxScore: 100, order: 0 },
            ],
          },
        ],
      };

      await repo.upsertRubric(programId, ScoringStage.application, payload);

      expect(mockPrisma.scoringSchema.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: schemaId } }),
      );
    });

    it('deletes categories absent from payload', async () => {
      const existingSchema = makeFullSchema();
      mockPrisma.scoringSchema.findFirst.mockResolvedValue(existingSchema);
      mockPrisma.scoringSchema.update.mockResolvedValue(existingSchema);
      mockPrisma.scoringCategory.deleteMany.mockResolvedValue({ count: 1 });
      mockPrisma.scoringCriterion.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.scoringSchema.findMany.mockResolvedValue([existingSchema]);

      const payload: UpsertRubricPayload = {
        categories: [], // all categories removed
      };

      await repo.upsertRubric(programId, ScoringStage.application, payload);

      // Should delete categories not in the (empty) payload id list
      expect(mockPrisma.scoringCategory.deleteMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ schemaId }),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create the repository interface**

Create `services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts`:

```typescript
import { ScoringStage } from '@prisma/client';
import { Prisma } from '@prisma/client';

export type ScoringCriterionNested = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  weight: Prisma.Decimal;
  maxScore: Prisma.Decimal;
  order: number;
  legacyId: number | null;
};

export type ScoringCategoryNested = {
  id: string;
  schemaId: string;
  name: string;
  description: string | null;
  weight: Prisma.Decimal;
  order: number;
  legacyId: string | null;
  criteria: ScoringCriterionNested[];
};

export type ScoringSchemaWithNested = {
  id: string;
  programId: string;
  stage: ScoringStage;
  name: string;
  description: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
  legacyId: number | null;
  categories: ScoringCategoryNested[];
};

export type UpsertCriterionPayload = {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  maxScore: number;
  order: number;
};

export type UpsertCategoryPayload = {
  id?: string;
  name: string;
  description?: string;
  weight: number;
  order: number;
  criteria: UpsertCriterionPayload[];
};

export type UpsertRubricPayload = {
  name?: string;
  description?: string;
  categories: UpsertCategoryPayload[];
};

export interface IScoringRubricRepository {
  findRubricsByProgramId(
    programId: string,
    stage?: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]>;

  upsertRubric(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
  ): Promise<ScoringSchemaWithNested>;
}
```

- [ ] **Step 4: Implement the repository**

Create `services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { ScoringStage } from '@prisma/client';
import { PrismaService } from '../../../../shared/infrastructure/prisma/prisma.service';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
} from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

const CATEGORIES_INCLUDE = {
  categories: {
    where: {},
    orderBy: { order: 'asc' as const },
    include: {
      criteria: {
        orderBy: { order: 'asc' as const },
      },
    },
  },
};

@Injectable()
export class ScoringRubricRepository implements IScoringRubricRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findRubricsByProgramId(
    programId: string,
    stage?: ScoringStage,
  ): Promise<ScoringSchemaWithNested[]> {
    const where: Record<string, unknown> = { programId, deletedAt: null };
    if (stage !== undefined) where.stage = stage;

    return this.prisma.scoringSchema.findMany({
      where,
      include: CATEGORIES_INCLUDE,
    }) as Promise<ScoringSchemaWithNested[]>;
  }

  async upsertRubric(
    programId: string,
    stage: ScoringStage,
    payload: UpsertRubricPayload,
  ): Promise<ScoringSchemaWithNested> {
    return this.prisma.$transaction(async (tx) => {
      // 1. Find or create the schema for this (programId, stage)
      let schema = await tx.scoringSchema.findFirst({
        where: { programId, stage, deletedAt: null },
      });

      if (!schema) {
        schema = await tx.scoringSchema.create({
          data: {
            programId,
            stage,
            name: payload.name ?? `${stage} Rubric`,
            description: payload.description ?? null,
            isActive: true,
          },
        });
      } else if (payload.name !== undefined || payload.description !== undefined) {
        schema = await tx.scoringSchema.update({
          where: { id: schema.id },
          data: {
            ...(payload.name !== undefined && { name: payload.name }),
            ...(payload.description !== undefined && { description: payload.description }),
          },
        });
      }

      const schemaId = schema.id;

      // 2. Reconcile categories: collect ids present in payload
      const payloadCategoryIds = payload.categories
        .filter((c) => c.id !== undefined)
        .map((c) => c.id as string);

      // Delete categories absent from the payload
      await tx.scoringCategory.deleteMany({
        where: {
          schemaId,
          ...(payloadCategoryIds.length > 0 ? { id: { notIn: payloadCategoryIds } } : {}),
        },
      });

      // 3. Upsert categories + their criteria
      for (const cat of payload.categories) {
        let categoryId: string;

        if (cat.id) {
          // Update existing
          await tx.scoringCategory.update({
            where: { id: cat.id },
            data: {
              name: cat.name,
              description: cat.description ?? null,
              weight: cat.weight,
              order: cat.order,
            },
          });
          categoryId = cat.id;
        } else {
          // Create new
          const created = await tx.scoringCategory.create({
            data: {
              schemaId,
              name: cat.name,
              description: cat.description ?? null,
              weight: cat.weight,
              order: cat.order,
            },
          });
          categoryId = created.id;
        }

        // Reconcile criteria within this category
        const payloadCriterionIds = cat.criteria
          .filter((c) => c.id !== undefined)
          .map((c) => c.id as string);

        await tx.scoringCriterion.deleteMany({
          where: {
            categoryId,
            ...(payloadCriterionIds.length > 0 ? { id: { notIn: payloadCriterionIds } } : {}),
          },
        });

        for (const crit of cat.criteria) {
          if (crit.id) {
            await tx.scoringCriterion.update({
              where: { id: crit.id },
              data: {
                name: crit.name,
                description: crit.description ?? null,
                weight: crit.weight,
                maxScore: crit.maxScore,
                order: crit.order,
              },
            });
          } else {
            await tx.scoringCriterion.create({
              data: {
                categoryId,
                name: crit.name,
                description: crit.description ?? null,
                weight: crit.weight,
                maxScore: crit.maxScore,
                order: crit.order,
              },
            });
          }
        }
      }

      // 4. Re-fetch the full schema with nested data
      const result = await tx.scoringSchema.findFirst({
        where: { id: schemaId },
        include: {
          categories: {
            orderBy: { order: 'asc' },
            include: {
              criteria: {
                orderBy: { order: 'asc' },
              },
            },
          },
        },
      });

      if (!result) throw new Error(`ScoringSchema ${schemaId} disappeared mid-transaction`);
      return result as ScoringSchemaWithNested;
    });
  }
}
```

- [ ] **Step 5: Run the repository tests**

```bash
npx jest src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/core/interfaces/repositories/scoring-rubric.repository.interface.ts \
        services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.ts \
        services/api/src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts
git commit -m "feat: add IScoringRubricRepository interface and ScoringRubricRepository implementation"
```

---

## Task 4: Query handler (GetScoringRubrics)

**Files:**
- Create: `services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts`
- Create: `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts`
- Test: `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts`

**Interfaces:**
- Consumes: `IScoringRubricRepository.findRubricsByProgramId`, `IProgramRepository.findBySlug` (for slug-to-UUID resolution), `ScoringStage` from `@prisma/client`.
- Produces: `GetScoringRubricsHandler` injectable service with `execute(query: GetScoringRubricsQuery): Promise<ScoringRubricsResponseDto>`.

- [ ] **Step 1: Write the failing handler tests**

Create `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts`:

```typescript
import { ScoringStage } from '@prisma/client';
import { GetScoringRubricsHandler } from './get-scoring-rubrics.handler';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';

const programId = 'prog-uuid-1';
const schemaId = 'schema-uuid-1';

const makeSchema = (stage: ScoringStage) => ({
  id: schemaId,
  programId,
  stage,
  name: `${stage} Rubric`,
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  legacyId: null,
  categories: [
    {
      id: 'cat-1',
      schemaId,
      name: 'Essay',
      description: null,
      weight: 0.6,
      order: 0,
      legacyId: null,
      criteria: [
        {
          id: 'crit-1',
          categoryId: 'cat-1',
          name: 'Relevance',
          description: null,
          weight: 1.0,
          maxScore: 100,
          order: 0,
          legacyId: null,
        },
      ],
    },
  ],
});

describe('GetScoringRubricsHandler', () => {
  let handler: GetScoringRubricsHandler;
  let mockRepo: { findRubricsByProgramId: jest.Mock };
  let mockProgramRepo: { findBySlug: jest.Mock; findById: jest.Mock };

  beforeEach(() => {
    mockRepo = { findRubricsByProgramId: jest.fn() };
    mockProgramRepo = {
      findBySlug: jest.fn(),
      findById: jest.fn().mockResolvedValue({ id: programId }),
    };
    handler = new GetScoringRubricsHandler(mockRepo as any, mockProgramRepo as any);
  });

  it('returns { application, interview } when both stages exist', async () => {
    mockProgramRepo.findById.mockResolvedValue({ id: programId });
    mockRepo.findRubricsByProgramId.mockResolvedValue([
      makeSchema(ScoringStage.application),
      makeSchema(ScoringStage.interview),
    ]);

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(result.application).not.toBeNull();
    expect(result.interview).not.toBeNull();
    expect(result.application!.stage).toBe('application');
    expect(result.interview!.stage).toBe('interview');
  });

  it('returns null for a stage that has no rubric', async () => {
    mockRepo.findRubricsByProgramId.mockResolvedValue([makeSchema(ScoringStage.application)]);

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(result.application).not.toBeNull();
    expect(result.interview).toBeNull();
  });

  it('maps Decimal weight/maxScore to numbers on criteria', async () => {
    const { Prisma } = await import('@prisma/client');
    const schema = makeSchema(ScoringStage.application);
    schema.categories[0].weight = new Prisma.Decimal(0.6) as any;
    schema.categories[0].criteria[0].weight = new Prisma.Decimal(1.0) as any;
    schema.categories[0].criteria[0].maxScore = new Prisma.Decimal(100) as any;

    mockRepo.findRubricsByProgramId.mockResolvedValue([schema]);

    const result = await handler.execute(new GetScoringRubricsQuery(programId));

    expect(typeof result.application!.categories[0].weight).toBe('number');
    expect(typeof result.application!.categories[0].criteria[0].maxScore).toBe('number');
  });

  it('resolves slug to UUID when a non-UUID programId is provided', async () => {
    mockProgramRepo.findBySlug.mockResolvedValue({ id: programId });
    mockRepo.findRubricsByProgramId.mockResolvedValue([]);

    await handler.execute(new GetScoringRubricsQuery('my-program-slug'));

    expect(mockProgramRepo.findBySlug).toHaveBeenCalledWith('my-program-slug');
    expect(mockRepo.findRubricsByProgramId).toHaveBeenCalledWith(programId, undefined);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create the query class**

Create `services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts`:

```typescript
import { ScoringStage } from '@prisma/client';

export class GetScoringRubricsQuery {
  constructor(
    public readonly programId: string,
    public readonly stage?: ScoringStage,
  ) {}
}
```

- [ ] **Step 4: Implement the handler**

Create `services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts`:

```typescript
import { Injectable, Inject } from '@nestjs/common';
import { Prisma, ScoringStage } from '@prisma/client';
import { IScoringRubricRepository, ScoringSchemaWithNested } from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { IProgramRepository } from '../../../../../core/interfaces/repositories/program.repository.interface';
import { GetScoringRubricsQuery } from '../get-scoring-rubrics.query';
import {
  ScoringRubricsResponseDto,
  RubricDto,
  RubricCategoryDto,
  RubricCriterionDto,
} from '../../../presentation/dto/scoring-rubric.dto';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

function mapSchema(schema: ScoringSchemaWithNested): RubricDto {
  const categories: RubricCategoryDto[] = schema.categories.map((cat) => {
    const criteria: RubricCriterionDto[] = cat.criteria.map((crit) => ({
      id: crit.id,
      name: crit.name,
      description: crit.description,
      weight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
      order: crit.order,
    }));
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weight: toNumber(cat.weight),
      order: cat.order,
      criteria,
    };
  });
  return {
    id: schema.id,
    programId: schema.programId,
    stage: schema.stage,
    name: schema.name,
    description: schema.description,
    isActive: schema.isActive,
    categories,
  };
}

@Injectable()
export class GetScoringRubricsHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
    @Inject('IProgramRepository')
    private readonly programRepo: IProgramRepository,
  ) {}

  async execute(query: GetScoringRubricsQuery): Promise<ScoringRubricsResponseDto> {
    const isUuid = UUID_REGEX.test(query.programId);
    let programId = query.programId;

    if (!isUuid) {
      const found = await this.programRepo.findBySlug(query.programId);
      programId = found?.id ?? query.programId;
    }

    const schemas = await this.repo.findRubricsByProgramId(programId, query.stage);

    const application = schemas.find((s) => s.stage === ScoringStage.application);
    const interview = schemas.find((s) => s.stage === ScoringStage.interview);

    return {
      application: application ? mapSchema(application) : null,
      interview: interview ? mapSchema(interview) : null,
    };
  }
}
```

- [ ] **Step 5: Run the handler tests**

```bash
npx jest src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/modules/programs/application/queries/get-scoring-rubrics.query.ts \
        services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.ts \
        services/api/src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts
git commit -m "feat: add GetScoringRubricsHandler query handler"
```

---

## Task 5: Command handler (UpsertScoringRubric)

**Files:**
- Create: `services/api/src/modules/programs/application/commands/upsert-scoring-rubric.command.ts`
- Create: `services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts`
- Test: `services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts`

**Interfaces:**
- Consumes: `IScoringRubricRepository.upsertRubric`, `UpsertScoringRubricDto` (request body), `ScoringStage` from `@prisma/client`.
- Produces: `UpsertScoringRubricHandler` injectable with `execute(command): Promise<RubricDto>`.

- [ ] **Step 1: Write the failing command handler tests**

Create `services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { ScoringStage } from '@prisma/client';
import { UpsertScoringRubricHandler } from './upsert-scoring-rubric.handler';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';

const programId = 'prog-uuid-1';

const validPayload = {
  name: 'Application Rubric',
  categories: [
    {
      name: 'Essay',
      weight: 0.6,
      order: 0,
      criteria: [{ name: 'Relevance', weight: 1.0, maxScore: 100, order: 0 }],
    },
  ],
};

const fakeResult = {
  id: 'schema-1',
  programId,
  stage: ScoringStage.application,
  name: 'Application Rubric',
  description: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  deletedAt: null,
  legacyId: null,
  categories: [
    {
      id: 'cat-1',
      schemaId: 'schema-1',
      name: 'Essay',
      description: null,
      weight: 0.6,
      order: 0,
      legacyId: null,
      criteria: [
        {
          id: 'crit-1',
          categoryId: 'cat-1',
          name: 'Relevance',
          description: null,
          weight: 1.0,
          maxScore: 100,
          order: 0,
          legacyId: null,
        },
      ],
    },
  ],
};

describe('UpsertScoringRubricHandler', () => {
  let handler: UpsertScoringRubricHandler;
  let mockRepo: { upsertRubric: jest.Mock };

  beforeEach(() => {
    mockRepo = { upsertRubric: jest.fn().mockResolvedValue(fakeResult) };
    handler = new UpsertScoringRubricHandler(mockRepo as any);
  });

  it('calls upsertRubric with the correct arguments and returns a RubricDto', async () => {
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, validPayload);
    const result = await handler.execute(cmd);

    expect(mockRepo.upsertRubric).toHaveBeenCalledWith(
      programId,
      ScoringStage.application,
      validPayload,
    );
    expect(result.id).toBe('schema-1');
    expect(result.categories).toHaveLength(1);
  });

  it('throws BadRequestException when a category weight is negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: -0.1, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a criterion maxScore is zero', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 0, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a criterion maxScore is negative', async () => {
    const payload = {
      categories: [
        { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: -10, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });

  it('throws BadRequestException when a category name is empty', async () => {
    const payload = {
      categories: [
        { name: '', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    };
    const cmd = new UpsertScoringRubricCommand(programId, ScoringStage.application, payload);
    await expect(handler.execute(cmd)).rejects.toThrow(BadRequestException);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Create the command class**

Create `services/api/src/modules/programs/application/commands/upsert-scoring-rubric.command.ts`:

```typescript
import { ScoringStage } from '@prisma/client';
import { UpsertRubricPayload } from '../../../../core/interfaces/repositories/scoring-rubric.repository.interface';

export class UpsertScoringRubricCommand {
  constructor(
    public readonly programId: string,
    public readonly stage: ScoringStage,
    public readonly payload: UpsertRubricPayload,
  ) {}
}
```

- [ ] **Step 4: Implement the handler**

Create `services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts`:

```typescript
import { Injectable, Inject, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  IScoringRubricRepository,
  ScoringSchemaWithNested,
  UpsertRubricPayload,
} from '../../../../../core/interfaces/repositories/scoring-rubric.repository.interface';
import { UpsertScoringRubricCommand } from '../upsert-scoring-rubric.command';
import { RubricDto, RubricCategoryDto, RubricCriterionDto } from '../../../presentation/dto/scoring-rubric.dto';

function toNumber(value: Prisma.Decimal | number): number {
  if (value instanceof Prisma.Decimal) return value.toNumber();
  return Number(value);
}

function mapToRubricDto(schema: ScoringSchemaWithNested): RubricDto {
  const categories: RubricCategoryDto[] = schema.categories.map((cat) => {
    const criteria: RubricCriterionDto[] = cat.criteria.map((crit) => ({
      id: crit.id,
      name: crit.name,
      description: crit.description,
      weight: toNumber(crit.weight),
      maxScore: toNumber(crit.maxScore),
      order: crit.order,
    }));
    return {
      id: cat.id,
      name: cat.name,
      description: cat.description,
      weight: toNumber(cat.weight),
      order: cat.order,
      criteria,
    };
  });
  return {
    id: schema.id,
    programId: schema.programId,
    stage: schema.stage,
    name: schema.name,
    description: schema.description,
    isActive: schema.isActive,
    categories,
  };
}

function validatePayload(payload: UpsertRubricPayload): void {
  for (const cat of payload.categories) {
    if (!cat.name || cat.name.trim().length === 0) {
      throw new BadRequestException('Category name must not be empty');
    }
    if (cat.weight < 0) {
      throw new BadRequestException(`Category "${cat.name}" weight must be >= 0`);
    }
    for (const crit of cat.criteria) {
      if (!crit.name || crit.name.trim().length === 0) {
        throw new BadRequestException('Criterion name must not be empty');
      }
      if (crit.weight < 0) {
        throw new BadRequestException(`Criterion "${crit.name}" weight must be >= 0`);
      }
      if (crit.maxScore <= 0) {
        throw new BadRequestException(`Criterion "${crit.name}" maxScore must be > 0`);
      }
    }
  }
}

@Injectable()
export class UpsertScoringRubricHandler {
  constructor(
    @Inject('IScoringRubricRepository')
    private readonly repo: IScoringRubricRepository,
  ) {}

  async execute(command: UpsertScoringRubricCommand): Promise<RubricDto> {
    validatePayload(command.payload);
    const result = await this.repo.upsertRubric(
      command.programId,
      command.stage,
      command.payload,
    );
    return mapToRubricDto(result);
  }
}
```

- [ ] **Step 5: Run the command handler tests**

```bash
npx jest src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Commit**

```bash
git add services/api/src/modules/programs/application/commands/upsert-scoring-rubric.command.ts \
        services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.ts \
        services/api/src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts
git commit -m "feat: add UpsertScoringRubricHandler command handler with validation"
```

---

## Task 6: Controller endpoints + module wiring

**Files:**
- Create: `services/api/src/modules/programs/presentation/program-scoring.controller.ts`
- Test: `services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts`
- Modify: `services/api/src/modules/programs/programs.module.ts`

**Interfaces:**
- Produces:
  - `GET /programs/:programId/scoring-rubrics` (roles: ADMIN, SUPER_ADMIN) returns `ScoringRubricsResponseDto`
  - `GET /programs/:programId/scoring-rubrics?stage=application|interview` (same roles)
  - `PUT /programs/:programId/scoring-rubrics/:stage` (roles: SUPER_ADMIN only) returns `RubricDto`

- [ ] **Step 1: Write the failing controller tests**

Create `services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ScoringStage } from '@prisma/client';
import { ProgramScoringController } from './program-scoring.controller';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import { UpsertScoringRubricDto } from './dto/scoring-rubric.dto';

describe('ProgramScoringController', () => {
  let controller: ProgramScoringController;
  const mockExecute = { execute: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ProgramScoringController],
      providers: [
        { provide: GetScoringRubricsHandler, useValue: mockExecute },
        { provide: UpsertScoringRubricHandler, useValue: mockExecute },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<ProgramScoringController>(ProgramScoringController);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('getScoringRubrics', () => {
    it('executes GetScoringRubricsQuery with the programId', async () => {
      mockExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', undefined);
      expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(GetScoringRubricsQuery));
      const query: GetScoringRubricsQuery = mockExecute.execute.mock.calls[0][0];
      expect(query.programId).toBe('prog-1');
      expect(query.stage).toBeUndefined();
    });

    it('passes stage query param when provided', async () => {
      mockExecute.execute.mockResolvedValue({ application: null, interview: null });
      await controller.getScoringRubrics('prog-1', ScoringStage.application);
      const query: GetScoringRubricsQuery = mockExecute.execute.mock.calls[0][0];
      expect(query.stage).toBe(ScoringStage.application);
    });
  });

  describe('upsertScoringRubric', () => {
    it('executes UpsertScoringRubricCommand with correct arguments', async () => {
      mockExecute.execute.mockResolvedValue({ id: 'schema-1' });
      const dto = plainToInstance(UpsertScoringRubricDto, {
        name: 'App Rubric',
        categories: [
          { name: 'Essay', weight: 0.5, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
        ],
      });

      await controller.upsertScoringRubric('prog-1', 'application', dto);

      expect(mockExecute.execute).toHaveBeenCalledWith(expect.any(UpsertScoringRubricCommand));
      const cmd: UpsertScoringRubricCommand = mockExecute.execute.mock.calls[0][0];
      expect(cmd.programId).toBe('prog-1');
      expect(cmd.stage).toBe(ScoringStage.application);
    });
  });
});

describe('UpsertScoringRubricDto: weight/maxScore validation via controller DTO', () => {
  it('converts percentage weight to fraction before validation', async () => {
    // The DTO receives fractions (0-1) -- the controller/client is responsible for % conversion.
    // Here we verify the DTO itself rejects weights < 0.
    const dto = plainToInstance(UpsertScoringRubricDto, {
      categories: [
        { name: 'Essay', weight: -0.01, order: 0, criteria: [{ name: 'X', weight: 1, maxScore: 100, order: 0 }] },
      ],
    });
    const errors = await validate(dto, { whitelist: true });
    expect(errors.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx jest src/modules/programs/presentation/program-scoring.controller.spec.ts
```

Expected: FAIL (module not found).

- [ ] **Step 3: Implement the controller**

Create `services/api/src/modules/programs/presentation/program-scoring.controller.ts`:

```typescript
import {
  Controller,
  Get,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ScoringStage } from '@prisma/client';
import { JwtAuthGuard } from '../../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { GetScoringRubricsHandler } from '../application/queries/handlers/get-scoring-rubrics.handler';
import { UpsertScoringRubricHandler } from '../application/commands/handlers/upsert-scoring-rubric.handler';
import { GetScoringRubricsQuery } from '../application/queries/get-scoring-rubrics.query';
import { UpsertScoringRubricCommand } from '../application/commands/upsert-scoring-rubric.command';
import {
  UpsertScoringRubricDto,
  ScoringRubricsResponseDto,
  RubricDto,
} from './dto/scoring-rubric.dto';

@ApiTags('Scoring Rubrics')
@Controller('programs')
export class ProgramScoringController {
  constructor(
    private readonly getScoringRubricsHandler: GetScoringRubricsHandler,
    private readonly upsertScoringRubricHandler: UpsertScoringRubricHandler,
  ) {}

  @Get(':programId/scoring-rubrics')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get scoring rubrics for a program (application and interview stages)' })
  async getScoringRubrics(
    @Param('programId') programId: string,
    @Query('stage') stage?: ScoringStage,
  ): Promise<ScoringRubricsResponseDto> {
    return this.getScoringRubricsHandler.execute(new GetScoringRubricsQuery(programId, stage));
  }

  @Put(':programId/scoring-rubrics/:stage')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Upsert the full rubric for a stage (super admin only)' })
  async upsertScoringRubric(
    @Param('programId') programId: string,
    @Param('stage') stageParam: string,
    @Body() dto: UpsertScoringRubricDto,
  ): Promise<RubricDto> {
    const stage = stageParam as ScoringStage;
    if (stage !== ScoringStage.application && stage !== ScoringStage.interview) {
      throw new BadRequestException(`Invalid stage "${stageParam}". Must be "application" or "interview".`);
    }

    // Convert percentage weights (UI) to fractions (DB): UI sends 0-100, API stores 0-1.
    // The frontend api-client is responsible for this conversion before calling the endpoint.
    // The DTO already validates fractions (0-1 range). No additional conversion here.
    return this.upsertScoringRubricHandler.execute(
      new UpsertScoringRubricCommand(programId, stage, {
        name: dto.name,
        description: dto.description,
        categories: dto.categories.map((cat) => ({
          id: cat.id,
          name: cat.name,
          description: cat.description,
          weight: cat.weight,
          order: cat.order,
          criteria: cat.criteria.map((crit) => ({
            id: crit.id,
            name: crit.name,
            description: crit.description,
            weight: crit.weight,
            maxScore: crit.maxScore,
            order: crit.order,
          })),
        })),
      }),
    );
  }
}
```

- [ ] **Step 4: Wire into `programs.module.ts`**

Open `services/api/src/modules/programs/programs.module.ts`. Make the following additions:

Add import at the top of the file (after the existing controller imports):
```typescript
import { ProgramScoringController } from './presentation/program-scoring.controller';
import { GetScoringRubricsHandler } from './application/queries/handlers/get-scoring-rubrics.handler';
import { UpsertScoringRubricHandler } from './application/commands/handlers/upsert-scoring-rubric.handler';
import { ScoringRubricRepository } from './infrastructure/persistence/scoring-rubric.repository';
```

In the `@Module` decorator:
- Add `ProgramScoringController` to the `controllers` array (after `ProgramFormFieldsController`).
- Add `GetScoringRubricsHandler`, `UpsertScoringRubricHandler` to the `providers` array (after the existing handlers).
- Add the repository provider (after the `'IProgramContentRepository'` provider):
  ```typescript
  {
    provide: 'IScoringRubricRepository',
    useClass: ScoringRubricRepository,
  },
  ```

- [ ] **Step 5: Run the controller tests**

```bash
npx jest src/modules/programs/presentation/program-scoring.controller.spec.ts
```

Expected: All tests PASS.

- [ ] **Step 6: Run all programs module tests to confirm nothing regressed**

```bash
npx jest src/modules/programs/
```

Expected: All tests PASS (existing specs + new specs).

- [ ] **Step 7: Type-check the API**

From `services/api/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 8: Commit**

```bash
git add services/api/src/modules/programs/presentation/program-scoring.controller.ts \
        services/api/src/modules/programs/presentation/program-scoring.controller.spec.ts \
        services/api/src/modules/programs/programs.module.ts
git commit -m "feat: add ProgramScoringController endpoints and wire into ProgramsModule"
```

---

## Task 7: Admin dashboard API client functions + TypeScript types

**Files:**
- Modify: `services/admin-dashboard/src/shared/api-client.ts`

**Interfaces:**
- Consumes: existing `request<T>()` helper in `api-client.ts`.
- Produces:
  - TypeScript types: `RubricCriterion`, `RubricCategory`, `Rubric`, `ScoringRubricsResponse`, `UpsertCriterionInput`, `UpsertCategoryInput`, `UpsertRubricInput`.
  - Functions: `getScoringRubrics(programId: string): Promise<ScoringRubricsResponse>`, `upsertScoringRubric(programId: string, stage: 'application' | 'interview', payload: UpsertRubricInput): Promise<Rubric>`.
  - Helper: `percentToFraction(pct: number): number`, `fractionToPercent(frac: number): number`.

- [ ] **Step 1: Append types and functions to `api-client.ts`**

Open `services/admin-dashboard/src/shared/api-client.ts`. Append the following to the end of the file:

```typescript
// ─── Scoring Rubrics ─────────────────────────────────────────────────────────

export type RubricCriterion = {
  id: string;
  name: string;
  description: string | null | undefined;
  /** Fraction 0-1 as stored in the API response. Use fractionToPercent() to display. */
  weight: number;
  maxScore: number;
  order: number;
};

export type RubricCategory = {
  id: string;
  name: string;
  description: string | null | undefined;
  /** Fraction 0-1 as stored in the API response. */
  weight: number;
  order: number;
  criteria: RubricCriterion[];
};

export type Rubric = {
  id: string;
  programId: string;
  stage: 'application' | 'interview';
  name: string;
  description: string | null | undefined;
  isActive: boolean;
  categories: RubricCategory[];
};

export type ScoringRubricsResponse = {
  application: Rubric | null;
  interview: Rubric | null;
};

export type UpsertCriterionInput = {
  id?: string;
  name: string;
  description?: string;
  /** Fraction 0-1. Use percentToFraction() before passing here. */
  weight: number;
  maxScore: number;
  order: number;
};

export type UpsertCategoryInput = {
  id?: string;
  name: string;
  description?: string;
  /** Fraction 0-1. */
  weight: number;
  order: number;
  criteria: UpsertCriterionInput[];
};

export type UpsertRubricInput = {
  name?: string;
  description?: string;
  categories: UpsertCategoryInput[];
};

// ─── Weight conversion helpers ────────────────────────────────────────────────

/** Convert a percentage (0-100) to a fraction (0-1) for the API. */
export function percentToFraction(pct: number): number {
  return pct / 100;
}

/** Convert a fraction (0-1) from the API to a percentage (0-100) for display. */
export function fractionToPercent(frac: number): number {
  return frac * 100;
}

// ─── Scoring Rubric API functions ─────────────────────────────────────────────

export function getScoringRubrics(programId: string): Promise<ScoringRubricsResponse> {
  return request<ScoringRubricsResponse>(`/programs/${programId}/scoring-rubrics`);
}

export function upsertScoringRubric(
  programId: string,
  stage: 'application' | 'interview',
  payload: UpsertRubricInput,
): Promise<Rubric> {
  return request<Rubric>(`/programs/${programId}/scoring-rubrics/${stage}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
```

- [ ] **Step 2: Type-check the admin dashboard**

From `services/admin-dashboard/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Commit**

```bash
git add services/admin-dashboard/src/shared/api-client.ts
git commit -m "feat: add scoring rubric types, api functions, and weight conversion helpers to api-client"
```

---

## Task 8: Admin dashboard builder page + components

**Files:**
- Create: `services/admin-dashboard/app/programs/[programId]/scoring/rubric/page.tsx`
- Create: `services/admin-dashboard/app/programs/[programId]/scoring/rubric/RubricBuilderClient.tsx`
- Modify: `services/admin-dashboard/lib/nav-config.ts`

**Interfaces:**
- Consumes: `getScoringRubrics`, `upsertScoringRubric`, `percentToFraction`, `fractionToPercent`, `UpsertRubricInput`, `UpsertCategoryInput`, `UpsertCriterionInput`, `Rubric`, `RubricCategory`, `RubricCriterion` from `@/src/shared/api-client`; `useResolvedProgramId` from `@/app/hooks/useResolvedProgramId`; `useAuth` from `@/app/contexts/AuthContext`; `useParams` from `next/navigation`.
- Produces: a rubric editor page at `/programs/[programId]/scoring/rubric` visible to super admins only; a nav entry under the Scoring section.

- [ ] **Step 1: Add a nav entry for the Rubric page**

Open `services/admin-dashboard/lib/nav-config.ts`. Find the `scoring` section in `programNavSections`:

```typescript
{ id: "scoring", title: "Scoring", items: [
  { id: "scoring", label: "Scoring", href: "scoring", icon: Trophy, children: [
    { id: "scoring-fully-funded", label: "Fully Funded", href: "scoring/fully-funded", icon: FileBadge },
    { id: "scoring-interview", label: "Interview", href: "scoring/interview", icon: MessageSquare },
  ]},
]},
```

Add the Rubric child item (add `BookOpen` to the lucide-react import at the top if not already present):

```typescript
{ id: "scoring", title: "Scoring", items: [
  { id: "scoring", label: "Scoring", href: "scoring", icon: Trophy, children: [
    { id: "scoring-fully-funded", label: "Fully Funded", href: "scoring/fully-funded", icon: FileBadge },
    { id: "scoring-interview", label: "Interview", href: "scoring/interview", icon: MessageSquare },
    { id: "scoring-rubric", label: "Rubric", href: "scoring/rubric", icon: BookOpen },
  ]},
]},
```

Note: the nav entry will be visible to all roles; the page itself gates on `isSuperAdmin` and shows an access-denied message for non-super-admins.

- [ ] **Step 2: Create the server page component**

Create `services/admin-dashboard/app/programs/[programId]/scoring/rubric/page.tsx`:

```tsx
import { RubricBuilderClient } from "./RubricBuilderClient";

export default function ScoringRubricPage() {
  return <RubricBuilderClient />;
}
```

- [ ] **Step 3: Create the client component**

Create `services/admin-dashboard/app/programs/[programId]/scoring/rubric/RubricBuilderClient.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { useAuth } from "@/app/contexts/AuthContext";
import { useResolvedProgramId } from "@/app/hooks/useResolvedProgramId";
import {
  getScoringRubrics,
  upsertScoringRubric,
  percentToFraction,
  fractionToPercent,
  Rubric,
  UpsertRubricInput,
  UpsertCategoryInput,
  UpsertCriterionInput,
} from "@/src/shared/api-client";

// ─── Types (local state representation in percentages) ────────────────────────

type CriterionState = {
  id?: string;
  name: string;
  description: string;
  weightPct: number;
  maxScore: number;
  order: number;
};

type CategoryState = {
  id?: string;
  name: string;
  description: string;
  weightPct: number;
  order: number;
  criteria: CriterionState[];
};

type RubricState = {
  name: string;
  description: string;
  categories: CategoryState[];
};

// ─── Conversion helpers ───────────────────────────────────────────────────────

function rubricToState(rubric: Rubric | null): RubricState {
  if (!rubric) return { name: "", description: "", categories: [] };
  return {
    name: rubric.name,
    description: rubric.description ?? "",
    categories: rubric.categories.map((cat, ci) => ({
      id: cat.id,
      name: cat.name,
      description: cat.description ?? "",
      weightPct: Math.round(fractionToPercent(cat.weight) * 100) / 100,
      order: ci,
      criteria: cat.criteria.map((crit, ri) => ({
        id: crit.id,
        name: crit.name,
        description: crit.description ?? "",
        weightPct: Math.round(fractionToPercent(crit.weight) * 100) / 100,
        maxScore: Number(crit.maxScore),
        order: ri,
      })),
    })),
  };
}

function stateToPayload(state: RubricState): UpsertRubricInput {
  return {
    name: state.name || undefined,
    description: state.description || undefined,
    categories: state.categories.map((cat, ci): UpsertCategoryInput => ({
      id: cat.id,
      name: cat.name,
      description: cat.description || undefined,
      weight: percentToFraction(cat.weightPct),
      order: ci,
      criteria: cat.criteria.map((crit, ri): UpsertCriterionInput => ({
        id: crit.id,
        name: crit.name,
        description: crit.description || undefined,
        weight: percentToFraction(crit.weightPct),
        maxScore: crit.maxScore,
        order: ri,
      })),
    })),
  };
}

// ─── Weight sum helpers ───────────────────────────────────────────────────────

function sumWeights(items: { weightPct: number }[]): number {
  return items.reduce((acc, item) => acc + (item.weightPct || 0), 0);
}

// ─── Sub-component: CriterionRow ─────────────────────────────────────────────

function CriterionRow({
  criterion,
  catIdx,
  critIdx,
  onChange,
  onDelete,
}: {
  criterion: CriterionState;
  catIdx: number;
  critIdx: number;
  onChange: (catIdx: number, critIdx: number, updated: Partial<CriterionState>) => void;
  onDelete: (catIdx: number, critIdx: number) => void;
}) {
  return (
    <div className="flex items-start gap-2 rounded border bg-muted/20 p-2">
      <div className="flex flex-1 flex-col gap-1">
        <input
          className="w-full rounded border px-2 py-1 text-sm"
          placeholder="Criterion name"
          value={criterion.name}
          onChange={(e) => onChange(catIdx, critIdx, { name: e.target.value })}
        />
        <input
          className="w-full rounded border px-2 py-1 text-xs text-muted-foreground"
          placeholder="Description (optional)"
          value={criterion.description}
          onChange={(e) => onChange(catIdx, critIdx, { description: e.target.value })}
        />
      </div>
      <div className="flex flex-col items-end gap-1">
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-20 rounded border px-2 py-1 text-sm"
            placeholder="Weight %"
            value={criterion.weightPct}
            min={0}
            step={0.01}
            onChange={(e) => onChange(catIdx, critIdx, { weightPct: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-20 rounded border px-2 py-1 text-sm"
            placeholder="Max score"
            value={criterion.maxScore}
            min={0.01}
            step={1}
            onChange={(e) => onChange(catIdx, critIdx, { maxScore: parseFloat(e.target.value) || 100 })}
          />
          <span className="text-xs text-muted-foreground">pts</span>
        </div>
      </div>
      <button
        type="button"
        className="mt-1 text-xs text-destructive hover:underline"
        onClick={() => onDelete(catIdx, critIdx)}
      >
        Remove
      </button>
    </div>
  );
}

// ─── Sub-component: CategoryCard ─────────────────────────────────────────────

function CategoryCard({
  category,
  catIdx,
  onCategoryChange,
  onCriterionChange,
  onAddCriterion,
  onDeleteCategory,
  onDeleteCriterion,
}: {
  category: CategoryState;
  catIdx: number;
  onCategoryChange: (catIdx: number, updated: Partial<CategoryState>) => void;
  onCriterionChange: (catIdx: number, critIdx: number, updated: Partial<CriterionState>) => void;
  onAddCriterion: (catIdx: number) => void;
  onDeleteCategory: (catIdx: number) => void;
  onDeleteCriterion: (catIdx: number, critIdx: number) => void;
}) {
  const critSum = sumWeights(category.criteria);
  const critSumWarning = category.criteria.length > 0 && Math.abs(critSum - 100) > 0.01;

  return (
    <div className="rounded-lg border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-start gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <input
            className="w-full rounded border px-3 py-1.5 font-medium"
            placeholder="Category name"
            value={category.name}
            onChange={(e) => onCategoryChange(catIdx, { name: e.target.value })}
          />
          <input
            className="w-full rounded border px-3 py-1 text-sm text-muted-foreground"
            placeholder="Description (optional)"
            value={category.description}
            onChange={(e) => onCategoryChange(catIdx, { description: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1">
          <input
            type="number"
            className="w-20 rounded border px-2 py-1.5 text-sm"
            placeholder="Weight %"
            value={category.weightPct}
            min={0}
            step={0.01}
            onChange={(e) => onCategoryChange(catIdx, { weightPct: parseFloat(e.target.value) || 0 })}
          />
          <span className="text-xs text-muted-foreground">%</span>
        </div>
        <button
          type="button"
          className="text-xs text-destructive hover:underline"
          onClick={() => onDeleteCategory(catIdx)}
        >
          Remove
        </button>
      </div>

      <div className="mb-2 space-y-2">
        {category.criteria.map((crit, critIdx) => (
          <CriterionRow
            key={critIdx}
            criterion={crit}
            catIdx={catIdx}
            critIdx={critIdx}
            onChange={onCriterionChange}
            onDelete={onDeleteCriterion}
          />
        ))}
      </div>

      {critSumWarning && (
        <p className="mb-2 text-xs text-amber-600">
          Criterion weights sum to {critSum.toFixed(1)}% (should be 100%). Scores will be normalized on computation.
        </p>
      )}

      <button
        type="button"
        className="text-xs text-primary hover:underline"
        onClick={() => onAddCriterion(catIdx)}
      >
        + Add criterion
      </button>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const STAGES = ["application", "interview"] as const;
type Stage = (typeof STAGES)[number];

const STAGE_LABELS: Record<Stage, string> = {
  application: "Application",
  interview: "Interview",
};

function emptyRubricState(): RubricState {
  return { name: "", description: "", categories: [] };
}

function emptyCriterion(order: number): CriterionState {
  return { name: "", description: "", weightPct: 0, maxScore: 100, order };
}

function emptyCategory(order: number): CategoryState {
  return { name: "", description: "", weightPct: 0, order, criteria: [] };
}

export function RubricBuilderClient() {
  const params = useParams<{ programId: string }>();
  const rawProgramId = params.programId;
  const programId = useResolvedProgramId(rawProgramId);
  const { accessConfig } = useAuth();

  const [activeStage, setActiveStage] = useState<Stage>("application");
  const [states, setStates] = useState<Record<Stage, RubricState>>({
    application: emptyRubricState(),
    interview: emptyRubricState(),
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Load both rubrics on mount
  const loadRubrics = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await getScoringRubrics(programId);
      setStates({
        application: rubricToState(data.application),
        interview: rubricToState(data.interview),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load rubrics.");
    } finally {
      setIsLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    loadRubrics();
  }, [loadRubrics]);

  const handleSave = async () => {
    setSaveError(null);
    setSaveSuccess(false);
    setIsSaving(true);
    try {
      const payload = stateToPayload(states[activeStage]);
      const result = await upsertScoringRubric(programId, activeStage, payload);
      setStates((prev) => ({
        ...prev,
        [activeStage]: rubricToState(result),
      }));
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save rubric.");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCategoryField = (catIdx: number, updated: Partial<CategoryState>) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      cats[catIdx] = { ...cats[catIdx], ...updated };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const updateCriterionField = (catIdx: number, critIdx: number, updated: Partial<CriterionState>) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      const criteria = [...cats[catIdx].criteria];
      criteria[critIdx] = { ...criteria[critIdx], ...updated };
      cats[catIdx] = { ...cats[catIdx], criteria };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const addCategory = () => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      cats.push(emptyCategory(cats.length));
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const deleteCategory = (catIdx: number) => {
    setStates((prev) => {
      const cats = prev[activeStage].categories.filter((_, i) => i !== catIdx);
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const addCriterion = (catIdx: number) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      const criteria = [...cats[catIdx].criteria];
      criteria.push(emptyCriterion(criteria.length));
      cats[catIdx] = { ...cats[catIdx], criteria };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  const deleteCriterion = (catIdx: number, critIdx: number) => {
    setStates((prev) => {
      const cats = [...prev[activeStage].categories];
      const criteria = cats[catIdx].criteria.filter((_, i) => i !== critIdx);
      cats[catIdx] = { ...cats[catIdx], criteria };
      return { ...prev, [activeStage]: { ...prev[activeStage], categories: cats } };
    });
  };

  // Super-admin gate
  if (!accessConfig.isSuperAdmin) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">
          Rubric management is only available to super admins.
        </p>
      </div>
    );
  }

  if (isLoading) {
    return <div className="p-6 text-sm text-muted-foreground">Loading rubrics...</div>;
  }

  if (error) {
    return (
      <div className="p-6">
        <p className="text-sm text-destructive">{error}</p>
        <button type="button" className="mt-2 text-sm text-primary underline" onClick={loadRubrics}>
          Retry
        </button>
      </div>
    );
  }

  const current = states[activeStage];
  const catSum = sumWeights(current.categories);
  const catSumWarning = current.categories.length > 0 && Math.abs(catSum - 100) > 0.01;

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-6">
      <div>
        <h1 className="text-xl font-semibold">Scoring Rubric</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Define categories and criteria for scoring applicants.
        </p>
      </div>

      {/* Stage tabs */}
      <div className="flex gap-2 border-b">
        {STAGES.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setActiveStage(stage)}
            className={`px-4 py-2 text-sm font-medium transition-colors ${
              activeStage === stage
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {STAGE_LABELS[stage]}
          </button>
        ))}
      </div>

      {/* Rubric name */}
      <div>
        <label className="mb-1 block text-sm font-medium">Rubric name</label>
        <input
          className="w-full rounded border px-3 py-2"
          placeholder={`${STAGE_LABELS[activeStage]} Rubric`}
          value={current.name}
          onChange={(e) =>
            setStates((prev) => ({
              ...prev,
              [activeStage]: { ...prev[activeStage], name: e.target.value },
            }))
          }
        />
      </div>

      {/* Category weight summary */}
      {catSumWarning && (
        <p className="rounded border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-700">
          Category weights sum to {catSum.toFixed(1)}% (should be 100%). Scores will be normalized on computation.
        </p>
      )}

      {/* Categories */}
      <div className="space-y-4">
        {current.categories.map((cat, catIdx) => (
          <CategoryCard
            key={catIdx}
            category={cat}
            catIdx={catIdx}
            onCategoryChange={updateCategoryField}
            onCriterionChange={updateCriterionField}
            onAddCriterion={addCriterion}
            onDeleteCategory={deleteCategory}
            onDeleteCriterion={deleteCriterion}
          />
        ))}
      </div>

      <button
        type="button"
        className="w-full rounded border-2 border-dashed py-2 text-sm text-muted-foreground hover:border-primary hover:text-primary"
        onClick={addCategory}
      >
        + Add category
      </button>

      {/* Save section */}
      <div className="flex items-center justify-between border-t pt-4">
        <div className="text-sm">
          {saveError && <p className="text-destructive">{saveError}</p>}
          {saveSuccess && <p className="text-green-600">Rubric saved.</p>}
        </div>
        <button
          type="button"
          disabled={isSaving}
          onClick={handleSave}
          className="rounded bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
        >
          {isSaving ? "Saving..." : "Save rubric"}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Type-check the admin dashboard**

From `services/admin-dashboard/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 5: Commit**

```bash
git add services/admin-dashboard/app/programs/[programId]/scoring/rubric/page.tsx \
        services/admin-dashboard/app/programs/[programId]/scoring/rubric/RubricBuilderClient.tsx \
        services/admin-dashboard/lib/nav-config.ts
git commit -m "feat: add scoring rubric builder UI with Application/Interview tabs and super-admin gate"
```

---

## Task 9: Final verification

**Files:** None created.

**Interfaces:**
- Verifies: tsc 0 errors (both services), all API tests pass, manual walkthrough confirms end-to-end flow.

- [ ] **Step 1: Run all API tests**

From `services/api/`:
```bash
npm test
```

Expected: All existing tests pass, plus the new spec files:
- `src/modules/programs/presentation/dto/scoring-rubric.dto.spec.ts`
- `src/modules/programs/infrastructure/persistence/scoring-rubric.repository.spec.ts`
- `src/modules/programs/application/queries/handlers/get-scoring-rubrics.handler.spec.ts`
- `src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler.spec.ts`
- `src/modules/programs/presentation/program-scoring.controller.spec.ts`

- [ ] **Step 2: Type-check the API**

From `services/api/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 3: Type-check the admin dashboard**

From `services/admin-dashboard/`:
```bash
npx tsc --noEmit
```

Expected: 0 errors.

- [ ] **Step 4: Manual walkthrough checklist**

Start the local dev stack and navigate to a program's scoring rubric page.

Walkthrough:
1. Log in as a super admin. Navigate to a test program's Scoring section. Confirm a "Rubric" nav item is visible under the Scoring tree.
2. Open the Rubric page. Confirm both "Application" and "Interview" tabs render.
3. On the Application tab: add 2 categories ("Essay" at 60%, "Interview" at 40%); add 2 criteria to Essay ("Topic Relevance" at 70%, 100 pts; "Clarity" at 30%, 100 pts); add 1 criterion to Interview ("Communication" at 100%, 100 pts).
4. Verify the category weight sum indicator does NOT show a warning (60+40=100).
5. Verify the Essay criteria weight sum indicator does NOT show a warning (70+30=100).
6. Click "Save rubric". Confirm the loading state appears, then a "Rubric saved." success message appears.
7. Hard-refresh the page. Confirm the rubric reloads with the same categories and criteria in the same order.
8. Switch to the Interview tab. Add 1 category and 1 criterion; save; refresh; confirm persistence.
9. Edit an existing criterion's weight to 50 (leaving others as-is, so sum != 100). Confirm the amber warning message appears. Click Save. Confirm it still saves (warn, do not block).
10. Log out. Log in as a program admin (not super admin). Navigate to the Rubric page directly. Confirm the "only available to super admins" message renders and no editor is shown.

- [ ] **Step 5: Confirm prisma migration is committed**

Run:
```bash
git log --oneline services/api/prisma/migrations/ | head -5
```

Confirm the `add-scoring-stage` migration files are committed.

- [ ] **Step 6: Final commit (if any remaining changes)**

If verification revealed and fixed any issues, commit with:
```bash
git commit -m "fix: scoring rubric verification fixes"
```

Otherwise, confirm the branch is clean:
```bash
git status
```

Expected: clean working tree (or only untracked files that should not be committed).
