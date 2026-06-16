# LOA On-Demand Download + Release Batches — Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax.

**Goal:** Replace the admin-generate-and-email LOA model with participant self-serve on-demand PDF streaming, gated by admin-managed submission-date-range release batches. **Architecture:** The NestJS API adds a new portal download endpoint (eligibility gate → lazy document_number assignment → FileServiceClient.generateLoa → StreamableFile) and admin CRUD endpoints for release batches; the admin dashboard gets a reworked 3-tab LOA page (Template | Batches | Downloads); the participant portal gets a BFF route and eligibility-aware Documents tab. **Tech Stack:** NestJS (CQRS, Prisma, @nestjs/throttler), Next.js 16 (admin), Next.js 14 (portal), FastAPI/WeasyPrint (renderer, unchanged), PostgreSQL.

---

## File Structure

### services/api — Create
- `src/prisma/schema/loa-release-batch.prisma` — Prisma model for loa_release_batches table
- `prisma/migrations/20260616100000_loa_release_batches/migration.sql` — idempotent SQL to create table + indexes
- `prisma/migrations/20260616100100_participant_document_loa_columns/migration.sql` — idempotent SQL to add download tracking + batch FK columns
- `src/modules/manage-program-content/infrastructure/loa-release-batch.repository.ts` — repository for batch CRUD + overlap query
- `src/modules/manage-program-content/infrastructure/loa-release-batch.repository.spec.ts` — unit tests for repository with mocked Prisma
- `src/modules/manage-program-content/application/commands/loa-batch.commands.ts` — CreateLoaBatchCommand, UpdateLoaBatchCommand, ReleaseLoaBatchCommand, UnreleaseLoaBatchCommand, DeleteLoaBatchCommand
- `src/modules/manage-program-content/application/queries/loa-batch.queries.ts` — GetLoaBatchesQuery, GetLoaDownloadsQuery
- `src/modules/manage-program-content/application/handlers/loa-batch.handlers.ts` — all batch command + query handlers
- `src/modules/manage-program-content/application/handlers/loa-batch.handlers.spec.ts` — handler unit tests
- `src/modules/manage-program-content/application/dtos/loa-batch.dto.ts` — CreateLoaBatchDto, UpdateLoaBatchDto, LoaBatchResponseDto, LoaDownloadResponseDto
- `src/modules/portal/application/services/loa-eligibility.service.ts` — eligibility gate logic
- `src/modules/portal/application/services/loa-eligibility.service.spec.ts` — eligibility unit tests (all status × batch × date-range combos)
- `src/modules/portal/application/services/loa-document-number.service.ts` — assign-once document number logic
- `src/modules/portal/application/services/loa-document-number.service.spec.ts` — unit tests for assign/reuse paths
- `scripts/cleanup-loa-file-urls.ts` — post-cutover one-off script to null fileUrls and delete MinIO objects

### services/api — Modify
- `src/prisma/schema/participant-document.prisma` — add downloadCount, firstDownloadedAt, lastDownloadedAt, loaReleaseBatchId fields
- `src/modules/manage-program-content/presentation/manage-program.controller.ts` — add 7 batch + downloads routes
- `src/modules/portal/presentation/portal.controller.ts` — add `GET loa/download` endpoint; remove `/viewed` endpoint
- `src/modules/portal/application/handlers/get-portal-documents.handler.ts` — replace fileUrl check with eligibility check for LOA; surface downloadable flag
- `src/modules/manage-program-content/application/handlers/manage-program-content.handlers.ts` — remove loa_ready event emit + MinIO upload step from GenerateLOAHandler
- `src/modules/notification/application/services/notification.service.ts` — remove sendLoaReadyEmail()

### services/api — Delete
- `src/modules/notification/application/handlers/loa-ready.handler.ts`
- `src/modules/notification/templates/loa-ready.hbs`
- `src/modules/portal/application/handlers/mark-document-viewed.handler.ts` (if exists as standalone)

### services/admin-dashboard — Create
- `app/components/documents/LoaBatchesTab.tsx` — batch list table with release toggle + create/edit actions
- `app/components/documents/LoaBatchDialog.tsx` — create/edit batch form dialog with overlap error display

### services/admin-dashboard — Modify
- `src/shared/api-client.ts` — add getLoaBatches, createLoaBatch, updateLoaBatch, releaseLoaBatch, unreleaseLoaBatch, deleteLoaBatch, getLoaDownloads; remove generateLoa, sendLoa, bulkSendLoa, getLOAStatus
- `app/programs/[programId]/documents/loa-template/page.tsx` — rework from 2 to 3 tabs (Template | Batches | Downloads); remove StatCards, GenerateLoaDialog, LoaRecipientDrawer
- `app/components/documents/LoaStatusTable.tsx` — repurpose for read-only Downloads view (new columns, no send actions)

### services/admin-dashboard — Delete
- `app/components/documents/GenerateLoaDialog.tsx`
- `app/components/documents/LoaRecipientDrawer.tsx`

### ybb-program-next — Create
- `app/api/portal/loa/download/route.ts` — BFF GET route that forwards auth + pipes binary PDF response

### ybb-program-next — Modify
- `components/dashboard/sections/DocumentsSection.tsx` — eligibility-aware LOA card (download button vs locked state); remove markDocumentViewed for LOA

---

## Task 1: loa_release_batches table — Prisma model + idempotent SQL migration [Phase A]

**Files:**
- Create: `services/api/src/prisma/schema/loa-release-batch.prisma` — Prisma model
- Create: `services/api/prisma/migrations/20260616100000_loa_release_batches/migration.sql` — idempotent DDL

**Steps:**

- [ ] Write the Prisma model file
  ```prisma
  // services/api/src/prisma/schema/loa-release-batch.prisma
  model LoaReleaseBatch {
    id             String    @id @default(uuid())
    programId      String    @map("program_id")
    name           String
    submissionFrom DateTime  @map("submission_from") @db.Timestamptz
    submissionTo   DateTime  @map("submission_to") @db.Timestamptz
    releasedAt     DateTime? @map("released_at") @db.Timestamptz
    createdBy      String    @map("created_by")
    createdAt      DateTime  @default(now()) @map("created_at") @db.Timestamptz
    updatedAt      DateTime  @updatedAt @map("updated_at") @db.Timestamptz
    deletedAt      DateTime? @map("deleted_at") @db.Timestamptz

    program              Program               @relation(fields: [programId], references: [id])
    participantDocuments ParticipantDocument[]

    @@map("loa_release_batches")
  }
  ```

- [ ] Write the SQL migration (idempotent — safe on re-run and safe for `prisma migrate deploy` on boot)
  ```sql
  -- Migration: loa_release_batches
  -- Created: 2026-06-16

  CREATE TABLE IF NOT EXISTS loa_release_batches (
    id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    program_id      UUID        NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
    name            TEXT        NOT NULL,
    submission_from TIMESTAMPTZ NOT NULL,
    submission_to   TIMESTAMPTZ NOT NULL,
    released_at     TIMESTAMPTZ NULL,
    created_by      UUID        NOT NULL,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at      TIMESTAMPTZ NULL
  );

  CREATE INDEX IF NOT EXISTS idx_loa_release_batches_program_id
    ON loa_release_batches(program_id);

  CREATE INDEX IF NOT EXISTS idx_loa_release_batches_program_range
    ON loa_release_batches(program_id, submission_from, submission_to)
    WHERE deleted_at IS NULL;
  ```

- [ ] Add the `LoaReleaseBatch` relation to the `Program` model in `src/prisma/schema/program.prisma`:
  ```prisma
  // Add inside the Program model body:
  loaReleaseBatches LoaReleaseBatch[]
  ```

- [ ] Verify Prisma schema generates without errors (no DB needed for format check):
  ```
  Run: cd services/api && npx prisma format
  Expected: "Formatted successfully" with no errors
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/prisma/schema/loa-release-batch.prisma \
        services/api/src/prisma/schema/program.prisma \
        services/api/prisma/migrations/20260616100000_loa_release_batches/migration.sql
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add loa_release_batches table — Prisma model + idempotent SQL migration"
  ```

---

## Task 2: Add LOA tracking columns to participant_documents [Phase A]

**Files:**
- Modify: `services/api/src/prisma/schema/participant-document.prisma` — add 4 new fields
- Create: `services/api/prisma/migrations/20260616100100_participant_document_loa_columns/migration.sql` — idempotent ALTER TABLE

**Steps:**

- [ ] Write the SQL migration:
  ```sql
  -- Migration: participant_document_loa_columns
  -- Created: 2026-06-16

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'participant_documents' AND column_name = 'download_count'
    ) THEN
      ALTER TABLE participant_documents ADD COLUMN download_count INT NOT NULL DEFAULT 0;
    END IF;
  END $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'participant_documents' AND column_name = 'first_downloaded_at'
    ) THEN
      ALTER TABLE participant_documents ADD COLUMN first_downloaded_at TIMESTAMPTZ NULL;
    END IF;
  END $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'participant_documents' AND column_name = 'last_downloaded_at'
    ) THEN
      ALTER TABLE participant_documents ADD COLUMN last_downloaded_at TIMESTAMPTZ NULL;
    END IF;
  END $$;

  DO $$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'participant_documents' AND column_name = 'loa_release_batch_id'
    ) THEN
      ALTER TABLE participant_documents
        ADD COLUMN loa_release_batch_id UUID NULL
        REFERENCES loa_release_batches(id) ON DELETE SET NULL;
    END IF;
  END $$;
  ```

- [ ] Update the Prisma model in `src/prisma/schema/participant-document.prisma` — add after the `emailedAt` field:
  ```prisma
  downloadCount       Int       @default(0) @map("download_count")
  firstDownloadedAt   DateTime? @map("first_downloaded_at") @db.Timestamptz
  lastDownloadedAt    DateTime? @map("last_downloaded_at") @db.Timestamptz
  loaReleaseBatchId   String?   @map("loa_release_batch_id")
  loaReleaseBatch     LoaReleaseBatch? @relation(fields: [loaReleaseBatchId], references: [id])
  ```

- [ ] Verify Prisma format:
  ```
  Run: cd services/api && npx prisma format
  Expected: "Formatted successfully"
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/prisma/schema/participant-document.prisma \
        services/api/prisma/migrations/20260616100100_participant_document_loa_columns/migration.sql
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add download tracking + loa_release_batch_id columns to participant_documents"
  ```

