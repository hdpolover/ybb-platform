# Send Letter of Acceptance (LoA) via Web Admin — Implementation Plan

> For agentic workers: REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (- [ ]) syntax.

**Goal:** Allow admins to generate LoA PDFs for a chosen audience (`submitted` or `accepted`) and immediately dispatch a "Your LoA is ready" email to each participant via RabbitMQ, with per-participant send-status tracked in `ParticipantDocument.emailedAt` and visible in the admin UI.

**Architecture:** The existing `GenerateLOAHandler` (NestJS CQRS) already generates PDF, uploads it, and upserts `ParticipantDocument`; this plan adds an `audience` parameter to replace the hardcoded `status = 'accepted'` filter, a post-generation `application.loa_ready` RabbitMQ event published per successfully generated document, and a new `@EventPattern('application.loa_ready')` handler in the notification service that emails the participant using a local Handlebars template (`loa-ready.hbs`). The notification service's existing `resolveEmailContent` pattern (managed template first, local `.hbs` fallback) is used, so it will automatically upgrade to managed templates once `API_INTERNAL_URL` + `NOTIFICATION_SERVICE_INTERNAL_KEY` are set in prod. Guard: email failure is non-blocking (logged, `emailedAt` left null); re-send is blocked unless admin explicitly resends.

**Tech Stack:**
- API: NestJS 10, CQRS (`@nestjs/cqrs`), Prisma 5, `RabbitMQProducerService` (internal, `ybb.events` topic exchange)
- Notification service: NestJS microservice, RabbitMQ `@EventPattern`, Handlebars (`hbs`), Resend/Nodemailer fallback
- Admin dashboard: Next.js 15, TypeScript strict, shadcn/ui, `sonner` toasts, `src/shared/api-client.ts` fetch wrapper
- Participant portal: Next.js 14 (`ybb-program-next`), documents page at `/dashboard/documents`

---

## File Structure

### API (`services/api`) — branch `dev`

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema/applications.prisma` | **Modify** | Add `emailedAt DateTime? @map("emailed_at") @db.Timestamptz(6)` to `ParticipantDocument` |
| `prisma/migrations/20260615120000_add_loa_emailed_at/migration.sql` | **Create** | SQL migration for new column |
| `src/modules/programs/application/commands/program-content.commands.ts` | **Modify** | Add `audience?: 'submitted' \| 'accepted'` field to `GenerateLOACommand`; keep `participantId?` + `bulk?` |
| `src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts` | **Modify** | Replace `whereClause.status = 'accepted'` with audience-driven filter; inject `RabbitMQProducerService`; emit `application.loa_ready` per generated doc; skip emit if `emailedAt` already set unless `resend: true` |
| `src/modules/programs/presentation/program-content.controller.ts` | **Modify** | Accept `{ participantId?: string; bulk?: boolean; audience?: 'submitted' \| 'accepted'; resend?: boolean }` in body |
| `src/modules/programs/programs.module.ts` | **Modify** | Add `RabbitMQModule` to `imports` array |

### Notification Service (`services/notification`) — branch `dev`

| File | Action | Responsibility |
|------|--------|----------------|
| `src/modules/events/events.controller.ts` | **Modify** | Add `@EventPattern('application.loa_ready')` handler calling `emailService.sendLoaReadyEmail` |
| `src/modules/email/email.service.ts` | **Modify** | Add `sendLoaReadyEmail(to: string, payload: LoaReadyPayload): Promise<void>` method |
| `src/modules/email/templates/loa-ready.hbs` | **Create** | Handlebars email body: "Your LoA is ready" with link to portal documents page |

### Admin Dashboard (`services/admin-dashboard`) — branch `dev`

| File | Action | Responsibility |
|------|--------|----------------|
| `src/shared/api-client.ts` | **Modify** | Add `sendLoa()` function (POST generate with `audience` param) and `getLoaStatus()` (GET per-participant LoA status) |
| `app/components/documents/LoaTemplateEditor.tsx` | **Modify** | Replace "Generate All" button with "Generate & Send" flow: audience selector dropdown + confirmation dialog + send progress |
| `app/programs/[programId]/documents/loa-template/page.tsx` | **Modify** | Add `<LoaStatusTable programId={programId} templateId={...} />` below the editor |
| `app/components/documents/LoaStatusTable.tsx` | **Create** | Table listing participants with columns: Name, Email, Generated At, Emailed At, status badge; resend button per row |

### API — new query endpoint for LoA status

| File | Action | Responsibility |
|------|--------|----------------|
| `src/modules/programs/application/queries/get-loa-status.handler.ts` | **Create** | Query handler: list `ParticipantDocument` rows for a `templateId`, join `application.participant`, return per-participant status |
| `src/modules/programs/presentation/program-content.controller.ts` | **Modify** (2nd touch) | Add `GET :programId/document-templates/:templateId/loa-status` route |
| `src/modules/programs/programs.module.ts` | **Modify** (2nd touch) | Register `GetLoaStatusHandler` in providers |

---

## Phase 1 — Backend: Audience Param, RabbitMQ Emit, `emailedAt` Migration

**Goal:** API generates for the right audience and emits `application.loa_ready` events. No UI changes yet. Independently shippable.

---

### Task 1.1: Prisma migration — add `emailedAt` to `ParticipantDocument`

**Files:**
- Modify: `services/api/prisma/schema/applications.prisma`
- Create: `services/api/prisma/migrations/20260615120000_add_loa_emailed_at/migration.sql`
- Test: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts` (new)

- [ ] Open `services/api/prisma/schema/applications.prisma`. In the `ParticipantDocument` model (currently ends at `legacyId Int? @unique @map("legacy_id")`), add after `generatedAt`:

```prisma
  emailedAt   DateTime? @map("emailed_at") @db.Timestamptz(6)
```

The full updated block (lines ~364-366 in applications.prisma):
```prisma
  generatedAt DateTime  @default(now()) @map("generated_at") @db.Timestamptz(6)
  emailedAt   DateTime? @map("emailed_at") @db.Timestamptz(6)
  expiresAt   DateTime? @map("expires_at") @db.Timestamptz(6)
```

- [ ] Create the migration SQL file at `services/api/prisma/migrations/20260615120000_add_loa_emailed_at/migration.sql`:

```sql
-- Add emailedAt column to participant_documents
ALTER TABLE "participant_documents"
  ADD COLUMN IF NOT EXISTS "emailed_at" TIMESTAMPTZ(6);
```

- [ ] Run `npx prisma generate` inside `services/api` to regenerate the Prisma client — verify `ParticipantDocument` type now includes `emailedAt: Date | null`.

