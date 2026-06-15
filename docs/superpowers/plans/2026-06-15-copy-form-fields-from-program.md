# Copy Form Fields From Another Program — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let an admin copy submission form fields from any program they can access into the current program (cross-brand, all or a subset, append or replace), via a new "Copy from program" button.

**Architecture:** A new CQRS command + handler in the API `programs` module mirrors the existing `ApplyFormTemplateHandler`, but reads `ApplicationFormField` rows from a source program instead of a template. A new admin-dashboard dialog (`CopyFromProgramDialog`) reuses `useAuth().accessiblePrograms` for the source picker and posts to the new endpoint. The existing "Copy from template" feature is untouched.

**Tech Stack:** NestJS + @nestjs/cqrs + Prisma (API, Jest tests). Next.js + React + Tailwind + sonner (admin dashboard, typecheck via `tsc`, no FE test runner).

**Spec:** `docs/superpowers/specs/2026-06-15-copy-form-fields-from-program-design.md`

**Working directory note:** All API paths are under `services/api/`; all admin-dashboard paths under `services/admin-dashboard/`. Run commands from the stated service directory.

---

## File Structure

**API (`services/api/`):**
- Create: `src/modules/programs/application/commands/copy-fields-from-program.command.ts` — the command DTO (plain data).
- Create: `src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts` — the copy logic.
- Create: `src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.spec.ts` — unit tests.
- Create: `src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts` — request validation.
- Modify: `src/modules/programs/presentation/program-form-fields.controller.ts` — add the route.
- Modify: `src/modules/programs/programs.module.ts` — register the handler as a provider.

**Admin dashboard (`services/admin-dashboard/`):**
- Modify: `app/components/submissionsMasterData/form-fields/catalog-api.ts` — add `fetchProgramFormFields` + `copyFieldsFromProgram` + a row type.
- Create: `app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx` — the dialog.
- Modify: `app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx` — add button, state, render.

---

## Task 1: Backend command + request DTO

**Files:**
- Create: `services/api/src/modules/programs/application/commands/copy-fields-from-program.command.ts`
- Create: `services/api/src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts`

- [ ] **Step 1: Create the command class**

`services/api/src/modules/programs/application/commands/copy-fields-from-program.command.ts`:

```typescript
export class CopyFieldsFromProgramCommand {
  constructor(
    public readonly programId: string,
    public readonly sourceProgramId: string,
    public readonly fieldIds: string[] | undefined,
    public readonly mode: 'append' | 'replace',
  ) {}
}
```

- [ ] **Step 2: Create the request DTO**

`services/api/src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts`:

```typescript
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsBoolean, IsIn, IsOptional, IsUUID } from 'class-validator';

export class CopyFieldsFromProgramDto {
  @ApiProperty({ description: 'Program to copy fields FROM.' })
  @IsUUID()
  sourceProgramId!: string;

  @ApiPropertyOptional({
    description: 'Specific source field ids to copy. Omit to copy all active fields.',
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  fieldIds?: string[];

  @ApiPropertyOptional({ enum: ['append', 'replace'], default: 'append' })
  @IsOptional()
  @IsIn(['append', 'replace'])
  mode?: 'append' | 'replace';

  @ApiPropertyOptional({
    description: 'Required true when mode=replace to guard against accidents.',
  })
  @IsOptional()
  @IsBoolean()
  confirm?: boolean;
}
```

- [ ] **Step 3: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors referencing the two new files.

- [ ] **Step 4: Commit**

```bash
cd services/api
git add src/modules/programs/application/commands/copy-fields-from-program.command.ts src/modules/programs/presentation/dto/copy-fields-from-program.dto.ts
git commit -m "feat(programs): add copy-fields-from-program command and DTO"
```

---

## Task 2: Backend handler (TDD)

**Files:**
- Create: `services/api/src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.spec.ts`
- Create: `services/api/src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts`

- [ ] **Step 1: Write the failing test**

`services/api/src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.spec.ts`:

