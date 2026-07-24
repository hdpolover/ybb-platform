# LoA Preview as Real Participant Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the admin LOA template preview render exactly what a named real participant will receive (persisted template + real data), instead of a hand-rolled sample that can never fail the way the participant download fails.

**Architecture:** Extract the source-map-building logic that `LoaDownloadService` uses into a new `LoaRenderDataService` (portal module), so both the real download and the admin preview turn an `applicationId` into placeholder data through the exact same code. A new `LoaPreviewParticipantService` (programs module) resolves *who* to preview as - an explicit `applicationId`, an auto-picked submitted/accepted application, or a sample-data fallback when the program has no applications yet - and resolves the document number without ever allocating one. The preview endpoint gains `applicationId`/`source` body params and reports back who it rendered via response headers, since it still returns a raw PDF blob.

**Tech Stack:** NestJS (CQRS query handler), Prisma, class-validator DTOs, Next.js 16 admin dashboard (React, Tiptap), Jest.

## Global Constraints

- Repo uses npm, not pnpm, for `services/api` and `services/admin-dashboard`.
- The global `ValidationPipe` (`services/api/src/main.ts:102-110`) runs `whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true }` - every DTO array-of-objects field REQUIRES `@Type(() => SomeDto)` alongside `@ValidateNested({ each: true })`, or nested objects arriving as plain JSON get stripped/rejected.
- Backend tests run with `npx jest <path>` from `services/api` (jest config lives in `services/api/package.json`, `rootDir: "src"`, `testRegex: ".*\\.spec\\.ts$"`).
- No em dashes in code comments or UI copy - use periods, commas, or parentheses instead. (This plan document itself is exempt; it is not shipped code/UI copy.)
- `document_number` is the ONLY field allowed to differ between preview-saved and download `GenerateLoaParams` output for the same application. The parity test (Task 4) must exclude it explicitly, not by accident.
- `services/admin-dashboard` has no test runner configured at all (no jest/vitest, no `test` script, zero existing `*.test.ts(x)`/`*.spec.ts(x)` files). Frontend tasks in this plan substitute `npm run build` (typecheck via `next build`) plus explicit manual-verification steps for the automated red/green test loop used in backend tasks. This is a deliberate, documented deviation for frontend-only tasks - do not invent a fake `npm test` command that doesn't exist in this repo.
- `ParticipantApplication` (Prisma model, `prisma/schema/applications.prisma:135`) has no `deletedAt` column - there is no soft-delete state to special-case. "applicationId not found, wrong program, or otherwise invalid" all collapse into one Prisma lookup returning `null`.

---

## File Structure

| File | Responsibility |
|---|---|
| `services/api/src/modules/portal/application/services/loa-render-data.service.ts` (new) | `LoaRenderDataService.buildSourceMapForApplication()` - turns an `applicationId` + doc number/signer opts into the flat placeholder source map + header display-name/batch split. The single shared piece download and preview both call. |
| `services/api/src/modules/portal/application/services/loa-render-data.service.spec.ts` (new) | Unit tests for the above, including the `personal_data` dead-column fallback (moved out of `loa-download.service.spec.ts`). |
| `services/api/src/modules/portal/application/services/loa-download.service.ts` (modify) | Slims down to participant/application/eligibility/template/doc-number orchestration; delegates source-map construction to `LoaRenderDataService`. |
| `services/api/src/modules/portal/application/services/loa-download.service.spec.ts` (modify) | Rewritten to mock `LoaRenderDataService`; keeps only the behavior `LoaDownloadService` itself still owns. |
| `services/api/src/modules/portal/portal.module.ts` (modify) | Registers + exports `LoaRenderDataService` so `ProgramsModule` can inject it. |
| `services/api/src/modules/programs/application/services/loa-preview-participant.service.ts` (new) | `LoaPreviewParticipantService` - resolves which application to preview as (explicit id / auto-pick / sample fallback) and resolves the document number without side effects. |
| `services/api/src/modules/programs/application/services/loa-preview-participant.service.spec.ts` (new) | Unit tests: explicit id validation, auto-pick pool rule (ignores batch release), sample fallback, doc-number resolution has zero write calls. |
| `services/api/src/modules/programs/application/handlers/loa-preview.handler.ts` (modify) | `PreviewLoaTemplateQuery` gains `applicationId`/`source`; handler resolves draft-vs-saved template content, delegates participant resolution + render data, returns `{ buffer, participantName, isSample }`. |
| `services/api/src/modules/programs/application/handlers/loa-preview.handler.spec.ts` (new) | Unit tests for the rewritten handler: draft/saved sourcing, 409 on unpublished saved template, 404 on bad `applicationId`, sample fallback, error propagation. |
| `services/api/src/modules/programs/presentation/dto/create-update-program-content.dto.ts` (modify) | `PreviewDocumentTemplateDto` gains optional `applicationId` (UUID) and `source` (`'draft' | 'saved'`). |
| `services/api/src/modules/programs/presentation/program-content.controller.ts` (modify) | Passes the new params through; sets `X-Preview-Participant-Name` (URI-encoded) and `X-Preview-Is-Sample` response headers. |
| `services/api/src/modules/programs/programs.module.ts` (modify) | Imports `PortalModule`; registers `LoaPreviewParticipantService`. |
| `services/api/src/main.ts` (modify) | Adds `exposedHeaders` to `app.enableCors(...)` so the browser can read the two new response headers cross-origin. |
| `services/api/src/modules/portal/application/services/loa-download-preview-parity.spec.ts` (new) | The parity test: download vs preview(source=saved) for the same fixture application produce identical `GenerateLoaParams`, excluding `document_number`. |
| `services/admin-dashboard/src/shared/api-client.ts` (modify) | `previewDocumentTemplate()` accepts `applicationId`/`source`, returns `{ blob, participantName, isSample }` instead of a bare `Blob`. |
| `services/admin-dashboard/app/components/documents/LoaParticipantPicker.tsx` (new) | Search dialog reusing `listApplications()` (existing admin applications search endpoint) to let an admin pick who to preview as. |
| `services/admin-dashboard/app/components/documents/LoaTemplateEditor.tsx` (modify) | Two-pane DRAFT/SAVED preview, "Previewing as" header with `[change]` picker trigger and sample-data notice, client-side drift warning. |

---

### Task 1: Extract LoaRenderDataService out of LoaDownloadService

**Files:**
- Create: `services/api/src/modules/portal/application/services/loa-render-data.service.ts`
- Create: `services/api/src/modules/portal/application/services/loa-render-data.service.spec.ts`
- Modify: `services/api/src/modules/portal/application/services/loa-download.service.ts:1-251` (full rewrite)
- Modify: `services/api/src/modules/portal/application/services/loa-download.service.spec.ts:1-414` (full rewrite)
- Modify: `services/api/src/modules/portal/portal.module.ts:1-52`
- Test: `services/api/src/modules/portal/application/services/loa-render-data.service.spec.ts`, `services/api/src/modules/portal/application/services/loa-download.service.spec.ts`

**Interfaces:**
- Consumes: `buildLoaSourceMap` from `@shared/utils/loa-render-payload.util` (existing, unchanged), `parseProgramBatch` from `@shared/utils/parse-program-batch` (existing, unchanged), `PrismaService` (existing).
- Produces: `export function formatGender(gender: string | null | undefined): string`, `export function formatPhone(countryCode: string | null | undefined, phoneNumber: string | null | undefined): string`, `export function readPersonalDataField(personalData: unknown, key: string, fallback: string | null | undefined): string`, `export interface BuildSourceMapOptions { documentNumber: string; signerName: string; signerTitle: string }`, `export interface LoaRenderData { sourceMap: Record<string, string>; programDisplayName: string; programBatch: string }`, `LoaRenderDataService.buildSourceMapForApplication(applicationId: string, opts: BuildSourceMapOptions): Promise<LoaRenderData>` - used by Task 3 (`PreviewLoaTemplateHandler`) and Task 4 (parity test).

This is a design decision worth flagging explicitly: the design spec's pseudocode shows `buildSourceMapForApplication(applicationId, opts: { documentNumber })` returning `Record<string, string>`. The actual implementation needs `signerName`/`signerTitle` in `opts` too (they're per-template signature fields the caller has already resolved via `resolveLoaSignature`, and they belong in the flat source map), and needs to return `programDisplayName`/`programBatch` alongside `sourceMap` because `buildGenerateLoaParams` needs those as separate top-level fields for the `header` block, and re-deriving them would require the caller to re-fetch the program row, defeating the point of the extraction. The spec's "roughly" wording licenses this.

- [ ] **Step 1: Write the failing tests**

`services/api/src/modules/portal/application/services/loa-render-data.service.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LoaRenderDataService } from './loa-render-data.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('LoaRenderDataService', () => {
  let service: LoaRenderDataService;
  let prisma: jest.Mocked<PrismaService>;

  const mockApplication = {
    id: 'app-1',
    programId: 'program-1',
    personalData: null,
    participant: { fullName: 'John Doe' },
    participationCategory: { name: 'International' },
  };
  const mockProgram = {
    id: 'program-1',
    name: 'YBB 2026',
    year: 2026,
    startDate: new Date('2026-07-01'),
    endDate: new Date('2026-07-14'),
    location: 'Bali, Indonesia',
  };
  const defaultOpts = { documentNumber: 'LOA-2026-0001', signerName: '', signerTitle: '' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoaRenderDataService,
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { findFirst: jest.fn() },
            program: { findUnique: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get<LoaRenderDataService>(LoaRenderDataService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  it('throws NotFoundException when the application does not exist', async () => {
    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

    await expect(service.buildSourceMapForApplication('missing-app', defaultOpts)).rejects.toThrow(NotFoundException);
    expect(prisma.program.findUnique).not.toHaveBeenCalled();
  });

  it('throws NotFoundException when the application programId points at a missing program', async () => {
    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(service.buildSourceMapForApplication('app-1', defaultOpts)).rejects.toThrow(NotFoundException);
  });

  it('splits "Program Name Batch N" into program.batch, and degrades new placeholders to "" (never "null"/"undefined") when participant fields are missing', async () => {
    const applicationWithNullableFields = {
      ...mockApplication,
      participant: {
        fullName: 'John Doe',
        // institution/nationality/birthdate/gender/originCountry/phoneCountryCode/
        // phoneNumber/major/occupation/user all intentionally absent to exercise the
        // null-guard fallback on every new placeholder.
      },
    };
    const programWithBatchSuffix = { ...mockProgram, name: 'Japan Youth Summit 2026 Batch 2' };

    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(applicationWithNullableFields);
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(programWithBatchSuffix);

    const result = await service.buildSourceMapForApplication('app-1', {
      documentNumber: 'LOA-2026-0001',
      signerName: '',
      signerTitle: '',
    });

    expect(result.programDisplayName).toBe('Japan Youth Summit 2026');
    expect(result.programBatch).toBe('2');
    expect(result.sourceMap['program.batch']).toBe('2');
    expect(result.sourceMap['participant.nationality']).toBe('');
    expect(result.sourceMap['participant.birthdate']).toBe('');
    expect(result.sourceMap['participant.gender']).toBe('');
    expect(result.sourceMap['participant.originCountry']).toBe('');
    expect(result.sourceMap['signer_name']).toBe('');
    expect(result.sourceMap['signer_title']).toBe('');
    expect(result.sourceMap['program.year']).toBe('2026');
    expect(result.sourceMap['participant.email']).toBe('');
    expect(result.sourceMap['participant.phone']).toBe('');
    expect(result.sourceMap['participant.major']).toBe('');
    expect(result.sourceMap['participant.occupation']).toBe('');

    for (const value of Object.values(result.sourceMap)) {
      expect(value).not.toBe('null');
      expect(value).not.toBe('undefined');
    }
  });

  describe('personalData fallback for institution/nationality/major/occupation', () => {
    it('(a) takes institution/nationality/major/occupation from personalData when present', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: {
          institution: 'Harvard University',
          nationality: 'American',
          major: 'Computer Science',
          occupation: 'Student',
        },
        participant: { fullName: 'John Doe', institution: '', nationality: '', major: '', occupation: '', gender: 'male' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Harvard University');
      expect(result.sourceMap['participant.nationality']).toBe('American');
      expect(result.sourceMap['participant.major']).toBe('Computer Science');
      expect(result.sourceMap['participant.occupation']).toBe('Student');
    });

    it('(b) falls back to the participant column when personalData lacks the key or is null', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: { institution: 'Harvard University' },
        participant: {
          fullName: 'John Doe',
          institution: 'Should Be Overridden',
          nationality: 'Indonesian',
          major: 'Biology',
          occupation: 'Engineer',
          gender: 'male',
        },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Harvard University');
      expect(result.sourceMap['participant.nationality']).toBe('Indonesian');
      expect(result.sourceMap['participant.major']).toBe('Biology');
      expect(result.sourceMap['participant.occupation']).toBe('Engineer');
    });

    it('(b2) falls back to the participant column when personalData itself is null', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: null,
        participant: {
          fullName: 'John Doe',
          institution: 'Fallback University',
          nationality: 'Indonesian',
          major: 'Biology',
          occupation: 'Engineer',
          gender: 'male',
        },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Fallback University');
      expect(result.sourceMap['participant.nationality']).toBe('Indonesian');
      expect(result.sourceMap['participant.major']).toBe('Biology');
      expect(result.sourceMap['participant.occupation']).toBe('Engineer');
    });

    it('(c) treats a whitespace-only personalData value as absent and falls back rather than rendering blank', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: { institution: '   ', nationality: '\t', major: '', occupation: '  ' },
        participant: {
          fullName: 'John Doe',
          institution: 'Fallback University',
          nationality: 'Indonesian',
          major: 'Biology',
          occupation: 'Engineer',
          gender: 'male',
        },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.institution']).toBe('Fallback University');
      expect(result.sourceMap['participant.nationality']).toBe('Indonesian');
      expect(result.sourceMap['participant.major']).toBe('Biology');
      expect(result.sourceMap['participant.occupation']).toBe('Engineer');
    });

    it('(d) leaves an already-correct participant field (fullName, gender) unchanged', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({
        ...mockApplication,
        personalData: {
          institution: 'Harvard University',
          nationality: 'American',
          major: 'Computer Science',
          occupation: 'Student',
        },
        participant: { fullName: 'Jane Smith', institution: '', nationality: '', major: '', occupation: '', gender: 'female' },
      });
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);

      const result = await service.buildSourceMapForApplication('app-1', defaultOpts);

      expect(result.sourceMap['participant.fullName']).toBe('Jane Smith');
      expect(result.sourceMap['participant.gender']).toBe('Female');
    });
  });
});
```