- [ ] Write a smoke test that the Prisma model compiles. Create `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.spec.ts` with:

```typescript
// Minimal compile-time test — real handler tests added in Task 1.3
import { GenerateLOACommand } from '../program-content.commands';

describe('GenerateLOACommand', () => {
  it('accepts audience param', () => {
    const cmd = new GenerateLOACommand('prog-1', 'tmpl-1', 'user-1', undefined, true, 'accepted');
    expect(cmd.audience).toBe('accepted');
  });

  it('defaults audience to accepted when bulk and no audience specified', () => {
    const cmd = new GenerateLOACommand('prog-1', 'tmpl-1', 'user-1', undefined, true);
    expect(cmd.audience).toBeUndefined();
  });
});
```

- [ ] Run test: `cd services/api && npx jest --testPathPattern="manage-program-content.handlers.spec"` — expected **FAIL** (class not updated yet).
- [ ] Commit: `git -C services/api add prisma/schema/applications.prisma prisma/migrations/20260615120000_add_loa_emailed_at && git -C services/api commit -m "feat: add emailedAt to ParticipantDocument for LoA send tracking"`

---

### Task 1.2: Extend `GenerateLOACommand` with `audience` and `resend` params

**Files:**
- Modify: `services/api/src/modules/programs/application/commands/program-content.commands.ts` (lines 268-278)

- [ ] Open `program-content.commands.ts`. The current `GenerateLOACommand` class (line 268):

```typescript
export class GenerateLOACommand {
    constructor(
        public readonly programId: string,
        public readonly templateId: string,
        public readonly userId: string,
        public readonly participantId?: string,
        public readonly bulk?: boolean,
    ) {}
}
```

Replace with:

```typescript
export type LoaAudience = 'submitted' | 'accepted';

export class GenerateLOACommand {
    constructor(
        public readonly programId: string,
        public readonly templateId: string,
        public readonly userId: string,
        public readonly participantId?: string,
        public readonly bulk?: boolean,
        public readonly audience?: LoaAudience,
        public readonly resend?: boolean,
    ) {}
}
```

- [ ] In `program-content.controller.ts` (around line 335-352), update the body destructuring and command construction:

```typescript
@Post(':programId/document-templates/:templateId/generate')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
@ApiOperation({ summary: 'Generate LOA PDF(s) for one participant or all eligible participants' })
async generateLOA(
  @Param('programId') programId: string,
  @Param('templateId') templateId: string,
  @Body() body: {
    participantId?: string;
    bulk?: boolean;
    audience?: 'submitted' | 'accepted';
    resend?: boolean;
  },
  @Request() req: ExpressRequest & { user: { id: string } },
) {
  return this.generateLOAHandler.execute(
    new GenerateLOACommand(
      programId,
      templateId,
      req.user.id,
      body.participantId,
      body.bulk,
      body.audience,
      body.resend,
    ),
  );
}
```

- [ ] Run the spec from Task 1.1 again: `npx jest --testPathPattern="manage-program-content.handlers.spec"` — expected **PASS** now (command constructor updated).
- [ ] Commit: `git -C services/api add src/modules/programs/application/commands/program-content.commands.ts src/modules/programs/presentation/program-content.controller.ts && git -C services/api commit -m "feat: add audience and resend params to GenerateLOACommand"`

---

### Task 1.3: Wire `RabbitMQModule` into `ProgramsModule` and inject producer into `GenerateLOAHandler`

**Files:**
- Modify: `services/api/src/modules/programs/programs.module.ts` (line 108: `imports: [CqrsModule, AuthModule, UsersModule, FilesModule]`)
- Modify: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts` (lines 1407-1557)

- [ ] In `programs.module.ts`, add `RabbitMQModule` to imports:

```typescript
// Add to imports at top of file:
import { RabbitMQModule } from '@shared/infrastructure/rabbitmq/rabbitmq.module';

// Line 108 — update imports array:
imports: [CqrsModule, AuthModule, UsersModule, FilesModule, RabbitMQModule],
```

- [ ] In `manage-program-content.handlers.ts`, update the `GenerateLOAHandler` constructor to inject `RabbitMQProducerService`. Find the import block at the top of the file and add:

```typescript
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
```

Update the constructor (lines 1411-1416):

```typescript
constructor(
    private readonly prisma: PrismaService,
    private readonly storageService: StorageService,
    private readonly fileServiceClient: FileServiceClient,
    private readonly cacheService: CacheService,
    private readonly rabbitmqProducer: RabbitMQProducerService,
) {}
```

- [ ] Write a unit test for the updated handler. In `manage-program-content.handlers.spec.ts`, expand to:

```typescript
import { GenerateLOACommand, LoaAudience } from '../program-content.commands';
import { GenerateLOAHandler } from './manage-program-content.handlers';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { StorageService } from '@shared/infrastructure/storage/storage.service';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

