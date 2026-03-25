# `any` Type Cleanup Reference

> **STATUS: All production `any` types have been eliminated as of the latest session.**
> Remaining `any` instances are limited to:
> - **Test files** (`.spec.ts`) — acceptable for mock objects, can be improved with `jest.Mocked<T>` later (P4)
> - **Commented-out code blocks** — `get-program-detail.handler.ts` lines 251–291 (inside `/* */` block, not compiled)

This document catalogs every `any` usage in `services/api/src/` that must be replaced with a proper type. Items are grouped by **category** and ordered by **priority** so the work can be done progressively without breaking things mid-way.

---

## ✅ Completed — All Production Files

### P1 — Foundational (DONE)

The `CurrentUser()` decorator already returns `CurrentUserData` (defined in `src/shared/decorators/current-user.decorator.ts`). Every controller below just needs the import added and `: any` replaced with `: CurrentUserData`.

> **Import to add to each file:**
> ```ts
> import { CurrentUser, CurrentUserData } from '@shared/decorators/current-user.decorator';
> ```

| File | Lines | Current | Should Be |
|------|-------|---------|-----------|
| `modules/payments/presentation/payments.controller.ts` | 40, 52, 90 | `user: any` | `user: CurrentUserData` |
| `modules/participants/presentation/participants.controller.ts` | 49, 66, 86, 102, 114, 126 | `user: any` | `user: CurrentUserData` |
| `modules/achievements/presentation/achievements.controller.ts` | 21, 31 | `user: any` | `user: CurrentUserData` |
| `modules/portal/presentation/portal.controller.ts` | 27, 37, 48, 57 | `user: any` | `user: CurrentUserData` |
| `modules/portal/presentation/portal-submissions.controller.ts` | 69, 96, 118 | `user: any` | `user: CurrentUserData` |
| `modules/portal/presentation/portal-certificates.controller.ts` | 51, 75 | `user: any` | `user: CurrentUserData` |

> **Note:** several of these controllers also check `user?.userId || user?.id`. Once typed, simplify to `user.userId` (the canonical field from `CurrentUserData`).

---

## P1 — Foundational: Payment gRPC interface

File: `modules/payments/common/proto/payment.interface.ts`

The `PaymentService` interface has three methods still typed as `any`. The proto definitions in `protos/payment_service.proto` already describe the shapes.

| Method | Request param | Response |
|--------|--------------|----------|
| `CreateIntent` | `CreateIntentRequest` (add to file) | `CreateIntentResponse` (add to file) |
| `GetPaymentMethods` | `GetPaymentMethodsRequest` (add to file) | `GetPaymentMethodsResponse` (add to file) |
| `ProcessPayment` | `ProcessPaymentRequest` (add to file) | `ProcessPaymentResponse` (add to file) |

**Interfaces to add** (derived directly from the proto):

```ts
// --- CreateIntent ---
export interface CreateIntentRequest {
  user_id: string;
  participant_id?: string;
  amount: number;
  currency: string;
  reference_type: string;
  reference_id: string;
  metadata?: Record<string, string>;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  description?: string;
  item_details?: ItemDetail[];
}

export interface ItemDetail {
  id: string;
  name: string;
  price: number;
  quantity: number;
  brand?: string;
  category?: string;
  merchant_name?: string;
}

export interface CreateIntentResponse {
  intent_id: string;
  client_secret?: string;
  status: string;
}

// --- GetPaymentMethods ---
export interface GetPaymentMethodsRequest {
  amount: number;
  currency: string;
}

export interface PaymentMethod {
  id: string;
  name: string;
  category: string;
  image_url: string;
  estimated_fee: number;
  is_surcharge: boolean;
}

export interface GetPaymentMethodsResponse {
  methods: PaymentMethod[];
}

// --- ProcessPayment ---
export interface ProcessPaymentRequest {
  intent_id: string;
  payment_method_id: string;
  gateway_token?: string;
  payment_details?: { details_json?: string };
}

export interface ProcessPaymentAction {
  type: string;
  url?: string;
  qr_string?: string;
}

export interface ProcessPaymentResponse {
  status: string;
  transaction_id: string;
  action?: ProcessPaymentAction;
  metadata?: Record<string, string>;
}
```