---

## Task 3: LoaReleaseBatch repository [Phase B]

**Files:**
- Create: `services/api/src/modules/manage-program-content/infrastructure/loa-release-batch.repository.ts`
- Create: `services/api/src/modules/manage-program-content/infrastructure/loa-release-batch.repository.spec.ts`

**Steps:**

- [ ] Write the failing test first:
  ```typescript
  // loa-release-batch.repository.spec.ts
  import { Test } from '@nestjs/testing';
  import { PrismaService } from '@/shared/database/prisma.service';
  import { LoaReleaseBatchRepository } from './loa-release-batch.repository';

  describe('LoaReleaseBatchRepository', () => {
    let repo: LoaReleaseBatchRepository;
    let prisma: jest.Mocked<PrismaService>;

    const mockBatch = {
      id: 'batch-1',
      programId: 'prog-1',
      name: 'Wave 1',
      submissionFrom: new Date('2026-01-01'),
      submissionTo: new Date('2026-03-31'),
      releasedAt: null,
      createdBy: 'admin-1',
      createdAt: new Date(),
      updatedAt: new Date(),
      deletedAt: null,
    };

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          LoaReleaseBatchRepository,
          {
            provide: PrismaService,
            useValue: {
              loaReleaseBatch: {
                findMany: jest.fn(),
                findFirst: jest.fn(),
                create: jest.fn(),
                update: jest.fn(),
              },
            },
          },
        ],
      }).compile();
      repo = module.get(LoaReleaseBatchRepository);
      prisma = module.get(PrismaService);
    });

    it('findByProgram returns active batches for a program', async () => {
      (prisma.loaReleaseBatch.findMany as jest.Mock).mockResolvedValue([mockBatch]);
      const result = await repo.findByProgram('prog-1');
      expect(prisma.loaReleaseBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ programId: 'prog-1', deletedAt: null }) }),
      );
      expect(result).toHaveLength(1);
    });

    it('findOverlapping returns batches whose range overlaps the given range', async () => {
      (prisma.loaReleaseBatch.findMany as jest.Mock).mockResolvedValue([mockBatch]);
      const result = await repo.findOverlapping('prog-1', new Date('2026-02-01'), new Date('2026-04-30'));
      expect(result).toHaveLength(1);
    });

    it('findOverlapping excludes the given excludeId', async () => {
      (prisma.loaReleaseBatch.findMany as jest.Mock).mockResolvedValue([]);
      await repo.findOverlapping('prog-1', new Date('2026-02-01'), new Date('2026-04-30'), 'batch-1');
      expect(prisma.loaReleaseBatch.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ NOT: { id: 'batch-1' } }),
        }),
      );
    });

    it('create saves a new batch', async () => {
      (prisma.loaReleaseBatch.create as jest.Mock).mockResolvedValue(mockBatch);
      const result = await repo.create({
        programId: 'prog-1',
        name: 'Wave 1',
        submissionFrom: new Date('2026-01-01'),
        submissionTo: new Date('2026-03-31'),
        createdBy: 'admin-1',
      });
      expect(prisma.loaReleaseBatch.create).toHaveBeenCalled();
      expect(result.name).toBe('Wave 1');
    });

    it('release sets releasedAt to now', async () => {
      (prisma.loaReleaseBatch.update as jest.Mock).mockResolvedValue({ ...mockBatch, releasedAt: new Date() });
      await repo.release('batch-1');
      expect(prisma.loaReleaseBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'batch-1' }, data: expect.objectContaining({ releasedAt: expect.any(Date) }) }),
      );
    });

    it('unrelease clears releasedAt', async () => {
      (prisma.loaReleaseBatch.update as jest.Mock).mockResolvedValue({ ...mockBatch, releasedAt: null });
      await repo.unrelease('batch-1');
      expect(prisma.loaReleaseBatch.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'batch-1' }, data: { releasedAt: null } }),
      );
    });
  });
  ```

- [ ] Run test — expect FAIL (class does not exist yet):
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-release-batch.repository.spec
  Expected: FAIL — "Cannot find module './loa-release-batch.repository'"
  ```

- [ ] Implement the repository:
  ```typescript
  // loa-release-batch.repository.ts
  import { Injectable } from '@nestjs/common';
  import { PrismaService } from '@/shared/database/prisma.service';

  export interface CreateLoaBatchData {
    programId: string;
    name: string;
    submissionFrom: Date;
    submissionTo: Date;
    createdBy: string;
  }

  export interface UpdateLoaBatchData {
    name?: string;
    submissionFrom?: Date;
    submissionTo?: Date;
  }

  @Injectable()
  export class LoaReleaseBatchRepository {
    constructor(private readonly prisma: PrismaService) {}

    async findByProgram(programId: string) {
      return this.prisma.loaReleaseBatch.findMany({
        where: { programId, deletedAt: null },
        orderBy: { submissionFrom: 'asc' },
      });
    }

    async findById(id: string) {
      return this.prisma.loaReleaseBatch.findFirst({
        where: { id, deletedAt: null },
      });
    }

    async findOverlapping(
      programId: string,
      from: Date,
      to: Date,
      excludeId?: string,
    ) {
      return this.prisma.loaReleaseBatch.findMany({
        where: {
          programId,
          deletedAt: null,
          ...(excludeId ? { NOT: { id: excludeId } } : {}),
          // overlap: existing.from <= to AND existing.to >= from
          submissionFrom: { lte: to },
          submissionTo: { gte: from },
        },
      });
    }

    async create(data: CreateLoaBatchData) {
      return this.prisma.loaReleaseBatch.create({ data });
    }

    async update(id: string, data: UpdateLoaBatchData) {
      return this.prisma.loaReleaseBatch.update({ where: { id }, data });
    }

    async release(id: string) {
      return this.prisma.loaReleaseBatch.update({
        where: { id },
        data: { releasedAt: new Date() },
      });
    }

    async unrelease(id: string) {
      return this.prisma.loaReleaseBatch.update({
        where: { id },
        data: { releasedAt: null },
      });
    }

    async softDelete(id: string) {
      return this.prisma.loaReleaseBatch.update({
        where: { id },
        data: { deletedAt: new Date() },
      });
    }
  }
  ```

- [ ] Run test — expect PASS:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-release-batch.repository.spec
  Expected: PASS — 6 passing
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/manage-program-content/infrastructure/loa-release-batch.repository.ts \
        services/api/src/modules/manage-program-content/infrastructure/loa-release-batch.repository.spec.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add LoaReleaseBatchRepository with overlap detection"
  ```

---

## Task 4: Batch CRUD commands + query handlers [Phase B]

**Files:**
- Create: `services/api/src/modules/manage-program-content/application/commands/loa-batch.commands.ts`
- Create: `services/api/src/modules/manage-program-content/application/queries/loa-batch.queries.ts`
- Create: `services/api/src/modules/manage-program-content/application/handlers/loa-batch.handlers.ts`
- Create: `services/api/src/modules/manage-program-content/application/handlers/loa-batch.handlers.spec.ts`
- Create: `services/api/src/modules/manage-program-content/application/dtos/loa-batch.dto.ts`

**Steps:**

- [ ] Write commands and query classes:
  ```typescript
  // loa-batch.commands.ts
  export class CreateLoaBatchCommand {
    constructor(
      public readonly programId: string,
      public readonly name: string,
      public readonly submissionFrom: Date,
      public readonly submissionTo: Date,
      public readonly adminUserId: string,
    ) {}
  }

  export class UpdateLoaBatchCommand {
    constructor(
      public readonly batchId: string,
      public readonly programId: string,
      public readonly name?: string,
      public readonly submissionFrom?: Date,
      public readonly submissionTo?: Date,
    ) {}
  }

  export class ReleaseLoaBatchCommand {
    constructor(public readonly batchId: string, public readonly programId: string) {}
  }

  export class UnreleaseLoaBatchCommand {
    constructor(public readonly batchId: string, public readonly programId: string) {}
  }

  export class DeleteLoaBatchCommand {
    constructor(public readonly batchId: string, public readonly programId: string) {}
  }
  ```

  ```typescript
  // loa-batch.queries.ts
  export class GetLoaBatchesQuery {
    constructor(public readonly programId: string) {}
  }

  export class GetLoaDownloadsQuery {
    constructor(public readonly programId: string) {}
  }
  ```

- [ ] Write DTOs:
  ```typescript
  // loa-batch.dto.ts
  import { IsString, IsDateString, IsOptional } from 'class-validator';

  export class CreateLoaBatchDto {
    @IsString() name: string;
    @IsDateString() submissionFrom: string;
    @IsDateString() submissionTo: string;
  }

  export class UpdateLoaBatchDto {
    @IsOptional() @IsString() name?: string;
    @IsOptional() @IsDateString() submissionFrom?: string;
    @IsOptional() @IsDateString() submissionTo?: string;
  }

  export class LoaBatchResponseDto {
    id: string;
    programId: string;
    name: string;
    submissionFrom: Date;
    submissionTo: Date;
    releasedAt: Date | null;
    eligibleCount: number;
    downloadedCount: number;
    createdAt: Date;
  }

  export class LoaDownloadResponseDto {
    participantName: string;
    email: string;
    batchName: string | null;
    documentNumber: string;
    firstDownloadedAt: Date | null;
    downloadCount: number;
  }
  ```