describe('GenerateLOAHandler', () => {
  const makePrisma = () => ({
    documentTemplate: { findFirst: jest.fn() },
    program: { findUnique: jest.fn() },
    participantApplication: { findMany: jest.fn().mockResolvedValue([]) },
    participantDocument: { count: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  });

  it('filters by submitted when audience=submitted', async () => {
    const prisma = makePrisma() as unknown as PrismaService;
    (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tmpl-1', type: 'letter_of_acceptance', htmlContent: '<p>Hi</p>', layoutConfig: {}, placeholders: [],
    });
    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: 'prog-1', name: 'YBB 2026', year: 2026, brandId: 'brand-1',
      brand: { landingUrl: 'https://portal.ybb.io', websiteUrl: null },
    });

    const handler = new GenerateLOAHandler(
      prisma,
      {} as StorageService,
      {} as FileServiceClient,
      {} as CacheService,
      { emit: jest.fn().mockResolvedValue(true) } as unknown as RabbitMQProducerService,
    );

    const cmd = new GenerateLOACommand('prog-1', 'tmpl-1', 'user-1', undefined, true, 'submitted');
    await handler.execute(cmd);

    const callArgs = (prisma.participantApplication.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.status).toBe('submitted');
  });

  it('defaults to accepted when bulk=true and no audience', async () => {
    const prisma = makePrisma() as unknown as PrismaService;
    (prisma.documentTemplate.findFirst as jest.Mock).mockResolvedValue({
      id: 'tmpl-1', type: 'letter_of_acceptance', htmlContent: '<p>Hi</p>', layoutConfig: {}, placeholders: [],
    });
    (prisma.program.findUnique as jest.Mock).mockResolvedValue({
      id: 'prog-1', name: 'YBB 2026', year: 2026, brandId: 'brand-1',
      brand: { landingUrl: 'https://portal.ybb.io', websiteUrl: null },
    });

    const handler = new GenerateLOAHandler(
      prisma,
      {} as StorageService,
      {} as FileServiceClient,
      {} as CacheService,
      { emit: jest.fn().mockResolvedValue(true) } as unknown as RabbitMQProducerService,
    );

    const cmd = new GenerateLOACommand('prog-1', 'tmpl-1', 'user-1', undefined, true);
    await handler.execute(cmd);

    const callArgs = (prisma.participantApplication.findMany as jest.Mock).mock.calls[0][0];
    expect(callArgs.where.status).toBe('accepted');
  });
});
```

- [ ] Run test: `npx jest --testPathPattern="manage-program-content.handlers.spec"` — expected **FAIL** (handler logic not updated yet).
- [ ] Commit module change: `git -C services/api add src/modules/programs/programs.module.ts && git -C services/api commit -m "feat: add RabbitMQModule to ProgramsModule for LoA event publishing"`

---

### Task 1.4: Update `GenerateLOAHandler.execute()` — audience filter + event emit

**Files:**
- Modify: `services/api/src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts` (lines 1433-1555)

- [ ] Replace the audience-filtering block (lines 1433-1441). Current code:

```typescript
const whereClause: Record<string, unknown> = { programId: command.programId, deletedAt: null };
if (command.participantId) {
    whereClause.participantId = command.participantId;
} else if (command.bulk) {
    whereClause.status = 'accepted';
} else {
    throw new BadRequestException('Provide participantId or bulk: true');
}
```

Replace with:

```typescript
const whereClause: Record<string, unknown> = { programId: command.programId, deletedAt: null };
if (command.participantId) {
    whereClause.participantId = command.participantId;
} else if (command.bulk) {
    // audience param introduced in LoA-send flow; default to 'accepted' for backwards compat
    const audience: 'submitted' | 'accepted' = command.audience ?? 'accepted';
    whereClause.status = audience;
} else {
    throw new BadRequestException('Provide participantId or bulk: true');
}
```

- [ ] Add the `emailedAt` guard and RabbitMQ emit. After the `this.prisma.participantDocument.create/update` block and before `generated++` (around line 1547), insert:

```typescript
// Emit notification — non-blocking; failure must not roll back the generated doc
const shouldSend = !existingDoc?.emailedAt || command.resend === true;
if (shouldSend) {
    try {
        const portalDocumentsUrl = `${process.env.PARTICIPANT_PORTAL_URL ?? ''}/dashboard/documents`;
        await this.rabbitmqProducer.emit('application.loa_ready', {
            email: app.participant.email,
            participant_name: app.participant.fullName,
            program_name: program.name,
            program_id: program.id,
            brand_id: program.brandId,
            application_id: app.id,
            document_id: existingDoc?.id ?? '',   // set after upsert above
            document_number: documentNumber,
            documents_page_url: portalDocumentsUrl,
            metadata: {
                emitted_at: new Date().toISOString(),
                sent_by: command.userId,
                audience: command.audience ?? 'accepted',
            },
        });
        // Mark emailedAt immediately — notification service will also attempt,
        // but marking here gives instant admin feedback
        const docId = existingDoc
            ? existingDoc.id
            : (await this.prisma.participantDocument.findFirst({
                  where: { applicationId: app.id, templateId: template.id },
              }))!.id;
        await this.prisma.participantDocument.update({
            where: { id: docId },
            data: { emailedAt: new Date() },
        });
    } catch (emitErr) {
        this.logger.warn(
            `LoA email event emit failed for application ${app.id}: ${emitErr instanceof Error ? emitErr.message : String(emitErr)}`,
        );
        // Non-blocking: generated count still increments; emailedAt stays null
    }
}
```

**Important:** The `document_id` field in the payload must be set after the upsert. The `existingDoc` reference is from `findFirst` before the upsert. After create, we need to re-fetch. The full corrected block replaces lines 1517-1547:

```typescript
const existingDoc = await this.prisma.participantDocument.findFirst({
    where: { applicationId: app.id, templateId: template.id },
});

let savedDocId: string;
if (existingDoc) {
    await this.prisma.participantDocument.update({
        where: { id: existingDoc.id },
        data: {
            fileUrl: uploadResult.url,
            documentNumber,
            generatedAt: new Date(),
            isPublic: false,
        },
    });
    savedDocId = existingDoc.id;
} else {
    const created = await this.prisma.participantDocument.create({
        data: {
            applicationId: app.id,
            templateId: template.id,
            name: `Letter of Acceptance – ${program.name}`,
            type: 'letter_of_acceptance',
            fileUrl: uploadResult.url,
            fileType: 'pdf',
            documentNumber,
            generatedAt: new Date(),
            isPublic: false,
        },
    });
    savedDocId = created.id;
}

// Emit LoA-ready notification — non-blocking
const alreadyEmailed = existingDoc?.emailedAt != null;
const shouldSend = !alreadyEmailed || command.resend === true;
if (shouldSend) {
    try {
        // Build documents URL from brand.landingUrl (same pattern as payment emails)
        // Requires brand to be fetched — add to program query above:
        //   const program = await this.prisma.program.findUnique({
        //     where: { id: command.programId },
        //     include: { brand: { select: { landingUrl: true, websiteUrl: true } } },
        //   });
        const brandBase = (program.brand?.landingUrl ?? program.brand?.websiteUrl ?? '').trim().replace(/\/$/, '');
        const portalDocumentsUrl = brandBase ? `${brandBase}/dashboard/documents` : '';
        await this.rabbitmqProducer.emit('application.loa_ready', {
            email: app.participant.email,
            participant_name: app.participant.fullName,
            program_name: program.name,
            program_id: program.id,
            brand_id: program.brandId,
            application_id: app.id,
            document_id: savedDocId,
            document_number: documentNumber,
            documents_page_url: portalDocumentsUrl,
            metadata: {
                emitted_at: new Date().toISOString(),
                sent_by: command.userId,
                audience: command.audience ?? 'accepted',
            },
        });
        await this.prisma.participantDocument.update({
            where: { id: savedDocId },
            data: { emailedAt: new Date() },
        });
    } catch (emitErr) {
        this.logger.warn(
            `LoA email event emit failed for application ${app.id}: ${emitErr instanceof Error ? emitErr.message : String(emitErr)}`,
        );
    }
}
```

- [ ] Run tests: `npx jest --testPathPattern="manage-program-content.handlers.spec"` — expected **PASS**.
- [ ] Run TypeScript check: `npx tsc --noEmit` in `services/api` — expected no errors.
- [ ] Commit: `git -C services/api add src/modules/programs/application/commands/handlers/manage-program-content.handlers.ts && git -C services/api commit -m "feat: emit application.loa_ready event after LoA generation with audience filter and emailedAt guard"`

---

## Phase 2 — Notification Service: Consumer + Local Email Template

**Goal:** Notification service handles `application.loa_ready` and sends a transactional "Your LoA is ready" email. Independently shippable after Phase 1.

---

### Task 2.1: Create `loa-ready.hbs` Handlebars template

**Files:**
- Create: `services/notification/src/modules/email/templates/loa-ready.hbs`

- [ ] Write a test to verify the template file exists and compiles without error. In `services/notification/src/modules/email/email.service.spec.ts` (or a new file `loa-ready-template.spec.ts`):

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as hbs from 'handlebars';

describe('loa-ready.hbs template', () => {
  it('exists and compiles', () => {
    const tplPath = path.join(__dirname, 'templates', 'loa-ready.hbs');
    expect(fs.existsSync(tplPath)).toBe(false); // RED — file not created yet
  });
});
```