After adding these, update `PaymentService` and `PaymentGrpcClient`:

File: `modules/payments/infrastructure/services/payment-grpc.client.ts` — Lines 38, 47, 56, 65, 74:

| Method | Param type | Return type |
|--------|-----------|-------------|
| `submitManualPayment` | ✅ already `SubmitManualPaymentRequest` | ✅ already typed |
| `verifyManualPayment` | ✅ already `VerifyManualPaymentRequest` | ✅ already typed |
| `createIntent` | `CreateIntentRequest` | `Promise<CreateIntentResponse>` |
| `getPaymentMethods` | `GetPaymentMethodsRequest` | `Promise<GetPaymentMethodsResponse>` |
| `processPayment` | `ProcessPaymentRequest` | `Promise<ProcessPaymentResponse>` |

---

## P2 — Domain: Payment controller return types

File: `modules/payments/presentation/payments.controller.ts`

| Lines | Current | Should Be |
|-------|---------|-----------|
| 41, 53 (`createIntent`, `confirmPayment`) | `Promise<any>` | `Promise<CreateIntentResponse>` / `Promise<ProcessPaymentResponse>` |
| 77 (`getPaymentMethods`) | `Promise<any>` | `Promise<GetPaymentMethodsResponse>` |

---

## P2 — Domain: CQRS handlers

File: `modules/payments/application/commands/handlers/create-intent.handler.ts` — Line 9

| Current | Should Be |
|---------|-----------|
| `Promise<any>` | `Promise<CreateIntentResponse>` |

---

## P2 — Domain: RabbitMQ event payloads

These use `@Payload() data: any` because the event payload structure is a freeform envelope. The correct fix is to define a typed union or a shared event envelope interface.

**Suggested shared type** (add to `src/common/types/events.ts`):

```ts
export interface RmqEventPayload<T = Record<string, unknown>> {
  event: string;
  timestamp?: string;
  data: T;
}
```

| File | Lines | Handler | Recommended payload type |
|------|-------|---------|--------------------------|
| `modules/audit/audit.controller.ts` | 35, 41, 47, 53 | `handleUserEvents`, `handlePaymentEvents`, `handleSystemEvents`, `handleProgramEvents` | `RmqEventPayload` |
| `modules/reporting/reporting.controller.ts` | 54, 60 | `handlePaymentSucceeded`, `handleUserRegistered` | `RmqEventPayload<{ amount?: number; currency?: string; email?: string }>` |

---

## P2 — Domain: Application DTO and entity loose types

### `modules/applications/presentation/dto/create-application-request.dto.ts` — Lines 42, 47
### `modules/applications/presentation/dto/update-application-request.dto.ts` — Lines 34, 39

```ts
// Current
documents?: Record<string, any>;
requirementFiles?: any[];

// Should be — add these interfaces to a shared types file
export interface DocumentFile {
  fileId: string;
  fileName: string;
  fileUrl: string;
  mimeType?: string;
}

// Then:
documents?: Record<string, DocumentFile>;
requirementFiles?: DocumentFile[];
```

### `core/entities/participant-application.entity.ts` — Lines 57–65, 77–78

Same `DocumentFile` type applies to:
- `personalData: Record<string, unknown>` (truly free-form JSON — `unknown` is still safer than `any`)
- `essayAnswers: Record<string, unknown>`
- `uploadedFiles: Record<string, DocumentFile>`
- `documents?: Record<string, DocumentFile>`
- `requirementFiles?: DocumentFile[]`
- `participantSnapshot?: Record<string, unknown>`
- `statusHistory?: ApplicationStatusHistoryEntry[]` (define this interface)

**Add to `core/entities/participant-application.entity.ts`:**
```ts
export interface ApplicationStatusHistoryEntry {
  status: string;
  changedAt: string;
  changedBy?: string;
  reason?: string;
}
```

---

## P2 — Domain: Portal submission DTOs

File: `modules/portal/presentation/dto/portal-submission-detail.dto.ts` — Lines 32, 35, 61, 113