```typescript
import { BadRequestException } from '@nestjs/common';
import { CopyFieldsFromProgramHandler } from './copy-fields-from-program.handler';
import { CopyFieldsFromProgramCommand } from '../copy-fields-from-program.command';
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
function mkPrisma(opts: {
  sourceFields?: SourceField[];
  existingFields?: { name: string; order: number }[];
} = {}): PrismaService {
  const base: any = {
    applicationFormField: {
      findMany: jest.fn().mockImplementation(({ where }: any) =>
        where.programId === 'src'
          ? Promise.resolve(opts.sourceFields ?? [])
          : Promise.resolve(opts.existingFields ?? []),
      ),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest
        .fn()
        .mockImplementation(({ data }: { data: any }) =>
          Promise.resolve({ id: `new-${data.name}`, ...data }),
        ),
    },
  };
  base.$transaction = jest
    .fn()
    .mockImplementation((cb: (tx: any) => Promise<unknown>) => cb(base));
  return base as PrismaService;
}

describe('CopyFieldsFromProgramHandler', () => {
  it('rejects copying a program into itself', async () => {
    const prisma = mkPrisma({ sourceFields: [srcField({})] });
    const h = new CopyFieldsFromProgramHandler(prisma);
    await expect(
      h.execute(new CopyFieldsFromProgramCommand('tgt', 'tgt', undefined, 'append')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects when there are no source fields to copy', async () => {
    const prisma = mkPrisma({ sourceFields: [] });
    const h = new CopyFieldsFromProgramHandler(prisma);
    await expect(
      h.execute(new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append')),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('append adds new fields and skips colliding keys', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'email', order: 0 }),
        srcField({ id: 'f2', name: 'phone', order: 1 }),
      ],
      existingFields: [{ name: 'email', order: 5 }],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    const result = await h.execute(
      new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append'),
    );
    expect(result.added).toEqual(['phone']);
    expect(result.skipped).toEqual(['email']);
    expect((prisma as any).applicationFormField.updateMany).not.toHaveBeenCalled();
    expect((prisma as any).applicationFormField.create).toHaveBeenCalledTimes(1);
  });

  it('append renumbers copied fields after the max existing order', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'a', order: 0 }),
        srcField({ id: 'f2', name: 'b', order: 1 }),
      ],
      existingFields: [{ name: 'x', order: 5 }],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    await h.execute(new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append'));
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(6);
    expect(create.mock.calls[1][0].data.order).toBe(7);
  });

  it('replace soft-deletes existing fields then inserts all source fields from order 0', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'a', order: 3 }),
        srcField({ id: 'f2', name: 'b', order: 9 }),
      ],
      existingFields: [{ name: 'old', order: 0 }],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    const result = await h.execute(
      new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'replace'),
    );
    expect((prisma as any).applicationFormField.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { programId: 'tgt', deletedAt: null },
        data: expect.objectContaining({ deletedAt: expect.any(Date), isActive: false }),
      }),
    );
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data.order).toBe(0);
    expect(create.mock.calls[1][0].data.order).toBe(1);
    expect(result.added).toEqual(['a', 'b']);
  });

  it('copies only the selected fieldIds, preserving source order', async () => {
    const prisma = mkPrisma({
      sourceFields: [
        srcField({ id: 'f1', name: 'a', order: 0 }),
        srcField({ id: 'f2', name: 'b', order: 1 }),
        srcField({ id: 'f3', name: 'c', order: 2 }),
      ],
    });
    const h = new CopyFieldsFromProgramHandler(prisma);
    const result = await h.execute(
      new CopyFieldsFromProgramCommand('tgt', 'src', ['f1', 'f3'], 'append'),
    );
    expect(result.added).toEqual(['a', 'c']);
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
    const h = new CopyFieldsFromProgramHandler(prisma);
    await h.execute(new CopyFieldsFromProgramCommand('tgt', 'src', undefined, 'append'));
    const create = (prisma as any).applicationFormField.create as jest.Mock;
    expect(create.mock.calls[0][0].data).toEqual(
      expect.objectContaining({
        mediaUrl: 'https://cdn/x.png',
        mediaAlt: 'Size guide',
        helpAssets: [{ kind: 'link', label: 'Guide', url: 'https://h' }],
      }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run (from `services/api/`): `npx jest --testPathPattern="copy-fields-from-program.handler.spec"`
Expected: FAIL — cannot find module `./copy-fields-from-program.handler`.

- [ ] **Step 3: Write the handler**

`services/api/src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts`:

```typescript
import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CopyFieldsFromProgramCommand } from '../copy-fields-from-program.command';