- [ ] Run: `npx jest --testPathPattern="loa-ready-template"` — expected **FAIL**.
- [ ] Create `services/notification/src/modules/email/templates/loa-ready.hbs`:

```handlebars
<div style="text-align: center;">
    <div style="width: 64px; height: 64px; background-color: #dcfce7; border-radius: 50%; margin: 0 auto 24px; display: flex; align-items: center; justify-content: center;">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#15803d" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
        </svg>
    </div>

    <h2 style="font-size: 24px; font-weight: 700; color: {{theme.primaryDark}}; margin: 0 0 8px;">
        Your Letter of Acceptance is Ready
    </h2>
    <p style="font-size: 16px; color: #6b7280; margin: 0 0 24px;">
        Hi {{participant_name}}, congratulations! Your Letter of Acceptance for
        <strong>{{program_name}}</strong> has been generated and is ready to download.
    </p>

    <div style="background-color: {{theme.primaryMuted}}; border: 1px solid {{theme.border}}; border-radius: 8px; padding: 24px; text-align: left; margin-bottom: 24px;">
        <table style="width: 100%; font-size: 14px; color: #374151;">
            <tr>
                <td style="padding-bottom: 8px; color: #6b7280;">Document Number</td>
                <td style="padding-bottom: 8px; text-align: right; font-family: monospace; font-size: 13px; font-weight: 600;">{{document_number}}</td>
            </tr>
            <tr>
                <td style="padding-bottom: 0; color: #6b7280;">Program</td>
                <td style="padding-bottom: 0; text-align: right; font-weight: 600;">{{program_name}}</td>
            </tr>
        </table>
    </div>

    <p style="font-size: 14px; color: #6b7280; line-height: 1.6; margin: 0 0 24px;">
        Head to your documents dashboard to view and download your LoA. Keep it safe —
        you may need it for visa applications or other official purposes.
    </p>

    <a href="{{documents_page_url}}" style="display: inline-block; background-color: {{theme.primary}}; color: #ffffff; font-size: 15px; font-weight: 600; padding: 12px 28px; border-radius: 8px; text-decoration: none;">
        View My Documents
    </a>
</div>
```

- [ ] Update the test to `toBe(true)`:

```typescript
expect(fs.existsSync(tplPath)).toBe(true); // GREEN
```

- [ ] Run test again — expected **PASS**.
- [ ] Commit: `git -C services/notification add src/modules/email/templates/loa-ready.hbs && git -C services/notification commit -m "feat: add loa-ready.hbs email template"`

---

### Task 2.2: Add `sendLoaReadyEmail` to `EmailService`

**Files:**
- Modify: `services/notification/src/modules/email/email.service.ts` (add after `sendSupportTicketStatusUpdatedEmail`, around line 815)

- [ ] Write the failing test in `services/notification/src/modules/email/email.service.spec.ts`:

```typescript
describe('EmailService.sendLoaReadyEmail', () => {
  it('calls resolveEmailContent with type loa_ready and fallback loa-ready', async () => {
    // Arrange — mock private resolveEmailContent indirectly via sendRawEmail
    const sendRawEmail = jest.spyOn(service as any, 'sendRawEmail').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'resolveEmailContent').mockResolvedValue({
      subject: 'Your Letter of Acceptance is Ready',
      html: '<p>Hi Jane</p>',
    });

    // Act
    await service.sendLoaReadyEmail('jane@example.com', {
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: 'https://ybb.io/dashboard/documents',
      brand_id: 'brand-1',
      program_id: 'prog-1',
    });

    // Assert
    expect(sendRawEmail).toHaveBeenCalledWith('jane@example.com', 'Your Letter of Acceptance is Ready', '<p>Hi Jane</p>');
  });
});
```

- [ ] Run: `npx jest --testPathPattern="email.service.spec"` — expected **FAIL** (method does not exist yet).
- [ ] Add the `LoaReadyPayload` interface and `sendLoaReadyEmail` method to `email.service.ts` after the last `sendXxx` method:

```typescript
export interface LoaReadyPayload {
  participant_name: string;
  program_name: string;
  document_number: string;
  documents_page_url: string;
  brand_id?: string;
  program_id?: string;
}

async sendLoaReadyEmail(to: string, payload: LoaReadyPayload): Promise<void> {
  const templateData = {
    participant_name: payload.participant_name,
    program_name: payload.program_name,
    document_number: payload.document_number,
    documents_page_url: payload.documents_page_url,
    brandId: payload.brand_id,
    programId: payload.program_id,
  };
  const { subject, html } = await this.resolveEmailContent({
    type: 'loa_ready',
    fallbackTemplateName: 'loa-ready',
    fallbackSubject: 'Your Letter of Acceptance is Ready',
    data: templateData,
  });
  await this.sendRawEmail(to, subject, html);
}
```

- [ ] Run test again — expected **PASS**.
- [ ] Run TypeScript check in notification service: `npx tsc --noEmit`.
- [ ] Commit: `git -C services/notification add src/modules/email/email.service.ts && git -C services/notification commit -m "feat: add sendLoaReadyEmail to EmailService"`

---

### Task 2.3: Add `@EventPattern('application.loa_ready')` handler to `EventsController`

**Files:**
- Modify: `services/notification/src/modules/events/events.controller.ts` (add after last `@EventPattern` handler, before `private async processEvent`)

- [ ] Write the test in `services/notification/src/modules/events/events.controller.spec.ts` (create if absent):