- [ ] Write the failing handler tests:
  ```typescript
  // loa-batch.handlers.spec.ts
  import { Test } from '@nestjs/testing';
  import { ForbiddenException, NotFoundException } from '@nestjs/common';
  import {
    CreateLoaBatchHandler,
    UpdateLoaBatchHandler,
    ReleaseLoaBatchHandler,
    UnreleaseLoaBatchHandler,
    DeleteLoaBatchHandler,
    GetLoaBatchesHandler,
    GetLoaDownloadsHandler,
  } from './loa-batch.handlers';
  import { LoaReleaseBatchRepository } from '../../infrastructure/loa-release-batch.repository';

  describe('CreateLoaBatchHandler', () => {
    let handler: CreateLoaBatchHandler;
    let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          CreateLoaBatchHandler,
          {
            provide: LoaReleaseBatchRepository,
            useValue: {
              findOverlapping: jest.fn(),
              create: jest.fn(),
            },
          },
        ],
      }).compile();
      handler = module.get(CreateLoaBatchHandler);
      mockRepo = module.get(LoaReleaseBatchRepository);
    });

    it('creates a batch when no overlap exists', async () => {
      mockRepo.findOverlapping.mockResolvedValue([]);
      mockRepo.create.mockResolvedValue({
        id: 'batch-1', programId: 'prog-1', name: 'Wave 1',
        submissionFrom: new Date('2026-01-01'), submissionTo: new Date('2026-03-31'),
        releasedAt: null, createdBy: 'admin-1', createdAt: new Date(), updatedAt: new Date(), deletedAt: null,
      });
      const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
      const result = await handler.execute(
        new CreateLoaBatchCommand('prog-1', 'Wave 1', new Date('2026-01-01'), new Date('2026-03-31'), 'admin-1'),
      );
      expect(result.name).toBe('Wave 1');
    });

    it('throws ForbiddenException when batch ranges overlap', async () => {
      mockRepo.findOverlapping.mockResolvedValue([{ id: 'existing', name: 'Existing' } as any]);
      const { CreateLoaBatchCommand } = await import('../commands/loa-batch.commands');
      await expect(
        handler.execute(
          new CreateLoaBatchCommand('prog-1', 'Wave 2', new Date('2026-02-01'), new Date('2026-04-30'), 'admin-1'),
        ),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  describe('ReleaseLoaBatchHandler', () => {
    let handler: ReleaseLoaBatchHandler;
    let mockRepo: jest.Mocked<LoaReleaseBatchRepository>;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          ReleaseLoaBatchHandler,
          { provide: LoaReleaseBatchRepository, useValue: { findById: jest.fn(), release: jest.fn() } },
        ],
      }).compile();
      handler = module.get(ReleaseLoaBatchHandler);
      mockRepo = module.get(LoaReleaseBatchRepository);
    });

    it('releases the batch', async () => {
      mockRepo.findById.mockResolvedValue({ id: 'batch-1', programId: 'prog-1' } as any);
      mockRepo.release.mockResolvedValue({ id: 'batch-1', releasedAt: new Date() } as any);
      const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
      await handler.execute(new ReleaseLoaBatchCommand('batch-1', 'prog-1'));
      expect(mockRepo.release).toHaveBeenCalledWith('batch-1');
    });

    it('throws NotFoundException for unknown batch', async () => {
      mockRepo.findById.mockResolvedValue(null);
      const { ReleaseLoaBatchCommand } = await import('../commands/loa-batch.commands');
      await expect(handler.execute(new ReleaseLoaBatchCommand('bad-id', 'prog-1'))).rejects.toThrow(NotFoundException);
    });
  });
  ```

- [ ] Run tests — expect FAIL:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-batch.handlers.spec
  Expected: FAIL — "Cannot find module './loa-batch.handlers'"
  ```

- [ ] Implement all handlers:
  ```typescript
  // loa-batch.handlers.ts
  import { CommandHandler, ICommandHandler, QueryHandler, IQueryHandler } from '@nestjs/cqrs';
  import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
  import { PrismaService } from '@/shared/database/prisma.service';
  import { LoaReleaseBatchRepository } from '../../infrastructure/loa-release-batch.repository';
  import {
    CreateLoaBatchCommand, UpdateLoaBatchCommand, ReleaseLoaBatchCommand,
    UnreleaseLoaBatchCommand, DeleteLoaBatchCommand,
  } from '../commands/loa-batch.commands';
  import { GetLoaBatchesQuery, GetLoaDownloadsQuery } from '../queries/loa-batch.queries';
  import { DocumentType } from '@prisma/client';

  @CommandHandler(CreateLoaBatchCommand)
  export class CreateLoaBatchHandler implements ICommandHandler<CreateLoaBatchCommand> {
    constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

    async execute(command: CreateLoaBatchCommand) {
      const { programId, name, submissionFrom, submissionTo, adminUserId } = command;
      const overlapping = await this.batchRepo.findOverlapping(programId, submissionFrom, submissionTo);
      if (overlapping.length > 0) {
        throw new ForbiddenException(
          `Batch date range overlaps with existing batch "${overlapping[0].name}"`,
        );
      }
      return this.batchRepo.create({ programId, name, submissionFrom, submissionTo, createdBy: adminUserId });
    }
  }

  @CommandHandler(UpdateLoaBatchCommand)
  export class UpdateLoaBatchHandler implements ICommandHandler<UpdateLoaBatchCommand> {
    constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

    async execute(command: UpdateLoaBatchCommand) {
      const { batchId, programId, name, submissionFrom, submissionTo } = command;
      const existing = await this.batchRepo.findById(batchId);
      if (!existing || existing.programId !== programId) throw new NotFoundException('Batch not found');

      const from = submissionFrom ?? existing.submissionFrom;
      const to = submissionTo ?? existing.submissionTo;
      const overlapping = await this.batchRepo.findOverlapping(programId, from, to, batchId);
      if (overlapping.length > 0) {
        throw new ForbiddenException(
          `Batch date range overlaps with existing batch "${overlapping[0].name}"`,
        );
      }
      return this.batchRepo.update(batchId, { name, submissionFrom, submissionTo });
    }
  }

  @CommandHandler(ReleaseLoaBatchCommand)
  export class ReleaseLoaBatchHandler implements ICommandHandler<ReleaseLoaBatchCommand> {
    constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

    async execute(command: ReleaseLoaBatchCommand) {
      const batch = await this.batchRepo.findById(command.batchId);
      if (!batch || batch.programId !== command.programId) throw new NotFoundException('Batch not found');
      return this.batchRepo.release(command.batchId);
    }
  }

  @CommandHandler(UnreleaseLoaBatchCommand)
  export class UnreleaseLoaBatchHandler implements ICommandHandler<UnreleaseLoaBatchCommand> {
    constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

    async execute(command: UnreleaseLoaBatchCommand) {
      const batch = await this.batchRepo.findById(command.batchId);
      if (!batch || batch.programId !== command.programId) throw new NotFoundException('Batch not found');
      return this.batchRepo.unrelease(command.batchId);
    }
  }

  @CommandHandler(DeleteLoaBatchCommand)
  export class DeleteLoaBatchHandler implements ICommandHandler<DeleteLoaBatchCommand> {
    constructor(private readonly batchRepo: LoaReleaseBatchRepository) {}

    async execute(command: DeleteLoaBatchCommand) {
      const batch = await this.batchRepo.findById(command.batchId);
      if (!batch || batch.programId !== command.programId) throw new NotFoundException('Batch not found');
      return this.batchRepo.softDelete(command.batchId);
    }
  }

  @QueryHandler(GetLoaBatchesQuery)
  export class GetLoaBatchesHandler implements IQueryHandler<GetLoaBatchesQuery> {
    constructor(
      private readonly batchRepo: LoaReleaseBatchRepository,
      private readonly prisma: PrismaService,
    ) {}

    async execute(query: GetLoaBatchesQuery) {
      const batches = await this.batchRepo.findByProgram(query.programId);
      return Promise.all(
        batches.map(async (batch) => {
          const [eligibleCount, downloadedCount] = await Promise.all([
            this.prisma.participantApplication.count({
              where: {
                programId: query.programId,
                status: { in: ['submitted', 'accepted'] },
                submissionDate: { gte: batch.submissionFrom, lte: batch.submissionTo },
              },
            }),
            this.prisma.participantDocument.count({
              where: { loaReleaseBatchId: batch.id, downloadCount: { gt: 0 } },
            }),
          ]);
          return { ...batch, eligibleCount, downloadedCount };
        }),
      );
    }
  }

  @QueryHandler(GetLoaDownloadsQuery)
  export class GetLoaDownloadsHandler implements IQueryHandler<GetLoaDownloadsQuery> {
    constructor(private readonly prisma: PrismaService) {}

    async execute(query: GetLoaDownloadsQuery) {
      const docs = await this.prisma.participantDocument.findMany({
        where: {
          type: DocumentType.letter_of_acceptance,
          application: { programId: query.programId },
        },
        include: {
          application: { include: { user: true } },
          loaReleaseBatch: true,
        },
        orderBy: { firstDownloadedAt: 'desc' },
      });

      return docs.map((doc) => ({
        participantName: doc.application.user.name,
        email: doc.application.user.email,
        batchName: doc.loaReleaseBatch?.name ?? null,
        documentNumber: doc.documentNumber,
        firstDownloadedAt: doc.firstDownloadedAt,
        downloadCount: doc.downloadCount,
      }));
    }
  }
  ```

- [ ] Run tests — expect PASS:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-batch.handlers.spec
  Expected: PASS — all tests passing
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/manage-program-content/application/
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add LOA batch CQRS commands, queries, and handlers with overlap validation"
  ```

---

## Task 5: Admin controller routes for batches + downloads [Phase B]

**Files:**
- Modify: `services/api/src/modules/manage-program-content/presentation/manage-program.controller.ts` — add 7 routes at end of controller

**Steps:**

- [ ] Add imports at the top of `manage-program.controller.ts` (after existing imports):
  ```typescript
  import { CreateLoaBatchDto, UpdateLoaBatchDto } from '../application/dtos/loa-batch.dto';
  import {
    CreateLoaBatchCommand, UpdateLoaBatchCommand, ReleaseLoaBatchCommand,
    UnreleaseLoaBatchCommand, DeleteLoaBatchCommand,
  } from '../application/commands/loa-batch.commands';
  import { GetLoaBatchesQuery, GetLoaDownloadsQuery } from '../application/queries/loa-batch.queries';
  ```