`services/api/src/modules/portal/application/services/loa-download.service.spec.ts` (full replacement):
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { LoaDownloadService } from './loa-download.service';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { LoaRenderDataService } from './loa-render-data.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { PortalCacheService } from './portal-cache.service';

describe('LoaDownloadService', () => {
  let service: LoaDownloadService;
  let loaEligibilityService: jest.Mocked<LoaEligibilityService>;
  let loaDocumentNumberService: jest.Mocked<LoaDocumentNumberService>;
  let loaRenderDataService: jest.Mocked<LoaRenderDataService>;
  let fileServiceClient: jest.Mocked<FileServiceClient>;
  let prisma: jest.Mocked<PrismaService>;
  let portalCacheService: jest.Mocked<PortalCacheService>;

  const mockParticipant = { id: 'participant-1', fullName: 'John Doe' };
  const mockApplication = { id: 'app-1', programId: 'program-1' };
  const mockProgram = { id: 'program-1', year: 2026 };
  const mockTemplate = {
    id: 'template-1',
    htmlContent: '<p>Hello {{participant.fullName}}</p>',
    placeholders: [
      { key: '{{participant.fullName}}', source: 'participant.fullName' },
      { key: '{{program.name}}', source: 'program.name' },
      { key: '{{document_number}}', source: 'participant_document.documentNumber' },
    ],
    layoutConfig: {
      headerHtml: '<header>YBB</header>',
      footerHtml: '<footer>YBB Footer</footer>',
      pageSize: 'A4',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
    },
  };
  const mockRenderData = {
    sourceMap: {
      'participant.fullName': 'John Doe',
      'program.name': 'YBB 2026',
      'participant_document.documentNumber': 'LOA-2026-0001',
    },
    programDisplayName: 'YBB 2026',
    programBatch: '',
  };
  const mockPdfBuffer = Buffer.from('PDF content');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoaDownloadService,
        {
          provide: LoaEligibilityService,
          useValue: { checkEligibility: jest.fn() },
        },
        {
          provide: LoaDocumentNumberService,
          useValue: { assignOrGet: jest.fn() },
        },
        {
          provide: LoaRenderDataService,
          useValue: { buildSourceMapForApplication: jest.fn() },
        },
        {
          provide: FileServiceClient,
          useValue: { generateLoa: jest.fn() },
        },
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { findFirst: jest.fn() },
            program: { findUnique: jest.fn() },
            documentTemplate: { findFirst: jest.fn() },
            participantDocument: {
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            signature: { findFirst: jest.fn() },
          },
        },
        {
          provide: PortalCacheService,
          useValue: { getParticipantProfile: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<LoaDownloadService>(LoaDownloadService);
    loaEligibilityService = module.get(LoaEligibilityService);
    loaDocumentNumberService = module.get(LoaDocumentNumberService);
    loaRenderDataService = module.get(LoaRenderDataService);
    fileServiceClient = module.get(FileServiceClient);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    portalCacheService = module.get(PortalCacheService);
  });

  function mockHappyPath() {
    (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
    (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
    (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(mockTemplate);
    (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: true, batchId: 'batch-1' });
    (loaDocumentNumberService.assignOrGet as jest.Mock).mockResolvedValue({
      docNumber: 'LOA-2026-0001',
      isNew: false,
      existingDocId: 'doc-1',
    });
    (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mockResolvedValue(mockRenderData);
    (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
    (prisma.participantDocument.update as jest.Mock).mockResolvedValue({});
    (prisma.participantDocument.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
  }

  describe('downloadLoa', () => {
    it('(a) throws ForbiddenException when participant is not eligible', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
      (loaEligibilityService.checkEligibility as jest.Mock).mockResolvedValue({ eligible: false });

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('(b) eligible → calls generateLoa and returns buffer with doc number in filename', async () => {
      mockHappyPath();

      const result = await service.downloadLoa('user-1', 'brand-1');

      expect(loaDocumentNumberService.assignOrGet).toHaveBeenCalledWith(
        mockApplication.id,
        mockApplication.programId,
        String(mockProgram.year),
        mockTemplate.id,
      );
      expect(loaRenderDataService.buildSourceMapForApplication).toHaveBeenCalledWith(
        mockApplication.id,
        expect.objectContaining({ documentNumber: 'LOA-2026-0001' }),
      );
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({
          html_content: expect.any(String),
          document_number: 'LOA-2026-0001',
          placeholder_data: expect.objectContaining({
            '{{document_number}}': 'LOA-2026-0001',
          }),
        }),
      );
      expect(result.buffer).toBe(mockPdfBuffer);
      expect(result.filename).toBe('LOA-LOA-2026-0001.pdf');
    });

    it('(c) records download tracking - increments downloadCount and sets lastDownloadedAt', async () => {
      mockHappyPath();

      await service.downloadLoa('user-1', 'brand-1');

      expect(prisma.participantDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1' },
          data: expect.objectContaining({
            downloadCount: { increment: 1 },
            lastDownloadedAt: expect.any(Date),
            loaReleaseBatchId: 'batch-1',
          }),
        }),
      );
      expect(prisma.participantDocument.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-1', firstDownloadedAt: null },
          data: { firstDownloadedAt: expect.any(Date) },
        }),
      );
    });

    it('throws NotFoundException when participant not found', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(NotFoundException);
    });

    it('throws ForbiddenException when application not found (inverted resolution: application first)', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(ForbiddenException);
      expect(prisma.program.findUnique).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when program not found', async () => {
      (portalCacheService.getParticipantProfile as jest.Mock).mockResolvedValue(mockParticipant);
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(mockApplication);
      (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.downloadLoa('user-1', 'brand-1')).rejects.toThrow(NotFoundException);
      expect(loaEligibilityService.checkEligibility).not.toHaveBeenCalled();
    });

    it('delegates the flat placeholder-source-map construction entirely to LoaRenderDataService, passing documentNumber/signerName/signerTitle', async () => {
      mockHappyPath();

      await service.downloadLoa('user-1', 'brand-1');

      expect(loaRenderDataService.buildSourceMapForApplication).toHaveBeenCalledTimes(1);
      const [calledApplicationId, calledOpts] = (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mock.calls[0];
      expect(calledApplicationId).toBe('app-1');
      expect(calledOpts).toEqual(
        expect.objectContaining({
          documentNumber: 'LOA-2026-0001',
          signerName: expect.any(String),
          signerTitle: expect.any(String),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**
Run: `cd services/api && npx jest src/modules/portal/application/services/loa-render-data.service.spec.ts src/modules/portal/application/services/loa-download.service.spec.ts`
Expected: FAIL - `loa-render-data.service.ts` does not exist yet (`Cannot find module './loa-render-data.service'`), and `loa-download.service.spec.ts` fails to compile/mock a `LoaRenderDataService` that isn't yet imported by `loa-download.service.ts`.

- [ ] **Step 3: Write minimal implementation**

`services/api/src/modules/portal/application/services/loa-render-data.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { parseProgramBatch } from '@shared/utils/parse-program-batch';
import { buildLoaSourceMap } from '@shared/utils/loa-render-payload.util';

// Gender enum values (prisma/schema/enums.prisma) are lowercase 'male' | 'female'.
// Rendered human-readable on the LOA for visa-support tokens.
export function formatGender(gender: string | null | undefined): string {
  if (gender === 'male') return 'Male';
  if (gender === 'female') return 'Female';
  return '';
}

// Joins phone country code + number sensibly. No double spaces, degrades to
// whichever half is present, empty string when neither is.
export function formatPhone(countryCode: string | null | undefined, phoneNumber: string | null | undefined): string {
  const cc = countryCode?.trim();
  const num = phoneNumber?.trim();
  if (cc && num) return `${cc} ${num}`;
  return cc || num || '';
}

// participants.institution/nationality/major/occupation are never populated on this
// platform (verified in prod: 0/13,199 participants have any of these set). The real
// values live in participant_applications.personal_data (JSON). Read from there first,
// falling back to the dead participant column so nothing regresses if personal_data is
// null or missing the key. A whitespace-only value counts as absent too.
export function readPersonalDataField(personalData: unknown, key: string, fallback: string | null | undefined): string {
  if (personalData && typeof personalData === 'object' && !Array.isArray(personalData)) {
    const value = (personalData as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim() !== '') return value.trim();
  }
  return fallback ?? '';
}

export interface BuildSourceMapOptions {
  documentNumber: string;
  signerName: string;
  signerTitle: string;
}

export interface LoaRenderData {
  sourceMap: Record<string, string>;
  programDisplayName: string;
  programBatch: string;
}

/**
 * Builds the flat placeholder source map (and the header display-name/batch
 * split) for a given application. The single place that turns a participant
 * + program row pair into LOA template tokens.
 *
 * Used by both the real participant download (LoaDownloadService) and the
 * admin preview endpoint (PreviewLoaTemplateHandler, source: 'saved' | 'draft')
 * so the two paths can never diverge on what "real participant data" means.
 *
 * Deliberately excludes: eligibility, document-number assignment/persistence,
 * template content/placeholders, signature resolution. Every caller owns
 * those on its own, since they differ by call site (download always assigns
 * a document number, preview never does; download uses the persisted
 * template, preview may use an unsaved draft).
 */
@Injectable()
export class LoaRenderDataService {
  constructor(private readonly prisma: PrismaService) {}

  async buildSourceMapForApplication(applicationId: string, opts: BuildSourceMapOptions): Promise<LoaRenderData> {
    const application = await this.prisma.participantApplication.findFirst({
      where: { id: applicationId },
      select: {
        id: true,
        programId: true,
        personalData: true,
        participant: {
          select: {
            fullName: true,
            institution: true,
            nationality: true,
            birthdate: true,
            gender: true,
            originCountry: true,
            phoneCountryCode: true,
            phoneNumber: true,
            major: true,
            occupation: true,
            user: { select: { email: true } },
          },
        },
        participationCategory: { select: { name: true } },
      },
    });
    if (!application) throw new NotFoundException('Application not found');

    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: {
        id: true,
        name: true,
        year: true,
        startDate: true,
        endDate: true,
        location: true,
        theme: true,
        brand: { select: { name: true } },
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    const now = new Date();
    const generatedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
    const startDate = program.startDate
      ? program.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const endDate = program.endDate
      ? program.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const birthdate = application.participant.birthdate
      ? application.participant.birthdate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : '';
    const { displayName: programDisplayName, batch: programBatch } = parseProgramBatch(program.name);

    const sourceMap = buildLoaSourceMap({
      participantFullName: application.participant.fullName,
      programName: program.name,
      programBatch,
      generatedAt,
      documentNumber: opts.documentNumber,
      participationCategoryName: application.participationCategory?.name ?? '',
      programLocation: program.location ?? '',
      programStartDate: startDate,
      programEndDate: endDate,
      institution: readPersonalDataField(application.personalData, 'institution', application.participant.institution),
      nationality: readPersonalDataField(application.personalData, 'nationality', application.participant.nationality),
      birthdate,
      gender: formatGender(application.participant.gender),
      originCountry: application.participant.originCountry ?? '',
      signerName: opts.signerName,
      signerTitle: opts.signerTitle,
      programYear: String(program.year),
      participantEmail: application.participant.user?.email ?? '',
      participantPhone: formatPhone(application.participant.phoneCountryCode, application.participant.phoneNumber),
      major: readPersonalDataField(application.personalData, 'major', application.participant.major),
      occupation: readPersonalDataField(application.personalData, 'occupation', application.participant.occupation),
      programTheme: program.theme ?? '',
      brandName: program.brand?.name ?? '',
    });

    return { sourceMap, programDisplayName, programBatch };
  }
}
```

`services/api/src/modules/portal/application/services/loa-download.service.ts` (full replacement):
```ts
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { LoaRenderDataService } from './loa-render-data.service';
import { PortalCacheService } from './portal-cache.service';
import { resolveLoaSignature, buildGenerateLoaParams } from '@shared/utils/loa-render-payload.util';

export interface LoaDownloadResult {
  buffer: Buffer;
  filename: string;
}

@Injectable()
export class LoaDownloadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly portalCacheService: PortalCacheService,
    private readonly loaEligibilityService: LoaEligibilityService,
    private readonly loaDocumentNumberService: LoaDocumentNumberService,
    private readonly loaRenderDataService: LoaRenderDataService,
    private readonly fileServiceClient: FileServiceClient,
  ) {}

  async downloadLoa(userId: string, brandId: string): Promise<LoaDownloadResult> {
    // 1. Resolve participant
    const participant = await this.portalCacheService.getParticipantProfile(userId);
    if (!participant) throw new NotFoundException('Participant not found');

    // 2. Resolve the participant's application first (Bug 1 fix: invert resolution order).
    //    A brand can have >1 active program, so resolving program by brandId alone risks
    //    picking the wrong one. Instead we find the application and read programId from it.
    const application = await this.prisma.participantApplication.findFirst({
      where: { participantId: participant.id },
      select: { id: true, programId: true },
    });
    if (!application) throw new ForbiddenException('Invitation Letter not available');

    // 3. Resolve the program deterministically from the application's own programId.
    //    Only `id`/`year` needed here - LoaRenderDataService (step 8) fetches the full
    //    program row on its own.
    const program = await this.prisma.program.findUnique({
      where: { id: application.programId },
      select: { id: true, year: true },
    });
    if (!program) throw new NotFoundException('Program not found');

    // 4. Eligibility gate
    const eligibility = await this.loaEligibilityService.checkEligibility(application.id, program.id);
    if (!eligibility.eligible) throw new ForbiddenException('Invitation Letter not available');

    // 5. Fetch the active LOA document template (moved before assignOrGet so we can pass
    //    its id to assignOrGet - Bug 2 fix: templateId must be set on the created row)
    const template = await this.prisma.documentTemplate.findFirst({
      where: { programId: program.id, type: 'letter_of_acceptance', isActive: true, deletedAt: null },
      select: { id: true, htmlContent: true, placeholders: true, layoutConfig: true },
    });
    if (!template || !template.htmlContent) {
      throw new NotFoundException('Invitation Letter template not configured');
    }

    // 6. Assign or reuse stable document number (Bug 2 fix: pass template.id so the
    //    ParticipantDocument row carries templateId, enabling GetPortalDocumentsHandler
    //    to match it by templateId and skip it in the uploaded-docs loop)
    const programCode = String(program.year);
    const { docNumber, existingDocId } = await this.loaDocumentNumberService.assignOrGet(
      application.id,
      program.id,
      programCode,
      template.id,
    );

    // 7. Extract layout settings from layoutConfig
    const layoutConfig = (template.layoutConfig ?? {}) as Record<string, unknown>;
    const headerConfig = (layoutConfig['header'] as Record<string, unknown> | undefined) ?? undefined;

    // 7b. Resolve signature - legacy fallback is raw layoutConfig.signatureUrl with
    // empty signer name/title. If layoutConfig.signatureId is set, look up the
    // reusable brand-scoped Signature record and supersede the legacy values with
    // its imageUrl/name/title. Any lookup failure degrades gracefully back to the
    // legacy fallback - a bad signature reference must never break LOA download.
    const { signatureUrl, signerName, signerTitle } = await resolveLoaSignature(this.prisma, {
      signatureUrl: layoutConfig['signatureUrl'] as string | undefined,
      signatureId: layoutConfig['signatureId'] as string | undefined,
    });

    // 8. Build the flat placeholder source map - the single shared piece with the
    //    admin preview endpoint. See LoaRenderDataService.
    const { sourceMap, programDisplayName, programBatch } = await this.loaRenderDataService.buildSourceMapForApplication(
      application.id,
      { documentNumber: docNumber, signerName, signerTitle },
    );

    const placeholders = (template.placeholders ?? []) as Array<{ key: string; source: string }>;

    // 9. Generate PDF via file service - no storage upload
    const buffer = await this.fileServiceClient.generateLoa(
      buildGenerateLoaParams({
        htmlContent: template.htmlContent,
        layoutConfig: {
          headerHtml: layoutConfig['headerHtml'] as string | undefined,
          footerHtml: layoutConfig['footerHtml'] as string | undefined,
          pageSize: layoutConfig['pageSize'] as string | undefined,
          margins: layoutConfig['margins'] as { top: number; right: number; bottom: number; left: number } | undefined,
          logoUrl: layoutConfig['logoUrl'] as string | undefined,
          stampUrl: layoutConfig['stampUrl'] as string | undefined,
          footerNote: layoutConfig['footerNote'] as string | undefined,
          showGeneratedDate: layoutConfig['showGeneratedDate'] as boolean | undefined,
          header: headerConfig
            ? {
                tagline: headerConfig['tagline'] as string | undefined,
                website: headerConfig['website'] as string | undefined,
                email: headerConfig['email'] as string | undefined,
                phone: headerConfig['phone'] as string | undefined,
              }
            : undefined,
        },
        placeholders,
        sourceMap,
        documentNumber: docNumber,
        signatureUrl,
        signerName,
        signerTitle,
        programDisplayName,
        programBatch,
      }),
    );

    // 10. Record download tracking
    const now = new Date();
    await this.prisma.participantDocument.update({
      where: { id: existingDocId },
      data: {
        downloadCount: { increment: 1 },
        lastDownloadedAt: now,
        loaReleaseBatchId: eligibility.batchId,
      },
    });
    // Set firstDownloadedAt only on first download (null guard avoids overwriting)
    await this.prisma.participantDocument.updateMany({
      where: { id: existingDocId, firstDownloadedAt: null },
      data: { firstDownloadedAt: now },
    });

    return { buffer, filename: `LOA-${docNumber}.pdf` };
  }
}
```

`services/api/src/modules/portal/application/services/loa-download.service.spec.ts`: paste the full file from Step 1 verbatim (already the target implementation, not a draft).

`services/api/src/modules/portal/application/services/loa-render-data.service.spec.ts`: paste the full file from Step 1 verbatim.

`services/api/src/modules/portal/portal.module.ts` (full replacement):
```ts
import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { AuthModule } from '../auth/auth.module';
import { PaymentsModule } from '../payments/payments.module';
import { FilesModule } from '../files/files.module';
import { ParticipantsModule } from '../participants/participants.module';

// Existing
import { PortalController } from './presentation/portal.controller';
import { GetPortalDashboardHandler } from './application/queries/handlers/get-portal-dashboard.handler';
import { GetPortalSubmissionsHandler } from './application/queries/handlers/get-portal-submissions.handler';
import { GetPortalPaymentsHandler } from './application/queries/handlers/get-portal-payments.handler';
import { GetPortalPaymentDetailHandler } from './application/queries/handlers/get-portal-payment-detail.handler';
import { GetPortalDocumentsHandler } from './application/queries/handlers/get-portal-documents.handler';
import { PortalCacheService } from './application/services/portal-cache.service';
import { PortalReceiptService } from './application/services/portal-receipt.service';
import { LoaEligibilityService } from './application/services/loa-eligibility.service';
import { LoaDocumentNumberService } from './application/services/loa-document-number.service';
import { LoaRenderDataService } from './application/services/loa-render-data.service';
import { LoaDownloadService } from './application/services/loa-download.service';
import { ConfirmPortalPaymentHandler } from './application/commands/handlers/confirm-portal-payment.handler';
import { CancelPortalPaymentHandler } from './application/commands/handlers/cancel-portal-payment.handler';
import { EnsurePortalPaymentInvoiceHandler } from './application/commands/handlers/ensure-portal-payment-invoice.handler';

// New - Submissions
import { PortalSubmissionsController } from './presentation/portal-submissions.controller';
import { GetPortalSubmissionDetailHandler } from './application/queries/handlers/get-portal-submission-detail.handler';
import { SaveSubmissionSectionHandler } from './application/commands/handlers/save-submission-section.handler';
import { PortalSubmitApplicationHandler } from './application/commands/handlers/portal-submit-application.handler';

// New - Certificates
import { PortalCertificatesController } from './presentation/portal-certificates.controller';
import { GetPortalCertificatesHandler } from './application/queries/handlers/get-portal-certificates.handler';
import { DownloadCertificateHandler } from './application/commands/handlers/download-certificate.handler';

// New - Documents
import { UploadSignedCopyHandler } from './application/commands/handlers/upload-signed-copy.handler';

@Module({
    imports: [CqrsModule, AuthModule, PaymentsModule, FilesModule, ParticipantsModule],
    controllers: [
        PortalController,
        PortalSubmissionsController,
        PortalCertificatesController,
    ],
    providers: [
        PortalCacheService,
        PortalReceiptService,
        LoaEligibilityService,
        LoaDocumentNumberService,
        LoaRenderDataService,
        LoaDownloadService,
        // Existing query handlers
        GetPortalDashboardHandler,
        GetPortalSubmissionsHandler,
        GetPortalPaymentsHandler,
        GetPortalPaymentDetailHandler,
        GetPortalDocumentsHandler,
        // New query handlers
        GetPortalSubmissionDetailHandler,
        GetPortalCertificatesHandler,
        // Command handlers
        SaveSubmissionSectionHandler,
        PortalSubmitApplicationHandler,
        DownloadCertificateHandler,
        ConfirmPortalPaymentHandler,
        CancelPortalPaymentHandler,
        EnsurePortalPaymentInvoiceHandler,
        UploadSignedCopyHandler,
    ],
    exports: [LoaRenderDataService],
})
export class PortalModule { }
```

- [ ] **Step 4: Run tests to verify they pass**
Run: `cd services/api && npx jest src/modules/portal/application/services/loa-render-data.service.spec.ts src/modules/portal/application/services/loa-download.service.spec.ts`
Expected: PASS - both suites green.

- [ ] **Step 5: Commit**
```bash
git add services/api/src/modules/portal/application/services/loa-render-data.service.ts \
        services/api/src/modules/portal/application/services/loa-render-data.service.spec.ts \
        services/api/src/modules/portal/application/services/loa-download.service.ts \
        services/api/src/modules/portal/application/services/loa-download.service.spec.ts \
        services/api/src/modules/portal/portal.module.ts
git commit -m "$(cat <<'EOF'
refactor: extract LoaRenderDataService from LoaDownloadService

Isolates the participant/program-to-placeholder source-map construction
into its own service so the admin LOA preview (next commits) can reuse
the exact same code path as the real participant download, instead of
a hand-rolled sample-data mock that can never fail the way the real
download fails.
EOF
)"
```

---

### Task 2: Add LoaPreviewParticipantService (pool resolution + side-effect-free document number)

**Files:**
- Create: `services/api/src/modules/programs/application/services/loa-preview-participant.service.ts`
- Create: `services/api/src/modules/programs/application/services/loa-preview-participant.service.spec.ts`
- Test: `services/api/src/modules/programs/application/services/loa-preview-participant.service.spec.ts`

**Interfaces:**
- Consumes: `PrismaService` (existing).
- Produces: `export type ResolvedPreviewParticipant = { isSample: true } | { isSample: false; applicationId: string }`, `LoaPreviewParticipantService.resolveApplicationId(programId: string, applicationId?: string): Promise<ResolvedPreviewParticipant>`, `LoaPreviewParticipantService.resolveDocumentNumber(applicationId: string): Promise<string>` - both used by Task 3 (`PreviewLoaTemplateHandler`).

- [ ] **Step 1: Write the failing test**

`services/api/src/modules/programs/application/services/loa-preview-participant.service.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { LoaPreviewParticipantService } from './loa-preview-participant.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('LoaPreviewParticipantService', () => {
  let service: LoaPreviewParticipantService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoaPreviewParticipantService,
        {
          provide: PrismaService,
          useValue: {
            participantApplication: { findFirst: jest.fn() },
            participantDocument: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
          },
        },
      ],
    }).compile();

    service = module.get(LoaPreviewParticipantService);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
  });

  describe('resolveApplicationId', () => {
    it('returns the explicit applicationId when it belongs to the program', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({ id: 'app-42' });

      const result = await service.resolveApplicationId('program-1', 'app-42');

      expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'app-42', programId: 'program-1' } }),
      );
      expect(result).toEqual({ isSample: false, applicationId: 'app-42' });
    });

    it('throws NotFoundException (never falls back to auto-pick) when the explicit applicationId does not belong to this program', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.resolveApplicationId('program-1', 'wrong-app')).rejects.toThrow(NotFoundException);
    });

    it('auto-picks the pool without gating on batch release state - status in [submitted, accepted] only', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue({ id: 'app-auto-1' });

      const result = await service.resolveApplicationId('program-1', undefined);

      expect(prisma.participantApplication.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 'program-1', status: { in: ['submitted', 'accepted'] } },
        }),
      );
      expect(result).toEqual({ isSample: false, applicationId: 'app-auto-1' });
    });

    it('falls back to isSample: true only when the pool is empty', async () => {
      (prisma.participantApplication.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resolveApplicationId('program-1', undefined);

      expect(result).toEqual({ isSample: true });
    });
  });

  describe('resolveDocumentNumber', () => {
    it('returns the existing document number without creating or updating anything', async () => {
      (prisma.participantDocument.findFirst as jest.Mock).mockResolvedValue({ documentNumber: 'LOA-2026-0005' });

      const result = await service.resolveDocumentNumber('app-42');

      expect(result).toBe('LOA-2026-0005');
      expect(prisma.participantDocument.create).not.toHaveBeenCalled();
      expect(prisma.participantDocument.update).not.toHaveBeenCalled();
    });

    it('returns the literal PREVIEW/000 without allocating when no document exists yet', async () => {
      (prisma.participantDocument.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.resolveDocumentNumber('app-42');

      expect(result).toBe('PREVIEW/000');
      expect(prisma.participantDocument.create).not.toHaveBeenCalled();
      expect(prisma.participantDocument.update).not.toHaveBeenCalled();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd services/api && npx jest src/modules/programs/application/services/loa-preview-participant.service.spec.ts`
Expected: FAIL with `Cannot find module './loa-preview-participant.service'`.

- [ ] **Step 3: Write minimal implementation**

`services/api/src/modules/programs/application/services/loa-preview-participant.service.ts`:
```ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

// Literal shown whenever preview has no already-assigned document number to
// reuse. Never allocated or persisted - preview must not burn real document
// numbers or bump download counters.
export const PREVIEW_DOCUMENT_NUMBER = 'PREVIEW/000';

export type ResolvedPreviewParticipant =
  | { isSample: true }
  | { isSample: false; applicationId: string };

/**
 * Resolves who an admin's LOA template preview should render as, and what
 * document number to show, without ever touching LoaDocumentNumberService
 * (which mints and persists real numbers) or LoaEligibilityService (which
 * additionally requires a released batch - deliberately not applied here,
 * since admins author templates before releasing).
 */
@Injectable()
export class LoaPreviewParticipantService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * `applicationId` explicit: validated against this program, 404 if it
   * doesn't belong here. Never silently falls back to auto-pick - a silent
   * fallback would let an admin believe they verified a specific
   * participant's letter when they did not.
   *
   * `applicationId` omitted: auto-picks the first application in the pool
   * of `submitted`/`accepted` applications for this program, explicitly NOT
   * gated on LoA eligibility (which additionally requires a released batch).
   * Falls back to `{ isSample: true }` only when that pool is empty.
   */
  async resolveApplicationId(programId: string, applicationId?: string): Promise<ResolvedPreviewParticipant> {
    if (applicationId) {
      const application = await this.prisma.participantApplication.findFirst({
        where: { id: applicationId, programId },
        select: { id: true },
      });
      if (!application) {
        throw new NotFoundException('Application not found for this program');
      }
      return { isSample: false, applicationId: application.id };
    }

    const autoPicked = await this.prisma.participantApplication.findFirst({
      where: { programId, status: { in: ['submitted', 'accepted'] } },
      orderBy: { submittedAt: 'asc' },
      select: { id: true },
    });
    if (!autoPicked) {
      return { isSample: true };
    }
    return { isSample: false, applicationId: autoPicked.id };
  }

  /**
   * Uses the already-assigned document number when this application has
   * one (matching exactly what a real download would show), otherwise the
   * literal PREVIEW/000. Never calls LoaDocumentNumberService.assignOrGet -    * this method only ever reads.
   */
  async resolveDocumentNumber(applicationId: string): Promise<string> {
    const existing = await this.prisma.participantDocument.findFirst({
      where: { applicationId, type: 'letter_of_acceptance' },
      select: { documentNumber: true },
    });
    if (existing?.documentNumber) return existing.documentNumber;
    return PREVIEW_DOCUMENT_NUMBER;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd services/api && npx jest src/modules/programs/application/services/loa-preview-participant.service.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add services/api/src/modules/programs/application/services/loa-preview-participant.service.ts \
        services/api/src/modules/programs/application/services/loa-preview-participant.service.spec.ts
git commit -m "$(cat <<'EOF'
feat: add LoaPreviewParticipantService for preview pool resolution

Resolves which application an admin LOA preview renders as (explicit
id, auto-pick from submitted/accepted applications, or sample-data
fallback when the pool is empty) and resolves the document number to
show without ever allocating one or touching LoaDocumentNumberService.
EOF
)"
```

---

### Task 3: Preview endpoint accepts applicationId/source and renders real participant data

**Files:**
- Modify: `services/api/src/modules/programs/presentation/dto/create-update-program-content.dto.ts:1607-1623`
- Modify: `services/api/src/modules/programs/application/handlers/loa-preview.handler.ts:1-145` (full rewrite)
- Modify: `services/api/src/modules/programs/presentation/program-content.controller.ts:327-346`
- Modify: `services/api/src/modules/programs/programs.module.ts:1-10,113-179`
- Modify: `services/api/src/main.ts:129-132`
- Create: `services/api/src/modules/programs/application/handlers/loa-preview.handler.spec.ts`
- Test: `services/api/src/modules/programs/application/handlers/loa-preview.handler.spec.ts`

**Interfaces:**
- Consumes: `LoaRenderDataService.buildSourceMapForApplication` (Task 1), `LoaPreviewParticipantService.resolveApplicationId` / `.resolveDocumentNumber` (Task 2), `PREVIEW_DOCUMENT_NUMBER` (Task 2), `resolveLoaSignature`/`buildLoaSourceMap`/`buildGenerateLoaParams`/`LoaLayoutConfigInput` from `@shared/utils/loa-render-payload.util` (existing), `parseProgramBatch` (existing).
- Produces: `export class PreviewLoaTemplateQuery { constructor(programId, htmlContent, layoutConfig, placeholders, applicationId?, source: 'draft'|'saved' = 'draft') }`, `export interface PreviewLoaResult { buffer: Buffer; participantName: string; isSample: boolean }`, `PreviewLoaTemplateHandler.execute(query: PreviewLoaTemplateQuery): Promise<PreviewLoaResult>` - used by Task 4 (parity test) and the controller.

- [ ] **Step 1: Write the failing test**

`services/api/src/modules/programs/application/handlers/loa-preview.handler.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PreviewLoaTemplateHandler, PreviewLoaTemplateQuery } from './loa-preview.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { LoaRenderDataService } from '@modules/portal/application/services/loa-render-data.service';
import { LoaPreviewParticipantService } from '../services/loa-preview-participant.service';

describe('PreviewLoaTemplateHandler', () => {
  let handler: PreviewLoaTemplateHandler;
  let prisma: jest.Mocked<PrismaService>;
  let fileServiceClient: jest.Mocked<FileServiceClient>;
  let loaRenderDataService: jest.Mocked<LoaRenderDataService>;
  let loaPreviewParticipantService: jest.Mocked<LoaPreviewParticipantService>;

  const mockProgram = {
    id: 'program-1',
    name: 'Japan Youth Summit 2026 Batch 2',
    year: 2026,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-10'),
    location: 'Tokyo, Japan',
    theme: 'Unity',
    brand: { name: 'YBB Foundation' },
  };
  const mockSavedTemplate = {
    htmlContent: '<p>Saved {{participant_name}}</p>',
    placeholders: [{ key: '{{participant_name}}', source: 'participant.fullName' }],
    layoutConfig: { pageSize: 'A4' },
  };
  const mockRenderData = {
    sourceMap: { 'participant.fullName': 'Real Participant' },
    programDisplayName: 'Japan Youth Summit 2026',
    programBatch: '2',
  };
  const mockPdfBuffer = Buffer.from('PDF content');

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewLoaTemplateHandler,
        {
          provide: PrismaService,
          useValue: {
            program: { findUnique: jest.fn() },
            documentTemplate: { findFirst: jest.fn() },
            signature: { findFirst: jest.fn() },
          },
        },
        { provide: FileServiceClient, useValue: { generateLoa: jest.fn() } },
        { provide: LoaRenderDataService, useValue: { buildSourceMapForApplication: jest.fn() } },
        {
          provide: LoaPreviewParticipantService,
          useValue: { resolveApplicationId: jest.fn(), resolveDocumentNumber: jest.fn() },
        },
      ],
    }).compile();

    handler = module.get(PreviewLoaTemplateHandler);
    prisma = module.get(PrismaService) as jest.Mocked<PrismaService>;
    fileServiceClient = module.get(FileServiceClient);
    loaRenderDataService = module.get(LoaRenderDataService);
    loaPreviewParticipantService = module.get(LoaPreviewParticipantService);

    (prisma.program.findUnique as jest.Mock).mockResolvedValue(mockProgram);
    (fileServiceClient.generateLoa as jest.Mock).mockResolvedValue(mockPdfBuffer);
  });

  it('throws NotFoundException when the program does not exist', async () => {
    (prisma.program.findUnique as jest.Mock).mockResolvedValue(null);

    await expect(
      handler.execute(new PreviewLoaTemplateQuery('missing-program', '<p>draft</p>', {}, [])),
    ).rejects.toThrow(NotFoundException);
  });

  describe('source: draft (default)', () => {
    it('renders the request-body draft content without touching the persisted template', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>unsaved draft</p>', {}, []));

      expect(prisma.documentTemplate.findFirst).not.toHaveBeenCalled();
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ html_content: '<p>unsaved draft</p>' }),
      );
    });
  });

  describe('source: saved', () => {
    it('renders the persisted active template when one exists', async () => {
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(mockSavedTemplate);
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>ignored</p>', {}, [], undefined, 'saved'));

      expect(prisma.documentTemplate.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { programId: 'program-1', type: 'letter_of_acceptance', isActive: true, deletedAt: null },
        }),
      );
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ html_content: '<p>Saved {{participant_name}}</p>' }),
      );
    });

    it('throws ConflictException (409) when no active template is published', async () => {
      (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue(null);
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      await expect(
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>ignored</p>', {}, [], undefined, 'saved')),
      ).rejects.toThrow(ConflictException);
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });
  });

  describe('participant resolution', () => {
    it('uses the explicit applicationId and calls LoaRenderDataService with it', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({
        isSample: false,
        applicationId: 'app-42',
      });
      (loaPreviewParticipantService.resolveDocumentNumber as jest.Mock).mockResolvedValue('LOA-2026-0007');
      (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mockResolvedValue(mockRenderData);

      await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], 'app-42'));

      expect(loaPreviewParticipantService.resolveApplicationId).toHaveBeenCalledWith('program-1', 'app-42');
      expect(loaRenderDataService.buildSourceMapForApplication).toHaveBeenCalledWith(
        'app-42',
        expect.objectContaining({ documentNumber: 'LOA-2026-0007' }),
      );
    });

    it('propagates NotFoundException from participant resolution for a wrong/missing applicationId, without falling back to auto-pick', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockRejectedValue(
        new NotFoundException('Application not found for this program'),
      );

      await expect(
        handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], 'wrong-app-id')),
      ).rejects.toThrow(NotFoundException);
      expect(loaRenderDataService.buildSourceMapForApplication).not.toHaveBeenCalled();
      expect(fileServiceClient.generateLoa).not.toHaveBeenCalled();
    });

    it('falls back to SAMPLE_PARTICIPANT and PREVIEW/000 when the pool is empty', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });

      const result = await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, []));

      expect(loaRenderDataService.buildSourceMapForApplication).not.toHaveBeenCalled();
      expect(result.isSample).toBe(true);
      expect(result.participantName).toBe('Jane Doe');
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ document_number: 'PREVIEW/000' }),
      );
    });

    it('returns the real participant name and isSample: false for a resolved application', async () => {
      (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({
        isSample: false,
        applicationId: 'app-42',
      });
      (loaPreviewParticipantService.resolveDocumentNumber as jest.Mock).mockResolvedValue('LOA-2026-0007');
      (loaRenderDataService.buildSourceMapForApplication as jest.Mock).mockResolvedValue(mockRenderData);

      const result = await handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [], 'app-42'));

      expect(result.isSample).toBe(false);
      expect(result.participantName).toBe('Real Participant');
      expect(fileServiceClient.generateLoa).toHaveBeenCalledWith(
        expect.objectContaining({ document_number: 'LOA-2026-0007' }),
      );
    });
  });

  it('surfaces file-service errors instead of swallowing them', async () => {
    (loaPreviewParticipantService.resolveApplicationId as jest.Mock).mockResolvedValue({ isSample: true });
    (fileServiceClient.generateLoa as jest.Mock).mockRejectedValue(new Error('file service unreachable'));

    await expect(
      handler.execute(new PreviewLoaTemplateQuery('program-1', '<p>draft</p>', {}, [])),
    ).rejects.toThrow('file service unreachable');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd services/api && npx jest src/modules/programs/application/handlers/loa-preview.handler.spec.ts`
Expected: FAIL - `PreviewLoaTemplateQuery` doesn't accept a 5th/6th constructor arg, `LoaRenderDataService`/`LoaPreviewParticipantService` are not injected by the current handler, `handler.execute()` returns a bare `Buffer` not `{ buffer, participantName, isSample }`.

- [ ] **Step 3: Write minimal implementation**

`services/api/src/modules/programs/application/handlers/loa-preview.handler.ts` (full replacement):
```ts
import { QueryHandler, IQueryHandler } from '@nestjs/cqrs';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { parseProgramBatch } from '@shared/utils/parse-program-batch';
import {
  resolveLoaSignature,
  buildLoaSourceMap,
  buildGenerateLoaParams,
  LoaLayoutConfigInput,
} from '@shared/utils/loa-render-payload.util';
import { LoaRenderDataService } from '@modules/portal/application/services/loa-render-data.service';
import { LoaPreviewParticipantService, PREVIEW_DOCUMENT_NUMBER } from '../services/loa-preview-participant.service';

// Clearly-fake sample participant used for admin template previews. Never a
// real person. Program fields (name/year/location/dates/theme/brand) are the
// REAL program's, so the preview reads as close to the eventual real letter
// as possible while staying honest that no participant has actually applied.
// Only rendered when the program's pool of submitted/accepted applications is
// empty - see LoaPreviewParticipantService.resolveApplicationId.
const SAMPLE_PARTICIPANT = {
  fullName: 'Jane Doe',
  participationCategoryName: 'International Delegate',
  institution: 'State University of Jakarta',
  nationality: 'Indonesian',
  birthdate: '12 May 2002',
  gender: 'Female',
  originCountry: 'Indonesia',
  email: 'jane.doe@example.com',
  phone: '+62 812345678',
  major: 'International Relations',
  occupation: 'Student',
};

export class PreviewLoaTemplateQuery {
  constructor(
    public readonly programId: string,
    public readonly htmlContent: string,
    public readonly layoutConfig: Record<string, unknown>,
    public readonly placeholders: Array<{ key: string; source: string }>,
    public readonly applicationId?: string,
    public readonly source: 'draft' | 'saved' = 'draft',
  ) {}
}

export interface PreviewLoaResult {
  buffer: Buffer;
  participantName: string;
  isSample: boolean;
}

@QueryHandler(PreviewLoaTemplateQuery)
export class PreviewLoaTemplateHandler implements IQueryHandler<PreviewLoaTemplateQuery> {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fileServiceClient: FileServiceClient,
    private readonly loaRenderDataService: LoaRenderDataService,
    private readonly loaPreviewParticipantService: LoaPreviewParticipantService,
  ) {}

  async execute(query: PreviewLoaTemplateQuery): Promise<PreviewLoaResult> {
    const program = await this.prisma.program.findUnique({
      where: { id: query.programId },
      select: {
        id: true,
        name: true,
        year: true,
        startDate: true,
        endDate: true,
        location: true,
        theme: true,
        brand: { select: { name: true } },
      },
    });
    if (!program) throw new NotFoundException('Program not found');

    // Resolve which template content to render: the in-editor draft (request
    // body, default) or the persisted saved row. Never a third source.
    let htmlContent = query.htmlContent;
    let placeholders = query.placeholders ?? [];
    let layoutConfig = query.layoutConfig ?? {};
    if (query.source === 'saved') {
      const savedTemplate = await this.prisma.documentTemplate.findFirst({
        where: { programId: query.programId, type: 'letter_of_acceptance', isActive: true, deletedAt: null },
        select: { htmlContent: true, placeholders: true, layoutConfig: true },
      });
      if (!savedTemplate || !savedTemplate.htmlContent) {
        throw new ConflictException('This Invitation Letter template is not published yet');
      }
      htmlContent = savedTemplate.htmlContent;
      placeholders = (savedTemplate.placeholders ?? []) as Array<{ key: string; source: string }>;
      layoutConfig = (savedTemplate.layoutConfig ?? {}) as Record<string, unknown>;
    }

    const headerConfig = (layoutConfig['header'] as Record<string, unknown> | undefined) ?? undefined;

    // Same signature-resolution path as a real download - an admin previewing
    // an unsaved draft still sees exactly what a saved signatureId resolves to.
    const { signatureUrl, signerName, signerTitle } = await resolveLoaSignature(this.prisma, {
      signatureUrl: layoutConfig['signatureUrl'] as string | undefined,
      signatureId: layoutConfig['signatureId'] as string | undefined,
    });

    const resolvedLayoutConfig: LoaLayoutConfigInput = {
      headerHtml: layoutConfig['headerHtml'] as string | undefined,
      footerHtml: layoutConfig['footerHtml'] as string | undefined,
      pageSize: layoutConfig['pageSize'] as string | undefined,
      margins: layoutConfig['margins'] as { top: number; right: number; bottom: number; left: number } | undefined,
      logoUrl: layoutConfig['logoUrl'] as string | undefined,
      stampUrl: layoutConfig['stampUrl'] as string | undefined,
      footerNote: layoutConfig['footerNote'] as string | undefined,
      showGeneratedDate: layoutConfig['showGeneratedDate'] as boolean | undefined,
      header: headerConfig
        ? {
            tagline: headerConfig['tagline'] as string | undefined,
            website: headerConfig['website'] as string | undefined,
            email: headerConfig['email'] as string | undefined,
            phone: headerConfig['phone'] as string | undefined,
          }
        : undefined,
    };

    // Resolve who to preview as: explicit applicationId (validated against
    // this program - 404 if wrong/missing, never silently auto-picked
    // instead), auto-picked first submitted/accepted application, or
    // SAMPLE_PARTICIPANT when the pool is empty. LoaDocumentNumberService is
    // deliberately not injected into this handler at all - preview can never
    // allocate a real document number.
    const resolved = await this.loaPreviewParticipantService.resolveApplicationId(
      query.programId,
      query.applicationId,
    );

    let sourceMap: Record<string, string>;
    let programDisplayName: string;
    let programBatch: string;
    let documentNumber: string;
    let participantName: string;

    if (resolved.isSample) {
      documentNumber = PREVIEW_DOCUMENT_NUMBER;
      participantName = SAMPLE_PARTICIPANT.fullName;
      const now = new Date();
      const generatedAt = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
      const startDate = program.startDate
        ? program.startDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      const endDate = program.endDate
        ? program.endDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
        : '';
      const split = parseProgramBatch(program.name);
      programDisplayName = split.displayName;
      programBatch = split.batch;
      sourceMap = buildLoaSourceMap({
        participantFullName: SAMPLE_PARTICIPANT.fullName,
        programName: program.name,
        programBatch,
        generatedAt,
        documentNumber,
        participationCategoryName: SAMPLE_PARTICIPANT.participationCategoryName,
        programLocation: program.location ?? '',
        programStartDate: startDate,
        programEndDate: endDate,
        institution: SAMPLE_PARTICIPANT.institution,
        nationality: SAMPLE_PARTICIPANT.nationality,
        birthdate: SAMPLE_PARTICIPANT.birthdate,
        gender: SAMPLE_PARTICIPANT.gender,
        originCountry: SAMPLE_PARTICIPANT.originCountry,
        signerName,
        signerTitle,
        programYear: String(program.year),
        participantEmail: SAMPLE_PARTICIPANT.email,
        participantPhone: SAMPLE_PARTICIPANT.phone,
        major: SAMPLE_PARTICIPANT.major,
        occupation: SAMPLE_PARTICIPANT.occupation,
        programTheme: program.theme ?? '',
        brandName: program.brand?.name ?? '',
      });
    } else {
      documentNumber = await this.loaPreviewParticipantService.resolveDocumentNumber(resolved.applicationId);
      const renderData = await this.loaRenderDataService.buildSourceMapForApplication(resolved.applicationId, {
        documentNumber,
        signerName,
        signerTitle,
      });
      sourceMap = renderData.sourceMap;
      programDisplayName = renderData.programDisplayName;
      programBatch = renderData.programBatch;
      participantName = renderData.sourceMap['participant.fullName'];
    }

    const buffer = await this.fileServiceClient.generateLoa(
      buildGenerateLoaParams({
        htmlContent,
        layoutConfig: resolvedLayoutConfig,
        placeholders,
        sourceMap,
        documentNumber,
        signatureUrl,
        signerName,
        signerTitle,
        programDisplayName,
        programBatch,
      }),
    );

    return { buffer, participantName, isSample: resolved.isSample };
  }
}
```

`services/api/src/modules/programs/presentation/dto/create-update-program-content.dto.ts` - replace lines 1607-1623 (`export class PreviewDocumentTemplateDto { ... }`):
```ts
export class PreviewDocumentTemplateDto {
    @ApiProperty({ description: 'Tiptap HTML body - the in-editor draft, not necessarily saved yet' })
    @IsString()
    @IsNotEmpty()
    htmlContent: string;

    @ApiProperty({ required: false, description: 'Placeholder token definitions (same shape as the saved template)', type: [DocumentTemplatePlaceholderDto] })
    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => DocumentTemplatePlaceholderDto)
    placeholders?: DocumentTemplatePlaceholderDto[];

    @ApiProperty({ required: false, description: 'Draft layout config - headerHtml/footerHtml/margins/logoUrl/stampUrl/header/footerNote/showGeneratedDate/etc.' })
    @IsOptional()
    layoutConfig?: Record<string, unknown>;

    @ApiProperty({ required: false, description: 'Application to render real participant data for. Omitted means auto-pick the first submitted/accepted application.' })
    @IsOptional()
    @IsUUID()
    applicationId?: string;

    @ApiProperty({ required: false, enum: ['draft', 'saved'], description: 'Which template content to render: the in-editor draft (default) or the persisted saved row.' })
    @IsOptional()
    @IsIn(['draft', 'saved'])
    source?: 'draft' | 'saved';
}
```

`services/api/src/modules/programs/presentation/program-content.controller.ts` - replace lines 327-346 (the `previewDocumentTemplate` method, imports/decorators above it unchanged):
```ts
  @Post(':id/document-templates/preview')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Render an Invitation Letter (draft or saved) through the real PDF generator, with real participant data when available' })
  @ApiResponse({ status: 200, description: 'PDF binary' })
  @ApiResponse({ status: 404, description: 'applicationId not found for this program' })
  @ApiResponse({ status: 409, description: 'source=saved requested but no active template is published' })
  async previewDocumentTemplate(
    @Param('id') programId: string,
    @Body() dto: PreviewDocumentTemplateDto,
    @Response({ passthrough: true }) res: ExpressResponse,
  ) {
    const result = await this.previewLoaTemplateHandler.execute(
      new PreviewLoaTemplateQuery(
        programId,
        dto.htmlContent,
        dto.layoutConfig ?? {},
        dto.placeholders ?? [],
        dto.applicationId,
        dto.source ?? 'draft',
      ),
    );
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline; filename="preview.pdf"',
      // URI-encoded since participant names may contain non-ASCII characters.
      // Decoded client-side in admin-dashboard's previewDocumentTemplate().
      'X-Preview-Participant-Name': encodeURIComponent(result.participantName),
      'X-Preview-Is-Sample': String(result.isSample),
    });
    return new StreamableFile(result.buffer);
  }
```

`services/api/src/modules/programs/programs.module.ts` - add one import near the top (after the `PreviewLoaTemplateHandler` import at the original line ~78):
```ts
import { PortalModule } from '@modules/portal/portal.module';
import { LoaPreviewParticipantService } from './application/services/loa-preview-participant.service';
```
 - and edit the `@Module({...})` block: add `PortalModule` to `imports`, add `LoaPreviewParticipantService` to `providers`:
```ts
@Module({
  imports: [CqrsModule, HttpModule, AuthModule, UsersModule, FilesModule, RabbitMQModule, PortalModule],
  controllers: [
    // ...unchanged...
  ],
  providers: [
    // ...unchanged existing entries...
    GetLoaBatchesHandler,
    GetLoaDownloadsHandler,
    PreviewLoaTemplateHandler,
    LoaPreviewParticipantService,

    CacheService,
    LandingRevalidationService,
    FormFieldKeyValidator,
    LoaReleaseBatchRepository,
    // ...unchanged rest...
  ],
  exports: ['IProgramContentRepository', 'IProgramRepository', ListProgramsHandler],
})
export class ProgramsModule { }
```

`services/api/src/main.ts` - replace lines 129-132:
```ts
  app.enableCors({
    origin: corsOrigins,
    credentials: true,
    // The LOA preview endpoint reports who it rendered as via these two
    // response headers (see program-content.controller.ts previewDocumentTemplate);
    // browsers strip custom headers from cross-origin fetch() responses
    // unless explicitly exposed here.
    exposedHeaders: ['X-Preview-Participant-Name', 'X-Preview-Is-Sample'],
  });
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd services/api && npx jest src/modules/programs/application/handlers/loa-preview.handler.spec.ts`
Expected: PASS

Also run the full portal + programs suites to confirm nothing else broke:
Run: `cd services/api && npx jest src/modules/portal src/modules/programs`
Expected: PASS (all suites, including Task 1's)

- [ ] **Step 5: Commit**
```bash
git add services/api/src/modules/programs/presentation/dto/create-update-program-content.dto.ts \
        services/api/src/modules/programs/application/handlers/loa-preview.handler.ts \
        services/api/src/modules/programs/application/handlers/loa-preview.handler.spec.ts \
        services/api/src/modules/programs/presentation/program-content.controller.ts \
        services/api/src/modules/programs/programs.module.ts \
        services/api/src/main.ts
git commit -m "$(cat <<'EOF'
feat: LOA preview renders real participant data via applicationId/source

The preview endpoint now accepts optional applicationId and source
('draft' | 'saved') body params, resolves the participant through the
same LoaRenderDataService the real download uses, and reports who it
rendered as (participant name, isSample) via response headers since it
still returns a raw PDF blob. Falls back to sample data only when the
program has zero submitted/accepted applications. Never allocates a
real document number or touches download counters.
EOF
)"
```

---

### Task 4: Parity test - preview(source=saved) vs download produce identical GenerateLoaParams except document_number

**Files:**
- Create: `services/api/src/modules/portal/application/services/loa-download-preview-parity.spec.ts`
- Test: `services/api/src/modules/portal/application/services/loa-download-preview-parity.spec.ts`

**Interfaces:**
- Consumes: `LoaDownloadService` (Task 1), `LoaRenderDataService` (Task 1, real instance - not mocked), `PreviewLoaTemplateHandler`/`PreviewLoaTemplateQuery` (Task 3), `LoaPreviewParticipantService` (Task 2, mocked), `GenerateLoaParams` type from `@modules/files/infrastructure/clients/file-service.client` (existing).
- Produces: nothing new - this is a pure test, the single most important one in this plan per the design spec's Risks section.

This test deliberately does NOT mock `LoaRenderDataService` for either side - it uses a real instance backed by a shared-shape mocked `PrismaService`, so it actually exercises the extraction from Task 1 rather than assuming it works. If a future change makes `LoaDownloadService` or `PreviewLoaTemplateHandler` build `GenerateLoaParams` differently (e.g. one forgets `programBatch`, or one reads stale `layoutConfig`), this test fails.

- [ ] **Step 1: Write the failing test**

`services/api/src/modules/portal/application/services/loa-download-preview-parity.spec.ts`:
```ts
import { Test, TestingModule } from '@nestjs/testing';
import { LoaDownloadService } from './loa-download.service';
import { LoaEligibilityService } from './loa-eligibility.service';
import { LoaDocumentNumberService } from './loa-document-number.service';
import { LoaRenderDataService } from './loa-render-data.service';
import { PortalCacheService } from './portal-cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import type { GenerateLoaParams } from '@modules/files/infrastructure/clients/file-service.client';
import { PreviewLoaTemplateHandler, PreviewLoaTemplateQuery } from '@modules/programs/application/handlers/loa-preview.handler';
import { LoaPreviewParticipantService } from '@modules/programs/application/services/loa-preview-participant.service';

describe('LOA preview/download parity', () => {
  const applicationId = 'app-parity-1';
  const programId = 'program-parity-1';
  const templateId = 'template-parity-1';

  const fixtureApplication = {
    id: applicationId,
    programId,
    personalData: {
      institution: 'Harvard University',
      nationality: 'American',
      major: 'Computer Science',
      occupation: 'Student',
    },
    participant: {
      fullName: 'Parity Participant',
      institution: '',
      nationality: '',
      birthdate: new Date('2001-03-15'),
      gender: 'female',
      originCountry: 'Indonesia',
      phoneCountryCode: '+62',
      phoneNumber: '81234567890',
      major: '',
      occupation: '',
      user: { email: 'parity@example.com' },
    },
    participationCategory: { name: 'International Delegate' },
  };

  const fixtureProgram = {
    id: programId,
    name: 'Japan Youth Summit 2026 Batch 2',
    year: 2026,
    startDate: new Date('2026-08-01'),
    endDate: new Date('2026-08-10'),
    location: 'Tokyo, Japan',
    theme: 'Unity in Diversity',
    brand: { name: 'YBB Foundation' },
  };

  const fixtureTemplate = {
    id: templateId,
    htmlContent: '<p>Dear {{participant_name}}</p>',
    placeholders: [
      { key: '{{participant_name}}', label: 'Participant Full Name', source: 'participant.fullName' },
      { key: '{{institution}}', label: 'Institution', source: 'participant.institution' },
      { key: '{{document_number}}', label: 'Document Number', source: 'participant_document.documentNumber' },
    ],
    layoutConfig: {
      headerHtml: '<header>Header</header>',
      footerHtml: '<footer>Footer</footer>',
      pageSize: 'A4',
      margins: { top: 40, right: 40, bottom: 40, left: 40 },
      signatureUrl: 'https://example.com/sig.png',
    },
  };

  function makeMockPrisma() {
    return {
      participantApplication: { findFirst: jest.fn().mockResolvedValue(fixtureApplication) },
      program: { findUnique: jest.fn().mockResolvedValue(fixtureProgram) },
      documentTemplate: { findFirst: jest.fn().mockResolvedValue(fixtureTemplate) },
      participantDocument: {
        update: jest.fn().mockResolvedValue({}),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      signature: { findFirst: jest.fn() },
    };
  }

  function stripDocumentNumber(params: GenerateLoaParams) {
    const { document_number: _documentNumber, placeholder_data, ...rest } = params;
    const { '{{document_number}}': _placeholderDocNumber, ...restPlaceholders } = placeholder_data;
    void _documentNumber;
    void _placeholderDocNumber;
    return { ...rest, placeholder_data: restPlaceholders };
  }

  it('produces identical GenerateLoaParams for download vs preview(source=saved), excluding only document_number', async () => {
    // ── Download side ──────────────────────────────────────────────────
    const downloadPrisma = makeMockPrisma();
    const downloadFileServiceClient = { generateLoa: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    const downloadModule: TestingModule = await Test.createTestingModule({
      providers: [
        LoaDownloadService,
        LoaRenderDataService,
        { provide: PrismaService, useValue: downloadPrisma },
        { provide: PortalCacheService, useValue: { getParticipantProfile: jest.fn().mockResolvedValue({ id: 'participant-parity-1' }) } },
        { provide: LoaEligibilityService, useValue: { checkEligibility: jest.fn().mockResolvedValue({ eligible: true, batchId: 'batch-1' }) } },
        {
          provide: LoaDocumentNumberService,
          useValue: {
            assignOrGet: jest.fn().mockResolvedValue({ docNumber: 'LOA-2026-0099', isNew: true, existingDocId: 'doc-parity-1' }),
          },
        },
        { provide: FileServiceClient, useValue: downloadFileServiceClient },
      ],
    }).compile();
    const downloadService = downloadModule.get(LoaDownloadService);
    await downloadService.downloadLoa('user-parity-1', 'brand-parity-1');
    const downloadParams: GenerateLoaParams = downloadFileServiceClient.generateLoa.mock.calls[0][0];

    // ── Preview (source=saved) side ────────────────────────────────────
    const previewPrisma = makeMockPrisma();
    const previewFileServiceClient = { generateLoa: jest.fn().mockResolvedValue(Buffer.from('pdf')) };
    const previewModule: TestingModule = await Test.createTestingModule({
      providers: [
        PreviewLoaTemplateHandler,
        LoaRenderDataService,
        { provide: PrismaService, useValue: previewPrisma },
        { provide: FileServiceClient, useValue: previewFileServiceClient },
        {
          provide: LoaPreviewParticipantService,
          useValue: {
            resolveApplicationId: jest.fn().mockResolvedValue({ isSample: false, applicationId }),
            resolveDocumentNumber: jest.fn().mockResolvedValue('PREVIEW/000'),
          },
        },
      ],
    }).compile();
    const previewHandler = previewModule.get(PreviewLoaTemplateHandler);
    await previewHandler.execute(
      new PreviewLoaTemplateQuery(programId, '<p>ignored - source is saved</p>', {}, [], applicationId, 'saved'),
    );
    const previewParams: GenerateLoaParams = previewFileServiceClient.generateLoa.mock.calls[0][0];

    // ── Parity ──────────────────────────────────────────────────────────
    expect(previewParams.document_number).toBe('PREVIEW/000');
    expect(downloadParams.document_number).toBe('LOA-2026-0099');
    expect(previewParams.document_number).not.toBe(downloadParams.document_number);

    expect(stripDocumentNumber(previewParams)).toEqual(stripDocumentNumber(downloadParams));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**
Run: `cd services/api && npx jest src/modules/portal/application/services/loa-download-preview-parity.spec.ts`
Expected: FAIL only if Task 1 or Task 3 introduced a divergence - if both prior tasks were implemented as specified, this should actually PASS on first run (there is no new production code in this task, only a test). Treat a pass on first run as valid: rerun once to confirm it is not a false positive from a typo in the fixture (e.g. temporarily change `fixtureTemplate.layoutConfig.pageSize` between the two mocks and confirm the test fails, then revert), and record that check in the commit description.

- [ ] **Step 3: Write minimal implementation**
None - this task is test-only, verifying behavior already implemented in Tasks 1-3.

- [ ] **Step 4: Run test to verify it passes**
Run: `cd services/api && npx jest src/modules/portal/application/services/loa-download-preview-parity.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**
```bash
git add services/api/src/modules/portal/application/services/loa-download-preview-parity.spec.ts
git commit -m "$(cat <<'EOF'
test: assert LOA preview(source=saved) and download stay byte-identical

The durable regression guard for this feature's root cause (preview
and download quietly diverging in what they render). Instantiates both
real code paths with a shared fixture and deep-equals their
GenerateLoaParams output, excluding only document_number by design.
EOF
)"
```

---

### Task 5: Admin API client - previewDocumentTemplate returns participant resolution metadata

**Files:**
- Modify: `services/admin-dashboard/src/shared/api-client.ts:3114-3132`
- Test: none (no test runner configured for `services/admin-dashboard` - see Global Constraints). Verify via `npm run build`.

**Interfaces:**
- Consumes: `getAccessToken`, `buildApiUrl`, `redirectToLogin`, `readErrorMessage` (existing module-scope helpers in `api-client.ts`, already used by `requestBlob`), `DocumentTemplatePlaceholder`/`DocumentTemplateLayoutConfig` (existing types).
- Produces: `export interface PreviewLoaResult { blob: Blob; participantName: string; isSample: boolean }`, `previewDocumentTemplate(programId: string, input: { htmlContent: string; placeholders?: DocumentTemplatePlaceholder[]; layoutConfig?: DocumentTemplateLayoutConfig; applicationId?: string; source?: 'draft' | 'saved' }): Promise<PreviewLoaResult>` - used by Task 7 (`LoaTemplateEditor.tsx`).

- [ ] **Step 1: Write the failing test**
No test runner exists for this package (see Global Constraints). Instead, write the type-checking probe that Step 2 will fail to compile:

Temporarily add this snippet to the bottom of `services/admin-dashboard/src/shared/api-client.ts` (delete it again in Step 3 once the real implementation makes it redundant - it exists purely to prove the current signature doesn't compile):
```ts
// TEMP TYPECHECK PROBE - deleted in Step 3.
async function __previewLoaResultProbe(): Promise<void> {
  const result = await previewDocumentTemplate('program-1', {
    htmlContent: '<p>x</p>',
    applicationId: 'app-1',
    source: 'saved',
  });
  const _blob: Blob = result.blob;
  const _name: string = result.participantName;
  const _sample: boolean = result.isSample;
  void _blob; void _name; void _sample;
}
```

- [ ] **Step 2: Run to verify it fails**
Run: `cd services/admin-dashboard && npm run build`
Expected: FAIL - TypeScript errors: `Object literal may only specify known properties, and 'applicationId' does not exist in type '{ htmlContent: string; placeholders?: ...; layoutConfig?: ...; }'` and `Property 'blob' does not exist on type 'Blob'` (current return type is a bare `Promise<Blob>`).

- [ ] **Step 3: Write minimal implementation**

Replace `services/admin-dashboard/src/shared/api-client.ts:3114-3132` (the `previewDocumentTemplate` JSDoc + function):
```ts
export interface PreviewLoaResult {
  blob: Blob;
  participantName: string;
  isSample: boolean;
}

/**
 * Render an Invitation Letter (draft or saved) through the real PDF
 * generator (WeasyPrint, same code path as the participant download), for a
 * real participant when one is available, and return it as a PDF Blob for
 * inline preview alongside who it was rendered as.
 *
 * Uses a plain fetch (not requestBlob) because it needs to read the
 * X-Preview-Participant-Name / X-Preview-Is-Sample response headers
 * alongside the blob body - requestBlob discards headers.
 */
export async function previewDocumentTemplate(
  programId: string,
  input: {
    htmlContent: string;
    placeholders?: DocumentTemplatePlaceholder[];
    layoutConfig?: DocumentTemplateLayoutConfig;
    applicationId?: string;
    source?: "draft" | "saved";
  },
): Promise<PreviewLoaResult> {
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${getAccessToken()}`);
  headers.set("Content-Type", "application/json");

  const res = await fetch(buildApiUrl(`/programs/${programId}/document-templates/preview`), {
    method: "POST",
    headers,
    body: JSON.stringify(input),
  });

  if (res.status === 401) {
    redirectToLogin("session_expired");
    throw new Error("Session expired. Redirecting to login...");
  }
  if (!res.ok) throw new Error(await readErrorMessage(res));

  const participantNameHeader = res.headers.get("X-Preview-Participant-Name");
  const isSampleHeader = res.headers.get("X-Preview-Is-Sample");
  const blob = await res.blob();

  return {
    blob,
    participantName: participantNameHeader ? decodeURIComponent(participantNameHeader) : "",
    isSample: isSampleHeader === "true",
  };
}
```

Delete the `__previewLoaResultProbe` snippet from Step 1 - the real function now covers what it proved.

- [ ] **Step 4: Run to verify it passes**
Run: `cd services/admin-dashboard && npm run build`
Expected: FAIL still, at this point, with one new error: `services/admin-dashboard/app/components/documents/LoaTemplateEditor.tsx:709` - `const blob = await previewDocumentTemplate(...)` then `URL.createObjectURL(blob)` - `blob` is now `PreviewLoaResult`, not `Blob`. This is expected and resolved in Task 7. Confirm the error is confined to that one line/file (no other unexpected breakage) before proceeding.

- [ ] **Step 5: Commit**
```bash
git add services/admin-dashboard/src/shared/api-client.ts
git commit -m "$(cat <<'EOF'
feat: previewDocumentTemplate accepts applicationId/source, returns metadata

Extends the admin API client's LOA preview call to pass the new
applicationId/source params and to surface who the PDF was rendered
as (participant name, isSample) via the endpoint's response headers,
alongside the blob. LoaTemplateEditor.tsx is updated to match in the
next commit.
EOF
)"
```

---

### Task 6: Admin UI - LoaParticipantPicker search dialog

**Files:**
- Create: `services/admin-dashboard/app/components/documents/LoaParticipantPicker.tsx`
- Test: none (no test runner). Verify via `npm run build` + manual render check in Task 7 (this component isn't wired into a page until Task 7, but must typecheck standalone now).

**Interfaces:**
- Consumes: `listApplications`, `Application` type (existing, `@/src/shared/api-client`), `Dialog`/`DialogContent`/`DialogHeader`/`DialogTitle` (existing, `@/src/ui/dialog`).
- Produces: `export function LoaParticipantPicker(props: { programId: string; open: boolean; onOpenChange: (open: boolean) => void; onSelect: (applicationId: string, participantName: string) => void }): JSX.Element` - used by Task 7.

- [ ] **Step 1: Write the failing test**
No test runner. Verification is `npm run build` after Step 3, confirming the new file typechecks and its imports resolve. There is nothing to "fail" before the file exists other than the build simply not referencing it yet - skip straight to Step 3 for this file-creation task, then use Step 4 as the actual first typecheck.

- [ ] **Step 2: Run test to verify it fails**
N/A - see Step 1. (If strict adherence to the checkbox format is wanted: `cd services/admin-dashboard && npm run build` currently passes without this file, since nothing imports it yet - there is no failing state to observe for a brand-new, not-yet-referenced component file.)

- [ ] **Step 3: Write minimal implementation**

`services/admin-dashboard/app/components/documents/LoaParticipantPicker.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, UserCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/src/ui/dialog";
import { listApplications, type Application } from "@/src/shared/api-client";

const SEARCH_DEBOUNCE_MS = 300;

interface LoaParticipantPickerProps {
  programId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (applicationId: string, participantName: string) => void;
}

/**
 * Search picker for "Previewing as: <name> [change]". Lets an admin pick a
 * specific application to preview the Invitation Letter as. Reuses the
 * existing admin applications search endpoint (GET /applications) - no new
 * search endpoint was introduced for this feature.
 */
export function LoaParticipantPicker({ programId, open, onOpenChange, onSelect }: LoaParticipantPickerProps) {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setSearch("");
    setResults([]);
    setError(null);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    setError(null);
    const timer = setTimeout(() => {
      listApplications({ programId, search: search.trim() || undefined, limit: 20 })
        .then((result) => setResults(result.data))
        .catch(() => setError("Failed to search applications"))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [open, programId, search]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Preview as participant</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or email…"
              className="block w-full rounded-md border border-zinc-200 bg-white py-2 pl-8 pr-3 text-xs text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div className="max-h-72 overflow-y-auto rounded-md border border-zinc-100">
            {loading ? (
              <div className="flex h-24 items-center justify-center">
                <Loader2 className="h-4 w-4 animate-spin text-zinc-400" />
              </div>
            ) : error ? (
              <p className="px-3 py-6 text-center text-xs text-red-600">{error}</p>
            ) : results.length === 0 ? (
              <p className="px-3 py-6 text-center text-xs text-zinc-400">No applications found.</p>
            ) : (
              <ul className="divide-y divide-zinc-100">
                {results.map((app) => (
                  <li key={app.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(app.id, app.participant?.fullName ?? "Unknown participant");
                        onOpenChange(false);
                      }}
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition hover:bg-blue-50"
                    >
                      <UserCircle2 className="h-4 w-4 shrink-0 text-zinc-400" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-medium text-zinc-800">
                          {app.participant?.fullName ?? "Unknown participant"}
                        </span>
                        <span className="block truncate text-[10px] text-zinc-400">
                          {app.participant?.email ?? app.id} · {app.status}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd services/admin-dashboard && npm run build`
Expected: The pre-existing `LoaTemplateEditor.tsx:709` type error from Task 5 still present (expected, fixed in Task 7); no NEW errors introduced by this file. Confirm by checking the build output only references `LoaTemplateEditor.tsx`, not `LoaParticipantPicker.tsx`.

- [ ] **Step 5: Commit**
```bash
git add services/admin-dashboard/app/components/documents/LoaParticipantPicker.tsx
git commit -m "$(cat <<'EOF'
feat: add LoaParticipantPicker search dialog for LOA preview

Standalone search dialog reusing the existing GET /applications
endpoint. Not yet wired into LoaTemplateEditor.tsx - that lands next.
EOF
)"
```

---

### Task 7: Admin UI - two-pane DRAFT/SAVED preview with "Previewing as" header and drift warning

**Files:**
- Modify: `services/admin-dashboard/app/components/documents/LoaTemplateEditor.tsx:1-50` (imports), `:484-489` (preview state), `:650-729` (preview generation + cleanup), `:801-845` (preview-mode JSX), `:1296-1312` (dialogs, adding the picker)
- Test: none (no test runner). Verify via `npm run build` + manual browser check.

**Interfaces:**
- Consumes: `previewDocumentTemplate` returning `PreviewLoaResult` (Task 5), `LoaParticipantPicker` (Task 6), `PLACEHOLDER_TOKENS`/`DEFAULT_LAYOUT`/`layout`/`template`/`editor`/`footerEditor`/`resolvedProgramId` (existing, unchanged).
- Produces: nothing consumed elsewhere - this is the final integration point.

- [ ] **Step 1: Write the failing test**
No test runner. The "failing" state to confirm before this task is the compile error already surfaced at the end of Task 5/6:
Run: `cd services/admin-dashboard && npm run build`
Expected (pre-existing, confirm it's still there): `Type error: Property 'blob' does not exist on type 'PreviewLoaResult'. Did you mean 'blob'?` or similar around `LoaTemplateEditor.tsx:709`, `URL.createObjectURL(blob)`.

- [ ] **Step 2: Run test to verify it fails**
Run: `cd services/admin-dashboard && npm run build`
Expected: FAIL with the error described in Step 1.

- [ ] **Step 3: Write minimal implementation**

In `services/admin-dashboard/app/components/documents/LoaTemplateEditor.tsx`, apply these changes:

**3a. Imports** - add to the existing `lucide-react` import (around line 12-17) and add the new component import (around line 49-50, after the `api-client` import block):
```tsx
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Undo, Redo, RemoveFormatting,
  Heading1, Heading2, Loader2, CheckCircle2, Upload, ImageIcon, X, Eye, EyeOff,
  ChevronDown, Pencil, AlertTriangle, RefreshCw, UserRound,
} from "lucide-react";
```
```tsx
import { LoaParticipantPicker } from "./LoaParticipantPicker";
```

**3b. A small local pane component** - add directly above `export function LoaTemplateEditor(...)` (before line 460):
```tsx
function PreviewPane({
  label,
  loading,
  error,
  pdfUrl,
  onRegenerate,
  warning,
}: {
  label: string;
  loading: boolean;
  error: string | null;
  pdfUrl: string | null;
  onRegenerate: () => void;
  warning?: string | null;
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-inner" style={{ minHeight: 560 }}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 bg-zinc-50 px-3 py-2 text-[11px] text-zinc-500">
        <span className="flex items-center gap-1.5 font-medium text-zinc-700">
          <Eye className="h-3 w-3" />
          {label}
        </span>
        <button
          type="button"
          disabled={loading}
          onClick={onRegenerate}
          className="flex items-center gap-1 rounded px-1.5 py-0.5 font-medium text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
          Regenerate
        </button>
      </div>
      {warning ? (
        <div className="flex items-start gap-1.5 border-b border-amber-200 bg-amber-50 px-3 py-1.5">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-600" />
          <p className="text-[10px] text-amber-700">{warning}</p>
        </div>
      ) : null}
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-2 text-xs text-zinc-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          Rendering PDF…
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <p className="text-xs font-medium text-red-600">Preview failed</p>
          <p className="max-w-sm text-[11px] text-zinc-500">{error}</p>
          <button
            type="button"
            onClick={onRegenerate}
            className="mt-1 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Try again
          </button>
        </div>
      ) : pdfUrl ? (
        <iframe src={pdfUrl} className="h-full w-full flex-1" title={`Invitation Letter Preview - ${label}`} style={{ minHeight: 520 }} />
      ) : (
        <div className="flex flex-1 items-center justify-center text-xs text-zinc-400">No preview yet.</div>
      )}
    </div>
  );
}
```

**3c. State** - replace the existing single-pane preview state block (original lines 484-489: `previewPdfUrl`/`previewLoading`/`previewError`/`previewObjectUrlRef`):
```tsx
  // Real-renderer preview: the PDF blob URLs from the file-service WeasyPrint
  // pipeline, not a hand-rolled HTML mock. Two panes - DRAFT (unsaved editor
  // state) and SAVED (persisted template row) - rendered side by side so a
  // corrupted persisted template can never hide behind a perfect-looking
  // draft again.
  const [previewPdfUrls, setPreviewPdfUrls] = useState<{ draft: string | null; saved: string | null }>({
    draft: null,
    saved: null,
  });
  const [previewLoading, setPreviewLoading] = useState<{ draft: boolean; saved: boolean }>({
    draft: false,
    saved: false,
  });
  const [previewErrors, setPreviewErrors] = useState<{ draft: string | null; saved: string | null }>({
    draft: null,
    saved: null,
  });
  const previewObjectUrlRefs = useRef<{ draft: string | null; saved: string | null }>({ draft: null, saved: null });

  // Who the preview is rendered as. Resolved server-side (auto-pick or the
  // admin's explicit picker choice) and reported back via response headers,
  // since the endpoint returns a raw PDF blob with no JSON body.
  const [previewApplicationId, setPreviewApplicationId] = useState<string | null>(null);
  const [previewParticipantName, setPreviewParticipantName] = useState<string | null>(null);
  const [previewIsSample, setPreviewIsSample] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
```

**3d. Cleanup effect** - replace the existing single-url cleanup effect (original lines 651-655):
```tsx
  useEffect(() => {
    return () => {
      if (previewObjectUrlRefs.current.draft) URL.revokeObjectURL(previewObjectUrlRefs.current.draft);
      if (previewObjectUrlRefs.current.saved) URL.revokeObjectURL(previewObjectUrlRefs.current.saved);
    };
  }, []);
```

**3e. Preview generation** - replace `generatePreview`/`togglePreview` (original lines 699-729):
```tsx
  // Renders through the same file-service WeasyPrint pipeline (structured
  // header, footer precedence, auto-stamp, page-footer disclaimer) that
  // LoaDownloadService uses for real participant downloads - see
  // PreviewLoaTemplateHandler on the API side. No hand-rolled HTML mock.
  const generatePreview = useCallback(async (source: "draft" | "saved") => {
    if (!editor || !resolvedProgramId) return;
    setPreviewLoading((l) => ({ ...l, [source]: true }));
    setPreviewErrors((e) => ({ ...e, [source]: null }));
    try {
      const footerHtml = footerEditor?.getHTML() ?? layout.footerHtml ?? "";
      const result = await previewDocumentTemplate(resolvedProgramId, {
        htmlContent: editor.getHTML(),
        placeholders: PLACEHOLDER_TOKENS,
        layoutConfig: { ...layout, footerHtml },
        applicationId: previewApplicationId ?? undefined,
        source,
      });
      const prevUrl = previewObjectUrlRefs.current[source];
      if (prevUrl) URL.revokeObjectURL(prevUrl);
      const url = URL.createObjectURL(result.blob);
      previewObjectUrlRefs.current[source] = url;
      setPreviewPdfUrls((u) => ({ ...u, [source]: url }));
      // The draft pane's response is treated as authoritative for the shared
      // "Previewing as" header - both panes resolve to the same application
      // in practice, since they're issued with the same applicationId/program.
      if (source === "draft") {
        setPreviewParticipantName(result.participantName);
        setPreviewIsSample(result.isSample);
      }
    } catch (err) {
      setPreviewErrors((e) => ({ ...e, [source]: err instanceof Error ? err.message : "Failed to generate preview" }));
    } finally {
      setPreviewLoading((l) => ({ ...l, [source]: false }));
    }
  }, [editor, footerEditor, layout, resolvedProgramId, previewApplicationId]);

  const generateBothPreviews = useCallback(() => {
    void generatePreview("draft");
    void generatePreview("saved");
  }, [generatePreview]);

  function togglePreview() {
    const next = !previewMode;
    setPreviewMode(next);
    if (next) generateBothPreviews();
  }

  function handlePickerSelect(applicationId: string, participantName: string) {
    setPreviewApplicationId(applicationId);
    setPreviewParticipantName(participantName);
    setPreviewIsSample(false);
    generateBothPreviews();
  }
```

**3f. Drift detection** - add directly above the `if (loading) { ... }` early return (original line 731), as a plain computation (not `useMemo` - Tiptap's `editor` object reference stays stable across keystrokes, so a `useMemo` keyed on `[editor]` would never recompute; this component already re-renders on every keystroke via Tiptap's own transaction-triggered updates, so a cheap inline computation is correct and costs no server work):
```tsx
  const currentFooterHtml = footerEditor?.getHTML() ?? layout.footerHtml ?? "";
  const hasDraftDrift = Boolean(
    template &&
      (editor?.getHTML() !== (template.htmlContent ?? "") ||
        JSON.stringify({ ...layout, footerHtml: currentFooterHtml }) !==
          JSON.stringify({ ...DEFAULT_LAYOUT, ...(template.layoutConfig ?? {}) })),
  );
```

**3g. Preview-mode JSX** - replace the existing single-pane `previewMode ? ( ... ) : ( ... )` block's TRUE branch (original lines 801-845, the `<div className="flex flex-1 flex-col overflow-hidden rounded-lg border ...">...</div>` for preview mode; the FALSE branch - the editor toolbar/body/footer - is unchanged):
```tsx
          {previewMode ? (
            <div className="flex flex-1 flex-col gap-2 overflow-hidden">
              <div className="flex items-center justify-between gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2">
                <div className="flex items-center gap-2 text-xs text-zinc-600">
                  <UserRound className="h-3.5 w-3.5 text-zinc-400" />
                  {previewIsSample ? (
                    <span>
                      Showing <span className="font-medium text-amber-700">sample data</span> - no submitted or
                      accepted applications yet for this program.
                    </span>
                  ) : (
                    <span>
                      Previewing as: <span className="font-medium text-zinc-900">{previewParticipantName ?? "…"}</span>
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setPickerOpen(true)}
                  className="text-[11px] font-medium text-blue-600 hover:text-blue-700"
                >
                  [change]
                </button>
              </div>
              <div className="flex flex-1 gap-2 overflow-hidden">
                <PreviewPane
                  label="DRAFT"
                  loading={previewLoading.draft}
                  error={previewErrors.draft}
                  pdfUrl={previewPdfUrls.draft}
                  onRegenerate={() => void generatePreview("draft")}
                  warning={
                    hasDraftDrift
                      ? "This draft differs from the last saved template. SAVED still reflects what participants can download today."
                      : null
                  }
                />
                <PreviewPane
                  label="SAVED"
                  loading={previewLoading.saved}
                  error={previewErrors.saved}
                  pdfUrl={previewPdfUrls.saved}
                  onRegenerate={() => void generatePreview("saved")}
                />
              </div>
            </div>
          ) : (
```
(leave the following `<>...</>` editor block and its closing `)}` exactly as-is)

**3h. Mount the picker dialog** - add alongside the other dialogs near the end of the component (original lines 1296-1312, right before the component's closing `</div>` / `);`):
```tsx
      <LoaParticipantPicker
        programId={resolvedProgramId}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        onSelect={handlePickerSelect}
      />
```

- [ ] **Step 4: Run test to verify it passes**
Run: `cd services/admin-dashboard && npm run build`
Expected: PASS (no TypeScript errors).

Then manually verify in the running app (`npm run dev`, per this repo's existing dev workflow which auto-deploys admin-dashboard):
1. Open a program's Invitation Letter editor, click Preview. Confirm two panes (DRAFT, SAVED) render side by side, each with its own loading/regenerate control.
2. Confirm the header reads "Previewing as: <real participant name>" for a program with at least one submitted/accepted application, or the sample-data notice for a program with none.
3. Click `[change]`, search for a participant, select one. Confirm both panes regenerate and the header updates to the selected name.
4. Edit the body text without saving. Confirm the DRAFT pane shows the drift warning banner and the SAVED pane does not.
5. Save the draft (Publish or Save Draft). Confirm the drift warning disappears and SAVED updates to match DRAFT on the next regenerate.

- [ ] **Step 5: Commit**
```bash
git add services/admin-dashboard/app/components/documents/LoaTemplateEditor.tsx
git commit -m "$(cat <<'EOF'
feat: two-pane DRAFT/SAVED LOA preview with real participant data

Replaces the single sample-data preview pane with side-by-side
DRAFT/SAVED panes rendered against real participant data, a
"Previewing as: <name>" header with a picker to preview as a specific
participant, a sample-data notice when the program has no
submitted/accepted applications yet, and a client-side drift warning
when the unsaved draft differs from the last saved template.
EOF
)"
```