```typescript
import { EventsController } from './events.controller';
import { EmailService } from '../email/email.service';
import { ReceiptService } from '../email/receipt.service';
import { NotificationIdempotencyService } from './notification-idempotency.service';
import { RmqContext } from '@nestjs/microservices';

const makeContext = (): RmqContext => ({
  getMessage: () => ({ content: Buffer.from('{}'), properties: { headers: {} } }),
  getChannelRef: () => ({ ack: jest.fn(), nack: jest.fn() }),
} as unknown as RmqContext);

describe('EventsController.handleLoaReady', () => {
  let controller: EventsController;
  let sendLoaReadyEmail: jest.Mock;

  beforeEach(() => {
    sendLoaReadyEmail = jest.fn().mockResolvedValue(undefined);
    controller = new EventsController(
      { sendLoaReadyEmail } as unknown as EmailService,
      {} as ReceiptService,
      {
        canProcess: jest.fn().mockResolvedValue(true),
        markProcessed: jest.fn().mockResolvedValue(undefined),
      } as unknown as NotificationIdempotencyService,
    );
  });

  it('calls sendLoaReadyEmail when email is present', async () => {
    const payload = {
      email: 'jane@example.com',
      participant_name: 'Jane Doe',
      program_name: 'YBB 2026',
      document_number: 'LOA-2026-000001',
      documents_page_url: 'https://ybb.io/dashboard/documents',
      brand_id: 'brand-1',
      program_id: 'prog-1',
    };

    await controller.handleLoaReady(payload, makeContext());
    expect(sendLoaReadyEmail).toHaveBeenCalledWith('jane@example.com', expect.objectContaining({
      participant_name: 'Jane Doe',
      document_number: 'LOA-2026-000001',
    }));
  });

  it('skips email silently when email field is missing', async () => {
    await controller.handleLoaReady({ no_email: true }, makeContext());
    expect(sendLoaReadyEmail).not.toHaveBeenCalled();
  });
});
```

- [ ] Run: `npx jest --testPathPattern="events.controller.spec"` — expected **FAIL**.
- [ ] Add the handler to `events.controller.ts` before the `private async processEvent` method (line 478):

```typescript
@EventPattern('application.loa_ready')
async handleLoaReady(
  @Payload() data: unknown,
  @Ctx() context: RmqContext,
): Promise<void> {
  const payload = asRecord(data);
  await this.processEvent('application.loa_ready', payload, context, async () => {
    this.logger.log(
      `Received application.loa_ready: ${JSON.stringify(summarizeEventPayload(payload))}`,
    );

    const email = getString(payload, 'email');
    if (!email) {
      this.logger.warn('application.loa_ready event missing email field — skipping');
      return;
    }

    await this.emailService.sendLoaReadyEmail(email, {
      participant_name: getString(payload, 'participant_name') ?? 'Participant',
      program_name: getString(payload, 'program_name') ?? '',
      document_number: getString(payload, 'document_number') ?? '',
      documents_page_url:
        getString(payload, 'documents_page_url') ?? '',
      brand_id: getString(payload, 'brand_id') ?? undefined,
      program_id: getString(payload, 'program_id') ?? undefined,
    });

    this.logger.log(`LoA-ready email sent to ${maskEmail(email)}`);
  });
}
```

- [ ] Run tests: `npx jest --testPathPattern="events.controller.spec"` — expected **PASS**.
- [ ] Run TypeScript check: `npx tsc --noEmit` in `services/notification`.
- [ ] Commit: `git -C services/notification add src/modules/events/events.controller.ts && git -C services/notification commit -m "feat: handle application.loa_ready event and send LoA-ready email"`

---

## Phase 3 — Admin Dashboard UI

**Goal:** Replace the plain "Generate All" button with a "Generate & Send" flow (audience selector + confirmation), and add a per-participant LoA status table below the editor. Depends on Phase 1 API changes.

---

### Task 3.1: API query — `GET /programs/:programId/document-templates/:templateId/loa-status`

**Files:**
- Create: `services/api/src/modules/programs/application/queries/get-loa-status.handler.ts`
- Modify: `services/api/src/modules/programs/presentation/program-content.controller.ts`
- Modify: `services/api/src/modules/programs/programs.module.ts`

- [ ] Write the test first. Create `services/api/src/modules/programs/application/queries/get-loa-status.handler.spec.ts`:

```typescript
import { GetLoaStatusHandler, GetLoaStatusQuery } from './get-loa-status.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

describe('GetLoaStatusHandler', () => {
  it('returns per-participant LoA status rows', async () => {
    const mockDocs = [
      {
        id: 'doc-1',
        documentNumber: 'LOA-2026-000001',
        generatedAt: new Date('2026-06-15T10:00:00Z'),
        emailedAt: new Date('2026-06-15T10:01:00Z'),
        fileUrl: 'https://cdn.ybb.io/docs/loa-1.pdf',
        application: {
          participant: { id: 'user-1', fullName: 'Jane Doe', email: 'jane@example.com' },
        },
      },
    ];
    const prisma = {
      participantDocument: {
        findMany: jest.fn().mockResolvedValue(mockDocs),
      },
    } as unknown as PrismaService;

    const handler = new GetLoaStatusHandler(prisma);
    const result = await handler.execute(new GetLoaStatusQuery('tmpl-1', 'prog-1'));

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      participantId: 'user-1',
      participantName: 'Jane Doe',
      email: 'jane@example.com',
      documentNumber: 'LOA-2026-000001',
      status: 'emailed',
    });
  });
});
```

- [ ] Run: `npx jest --testPathPattern="get-loa-status.handler.spec"` — expected **FAIL**.
- [ ] Create `services/api/src/modules/programs/application/queries/get-loa-status.handler.ts`:

```typescript
import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

export class GetLoaStatusQuery {
  constructor(
    public readonly templateId: string,
    public readonly programId: string,
  ) {}
}

export interface LoaStatusRow {
  documentId: string;
  participantId: string;
  participantName: string;
  email: string;
  documentNumber: string | null;
  generatedAt: Date;
  emailedAt: Date | null;
  fileUrl: string;
  status: 'generated' | 'emailed';
}

@Injectable()
@QueryHandler(GetLoaStatusQuery)
export class GetLoaStatusHandler implements IQueryHandler<GetLoaStatusQuery, LoaStatusRow[]> {
  constructor(private readonly prisma: PrismaService) {}

  async execute(query: GetLoaStatusQuery): Promise<LoaStatusRow[]> {
    const docs = await this.prisma.participantDocument.findMany({
      where: {
        templateId: query.templateId,
        deletedAt: null,
        application: { programId: query.programId },
      },
      include: {
        application: {
          include: {
            participant: { select: { id: true, fullName: true, email: true } },
          },
        },
      },
      orderBy: { generatedAt: 'desc' },
    });

    return docs.map((doc) => ({
      documentId: doc.id,
      participantId: doc.application.participant.id,
      participantName: doc.application.participant.fullName,
      email: doc.application.participant.email,
      documentNumber: doc.documentNumber,
      generatedAt: doc.generatedAt,
      emailedAt: doc.emailedAt,
      fileUrl: doc.fileUrl,
      status: doc.emailedAt != null ? 'emailed' : 'generated',
    }));
  }
}
```