```ts
// options: any -> define a union
options?: string[] | { label: string; value: string }[];

// validationRules: any -> define an interface
export interface FieldValidationRules {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
}
validationRules?: FieldValidationRules;

// values: Record<string, any> -> use unknown for safety
values: Record<string, unknown>;

// uploadedFile: Record<string, any> -> use DocumentFile
uploadedFile?: DocumentFile;
```

---

## P2 — Domain: Landing page DTO loose arrays

File: `modules/landing/dto/landing-page.dto.ts` — Lines 54, 57, 60, 63, 66, 69, 99

These are flexible CMS-style payloads that vary by brand/config. The safest incremental option is to replace `any` with `unknown` to force callers to narrow, or define specific sub-interfaces for the known shapes.

| Field | Temporary fix | Long-term target |
|-------|--------------|-----------------|
| `vision_mission?: any` | `vision_mission?: { vision?: string; mission?: string }` | — |
| `ig_feed?: any[]` | `ig_feed?: IgFeedItem[]` | Add `IgFeedItem` interface |
| `registration_types?: any[]` | `registration_types?: RegistrationType[]` | Add interface |
| `guidelines?: any[]` | `guidelines?: Guideline[]` | Add interface |
| `tabs?: any[]` | `tabs?: ContentTab[]` | Add interface |
| `items?: any[]` | `items?: unknown[]` | Narrow per consumer |
| `data?: any[]` (`LandingPageSectionDto`) | `data?: unknown[]` | Narrow per consumer |

---

## P3 — Infrastructure: Prisma soft-delete helpers

File: `shared/infrastructure/prisma/prisma.service.ts` — Lines 81, 173, 174, 189

`softDelete` and `restore` accept a `model: any` because Prisma doesn't expose a generic delegate type directly. The safest typed pattern is:

```ts
// Use a structural interface instead of any
interface PrismaModel {
  update: (args: { where: object; data: object }) => Promise<unknown>;
}

async softDelete<T>(model: PrismaModel, where: object, deletedBy?: string): Promise<T>
async restore<T>(model: PrismaModel, where: object): Promise<T>
```

For `newWhere: any` on line 81, replace with `Record<string, unknown>`.

---

## P3 — Infrastructure: Application repository `where` builders

File: `modules/applications/infrastructure/persistence/application.repository.ts` — Lines 63, 106

```ts
// Current
const where: any = { programId };

// Fix: use Prisma-generated type
import { Prisma } from '@prisma/client';
const where: Prisma.ParticipantApplicationWhereInput = { programId };
```

File: `modules/participants/infrastructure/persistence/participant.repository.ts` — Lines 54–56
File: `modules/participants/infrastructure/persistence/ambassador.repository.ts` — Line 54

Same approach — use `Prisma.ParticipantUpdateInput` / `Prisma.AmbassadorUpdateInput` instead of `any`.

---

## P3 — Infrastructure: Application mapper

File: `modules/applications/infrastructure/mappers/application.mapper.ts` — Lines 36, 37, 49, 50, 108, 142

- `toPrismaCreate()` and `toPrismaUpdate()` should return `Prisma.ParticipantApplicationCreateInput` / `Prisma.ParticipantApplicationUpdateInput`.
- `as any[]` and `as Record<string, any>` casts on lines 36–50 can be replaced with `as DocumentFile[]` and `as Record<string, unknown>` after the entity types are updated.

---

## P3 — Infrastructure: Excel service generic row type

File: `shared/infrastructure/excel/excel.service.ts` — Lines 8, 26

```ts
// Current
data: any[]

// Fix: define a row shape
type ExcelRow = Record<string, string | number | boolean | Date | null | undefined>;
data: ExcelRow[]
```

---

## P3 — Audit admin `buildWhereClause`

File: `modules/audit/audit-admin.controller.ts` — Lines 184, 185

```ts
// Current
private buildWhereClause(query: QueryAuditLogsDto): any

// Fix: use Prisma-generated type
import { Prisma } from '@prisma/client';
private buildWhereClause(query: QueryAuditLogsDto): Prisma.DataChangeLogWhereInput
```

---

## P3 — Core entities with JSONB fields

These fields map to Postgres `JSONB` columns. Replace with `unknown` or narrow interfaces as described above.