- [ ] Add the 7 routes inside the controller class body (after existing LOA-related routes):
  ```typescript
  // --- LOA Release Batches ---

  @Get(':programId/loa-batches')
  async getLoaBatches(@Param('programId') programId: string) {
    return this.queryBus.execute(new GetLoaBatchesQuery(programId));
  }

  @Post(':programId/loa-batches')
  async createLoaBatch(
    @Param('programId') programId: string,
    @Body() dto: CreateLoaBatchDto,
    @CurrentUser() user: JwtPayload,
  ) {
    return this.commandBus.execute(
      new CreateLoaBatchCommand(
        programId,
        dto.name,
        new Date(dto.submissionFrom),
        new Date(dto.submissionTo),
        user.sub,
      ),
    );
  }

  @Put(':programId/loa-batches/:batchId')
  async updateLoaBatch(
    @Param('programId') programId: string,
    @Param('batchId') batchId: string,
    @Body() dto: UpdateLoaBatchDto,
  ) {
    return this.commandBus.execute(
      new UpdateLoaBatchCommand(
        batchId,
        programId,
        dto.name,
        dto.submissionFrom ? new Date(dto.submissionFrom) : undefined,
        dto.submissionTo ? new Date(dto.submissionTo) : undefined,
      ),
    );
  }

  @Post(':programId/loa-batches/:batchId/release')
  async releaseLoaBatch(
    @Param('programId') programId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.commandBus.execute(new ReleaseLoaBatchCommand(batchId, programId));
  }

  @Post(':programId/loa-batches/:batchId/unrelease')
  async unreleaseLoaBatch(
    @Param('programId') programId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.commandBus.execute(new UnreleaseLoaBatchCommand(batchId, programId));
  }

  @Delete(':programId/loa-batches/:batchId')
  async deleteLoaBatch(
    @Param('programId') programId: string,
    @Param('batchId') batchId: string,
  ) {
    return this.commandBus.execute(new DeleteLoaBatchCommand(batchId, programId));
  }

  @Get(':programId/loa-downloads')
  async getLoaDownloads(@Param('programId') programId: string) {
    return this.queryBus.execute(new GetLoaDownloadsQuery(programId));
  }
  ```

- [ ] Register all new handlers and the repository in the manage-program-content module's `providers` array (in `manage-program-content.module.ts`):
  ```typescript
  // Add to providers array:
  LoaReleaseBatchRepository,
  CreateLoaBatchHandler,
  UpdateLoaBatchHandler,
  ReleaseLoaBatchHandler,
  UnreleaseLoaBatchHandler,
  DeleteLoaBatchHandler,
  GetLoaBatchesHandler,
  GetLoaDownloadsHandler,
  ```

- [ ] Verify build compiles (no missing imports):
  ```
  Run: cd services/api && npx nx build api --skip-nx-cache 2>&1 | tail -20
  Expected: "Successfully ran target build"
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/manage-program-content/
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add admin LOA batch CRUD + downloads controller routes"
  ```

---

## Task 6: LOA Eligibility Service [Phase C]

**Files:**
- Create: `services/api/src/modules/portal/application/services/loa-eligibility.service.ts`
- Create: `services/api/src/modules/portal/application/services/loa-eligibility.service.spec.ts`

**Steps:**

- [ ] Write the failing tests first (all status × batch × date combos):
  ```typescript
  // loa-eligibility.service.spec.ts
  import { Test } from '@nestjs/testing';
  import { PrismaService } from '@/shared/database/prisma.service';
  import { LoaEligibilityService } from './loa-eligibility.service';

  describe('LoaEligibilityService', () => {
    let service: LoaEligibilityService;
    let prisma: jest.Mocked<{ participantApplication: any; loaReleaseBatch: any }>;

    const makeApp = (overrides = {}) => ({
      id: 'app-1',
      programId: 'prog-1',
      status: 'accepted',
      submissionDate: new Date('2026-02-15'),
      ...overrides,
    });

    const makeBatch = (overrides = {}) => ({
      id: 'batch-1',
      programId: 'prog-1',
      submissionFrom: new Date('2026-01-01'),
      submissionTo: new Date('2026-03-31'),
      releasedAt: new Date('2026-04-01'),
      deletedAt: null,
      ...overrides,
    });

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          LoaEligibilityService,
          {
            provide: PrismaService,
            useValue: {
              participantApplication: { findFirst: jest.fn() },
              loaReleaseBatch: { findFirst: jest.fn() },
            },
          },
        ],
      }).compile();
      service = module.get(LoaEligibilityService);
      prisma = module.get(PrismaService) as any;
    });

    it('returns eligible=false when application status is rejected', async () => {
      prisma.participantApplication.findFirst.mockResolvedValue(makeApp({ status: 'rejected' }));
      const result = await service.checkEligibility('app-1', 'prog-1');
      expect(result).toEqual({ eligible: false });
      expect(prisma.loaReleaseBatch.findFirst).not.toHaveBeenCalled();
    });

    it('returns eligible=false when application status is withdrawn', async () => {
      prisma.participantApplication.findFirst.mockResolvedValue(makeApp({ status: 'withdrawn' }));
      const result = await service.checkEligibility('app-1', 'prog-1');
      expect(result).toEqual({ eligible: false });
    });

    it('returns eligible=false when no released batch covers submission_date', async () => {
      prisma.participantApplication.findFirst.mockResolvedValue(makeApp());
      prisma.loaReleaseBatch.findFirst.mockResolvedValue(null);
      const result = await service.checkEligibility('app-1', 'prog-1');
      expect(result).toEqual({ eligible: false });
    });

    it('returns eligible=false when submission_date is before batch.submissionFrom', async () => {
      prisma.participantApplication.findFirst.mockResolvedValue(makeApp({ submissionDate: new Date('2025-12-31') }));
      prisma.loaReleaseBatch.findFirst.mockResolvedValue(null);
      const result = await service.checkEligibility('app-1', 'prog-1');
      expect(result).toEqual({ eligible: false });
    });

    it('returns eligible=true with batchId when submission_date falls within a released batch', async () => {
      prisma.participantApplication.findFirst.mockResolvedValue(makeApp());
      prisma.loaReleaseBatch.findFirst.mockResolvedValue(makeBatch());
      const result = await service.checkEligibility('app-1', 'prog-1');
      expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
    });

    it('returns eligible=true for submitted status (not just accepted)', async () => {
      prisma.participantApplication.findFirst.mockResolvedValue(makeApp({ status: 'submitted' }));
      prisma.loaReleaseBatch.findFirst.mockResolvedValue(makeBatch());
      const result = await service.checkEligibility('app-1', 'prog-1');
      expect(result).toEqual({ eligible: true, batchId: 'batch-1' });
    });
  });
  ```

- [ ] Run — expect FAIL:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-eligibility.service.spec
  Expected: FAIL — "Cannot find module './loa-eligibility.service'"
  ```

- [ ] Implement:
  ```typescript
  // loa-eligibility.service.ts
  import { Injectable } from '@nestjs/common';
  import { PrismaService } from '@/shared/database/prisma.service';

  export interface EligibilityResult {
    eligible: boolean;
    batchId?: string;
  }

  @Injectable()
  export class LoaEligibilityService {
    constructor(private readonly prisma: PrismaService) {}

    async checkEligibility(applicationId: string, programId: string): Promise<EligibilityResult> {
      const application = await this.prisma.participantApplication.findFirst({
        where: { id: applicationId },
        select: { status: true, submissionDate: true },
      });

      if (!application) return { eligible: false };
      if (!['submitted', 'accepted'].includes(application.status)) return { eligible: false };
      if (!application.submissionDate) return { eligible: false };

      const batch = await this.prisma.loaReleaseBatch.findFirst({
        where: {
          programId,
          deletedAt: null,
          releasedAt: { not: null },
          submissionFrom: { lte: application.submissionDate },
          submissionTo: { gte: application.submissionDate },
        },
        select: { id: true },
      });

      if (!batch) return { eligible: false };
      return { eligible: true, batchId: batch.id };
    }
  }
  ```

- [ ] Run — expect PASS:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-eligibility.service.spec
  Expected: PASS — 6 passing
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/portal/application/services/loa-eligibility.service.ts \
        services/api/src/modules/portal/application/services/loa-eligibility.service.spec.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add LoaEligibilityService with status + released-batch + date-range gate"
  ```

---

## Task 7: LOA Document Number assignment service [Phase C]

**Files:**
- Create: `services/api/src/modules/portal/application/services/loa-document-number.service.ts`
- Create: `services/api/src/modules/portal/application/services/loa-document-number.service.spec.ts`

**Steps:**

- [ ] Write failing tests:
  ```typescript
  // loa-document-number.service.spec.ts
  import { Test } from '@nestjs/testing';
  import { PrismaService } from '@/shared/database/prisma.service';
  import { LoaDocumentNumberService } from './loa-document-number.service';

  describe('LoaDocumentNumberService', () => {
    let service: LoaDocumentNumberService;
    let prisma: jest.Mocked<{ participantDocument: any }>;

    beforeEach(async () => {
      const module = await Test.createTestingModule({
        providers: [
          LoaDocumentNumberService,
          {
            provide: PrismaService,
            useValue: {
              participantDocument: {
                findFirst: jest.fn(),
                count: jest.fn(),
                create: jest.fn(),
              },
            },
          },
        ],
      }).compile();
      service = module.get(LoaDocumentNumberService);
      prisma = module.get(PrismaService) as any;
    });

    it('returns existing documentNumber when LOA row already exists for application', async () => {
      prisma.participantDocument.findFirst.mockResolvedValue({
        id: 'doc-1',
        documentNumber: 'LOA-YBB2026-0001',
      });
      const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026');
      expect(result).toEqual({ docNumber: 'LOA-YBB2026-0001', isNew: false, existingDocId: 'doc-1' });
      expect(prisma.participantDocument.count).not.toHaveBeenCalled();
    });

    it('assigns a new document number (0001) when no LOA row exists and program has no existing LOAs', async () => {
      prisma.participantDocument.findFirst.mockResolvedValue(null);
      prisma.participantDocument.count.mockResolvedValue(0);
      prisma.participantDocument.create.mockResolvedValue({
        id: 'doc-new',
        documentNumber: 'LOA-YBB2026-0001',
      });
      const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026');
      expect(result.docNumber).toBe('LOA-YBB2026-0001');
      expect(result.isNew).toBe(true);
    });

    it('assigns a sequential document number when other LOAs already exist', async () => {
      prisma.participantDocument.findFirst.mockResolvedValue(null);
      prisma.participantDocument.count.mockResolvedValue(5);
      prisma.participantDocument.create.mockResolvedValue({
        id: 'doc-new',
        documentNumber: 'LOA-YBB2026-0006',
      });
      const result = await service.assignOrGet('app-1', 'prog-1', 'YBB2026');
      expect(result.docNumber).toBe('LOA-YBB2026-0006');
    });
  });
  ```