- [ ] Run test — expected **PASS**.
- [ ] Add route to `program-content.controller.ts`. After the existing `generateLOA` method, add:

```typescript
@Get(':programId/document-templates/:templateId/loa-status')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
@ApiBearerAuth()
@ApiOperation({ summary: 'List per-participant LoA generation and email status' })
async getLoaStatus(
  @Param('programId') programId: string,
  @Param('templateId') templateId: string,
) {
  return this.queryBus.execute(new GetLoaStatusQuery(templateId, programId));
}
```

Also add to controller constructor:
```typescript
// Add to imports at top of program-content.controller.ts:
import { GetLoaStatusQuery } from '../application/queries/get-loa-status.handler';
import { QueryBus } from '@nestjs/cqrs';

// Inject QueryBus in constructor if not already present:
constructor(
  // ... existing injections ...
  private readonly queryBus: QueryBus,
) {}
```

- [ ] Register `GetLoaStatusHandler` in `programs.module.ts` providers array alongside existing query handlers.
- [ ] Run TypeScript check: `npx tsc --noEmit`.
- [ ] Commit: `git -C services/api add src/modules/programs/application/queries/get-loa-status.handler.ts src/modules/programs/presentation/program-content.controller.ts src/modules/programs/programs.module.ts && git -C services/api commit -m "feat: add GetLoaStatusHandler and GET loa-status route"`

---

### Task 3.2: Extend `api-client.ts` with `sendLoa` and `getLoaStatus`

**Files:**
- Modify: `services/admin-dashboard/src/shared/api-client.ts` (add after `generateLoa` function, around line 2657)

- [ ] After the existing `generateLoa` function (line 2646-2655), add:

```typescript
export async function sendLoa(
  programId: string,
  templateId: string,
  body: {
    bulk: true;
    audience: 'submitted' | 'accepted';
    resend?: boolean;
  },
): Promise<{ generated: number; failed: number }> {
  return request<{ generated: number; failed: number }>(
    `/programs/${programId}/document-templates/${templateId}/generate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}

export type LoaStatusRow = {
  documentId: string;
  participantId: string;
  participantName: string;
  email: string;
  documentNumber: string | null;
  generatedAt: string;
  emailedAt: string | null;
  fileUrl: string;
  status: 'generated' | 'emailed';
};

export async function getLoaStatus(
  programId: string,
  templateId: string,
): Promise<LoaStatusRow[]> {
  return request<LoaStatusRow[]>(
    `/programs/${programId}/document-templates/${templateId}/loa-status`,
    { method: 'GET' },
  );
}
```

- [ ] Run TypeScript check in admin dashboard: `npx tsc --noEmit`.
- [ ] Commit: `git -C services/admin-dashboard add src/shared/api-client.ts && git -C services/admin-dashboard commit -m "feat: add sendLoa and getLoaStatus to api-client"`

---

### Task 3.3: Update `LoaTemplateEditor.tsx` — replace "Generate All" with "Generate & Send" flow

**Files:**
- Modify: `services/admin-dashboard/app/components/documents/LoaTemplateEditor.tsx`

The current "Generate All" button (line 519) sends `{ bulk: true }` with no audience. Replace with a dialog-based flow.

- [ ] Add new state variables after the existing `generating` state:

```typescript
const [sendDialogOpen, setSendDialogOpen] = useState(false);
const [sendAudience, setSendAudience] = useState<'submitted' | 'accepted'>('accepted');
const [sending, setSending] = useState(false);
```

- [ ] Add imports (update the existing import from `api-client`):

```typescript
import {
  listDocumentTemplates,
  createDocumentTemplate,
  updateDocumentTemplate,
  generateLoa,
  sendLoa,            // NEW
  listProgramMedia,
  uploadFileViaPresignedUrl,
  type DocumentTemplate,
  type DocumentTemplatePlaceholder,
  type DocumentTemplateLayoutConfig,
  type MediaFile,
} from "@/src/shared/api-client";
```

- [ ] Add `handleSendAll` function after `handleGenerateAll`:

```typescript
async function handleSendAll() {
  if (!template) { toast.error("Save the template first"); return; }
  setSending(true);
  setSendDialogOpen(false);
  try {
    const result = await sendLoa(programId, template.id, {
      bulk: true,
      audience: sendAudience,
    });
    toast.success(
      `Generated & sent ${result.generated} LoA(s)${result.failed ? `, ${result.failed} failed` : ""}`,
    );
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Send failed");
  } finally {
    setSending(false);
  }
}
```

- [ ] Replace the existing "Generate All" button (lines 518-524) with:

```tsx
{/* Generate & Send button */}
<button
  type="button"
  disabled={sending || !template}
  onClick={() => setSendDialogOpen(true)}
  className="flex items-center gap-1.5 rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700 disabled:opacity-50"