type TxLike = PrismaService;

type CopyResult = {
  mode: 'append' | 'replace';
  sourceProgramId: string;
  added: string[];
  skipped: string[];
};

@Injectable()
@CommandHandler(CopyFieldsFromProgramCommand)
export class CopyFieldsFromProgramHandler
  implements ICommandHandler<CopyFieldsFromProgramCommand>
{
  constructor(private readonly prisma: PrismaService) {}

  async execute({
    programId,
    sourceProgramId,
    fieldIds,
    mode,
  }: CopyFieldsFromProgramCommand): Promise<CopyResult> {
    if (sourceProgramId === programId) {
      throw new BadRequestException({
        code: 'invalid_source',
        message: 'Source program must differ from the target program.',
      });
    }

    return this.prisma.$transaction(async (tx: TxLike) => {
      let sourceFields = await tx.applicationFormField.findMany({
        where: { programId: sourceProgramId, deletedAt: null },
        orderBy: { order: 'asc' },
      });

      if (fieldIds && fieldIds.length > 0) {
        const idSet = new Set(fieldIds);
        sourceFields = sourceFields.filter((f: { id: string }) => idSet.has(f.id));
      }

      if (sourceFields.length === 0) {
        throw new BadRequestException({
          code: 'no_fields',
          message: 'No fields to copy from the source program.',
        });
      }

      if (mode === 'replace') {
        await tx.applicationFormField.updateMany({
          where: { programId, deletedAt: null },
          data: { deletedAt: new Date(), isActive: false },
        });
      }

      const existing =
        mode === 'append'
          ? await tx.applicationFormField.findMany({
              where: { programId, deletedAt: null },
              select: { name: true, order: true },
            })
          : [];
      const existingNames = new Set(
        existing.map((f: { name: string }) => f.name),
      );
      const baseOrder =
        mode === 'append'
          ? existing.reduce(
              (max: number, f: { order: number }) => Math.max(max, f.order),
              -1,
            ) + 1
          : 0;

      const added: string[] = [];
      const skipped: string[] = [];
      let placed = 0;

      for (const f of sourceFields) {
        if (existingNames.has(f.name)) {
          skipped.push(f.name);
          continue;
        }
        await tx.applicationFormField.create({
          data: {
            programId,
            name: f.name,
            label: f.label,
            type: f.type,
            section: f.section,
            isRequired: f.isRequired,
            order: baseOrder + placed,
            placeholder: f.placeholder,
            helpText: f.helpText,
            mediaUrl: f.mediaUrl,
            mediaAlt: f.mediaAlt,
            helpAssets: (f.helpAssets as never) ?? [],
            options: (f.options as never) ?? [],
            validationRules: (f.validationRules as never) ?? {},
            source: f.source,
            systemFieldKey: f.systemFieldKey,
          },
        });
        added.push(f.name);
        existingNames.add(f.name);
        placed += 1;
      }

      return { mode, sourceProgramId, added, skipped };
    });
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run (from `services/api/`): `npx jest --testPathPattern="copy-fields-from-program.handler.spec"`
Expected: PASS — 7 passing tests.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.ts src/modules/programs/application/commands/handlers/copy-fields-from-program.handler.spec.ts
git commit -m "feat(programs): add copy-fields-from-program handler with tests"
```

---

## Task 3: Wire the route + register the handler

**Files:**
- Modify: `services/api/src/modules/programs/presentation/program-form-fields.controller.ts`
- Modify: `services/api/src/modules/programs/programs.module.ts`

- [ ] **Step 1: Add imports + route to the controller**

In `program-form-fields.controller.ts`, add these imports near the existing command/DTO imports (lines 15-16):

```typescript
import { CopyFieldsFromProgramCommand } from '../application/commands/copy-fields-from-program.command';
import { CopyFieldsFromProgramDto } from './dto/copy-fields-from-program.dto';
```

Then add this method inside the `ProgramFormFieldsController` class, immediately after the existing `apply(...)` method (after line 45):

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

(`BadRequestException`, `Body`, `Param`, `Post`, `CommandBus`, `ApiOperation` are already imported in this file.)

- [ ] **Step 2: Register the handler in the module**

In `programs.module.ts`, add the import near the other handler imports:

```typescript
import { CopyFieldsFromProgramHandler } from './application/commands/handlers/copy-fields-from-program.handler';
```

Then add `CopyFieldsFromProgramHandler,` to the `providers` array, immediately after the `ApplyFormTemplateHandler,` line (line 189):

```typescript
    ApplyFormTemplateHandler,
    CopyFieldsFromProgramHandler,
```

- [ ] **Step 3: Verify it compiles**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Run the full programs handler tests to confirm nothing broke**

Run (from `services/api/`): `npx jest --testPathPattern="copy-fields-from-program.handler.spec|apply-form-template.handler.spec"`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd services/api
git add src/modules/programs/presentation/program-form-fields.controller.ts src/modules/programs/programs.module.ts
git commit -m "feat(programs): expose POST copy-from-program route"
```

---

## Task 4: Frontend API client functions

**Files:**
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/catalog-api.ts`

- [ ] **Step 1: Add a source-field row type + two functions**

Append to `catalog-api.ts` (it already imports `buildApiUrl`, `getAccessToken` and defines `authHeaders()`):

```typescript
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
  const url = buildApiUrl(`/programs/${programId}/form-fields`);
  const res = await fetch(url, { headers: await authHeaders() });
  if (!res.ok) {
    throw new Error("Failed to load source program fields");
  }
  return res.json();
}

export async function copyFieldsFromProgram(
  programId: string,
  params: { sourceProgramId: string; fieldIds?: string[]; mode: "append" | "replace" },
): Promise<{ mode: string; sourceProgramId: string; added: string[]; skipped: string[] }> {
  const url = buildApiUrl(`/programs/${programId}/form-fields/copy-from-program`);
  const res = await fetch(url, {
    method: "POST",
    headers: await authHeaders(),
    body: JSON.stringify({
      sourceProgramId: params.sourceProgramId,
      ...(params.fieldIds ? { fieldIds: params.fieldIds } : {}),
      mode: params.mode,
      ...(params.mode === "replace" ? { confirm: true } : {}),
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to copy fields from program");
  }
  return res.json();
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors referencing `catalog-api.ts`.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/submissionsMasterData/form-fields/catalog-api.ts
git commit -m "feat(admin): add copyFieldsFromProgram API client"
```

---

## Task 5: The CopyFromProgramDialog component

**Files:**
- Create: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx`

- [ ] **Step 1: Create the component**

`services/admin-dashboard/app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx`:

```tsx
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
  copyFieldsFromProgram,
  fetchProgramFormFields,
  type ProgramFormFieldRow,
} from "./catalog-api";

interface CopyFromProgramDialogProps {
  open: boolean;
  programId: string;
  onClose: () => void;
  onApplied: () => void;
}

export function CopyFromProgramDialog({
  open,
  programId,
  onClose,
  onApplied,
}: CopyFromProgramDialogProps) {
  const { accessiblePrograms } = useAuth();

  const [sourceId, setSourceId] = useState<string | null>(null);
  const [fields, setFields] = useState<ProgramFormFieldRow[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loadingFields, setLoadingFields] = useState(false);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [mode, setMode] = useState<"append" | "replace">("append");
  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);

  const currentBrandId = useMemo(
    () => accessiblePrograms.find((p) => p.programId === programId)?.brandId ?? null,
    [accessiblePrograms, programId],
  );

  const sourceOptions = useMemo(
    () =>
      accessiblePrograms
        .filter((p) => p.programId !== programId)
        .slice()
        .sort((a, b) =>
          a.brandName === b.brandName
            ? b.programYear - a.programYear
            : a.brandName.localeCompare(b.brandName),
        ),
    [accessiblePrograms, programId],
  );

  const selectedSource = useMemo(
    () => accessiblePrograms.find((p) => p.programId === sourceId) ?? null,
    [accessiblePrograms, sourceId],
  );

  // Reset everything when the dialog opens.
  useEffect(() => {
    if (!open) return;
    setSourceId(null);
    setFields([]);
    setSelectedIds(new Set());
    setLoadingFields(false);
    setFieldsError(null);
    setMode("append");
    setConfirmText("");
    setApplying(false);
  }, [open]);

  // Load the source program's fields when the source changes.
  useEffect(() => {
    if (!sourceId) {
      setFields([]);
      setSelectedIds(new Set());
      return;
    }
    setLoadingFields(true);
    setFieldsError(null);
    fetchProgramFormFields(sourceId)
      .then((rows) => {
        setFields(rows);
        setSelectedIds(new Set(rows.map((r) => r.id)));
      })
      .catch((err) =>
        setFieldsError(err instanceof Error ? err.message : "Failed to load fields"),
      )
      .finally(() => setLoadingFields(false));
  }, [sourceId]);

  const allSelected = fields.length > 0 && selectedIds.size === fields.length;

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(fields.map((f) => f.id)));
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
    return fields.some(
      (f) =>
        selectedIds.has(f.id) &&
        (Boolean(f.mediaUrl) || (f.helpAssets?.length ?? 0) > 0),
    );
  }, [selectedSource, currentBrandId, fields, selectedIds]);

  const replaceConfirmed = mode !== "replace" || confirmText.trim().toUpperCase() === "REPLACE";
  const canApply =
    !!sourceId && selectedIds.size > 0 && replaceConfirmed && !applying;

  async function handleApply() {
    if (!sourceId) return;
    setApplying(true);
    try {
      const fieldIds =
        selectedIds.size === fields.length ? undefined : Array.from(selectedIds);
      const result = await copyFieldsFromProgram(programId, {
        sourceProgramId: sourceId,
        fieldIds,
        mode,
      });
      toast.success(
        `Copied ${result.added.length} field(s)` +
          (result.skipped.length ? `, skipped ${result.skipped.length} duplicate(s)` : ""),
      );
      onApplied();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to copy fields");
    } finally {
      setApplying(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => (!v ? onClose() : undefined)}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>Copy from another program</SheetTitle>
          <SheetDescription>
            Copy application form fields from any program you can access into this one.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Source program</label>
            <select
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
              value={sourceId ?? ""}
              onChange={(e) => setSourceId(e.target.value || null)}
            >
              <option value="">Select a program…</option>
              {sourceOptions.map((p) => (
                <option key={p.programId} value={p.programId}>
                  {p.programName} · {p.brandName}
                </option>
              ))}
            </select>
          </div>

          {loadingFields && <p className="text-sm text-slate-500">Loading fields…</p>}
          {fieldsError && <p className="text-sm text-red-600">{fieldsError}</p>}

          {!loadingFields && !fieldsError && fields.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700">
                  Fields ({selectedIds.size}/{fields.length})
                </label>
                <button
                  type="button"
                  className="text-sm text-blue-600 hover:underline"
                  onClick={toggleAll}
                >
                  {allSelected ? "Deselect all" : "Select all"}
                </button>
              </div>
              <ul className="max-h-72 space-y-1 overflow-y-auto rounded-md border border-slate-200 p-2">
                {fields.map((f) => (
                  <li key={f.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(f.id)}
                        onChange={() => toggleOne(f.id)}
                      />
                      <span className="text-sm text-slate-800">{f.label}</span>
                      <span className="text-xs text-slate-400">
                        {f.fieldName} · {f.fieldType}
                        {f.section ? ` · ${f.section}` : ""}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {fields.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="text-sm font-medium text-slate-700">Mode</legend>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="copy-mode"
                  checked={mode === "append"}
                  onChange={() => setMode("append")}
                />
                Append (add new fields, skip ones that already exist)
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="copy-mode"
                  checked={mode === "replace"}
                  onChange={() => setMode("replace")}
                />
                Replace (remove this program&apos;s current fields first)
              </label>
            </fieldset>
          )}

          {mode === "replace" && (
            <div className="space-y-2 rounded-md border border-amber-300 bg-amber-50 p-3">
              <p className="text-sm text-amber-800">
                Replace removes this program&apos;s existing fields. If participants have
                already submitted answers, those answers are kept but may become hidden or
                no longer match the new fields. Type <strong>REPLACE</strong> to confirm.
              </p>
              <input
                type="text"
                className="w-full rounded-md border border-amber-300 px-3 py-2 text-sm"
                placeholder="REPLACE"
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
              />
            </div>
          )}

          {crossBrandMediaWarning && (
            <p className="text-xs text-slate-500">
              Some selected fields reference media from another brand&apos;s storage. The
              images will work, but consider re-uploading them under this brand.
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              className="rounded-md border border-slate-300 px-4 py-2 text-sm"
              onClick={onClose}
              disabled={applying}
            >
              Cancel
            </button>
            <button
              type="button"
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              onClick={handleApply}
              disabled={!canApply}
            >
              {applying ? "Copying…" : "Copy fields"}
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
```

- [ ] **Step 2: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors. If `@/src/ui/sheet` exports differ, match the imports used by `CopyFromTemplateDialog.tsx` exactly.

- [ ] **Step 3: Commit**

```bash
cd services/admin-dashboard
git add app/components/submissionsMasterData/form-fields/CopyFromProgramDialog.tsx
git commit -m "feat(admin): add CopyFromProgramDialog"
```

---

## Task 6: Wire the button into FormFieldsTable

**Files:**
- Modify: `services/admin-dashboard/app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx`

- [ ] **Step 1: Import the new dialog**

Add near the existing `CopyFromTemplateDialog` import in `FormFieldsTable.tsx`:

```tsx
import { CopyFromProgramDialog } from "./CopyFromProgramDialog";
```

- [ ] **Step 2: Add state**

Next to the existing `const [copyTemplateOpen, setCopyTemplateOpen] = useState(false);`, add:

```tsx
const [copyFromProgramOpen, setCopyFromProgramOpen] = useState(false);
```

- [ ] **Step 3: Add the button**

Duplicate the existing "Copy from template" button element (keep its exact element type and CSS classes), placing the copy immediately before or after it, and change only its label and click handler:

```tsx
{/* mirror the existing "Copy from template" button's element + classes */}
<button
  type="button"
  onClick={() => setCopyFromProgramOpen(true)}
  /* ...same className as the existing Copy from template button... */
>
  Copy from program
</button>
```

- [ ] **Step 4: Render the dialog**

Immediately after the existing `<CopyFromTemplateDialog ... />` render block (around lines 405-413), add:

```tsx
<CopyFromProgramDialog
  open={copyFromProgramOpen}
  programId={programId}
  onClose={() => setCopyFromProgramOpen(false)}
  onApplied={() => {
    setCopyFromProgramOpen(false);
    void loadFields();
  }}
/>
```

- [ ] **Step 5: Verify it compiles**

Run (from `services/admin-dashboard/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd services/admin-dashboard
git add app/components/submissionsMasterData/form-fields/FormFieldsTable.tsx
git commit -m "feat(admin): add Copy from program button to form fields tab"
```

---

## Task 7: End-to-end manual verification

**No code changes — verification only.**

- [ ] **Step 1: Backend test sweep**

Run (from `services/api/`): `npx jest --testPathPattern="copy-fields-from-program"`
Expected: PASS (7 tests).

- [ ] **Step 2: Both services typecheck clean**

Run (from `services/api/`): `npx tsc --noEmit -p tsconfig.json` → no errors.
Run (from `services/admin-dashboard/`): `npx tsc --noEmit` → no errors.

- [ ] **Step 3: Manual smoke (against a running dev stack)**

1. Open a program's Master Data > Submission Form > Form Fields tab.
2. Click "Copy from program". Confirm the source dropdown lists other programs across brands and excludes the current one.
3. Pick a source with fields; confirm fields load and all are pre-selected; deselect a few.
4. Append mode → "Copy fields"; confirm new fields appear (duplicates by key are skipped, surfaced in the toast) and ordering lands after existing fields.
5. Repeat with Replace mode into a throwaway program; confirm the REPLACE-to-confirm gate and that the table is replaced.
6. Copy a field with media from a different brand; confirm the cross-brand media note appears.

- [ ] **Step 4: Update the Obsidian note**

Append a short entry to `01 - Notes/YBB Platform.md` summarizing the feature, endpoint, and files touched.

---

## Notes / deliberate scope decisions

- **Submission-count display:** The spec mentioned surfacing the exact participant submission count in the replace warning. To avoid adding a new read endpoint for a non-critical hint, this plan ships a clear generic replace warning + type-to-confirm (matching the existing template flow). Surfacing an exact count is a low-priority follow-up if a cheap count source is later confirmed.
- **System fields:** copied by carrying the source row's `source`/`systemFieldKey` and its already-resolved `type`/`options`/`label` directly. No catalog re-resolution (the source row already reflects what that program shows).
- **No migration:** purely additive; no schema change.