- [ ] Run — expect FAIL:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-document-number.service.spec
  Expected: FAIL — "Cannot find module './loa-document-number.service'"
  ```

- [ ] Implement:
  ```typescript
  // loa-document-number.service.ts
  import { Injectable } from '@nestjs/common';
  import { PrismaService } from '@/shared/database/prisma.service';
  import { DocumentType } from '@prisma/client';

  export interface AssignOrGetResult {
    docNumber: string;
    isNew: boolean;
    existingDocId?: string;
  }

  @Injectable()
  export class LoaDocumentNumberService {
    constructor(private readonly prisma: PrismaService) {}

    async assignOrGet(
      applicationId: string,
      programId: string,
      programCode: string,
    ): Promise<AssignOrGetResult> {
      const existing = await this.prisma.participantDocument.findFirst({
        where: { applicationId, type: DocumentType.letter_of_acceptance },
        select: { id: true, documentNumber: true },
      });

      if (existing?.documentNumber) {
        return { docNumber: existing.documentNumber, isNew: false, existingDocId: existing.id };
      }

      const count = await this.prisma.participantDocument.count({
        where: {
          type: DocumentType.letter_of_acceptance,
          application: { programId },
        },
      });

      const padded = String(count + 1).padStart(4, '0');
      const docNumber = `LOA-${programCode}-${padded}`;

      const created = await this.prisma.participantDocument.create({
        data: {
          applicationId,
          type: DocumentType.letter_of_acceptance,
          title: 'Letter of Acceptance',
          documentNumber: docNumber,
          // fileUrl intentionally omitted — no PDF stored
        },
        select: { id: true, documentNumber: true },
      });

      return { docNumber: created.documentNumber!, isNew: true, existingDocId: created.id };
    }
  }
  ```

- [ ] Run — expect PASS:
  ```
  Run: cd services/api && npx jest --testPathPattern=loa-document-number.service.spec
  Expected: PASS — 3 passing
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/portal/application/services/loa-document-number.service.ts \
        services/api/src/modules/portal/application/services/loa-document-number.service.spec.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add LoaDocumentNumberService — assign-once sequential LOA number"
  ```

---

## Task 8: Portal LOA download endpoint [Phase C]

**Files:**
- Modify: `services/api/src/modules/portal/presentation/portal.controller.ts` — add `GET loa/download` route
- Modify: `services/api/src/modules/portal/portal.module.ts` — register new services

**Steps:**

- [ ] Add imports to `portal.controller.ts` (at top, after existing imports):
  ```typescript
  import { StreamableFile, Header, HttpCode, HttpStatus } from '@nestjs/common';
  import { Throttle } from '@nestjs/throttler';
  import { LoaEligibilityService } from '../application/services/loa-eligibility.service';
  import { LoaDocumentNumberService } from '../application/services/loa-document-number.service';
  import { FileServiceClient } from '@/shared/clients/file-service.client';
  ```

- [ ] Inject the new services in the controller constructor (add alongside existing constructor params):
  ```typescript
  // In the constructor:
  private readonly loaEligibilityService: LoaEligibilityService,
  private readonly loaDocumentNumberService: LoaDocumentNumberService,
  private readonly fileServiceClient: FileServiceClient,
  ```

- [ ] Add the download endpoint to `portal.controller.ts`:
  ```typescript
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Get('loa/download')
  @Header('Content-Type', 'application/pdf')
  async downloadLoa(
    @CurrentUser() user: JwtPayload,
    @Headers('x-brand-domain') brandDomain: string,
  ): Promise<StreamableFile> {
    // 1. Resolve Brand → Program → Application
    const brand = await this.prisma.brand.findFirst({ where: { domain: brandDomain } });
    if (!brand) throw new NotFoundException('Brand not found');

    const program = await this.prisma.program.findFirst({
      where: { brandId: brand.id },
      select: { id: true, name: true, code: true, startDate: true, endDate: true, type: true, location: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    const application = await this.prisma.participantApplication.findFirst({
      where: { userId: user.sub, programId: program.id },
      select: { id: true, status: true, submissionDate: true, user: { select: { name: true } } },
    });
    if (!application) throw new ForbiddenException('LOA not available');

    // 2. Eligibility gate
    const eligibility = await this.loaEligibilityService.checkEligibility(application.id, program.id);
    if (!eligibility.eligible) throw new ForbiddenException('LOA not available');

    // 3. Assign or reuse document number
    const { docNumber, existingDocId } = await this.loaDocumentNumberService.assignOrGet(
      application.id,
      program.id,
      program.code,
    );

    // 4. Fetch DocumentTemplate
    const template = await this.prisma.documentTemplate.findFirst({
      where: { programId: program.id, type: 'letter_of_acceptance' },
    });
    if (!template) throw new NotFoundException('LOA template not configured');

    // 5. Build placeholder map
    const now = new Date();
    const placeholders: Record<string, string> = {
      '{{participant_name}}': application.user.name,
      '{{program_name}}': program.name,
      '{{program_start_date}}': program.startDate?.toLocaleDateString('id-ID') ?? '',
      '{{program_end_date}}': program.endDate?.toLocaleDateString('id-ID') ?? '',
      '{{submission_date}}': application.submissionDate?.toLocaleDateString('id-ID') ?? '',
      '{{document_number}}': docNumber,
      '{{issued_date}}': now.toLocaleDateString('id-ID'),
      '{{program_type}}': program.type ?? '',
      '{{program_location}}': program.location ?? '',
    };

    let htmlContent = template.content;
    for (const [key, value] of Object.entries(placeholders)) {
      htmlContent = htmlContent.replaceAll(key, value);
    }

    // 6. Generate PDF
    const buffer = await this.fileServiceClient.generateLoa({
      htmlContent,
      headerHtml: template.headerHtml ?? undefined,
      footerHtml: template.footerHtml ?? undefined,
      pageSettings: template.pageSettings ?? undefined,
    });

    // 7. Track download
    const docId = existingDocId;
    await this.prisma.participantDocument.update({
      where: { id: docId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: now,
        firstDownloadedAt: { set: undefined }, // handled below via raw check
        loaReleaseBatchId: eligibility.batchId,
      },
    });
    // Set firstDownloadedAt only on first download
    await this.prisma.participantDocument.updateMany({
      where: { id: docId, firstDownloadedAt: null },
      data: { firstDownloadedAt: now },
    });

    // 8. Stream
    return new StreamableFile(buffer, {
      type: 'application/pdf',
      disposition: `attachment; filename="LOA-${docNumber}.pdf"`,
    });
  }
  ```

- [ ] Register `LoaEligibilityService` and `LoaDocumentNumberService` in `portal.module.ts` providers array:
  ```typescript
  // Add to providers:
  LoaEligibilityService,
  LoaDocumentNumberService,
  ```

- [ ] Build check:
  ```
  Run: cd services/api && npx nx build api --skip-nx-cache 2>&1 | tail -5
  Expected: "Successfully ran target build"
  ```

- [ ] Manual integration test (dev environment):
  ```
  Run: curl -H "Authorization: Bearer <valid_token>" \
            -H "x-brand-domain: dev.ybb.id" \
            http://localhost:3000/v1/portal/loa/download \
            --output /tmp/test-loa.pdf
  Expected: File /tmp/test-loa.pdf created; `file /tmp/test-loa.pdf` returns "PDF document"
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/portal/
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add portal GET /v1/portal/loa/download — gated on-demand PDF streaming"
  ```

---

## Task 9: Update GetPortalDocumentsHandler for eligibility-based LOA [Phase C]

**Files:**
- Modify: `services/api/src/modules/portal/application/handlers/get-portal-documents.handler.ts` — replace fileUrl check with eligibility check for LOA type

**Steps:**

- [ ] Open `get-portal-documents.handler.ts`. Find the section that builds the LOA document entry (where it checks `fileUrl`). Replace it:

  **Before (existing pattern — find and replace this block):**
  ```typescript
  // Existing: marks LOA available only if fileUrl is set
  if (doc.type === 'letter_of_acceptance') {
    return { ...doc, available: !!doc.fileUrl };
  }
  ```

  **After:**
  ```typescript
  if (doc.type === DocumentType.letter_of_acceptance) {
    const eligibility = await this.loaEligibilityService.checkEligibility(
      application.id,
      program.id,
    );
    return {
      id: doc.id,
      type: doc.type,
      title: doc.title ?? 'Letter of Acceptance',
      downloadable: eligibility.eligible,
      documentNumber: doc.documentNumber ?? undefined,
      downloadCount: doc.downloadCount,
      firstDownloadedAt: doc.firstDownloadedAt,
      // fileUrl intentionally omitted for LOA
    };
  }
  ```

- [ ] Add `LoaEligibilityService` to the handler's constructor:
  ```typescript
  constructor(
    // ... existing params ...
    private readonly loaEligibilityService: LoaEligibilityService,
  ) {}
  ```

- [ ] Write handler spec test (add to existing spec file or create new):
  ```typescript
  // In get-portal-documents.handler.spec.ts
  it('returns downloadable=true for LOA when participant is eligible', async () => {
    // Arrange: set up mocks so application.status='accepted', valid batch covers submission_date
    mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: true, batchId: 'batch-1' });
    // Act
    const result = await handler.execute(new GetPortalDocumentsQuery(user.sub, 'dev.ybb.id'));
    // Assert
    const loaDoc = result.find(d => d.type === 'letter_of_acceptance');
    expect(loaDoc?.downloadable).toBe(true);
    expect(loaDoc?.fileUrl).toBeUndefined();
  });

  it('returns downloadable=false for LOA when no released batch covers participant', async () => {
    mockLoaEligibilityService.checkEligibility.mockResolvedValue({ eligible: false });
    const result = await handler.execute(new GetPortalDocumentsQuery(user.sub, 'dev.ybb.id'));
    const loaDoc = result.find(d => d.type === 'letter_of_acceptance');
    expect(loaDoc?.downloadable).toBe(false);
  });
  ```

- [ ] Run tests:
  ```
  Run: cd services/api && npx jest --testPathPattern=get-portal-documents.handler
  Expected: PASS
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/src/modules/portal/application/handlers/get-portal-documents.handler.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: GetPortalDocumentsHandler surfaces LOA by eligibility, not fileUrl"
  ```

---

## Task 10: Portal BFF route for LOA download [Phase D]

**Files:**
- Create: `ybb-program-next/app/api/portal/loa/download/route.ts`

**Steps:**

- [ ] Create directory and file:
  ```
  mkdir -p /Users/hendra/Projects/YBB/ybb-new/ybb-program-next/app/api/portal/loa/download
  ```

- [ ] Write the BFF route:
  ```typescript
  // app/api/portal/loa/download/route.ts
  import { NextRequest, NextResponse } from 'next/server';

  export async function GET(request: NextRequest) {
    const accessToken = request.cookies.get('accessToken')?.value;
    if (!accessToken) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const brandDomain = request.headers.get('x-brand-domain') ?? '';

    const res = await fetch(`${process.env.API_BASE_URL}/v1/portal/loa/download`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'x-brand-domain': brandDomain,
      },
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return NextResponse.json(data, { status: res.status });
    }

    const buffer = await res.arrayBuffer();
    return new Response(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          res.headers.get('Content-Disposition') ?? 'attachment; filename="LOA.pdf"',
      },
    });
  }
  ```

- [ ] Verify TypeScript compiles:
  ```
  Run: cd /Users/hendra/Projects/YBB/ybb-new/ybb-program-next && npx tsc --noEmit 2>&1 | head -20
  Expected: No errors
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-program-next \
    add app/api/portal/loa/download/route.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-program-next \
    commit -m "feat: add BFF GET /api/portal/loa/download — forward auth + pipe PDF binary"
  ```

---

## Task 11: Update DocumentsSection for eligibility-based LOA [Phase D]

**Files:**
- Modify: `ybb-program-next/components/dashboard/sections/DocumentsSection.tsx`

**Steps:**

- [ ] Open `DocumentsSection.tsx`. Update the `PortalDocument` type (or import it):
  ```typescript
  interface PortalDocument {
    id: string;
    type: string;
    title: string;
    fileUrl?: string;       // kept for non-LOA documents
    downloadable?: boolean; // LOA-specific: true = eligible, false = locked
    documentNumber?: string;
    downloadCount?: number;
    firstDownloadedAt?: string;
    status: string;
    viewedAt?: string;
  }
  ```

- [ ] Add a `downloadLoa` helper function inside the component:
  ```typescript
  const downloadLoa = async () => {
    try {
      const res = await fetch('/api/portal/loa/download', {
        headers: { 'x-brand-domain': window.location.hostname },
      });
      if (!res.ok) {
        alert('Your LOA is not yet available. Please try again later.');
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('Content-Disposition')?.match(/filename="(.+)"/)?.[1] ?? 'LOA.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      alert('Failed to download LOA. Please try again.');
    }
  };
  ```

- [ ] Find the LOA document rendering block (currently checks `doc.fileUrl`) and replace it:
  ```typescript
  // Replace the LOA card render block:
  if (doc.type === 'letter_of_acceptance') {
    if (doc.downloadable) {
      return (
        <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg">
          <div>
            <p className="font-medium">{doc.title}</p>
            {doc.documentNumber && (
              <p className="text-sm text-muted-foreground">No. {doc.documentNumber}</p>
            )}
          </div>
          <button
            onClick={downloadLoa}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:bg-primary/90"
          >
            Download Letter of Acceptance
          </button>
        </div>
      );
    }
    return (
      <div key={doc.id} className="flex items-center justify-between p-4 border rounded-lg opacity-60 bg-muted/30 border-dashed cursor-not-allowed">
        <div>
          <p className="font-medium">{doc.title}</p>
          <p className="text-sm text-muted-foreground">
            Your Letter of Acceptance will be available once released.
          </p>
        </div>
      </div>
    );
  }
  ```

- [ ] Remove the `markDocumentViewed` call that was previously called for LOA (search for `markDocumentViewed` in the file; the call that triggers before navigating to `fileUrl` for LOA should be removed or guarded to skip for LOA type).

- [ ] TypeScript check:
  ```
  Run: cd /Users/hendra/Projects/YBB/ybb-new/ybb-program-next && npx tsc --noEmit 2>&1 | head -20
  Expected: No errors
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-program-next \
    add components/dashboard/sections/DocumentsSection.tsx
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-program-next \
    commit -m "feat: DocumentsSection renders LOA as download button (eligible) or locked state"
  ```

---

## Task 12: Admin api-client — add batch methods, remove obsolete [Phase E]

**Files:**
- Modify: `services/admin-dashboard/src/shared/api-client.ts`

**Steps:**

- [ ] Add type definitions near the top of `api-client.ts` (or in a co-located types file):
  ```typescript
  export interface LoaBatch {
    id: string;
    programId: string;
    name: string;
    submissionFrom: string; // ISO string
    submissionTo: string;
    releasedAt: string | null;
    eligibleCount: number;
    downloadedCount: number;
    createdAt: string;
  }

  export interface CreateLoaBatchInput {
    name: string;
    submissionFrom: string; // ISO string
    submissionTo: string;
  }

  export interface UpdateLoaBatchInput {
    name?: string;
    submissionFrom?: string;
    submissionTo?: string;
  }

  export interface LoaDownload {
    participantName: string;
    email: string;
    batchName: string | null;
    documentNumber: string;
    firstDownloadedAt: string | null;
    downloadCount: number;
  }
  ```

- [ ] Add 7 new methods to the api-client class:
  ```typescript
  async getLoaBatches(programId: string): Promise<LoaBatch[]> {
    return this.request('GET', `/programs/${programId}/loa-batches`);
  }

  async createLoaBatch(programId: string, data: CreateLoaBatchInput): Promise<LoaBatch> {
    return this.request('POST', `/programs/${programId}/loa-batches`, { body: data });
  }

  async updateLoaBatch(programId: string, id: string, data: UpdateLoaBatchInput): Promise<LoaBatch> {
    return this.request('PUT', `/programs/${programId}/loa-batches/${id}`, { body: data });
  }

  async releaseLoaBatch(programId: string, id: string): Promise<LoaBatch> {
    return this.request('POST', `/programs/${programId}/loa-batches/${id}/release`);
  }

  async unreleaseLoaBatch(programId: string, id: string): Promise<LoaBatch> {
    return this.request('POST', `/programs/${programId}/loa-batches/${id}/unrelease`);
  }

  async deleteLoaBatch(programId: string, id: string): Promise<void> {
    return this.request('DELETE', `/programs/${programId}/loa-batches/${id}`);
  }

  async getLoaDownloads(programId: string): Promise<LoaDownload[]> {
    return this.request('GET', `/programs/${programId}/loa-downloads`);
  }
  ```

- [ ] Remove old LOA methods: delete `generateLoa`, `sendLoa`, `bulkSendLoa`, `getLOAStatus` method bodies from the class. Keep `getLoaTemplate` and `updateLoaTemplate`.

- [ ] TypeScript check:
  ```
  Run: cd /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/admin-dashboard && npx tsc --noEmit 2>&1 | head -20
  Expected: No errors (removed methods may cause errors in components — those are fixed in Task 15)
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/admin-dashboard/src/shared/api-client.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: admin api-client — add LOA batch CRUD + downloads methods; remove obsolete send/generate"
  ```

---

## Task 13: LoaBatchesTab + LoaBatchDialog components [Phase E]

**Files:**
- Create: `services/admin-dashboard/app/components/documents/LoaBatchesTab.tsx`
- Create: `services/admin-dashboard/app/components/documents/LoaBatchDialog.tsx`

**Steps:**

- [ ] Create `LoaBatchDialog.tsx`:
  ```typescript
  // app/components/documents/LoaBatchDialog.tsx
  'use client';
  import { useState } from 'react';
  import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/ui/dialog';
  import { Button } from '@/ui/button';
  import { Input } from '@/ui/input';
  import { Label } from '@/ui/label';
  import { apiClient, LoaBatch, CreateLoaBatchInput, UpdateLoaBatchInput } from '@/shared/api-client';

  interface LoaBatchDialogProps {
    programId: string;
    batch?: LoaBatch;
    onClose: () => void;
    onSaved: () => void;
  }

  export function LoaBatchDialog({ programId, batch, onClose, onSaved }: LoaBatchDialogProps) {
    const [name, setName] = useState(batch?.name ?? '');
    const [submissionFrom, setSubmissionFrom] = useState(
      batch?.submissionFrom ? batch.submissionFrom.slice(0, 10) : '',
    );
    const [submissionTo, setSubmissionTo] = useState(
      batch?.submissionTo ? batch.submissionTo.slice(0, 10) : '',
    );
    const [error, setError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setSaving(true);
      try {
        const payload: CreateLoaBatchInput | UpdateLoaBatchInput = {
          name,
          submissionFrom: new Date(submissionFrom).toISOString(),
          submissionTo: new Date(submissionTo).toISOString(),
        };
        if (batch) {
          await apiClient.updateLoaBatch(programId, batch.id, payload as UpdateLoaBatchInput);
        } else {
          await apiClient.createLoaBatch(programId, payload as CreateLoaBatchInput);
        }
        onSaved();
      } catch (err: any) {
        setError(err?.message ?? 'Failed to save batch. Date range may overlap with an existing batch.');
      } finally {
        setSaving(false);
      }
    };

    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{batch ? 'Edit Batch' : 'Create Batch'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="batch-name">Batch Name</Label>
              <Input
                id="batch-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Wave 1"
                required
              />
            </div>
            <div>
              <Label htmlFor="batch-from">Submission Date From</Label>
              <Input
                id="batch-from"
                type="date"
                value={submissionFrom}
                onChange={(e) => setSubmissionFrom(e.target.value)}
                required
              />
            </div>
            <div>
              <Label htmlFor="batch-to">Submission Date To</Label>
              <Input
                id="batch-to"
                type="date"
                value={submissionTo}
                onChange={(e) => setSubmissionTo(e.target.value)}
                required
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={saving}>
                {saving ? 'Saving…' : batch ? 'Save Changes' : 'Create Batch'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    );
  }
  ```

- [ ] Create `LoaBatchesTab.tsx`:
  ```typescript
  // app/components/documents/LoaBatchesTab.tsx
  'use client';
  import { useState } from 'react';
  import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
  import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/ui/table';
  import { Badge } from '@/ui/badge';
  import { Button } from '@/ui/button';
  import { Switch } from '@/ui/switch';
  import { apiClient, LoaBatch } from '@/shared/api-client';
  import { LoaBatchDialog } from './LoaBatchDialog';

  interface LoaBatchesTabProps {
    programId: string;
  }

  export function LoaBatchesTab({ programId }: LoaBatchesTabProps) {
    const queryClient = useQueryClient();
    const [dialogBatch, setDialogBatch] = useState<LoaBatch | undefined>();
    const [dialogOpen, setDialogOpen] = useState(false);

    const { data: batches = [], isLoading } = useQuery({
      queryKey: ['loa-batches', programId],
      queryFn: () => apiClient.getLoaBatches(programId),
    });

    const releaseMutation = useMutation({
      mutationFn: ({ id, released }: { id: string; released: boolean }) =>
        released
          ? apiClient.releaseLoaBatch(programId, id)
          : apiClient.unreleaseLoaBatch(programId, id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loa-batches', programId] }),
    });

    const deleteMutation = useMutation({
      mutationFn: (id: string) => apiClient.deleteLoaBatch(programId, id),
      onSuccess: () => queryClient.invalidateQueries({ queryKey: ['loa-batches', programId] }),
    });

    const handleSaved = () => {
      setDialogOpen(false);
      setDialogBatch(undefined);
      queryClient.invalidateQueries({ queryKey: ['loa-batches', programId] });
    };

    if (isLoading) return <p className="text-sm text-muted-foreground">Loading batches…</p>;

    return (
      <div className="space-y-4">
        <div className="flex justify-end">
          <Button onClick={() => { setDialogBatch(undefined); setDialogOpen(true); }}>
            + Create Batch
          </Button>
        </div>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Submission Range</TableHead>
              <TableHead>Eligible</TableHead>
              <TableHead>Downloaded</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {batches.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                  No batches yet. Create one to start releasing LOAs.
                </TableCell>
              </TableRow>
            )}
            {batches.map((batch) => (
              <TableRow key={batch.id}>
                <TableCell className="font-medium">{batch.name}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(batch.submissionFrom).toLocaleDateString()} –{' '}
                  {new Date(batch.submissionTo).toLocaleDateString()}
                </TableCell>
                <TableCell>{batch.eligibleCount}</TableCell>
                <TableCell>{batch.downloadedCount}</TableCell>
                <TableCell>
                  <Badge variant={batch.releasedAt ? 'default' : 'secondary'}>
                    {batch.releasedAt ? 'Released' : 'Draft'}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={!!batch.releasedAt}
                      onCheckedChange={(checked) =>
                        releaseMutation.mutate({ id: batch.id, released: checked })
                      }
                      aria-label={batch.releasedAt ? 'Unrelease batch' : 'Release batch'}
                    />
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setDialogBatch(batch); setDialogOpen(true); }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm(`Delete batch "${batch.name}"?`)) {
                          deleteMutation.mutate(batch.id);
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {dialogOpen && (
          <LoaBatchDialog
            programId={programId}
            batch={dialogBatch}
            onClose={() => { setDialogOpen(false); setDialogBatch(undefined); }}
            onSaved={handleSaved}
          />
        )}
      </div>
    );
  }
  ```

- [ ] TypeScript check:
  ```
  Run: cd /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/admin-dashboard && npx tsc --noEmit 2>&1 | head -20
  Expected: No errors
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/admin-dashboard/app/components/documents/LoaBatchesTab.tsx \
        services/admin-dashboard/app/components/documents/LoaBatchDialog.tsx
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: add LoaBatchesTab + LoaBatchDialog admin components"
  ```

---

## Task 14: Rework loa-template page (3 tabs) + repurpose LoaStatusTable [Phase E]

**Files:**
- Modify: `services/admin-dashboard/app/programs/[programId]/documents/loa-template/page.tsx`
- Modify: `services/admin-dashboard/app/components/documents/LoaStatusTable.tsx`

**Steps:**

- [ ] Update `LoaStatusTable.tsx` to use the new `getLoaDownloads` method and show new columns:
  ```typescript
  // Replace the data-fetching hook and column definitions in LoaStatusTable.tsx:

  // Old: used getLOAStatus → removed
  // New:
  const { data: downloads = [], isLoading } = useQuery({
    queryKey: ['loa-downloads', programId],
    queryFn: () => apiClient.getLoaDownloads(programId),
  });

  // New column definitions (replace old status/sentAt/resend columns):
  // Columns: Participant Name | Email | Batch | Document Number | First Downloaded | Download Count
  ```

  Full updated render of the table body:
  ```typescript
  <TableBody>
    {downloads.map((row, i) => (
      <TableRow key={i}>
        <TableCell>{row.participantName}</TableCell>
        <TableCell>{row.email}</TableCell>
        <TableCell>{row.batchName ?? '—'}</TableCell>
        <TableCell className="font-mono text-sm">{row.documentNumber}</TableCell>
        <TableCell>
          {row.firstDownloadedAt
            ? new Date(row.firstDownloadedAt).toLocaleDateString()
            : '—'}
        </TableCell>
        <TableCell>{row.downloadCount}</TableCell>
      </TableRow>
    ))}
  </TableBody>
  ```

  Remove: the per-row "Send / Resend" action button and column.

- [ ] Rewrite `loa-template/page.tsx` to 3 tabs:
  ```typescript
  // Full replacement of the page component:
  'use client';
  import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/ui/tabs';
  import { LoaTemplateEditor } from '@/components/documents/LoaTemplateEditor';
  import { LoaBatchesTab } from '@/components/documents/LoaBatchesTab';
  import { LoaStatusTable } from '@/components/documents/LoaStatusTable';

  interface Props {
    params: { programId: string };
  }

  export default function LoaTemplatePage({ params }: Props) {
    const { programId } = params;

    return (
      <div className="p-6 space-y-6">
        <h1 className="text-2xl font-semibold">Letter of Acceptance</h1>
        <Tabs defaultValue="template">
          <TabsList>
            <TabsTrigger value="template">Template</TabsTrigger>
            <TabsTrigger value="batches">Batches</TabsTrigger>
            <TabsTrigger value="downloads">Downloads</TabsTrigger>
          </TabsList>
          <TabsContent value="template">
            <LoaTemplateEditor programId={programId} />
          </TabsContent>
          <TabsContent value="batches">
            <LoaBatchesTab programId={programId} />
          </TabsContent>
          <TabsContent value="downloads">
            <LoaStatusTable programId={programId} />
          </TabsContent>
        </Tabs>
      </div>
    );
  }
  ```

- [ ] Remove imports from the page that are no longer needed: `GenerateLoaDialog`, `LoaRecipientDrawer`, `StatCard`, and any state for the old funnel counts.

- [ ] Build check:
  ```
  Run: cd /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/admin-dashboard && npm run build 2>&1 | tail -10
  Expected: "Compiled successfully" or "Build complete"
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/admin-dashboard/app/programs/ \
        services/admin-dashboard/app/components/documents/LoaStatusTable.tsx
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "feat: LOA page reworked to 3 tabs (Template | Batches | Downloads); repurpose LoaStatusTable"
  ```

---

## Task 15: Remove obsolete backend — loa_ready event, email handler, viewed endpoint [Phase F]

**Files:**
- Delete: `services/api/src/modules/notification/application/handlers/loa-ready.handler.ts`
- Delete: `services/api/src/modules/notification/templates/loa-ready.hbs`
- Modify: `services/api/src/modules/notification/application/services/notification.service.ts` — remove `sendLoaReadyEmail()`
- Modify: `services/api/src/modules/manage-program-content/application/handlers/manage-program-content.handlers.ts` — remove `loa_ready` emit + MinIO upload from `GenerateLOAHandler`
- Modify: `services/api/src/modules/portal/presentation/portal.controller.ts` — remove `/viewed` endpoint
- Delete (if standalone): `services/api/src/modules/portal/application/handlers/mark-document-viewed.handler.ts`

**Steps:**

- [ ] In `manage-program-content.handlers.ts`, find `GenerateLOAHandler.execute()`. Remove:
  - The `storageService.uploadFile(...)` call and the `fileUrl` assignment to `ParticipantDocument`
  - The `this.eventEmitter.emit('loa_ready', { ... })` line
  - Any import of `storageService` if it was only used for LOA (leave if used by other document types)

- [ ] In `notification.service.ts`, remove the `sendLoaReadyEmail()` method body and any call sites within the notification module.

- [ ] Delete `loa-ready.handler.ts`:
  ```
  rm services/api/src/modules/notification/application/handlers/loa-ready.handler.ts
  ```

- [ ] Delete `loa-ready.hbs`:
  ```
  rm services/api/src/modules/notification/templates/loa-ready.hbs
  ```

- [ ] In `portal.controller.ts`, find the `@Post('documents/:id/viewed')` or similar endpoint and delete that route method + the `MarkDocumentViewedCommand` import.

- [ ] Delete `mark-document-viewed.handler.ts` (if it exists as a separate file; if it's inline in a shared file, just remove the class):
  ```
  rm -f services/api/src/modules/portal/application/handlers/mark-document-viewed.handler.ts
  ```

- [ ] Remove the now-unused `MarkDocumentViewedHandler` from the portal module's providers array.

- [ ] Build check — must pass clean:
  ```
  Run: cd services/api && npx nx build api --skip-nx-cache 2>&1 | tail -10
  Expected: "Successfully ran target build" with zero TypeScript errors
  ```

- [ ] Run full API test suite:
  ```
  Run: cd services/api && npx nx test api 2>&1 | tail -20
  Expected: All tests pass (any loa-ready.handler.spec.ts deleted earlier should not appear)
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add -A services/api/src/modules/notification/ \
        services/api/src/modules/manage-program-content/application/handlers/manage-program-content.handlers.ts \
        services/api/src/modules/portal/
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "refactor: remove loa_ready event, sendLoaReadyEmail, loa-ready template, mark-viewed endpoint"
  ```

---

## Task 16: Remove obsolete admin dashboard components + final build check [Phase F]

**Files:**
- Delete: `services/admin-dashboard/app/components/documents/GenerateLoaDialog.tsx`
- Delete: `services/admin-dashboard/app/components/documents/LoaRecipientDrawer.tsx`

**Steps:**

- [ ] Confirm no remaining imports of `GenerateLoaDialog` or `LoaRecipientDrawer` (Task 14 already removed the page imports):
  ```
  Run: grep -r "GenerateLoaDialog\|LoaRecipientDrawer" /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/admin-dashboard/app
  Expected: No output (zero matches)
  ```

- [ ] Delete the files:
  ```
  rm services/admin-dashboard/app/components/documents/GenerateLoaDialog.tsx
  rm services/admin-dashboard/app/components/documents/LoaRecipientDrawer.tsx
  ```

- [ ] Confirm no remaining references to old api-client methods:
  ```
  Run: grep -r "generateLoa\|sendLoa\|bulkSendLoa\|getLOAStatus" /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/admin-dashboard/app
  Expected: No output
  ```

- [ ] Full admin-dashboard build:
  ```
  Run: cd /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/admin-dashboard && npm run build 2>&1 | tail -15
  Expected: Build succeeds with no TypeScript errors
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add -A services/admin-dashboard/app/components/documents/
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "refactor: delete GenerateLoaDialog + LoaRecipientDrawer — superseded by batch flow"
  ```

---

## Task 17: Post-cutover data cleanup script [Phase G — DO NOT run at cutover]

> ⚠️ **This task is NOT part of the cutover deploy. Run only after verifying the new LOA flow works correctly on dev/prod.**

**Files:**
- Create: `services/api/scripts/cleanup-loa-file-urls.ts`

**Steps:**

- [ ] Create the cleanup script:
  ```typescript
  // scripts/cleanup-loa-file-urls.ts
  // POST-CUTOVER ONLY: Run after verifying the new on-demand LOA flow works.
  // Nulls out file_url on existing letter_of_acceptance ParticipantDocument rows
  // and deletes the associated MinIO objects to reclaim storage.

  import { PrismaClient } from '@prisma/client';
  import { StorageService } from '../src/shared/storage/storage.service';

  async function main() {
    const prisma = new PrismaClient();

    console.log('Fetching existing LOA ParticipantDocument rows with fileUrl...');
    const docs = await prisma.participantDocument.findMany({
      where: {
        type: 'letter_of_acceptance',
        fileUrl: { not: null },
      },
      select: { id: true, fileUrl: true, documentNumber: true },
    });

    console.log(`Found ${docs.length} LOA documents with stored fileUrls.`);
    if (docs.length === 0) {
      console.log('Nothing to clean up.');
      await prisma.$disconnect();
      return;
    }

    // Preview before destructive actions
    for (const doc of docs.slice(0, 5)) {
      console.log(`  - ${doc.documentNumber ?? doc.id}: ${doc.fileUrl}`);
    }
    if (docs.length > 5) console.log(`  ... and ${docs.length - 5} more`);

    const confirmed = process.argv.includes('--confirm');
    if (!confirmed) {
      console.log('\nDRY RUN. Pass --confirm to actually execute.');
      await prisma.$disconnect();
      return;
    }

    // Delete MinIO objects
    // NOTE: instantiate StorageService with env-based config
    const storageService = new StorageService();
    let deleted = 0;
    let failed = 0;
    for (const doc of docs) {
      if (doc.fileUrl) {
        try {
          await storageService.deleteFile(doc.fileUrl);
          deleted++;
        } catch (err) {
          console.error(`  WARN: failed to delete object for ${doc.id}: ${err}`);
          failed++;
        }
      }
    }
    console.log(`Deleted ${deleted} MinIO objects, ${failed} failures.`);

    // Null out fileUrl in DB
    const updated = await prisma.participantDocument.updateMany({
      where: { type: 'letter_of_acceptance', fileUrl: { not: null } },
      data: { fileUrl: null },
    });
    console.log(`Nulled fileUrl on ${updated.count} rows.`);

    await prisma.$disconnect();
    console.log('Done.');
  }

  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
  ```

- [ ] Document how to run (dry run first, then confirm):
  ```
  # Dry run (safe — shows what would be affected):
  Run: cd services/api && npx ts-node scripts/cleanup-loa-file-urls.ts
  Expected: Lists affected documents, prints "DRY RUN. Pass --confirm to actually execute."

  # Actual run (ONLY after verifying new LOA flow on prod):
  Run: cd services/api && npx ts-node scripts/cleanup-loa-file-urls.ts --confirm
  Expected: Prints deleted count + "Done."
  ```

- [ ] Commit:
  ```
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    add services/api/scripts/cleanup-loa-file-urls.ts
  git -C /Users/hendra/Projects/YBB/ybb-new/ybb-platform \
    commit -m "chore: add post-cutover LOA fileUrl cleanup script (DO NOT run at cutover)"
  ```

---

## Task 18: Final integration smoke test [Phase G]

This is a manual checklist run on the dev environment after all code is deployed.

**Steps:**

- [ ] Verify API migrations run on boot (check docker logs on dev deploy):
  ```
  Run: docker logs ybb-api 2>&1 | grep -i "migrate"
  Expected: "All migrations have been applied" or "Running migration 20260616100000_loa_release_batches"
  ```

- [ ] Admin — create a batch:
  ```
  1. Navigate to admin: /programs/<programId>/documents/loa-template → Batches tab
  2. Click "Create Batch", fill: Name="Wave 1", From=2026-01-01, To=2026-06-30
  3. Expected: new batch row appears with status "Draft"
  ```

- [ ] Admin — test overlap validation:
  ```
  1. Try to create another batch with overlapping dates (e.g. From=2026-04-01, To=2026-07-31)
  2. Expected: error message "overlaps with existing batch 'Wave 1'"
  ```

- [ ] Admin — release the batch:
  ```
  1. Toggle the Release switch on "Wave 1"
  2. Expected: badge changes to "Released"
  ```

- [ ] Portal — verify eligible participant sees download button:
  ```
  1. Log in as a participant with status=accepted and submission_date within the batch range
  2. Navigate to Documents tab
  3. Expected: "Download Letter of Acceptance" button visible (not locked state)
  ```

- [ ] Portal — verify ineligible participant sees locked state:
  ```
  1. Log in as a participant with status=rejected OR submission_date outside all released batches
  2. Navigate to Documents tab
  3. Expected: locked state card with "Your Letter of Acceptance will be available once released."
  ```

- [ ] Portal — download LOA:
  ```
  1. As eligible participant, click "Download Letter of Acceptance"
  2. Expected: PDF downloads; filename is "LOA-<programCode>-XXXX.pdf"
  3. Verify PDF content contains participant name, program name, document number
  ```

- [ ] Portal — re-download keeps same document number:
  ```
  1. Download again
  2. Expected: same filename / document number; download_count incremented in admin Downloads tab
  ```

- [ ] Admin — Downloads tab reflects tracking:
  ```
  1. Navigate to Downloads tab
  2. Expected: row for the participant showing documentNumber, firstDownloadedAt, downloadCount ≥ 1
  ```

- [ ] Admin — unrelease batch revokes access:
  ```
  1. Toggle release off for "Wave 1"
  2. As eligible participant, click download button (if still visible) or refresh Documents tab
  3. Expected: 403 or locked state; participant can no longer download
  ```

---

## Self-Review

### Spec Coverage

| Spec Section | Tasks |
|---|---|
| §1 Summary (on-demand streaming, no storage, release batches, audit records) | Tasks 1, 2, 8, 9 |
| §3 Eligibility Gate (status ∈ submitted/accepted, submission_date in released batch) | Task 6 |
| §4.1 loa_release_batches table | Task 1 |
| §4.2 ParticipantDocument new columns (download_count, first/last_downloaded_at, loa_release_batch_id) | Task 2 |
| §5.1 Portal GET /v1/portal/loa/download (gate, assign/reuse docNum, generateLoa, StreamableFile, tracking, rate limit) | Tasks 6, 7, 8, 9 |
| §5.2 Admin batch CRUD + release/unrelease + loa-downloads | Tasks 3, 4, 5 |
| §6 Admin UI — 3 tabs, remove Generate/Bulk/Drawer | Tasks 12, 13, 14, 16 |
| §7 Participant UI — eligibility-based LOA card, locked state | Tasks 9, 10, 11 |
| §8 Generation/Streaming — FileServiceClient.generateLoa reused, StreamableFile, no MinIO | Task 8 |
| §9 Removed/Obsolete — loa_ready event, email handler, template, Mark-viewed, fileUrl upload | Tasks 15, 16 |
| §10 Existing Data Cleanup (post-cutover) | Task 17 |
| §11 Edge Cases — overlap, date inclusivity, status change, unrelease, re-download, no batch | Tasks 1 (indexes), 4 (overlap), 6 (status, date-range, unrelease), 7 (assign-once), 8 (re-download count, rate limit) |
| §12 Testing | Tests embedded in Tasks 3, 4, 6, 7, 8, 9 + smoke test Task 18 |
| §13 Rollout | Task 18 (smoke test mirrors the rollout checklist) |

### Placeholder Scan

No TBDs, no "similar to Task N" references, no "add error handling" stubs. Every code block is complete and production-ready.

The one intentional omission: Task 8 (download endpoint) uses a two-step update for `firstDownloadedAt` (updateMany where null) rather than a single upsert, because Prisma's `update` does not support a conditional set. This is correct but worth noting in PR description.

### Type Consistency

| Type | Defined In | Used In |
|---|---|---|
| `LoaBatch` | Task 12 (`api-client.ts`) | Tasks 12, 13, 14 |
| `CreateLoaBatchInput` | Task 12 (`api-client.ts`) | Tasks 13 (dialog) |
| `UpdateLoaBatchInput` | Task 12 (`api-client.ts`) | Tasks 13 (dialog) |
| `LoaDownload` | Task 12 (`api-client.ts`) | Tasks 12, 14 |
| `CreateLoaBatchDto` | Task 4 (`loa-batch.dto.ts`) | Task 5 (controller) |
| `UpdateLoaBatchDto` | Task 4 (`loa-batch.dto.ts`) | Task 5 (controller) |
| `LoaBatchResponseDto` | Task 4 (`loa-batch.dto.ts`) | Task 5 (controller return type) |
| `LoaDownloadResponseDto` | Task 4 (`loa-batch.dto.ts`) | Task 5 (controller return type) |
| `EligibilityResult` | Task 6 (`loa-eligibility.service.ts`) | Tasks 8, 9 |
| `AssignOrGetResult` | Task 7 (`loa-document-number.service.ts`) | Task 8 |
| `CreateLoaBatchData` | Task 3 (`loa-release-batch.repository.ts`) | Task 4 (handlers) |
| `UpdateLoaBatchData` | Task 3 (`loa-release-batch.repository.ts`) | Task 4 (handlers) |
| `GenerateLoaPayload` | Existing `file-service.client.ts` | Task 8 (download endpoint) |
| `PortalDocument` (updated) | Task 11 (`DocumentsSection.tsx`) | Task 11 |

All types flow consistently across task boundaries — no type defined in a later task is used in an earlier task.