| File | Field | Recommended type |
|------|-------|-----------------|
| `core/entities/user-activity-log.entity.ts` L7 | `activityData: any` | `activityData: Record<string, unknown>` |
| `core/entities/user-preference.entity.ts` L22 | `customSettings: any` | `customSettings: Record<string, unknown>` |
| `core/entities/participant.entity.ts` L42 | `preferences?: any` | `preferences?: Record<string, unknown> \| null` |
| `core/entities/user-notification.entity.ts` L16 | `metadata: any` | `metadata: Record<string, unknown>` |
| `core/entities/brand.entity.ts` L24 | `socialMediaLinks: any` | `socialMediaLinks: SocialMediaLinks \| null` — define interface |
| `core/entities/brand-setting.entity.ts` L8 | `footerNavigation: any` | `footerNavigation: FooterNavigationConfig` — define interface |
| `core/entities/support-ticket.entity.ts` L35 | `attachments: any[]` | `attachments: DocumentFile[]` |
| `core/entities/account-deletion-request.entity.ts` L13–14 | `dataSnapshot: any`, `deletionLog: any` | `Record<string, unknown>` |

---

## P3 — Landing service return types

File: `modules/landing/landing.service.ts` — Lines 73–109

All `async getFoo(): Promise<any>` methods. Each strategy has a known shape — wire the return type through `LandingPageResponseDto`:

```ts
async getHome(url?: string): Promise<LandingPageResponseDto>
async getAbout(url?: string): Promise<LandingPageResponseDto>
// ... etc
```

The interface `LandingPageStrategy` in `modules/landing/strategies/landing-page.strategy.ts` L4 also returns `Promise<any>` — change to `Promise<LandingPageResponseDto>`.

---

## P3 — Swagger config

File: `src/config/swagger.config.ts` — Lines 189, 198, 220, 221, 247, 253, 260, 263–265

These are internal OpenAPI document manipulation utilities. The `openapi-types` package (already used by NestJS/Swagger) has `OpenAPIObject` and `PathItemObject` types you can use to replace `any`:

```ts
import { OpenAPIObject } from '@nestjs/swagger';

const participantMethods: PathItemObject = {};
const collectUsedSchemas = (obj: OpenAPIObject, usedSet: Set<string>) => { ... }
```

For lines with `(documentAll as any)`, cast to `OpenAPIObject` instead.

---

## P4 — Test files

| File | Lines | Notes |
|------|-------|-------|
| `modules/landing/landing.service.spec.ts` | 15–16 | `prismaService: any`, `homeStrategy: any` → use proper mock types via `jest.Mocked<T>` |
| `modules/landing/strategies/home.strategy.spec.ts` | 8, 128 | Same — use `jest.Mocked<PrismaService>` |

---

## P4 — `metadata.service.ts` (Intl API)

File: `modules/metadata/metadata.service.ts` — Line 66

```ts
// Current
const timezones = (Intl as any).supportedValuesOf('timeZone');

// Fix: declare the extended type locally
const timezones = (Intl as typeof Intl & { supportedValuesOf(key: string): string[] }).supportedValuesOf('timeZone');
```

---

## Suggested Execution Order

1. **Add missing interfaces** to `payment.interface.ts` (unblocks P1 & P2 payment work)
2. **Fix `CurrentUser` parameter** in all controllers (one-liner per method, zero logic change)
3. **Fix payment controller / handler return types** (depends on step 1)
4. **Add `RmqEventPayload`** to `common/types/events.ts` and update audit + reporting controllers
5. **Define `DocumentFile` + `ApplicationStatusHistoryEntry`** and update application DTOs + entity
6. **Update portal submission DTOs** (`FieldValidationRules`, etc.)
7. **Prisma infrastructure** — `softDelete`/`restore`, repository `where` builders, mapper return types
8. **Core entities** — replace JSONB `any` fields with `Record<string, unknown>` or typed interfaces
9. **Landing service / strategy** return types
10. **Swagger config** — use `OpenAPIObject`
11. **Test files** — use `jest.Mocked<T>`

---

## ✅ Completed Files (All Sessions)

All files below have been updated from `any` to proper types:

### Infrastructure & Shared
- `shared/infrastructure/prisma/prisma.service.ts`
- `shared/infrastructure/database/transactional-repositories.ts`
- `shared/services/transaction.service.ts`
- `shared/infrastructure/cache/cache-invalidate.decorator.ts`
- `shared/interceptors/audit-trail.interceptor.ts`
- `shared/services/data-change-log.service.ts`
- `shared/infrastructure/file/file-service.client.ts`

### Auth Module
- `modules/auth/infrastructure/strategies/settings.strategy.ts`
- `modules/auth/infrastructure/firebase/firebase-auth.service.ts`
- `modules/auth/application/commands/create-auth-provider.command.ts`
- `modules/auth/application/commands/update-auth-provider.command.ts`
- `modules/auth/presentation/dto/create-auth-provider.dto.ts`

### Payments Module
- `modules/payments/infrastructure/persistence/payment.repository.ts`
- `modules/payments/presentation/webhooks.controller.ts`
- `modules/payments/presentation/dto/confirm-payment.dto.ts`
- `modules/payments/presentation/dto/create-intent.dto.ts`

### Programs Module
- `modules/programs/presentation/programs.controller.ts`
- `modules/programs/presentation/program-content.controller.ts`
- `modules/programs/infrastructure/persistence/program.repository.ts`
- `modules/programs/infrastructure/persistence/program-content.repository.ts`
- `modules/programs/application/commands/update-program-branding.command.ts`
- `modules/programs/application/commands/program-content.commands.ts`
- `modules/programs/application/commands/handlers/create-program.handler.ts`
- `modules/programs/application/commands/handlers/delete-program.handler.ts`
- `modules/programs/application/commands/handlers/update-program-branding.handler.ts`
- `modules/programs/application/queries/handlers/get-program-detail.handler.ts`
- `modules/programs/application/dto/upload-content.dto.ts`
- `modules/programs/application/dto/create-update-program-content.dto.ts`
- `modules/programs/application/dto/program-content.dto.ts`
- `modules/programs/application/dto/program-detail-response.dto.ts`
- `modules/programs/application/dto/program-landing.dto.ts`
- `modules/programs/application/dto/participation-info.dto.ts`
- `modules/programs/application/dto/application-form-field/create-application-form-field.dto.ts`

### Applications Module
- `modules/applications/infrastructure/mappers/application.mapper.ts`
- `modules/applications/application/commands/create-application.command.ts`
- `modules/applications/application/commands/update-application.command.ts`
- `modules/applications/application/commands/handlers/create-application.handler.ts`
- `modules/applications/application/commands/handlers/update-application.handler.ts`
- `modules/applications/application/queries/handlers/list-applications.handler.ts`
- `modules/applications/application/queries/handlers/get-application.handler.ts`
- `modules/applications/application/queries/handlers/export-applications.handler.ts`
- `modules/applications/application/dto/application-response.dto.ts`
- `modules/applications/application/dto/create-application.dto.ts`
- `modules/applications/application/dto/update-application.dto.ts`

### Portal Module
- `modules/portal/application/queries/portal-queries.ts`
- `modules/portal/application/queries/handlers/get-portal-submission-detail.handler.ts`
- `modules/portal/application/queries/handlers/get-portal-payments.handler.ts`
- `modules/portal/application/queries/handlers/get-portal-dashboard.handler.ts`
- `modules/portal/application/commands/handlers/portal-submit-application.handler.ts`
- `modules/portal/application/commands/handlers/save-submission-section.handler.ts`
- `modules/portal/application/utils/submission-progress.util.ts`

### Users Module
- `modules/users/application/commands/update-user-preferences.command.ts`
- `modules/users/application/commands/handlers/update-user-preferences.handler.ts`
- `modules/users/infrastructure/persistence/account-deletion-request.repository.ts`

### Brands Module
- `modules/brands/application/commands/*.ts` (handlers and commands)

### System Module
- `modules/system/infrastructure/persistence/system-announcement.repository.ts`
- `modules/system/presentation/system-announcements.controller.ts`

### Files Module
- `modules/files/presentation/documents.controller.ts`

### Core DTOs
- `modules/users/presentation/dto/user-notification.dto.ts`
- `modules/users/presentation/dto/user-preference.dto.ts`
- `modules/users/presentation/dto/user-logs.dto.ts`
- `modules/audit/audit.service.ts`