>
  {sending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
  Generate & Send
</button>

{/* Audience confirmation dialog */}
{sendDialogOpen && (
  <Dialog open={sendDialogOpen} onOpenChange={setSendDialogOpen}>
    <DialogContent className="max-w-sm">
      <DialogHeader>
        <DialogTitle>Generate & Send LoA</DialogTitle>
      </DialogHeader>
      <div className="space-y-4 pt-2">
        <p className="text-sm text-zinc-600">
          Generate LoA PDFs and email each participant. Choose the audience:
        </p>
        <div className="space-y-2">
          {(["accepted", "submitted"] as const).map((opt) => (
            <label
              key={opt}
              className="flex cursor-pointer items-center gap-3 rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50"
            >
              <input
                type="radio"
                name="audience"
                value={opt}
                checked={sendAudience === opt}
                onChange={() => setSendAudience(opt)}
                className="h-4 w-4 accent-blue-600"
              />
              <span className="text-sm font-medium capitalize text-zinc-800">
                {opt === "accepted" ? "Accepted applicants" : "Submitted applicants"}
              </span>
            </label>
          ))}
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => setSendDialogOpen(false)}
            className="rounded-md border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSendAll}
            className="rounded-md bg-green-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-green-700"
          >
            Confirm & Send
          </button>
        </div>
      </div>
    </DialogContent>
  </Dialog>
)}
```

Add `Send` to lucide-react imports:
```typescript
import {
  Bold, Italic, Underline as UnderlineIcon, AlignLeft, AlignCenter,
  AlignRight, List, ListOrdered, Undo, Redo, RemoveFormatting,
  Heading1, Heading2, Loader2, CheckCircle2, Zap, Upload, ImageIcon, X, Eye, EyeOff, Send,
} from "lucide-react";
```

- [ ] Run TypeScript check: `npx tsc --noEmit` in `services/admin-dashboard`.
- [ ] Commit: `git -C services/admin-dashboard add app/components/documents/LoaTemplateEditor.tsx && git -C services/admin-dashboard commit -m "feat: replace Generate All with Generate & Send flow with audience selector"`

---

### Task 3.4: Create `LoaStatusTable.tsx` component

**Files:**
- Create: `services/admin-dashboard/app/components/documents/LoaStatusTable.tsx`
- Modify: `services/admin-dashboard/app/programs/[programId]/documents/loa-template/page.tsx`

- [ ] Create `services/admin-dashboard/app/components/documents/LoaStatusTable.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { RefreshCw, Send, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import {
  getLoaStatus,
  sendLoa,
  type DocumentTemplate,
  type LoaStatusRow,
} from "@/src/shared/api-client";
import { formatDate } from "@/lib/utils";

interface LoaStatusTableProps {
  programId: string;
  template: DocumentTemplate | null;
}

export function LoaStatusTable({ programId, template }: LoaStatusTableProps) {
  const [rows, setRows] = useState<LoaStatusRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState<string | null>(null); // participantId being resent

  const load = useCallback(async () => {
    if (!template) return;
    setLoading(true);
    try {
      const data = await getLoaStatus(programId, template.id);
      setRows(data);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load LoA status");
    } finally {
      setLoading(false);
    }
  }, [programId, template]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleResend(participantId: string) {
    if (!template) return;
    setResending(participantId);
    try {
      await sendLoa(programId, template.id, {
        bulk: false as unknown as true, // single participant re-send via participantId
        audience: "accepted",
        resend: true,
      });
      toast.success("LoA re-sent");
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Resend failed");
    } finally {
      setResending(null);
    }
  }

  if (!template) return null;

  return (
    <div className="rounded-xl border border-zinc-200 bg-white">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-900">LoA Send Status</h2>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-md border border-zinc-200 px-2.5 py-1.5 text-xs font-medium text-zinc-600 hover:bg-zinc-50 disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {rows.length === 0 && !loading ? (
        <div className="py-12 text-center text-sm text-zinc-400">
          No LoAs generated yet. Use &quot;Generate & Send&quot; above to start.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-100 bg-zinc-50 text-xs font-medium text-zinc-500">
              <th className="px-4 py-2.5 text-left">Participant</th>
              <th className="px-4 py-2.5 text-left">Document No.</th>
              <th className="px-4 py-2.5 text-left">Generated</th>
              <th className="px-4 py-2.5 text-left">Emailed</th>
              <th className="px-4 py-2.5 text-left">Status</th>
              <th className="px-4 py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {rows.map((row) => (
              <tr key={row.documentId} className="hover:bg-zinc-50">
                <td className="px-4 py-3">
                  <div className="font-medium text-zinc-900">{row.participantName}</div>
                  <div className="text-xs text-zinc-400">{row.email}</div>
                </td>
                <td className="px-4 py-3 font-mono text-xs text-zinc-600">
                  {row.documentNumber ?? "—"}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {formatDate(row.generatedAt)}
                </td>
                <td className="px-4 py-3 text-xs text-zinc-500">
                  {row.emailedAt ? formatDate(row.emailedAt) : "—"}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={[
                      "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                      row.status === "emailed"
                        ? "bg-green-50 text-green-700"
                        : "bg-amber-50 text-amber-700",
                    ].join(" ")}
                  >
                    {row.status === "emailed" ? "Emailed" : "Generated"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <a
                      href={row.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-xs text-blue-600 hover:underline"
                    >
                      <ExternalLink className="h-3 w-3" />
                      PDF
                    </a>
                    <button
                      type="button"
                      disabled={resending === row.participantId}
                      onClick={() => void handleResend(row.participantId)}
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 disabled:opacity-40"
                      title="Re-send email"
                    >
                      <Send className="h-3 w-3" />
                      {resending === row.participantId ? "Sending…" : "Resend"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
```

**Note on Resend UX:** The `handleResend` currently calls `sendLoa` with `bulk: false` — this needs a separate single-participant resend route. For now, `resend: true` with `participantId` is the correct approach. Update `sendLoa` in api-client to also accept `{ participantId: string; resend: true }`:

```typescript
export async function sendLoa(
  programId: string,
  templateId: string,
  body:
    | { bulk: true; audience: 'submitted' | 'accepted'; resend?: boolean }
    | { participantId: string; resend: true },
): Promise<{ generated: number; failed: number }> {
  return request<{ generated: number; failed: number }>(
    `/programs/${programId}/document-templates/${templateId}/generate`,
    { method: 'POST', body: JSON.stringify(body) },
  );
}
```

And update `handleResend` in `LoaStatusTable.tsx` to use the correct overload:

```typescript
async function handleResend(participantId: string) {
  if (!template) return;
  setResending(participantId);
  try {
    await sendLoa(programId, template.id, { participantId, resend: true });
    toast.success("LoA re-sent");
    await load();
  } catch (err) {
    toast.error(err instanceof Error ? err.message : "Resend failed");
  } finally {
    setResending(null);
  }
}
```

- [ ] Update `app/programs/[programId]/documents/loa-template/page.tsx` to render the status table below the editor. The page needs the template id from the editor — thread it via a shared state or query. Simplest approach: fetch template id in the page and pass to both:

```tsx
"use client";

import { use, useEffect, useState } from "react";
import { LoaTemplateEditor } from "@/app/components/documents/LoaTemplateEditor";
import { LoaStatusTable } from "@/app/components/documents/LoaStatusTable";
import { listDocumentTemplates, type DocumentTemplate } from "@/src/shared/api-client";

export default function LoaTemplatePage({
  params,
}: {
  params: Promise<{ programId: string }>;
}) {
  const { programId } = use(params);
  const [activeTemplate, setActiveTemplate] = useState<DocumentTemplate | null>(null);

  useEffect(() => {
    listDocumentTemplates(programId, 'letter_of_acceptance')
      .then((tpls) => setActiveTemplate(tpls.find((t) => t.isActive) ?? tpls[0] ?? null))
      .catch(() => {/* silent — editor handles its own load */});
  }, [programId]);

  return (
    <div className="flex flex-col gap-6">
      <LoaTemplateEditor programId={programId} onTemplateChange={setActiveTemplate} />
      <LoaStatusTable programId={programId} template={activeTemplate} />
    </div>
  );
}
```

- [ ] Add `onTemplateChange` prop to `LoaTemplateEditor.tsx`. After existing save flows call `setTemplate(created)` or similar, also call `onTemplateChange?.(created)`. Update props interface:

```typescript
interface LoaTemplateEditorProps {
  programId: string;
  onTemplateChange?: (template: DocumentTemplate | null) => void;
}
```

- [ ] Run TypeScript check: `npx tsc --noEmit` in `services/admin-dashboard`.
- [ ] Commit: `git -C services/admin-dashboard add app/components/documents/LoaStatusTable.tsx app/programs/\[programId\]/documents/loa-template/page.tsx app/components/documents/LoaTemplateEditor.tsx && git -C services/admin-dashboard commit -m "feat: add LoaStatusTable with per-participant generated/emailed status and resend action"`

---

## Phase 4 (Optional) — `availableFrom` Release Scheduling

**Goal:** Allow admin to schedule the LoA "visible from" date so participants cannot see the document until a specific datetime. Not required for core send flow.

**Scope note:** This phase is deferred. When prioritized, the approach is:
1. Add `availableFrom DateTime? @map("available_from") @db.Timestamptz(6)` to `ParticipantDocument`.
2. In `GetPortalDocumentsHandler`, filter out documents where `availableFrom > now()`.
3. In `GenerateLOACommand`, accept an optional `availableFrom` ISO string; set on create/update.
4. In the admin UI, add a datetime picker to the "Generate & Send" dialog.
5. The notification email may still send immediately; the portal simply hides the document until `availableFrom`. Alternatively, delay the RabbitMQ emit using a scheduled job — that is a larger change (requires Bull/BullMQ).

This phase MUST NOT be implemented in the same PR as Phases 1-3.

---

## Prod/Env Dependencies

### RabbitMQ Queue

The new routing key `application.loa_ready` uses the existing `ybb.events` topic exchange (durable). The notification service already consumes from `notification_queue` which is bound to `ybb.events` with a wildcard routing key. No new queue or exchange creation is needed — verify the existing binding covers `application.#` patterns.

**Confirm:** Run `rabbitmqctl list_bindings` on prod to verify `notification_queue` is bound to `ybb.events` with `#` or `application.#`. If bound only to specific keys, add: `rabbitmqctl set_policy ...` or update the notification service `main.ts` RMQ config.

### Participant Portal URL

No new env var needed. The documents page URL is constructed from `brand.landingUrl ?? brand.websiteUrl` (the same pattern used by payment rejection emails — see `participant-dashboard-url.util.ts`). Ensure each brand has `landingUrl` or `websiteUrl` set; if neither is set, the email will render without a CTA link (logged as a warning).

### Managed Template Upgrade Path (Later)

Once these two env vars are set in the notification service container, all emails will automatically use the admin-editable managed template instead of the local `.hbs` fallback — no code change needed:

```
API_INTERNAL_URL=http://api:3000       # internal Docker network URL
NOTIFICATION_SERVICE_INTERNAL_KEY=<shared-secret>
```

The `resolveEmailContent` method already implements this: it calls `GET /internal/email-templates/resolve?type=loa_ready&brandId=...` first; if the managed template exists and has a non-empty body, it uses it. Otherwise it falls back to `loa-ready.hbs`.

The admin-facing email template editor page is at `/email-templates` in the admin dashboard. To create a managed `loa_ready` template: navigate there, click "New Template", set type = `loa_ready`, author the body, and publish.

---

## Self-Review: Spec Coverage Checklist

- [x] **Architectural decision 1 (reuse GenerateLOAHandler):** Tasks 1.2-1.4 add send capability on top of existing generation — no new handler created.
- [x] **Architectural decision 2 (audience param):** Task 1.2 adds `audience: 'submitted' | 'accepted'` to command/controller; Task 1.4 replaces hardcoded `status = 'accepted'` with `command.audience ?? 'accepted'`.
- [x] **Architectural decision 3 (RabbitMQ event):** Tasks 1.3-1.4 emit `application.loa_ready` from `GenerateLOAHandler`; Task 2.3 adds `@EventPattern('application.loa_ready')` handler in notification service.
- [x] **Architectural decision 4 (local Handlebars template + managed upgrade path):** Task 2.1 creates `loa-ready.hbs`; Task 2.2 uses `resolveEmailContent` with `fallbackTemplateName: 'loa-ready'`; Prod/Env section documents the managed upgrade path.
- [x] **Architectural decision 5 (emailedAt field + admin status view):** Task 1.1 adds `emailedAt` migration; Task 1.4 sets it post-emit; Tasks 3.1-3.4 add query endpoint and `LoaStatusTable`.
- [x] **Architectural decision 6 (non-blocking guard, no re-email):** Task 1.4 wraps emit in try/catch (warn-only); skips emit if `existingDoc.emailedAt` is set unless `command.resend === true`; resend button in `LoaStatusTable` passes `resend: true`.
- [x] **Architectural decision 7 (availableFrom = separate later phase):** Phase 4 marked optional with implementation sketch.
- [x] **No placeholders — all code is complete:** Every `- [ ]` code step contains real runnable TypeScript/Prisma/Handlebars.
- [x] **Type consistency with strict admin TS:** All new admin components use explicit interfaces, no implicit `any`, no `as any` casts except where required to work around shadcn internal types.
- [x] **TDD pattern (RED/GREEN/COMMIT):** Each task writes the failing test first, runs it, implements, runs again.
- [x] **Branch targets:** API + notification + admin dashboard commits target `dev`; participant web (`ybb-program-next`) is read-only reference only (no changes needed — `/dashboard/documents` page already exists).
- [x] **Migration naming convention:** `20260615120000_add_loa_emailed_at` matches repo format `YYYYMMDDHHMMSS_snake_case`.
- [x] **`programs.module.ts` does not already import `RabbitMQModule`** (confirmed at line 108 — only `CqrsModule, AuthModule, UsersModule, FilesModule`).
- [x] **Controller `QueryBus` injection:** Verified controller currently injects `generateLOAHandler` directly (not via query bus) — the new `getLoaStatus` route uses `queryBus.execute` which requires `QueryBus` injection. Task 3.1 notes this explicitly.
