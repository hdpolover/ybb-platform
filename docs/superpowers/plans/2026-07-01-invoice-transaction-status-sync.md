# Invoice ↔ Gateway-Transaction Status Sync — Implementation Plan

For agentic workers: REQUIRED SUB-SKILL — before executing any task below, load and follow
`superpowers:test-driven-development` for the RED → GREEN → REFACTOR discipline, and
`superpowers:verification-before-completion` before checking off any task.

**Goal:** Close the drift between `ApplicationInvoice.status` (NestJS API,
`ybb_platform_db`) and the Go payment service's `PaymentIntent`/`PaymentTransaction`
status (`ybb_payments_db`) so a terminal invoice can never leave a live gateway
transaction behind — fixing the "Cancelled invoice / Pending attempt" admin-UI
contradiction, self-healing the 262 already-orphaned prod records, and correcting the
`midtrans_cc` gateway mislabeling.

**Architecture:** Two independently-owned state machines synced by RabbitMQ events
(`payment.cancelled`, `payment.succeeded`, `payment.failed`) and internal HTTP calls
from the NestJS API to the Go payment service (`PAYMENT_SERVICE_URL`), linked by
`application_invoices.external_intent_id` / `external_transaction_id`. This plan adds:
one shared idempotent void method (`PaymentGatewayClient.voidTransaction`), wires it
into every terminal-invoice writer, widens the hourly reconciliation cron to catch
drift the writers miss, fixes the admin UI to defer to invoice status, ships a
dry-run-first backfill for the existing orphans, and fixes the gateway-name display
(with a data-only fix for the stored mapping).

**Tech Stack:** NestJS (TypeScript) API in `services/api` (npm, Jest, `ts-jest`), Go
payment service in `services/payment` (Go 1.24, `go test`, `testify/require`),
Next.js 16 admin dashboard in `services/admin-dashboard` (no test framework installed;
existing convention is a standalone `node <file>.test.ts` using `node:assert/strict`,
see `services/admin-dashboard/lib/datetime.test.ts`).

## Global Constraints

- **Milestone: Bug Fix & Security Hardening.** No new features — every change here is
  either a correctness fix (invoice/transaction sync), a safety net (reconciliation),
  or a one-off remediation (backfill). Do not add speculative generality.
- **Repo/package manager:** `ybb-platform` uses **npm**, not pnpm (`services/api`,
  `services/admin-dashboard` both have `package-lock.json`). Always run `npm run test`
  / `npm test`, never `pnpm`.
- **Invariant to enforce everywhere:** *invoice terminal ⇒ its linked transaction must
  be terminal.* Terminal invoice statuses: `paid`, `cancelled`, `failed`, `refunded`.
  Terminal transaction statuses (Go): `SUCCESS`, `FAILED`, `VOID`, `REJECTED`. Terminal
  intent statuses (Go): `SUCCEEDED`, `CANCELED`.
- **Never void a gateway-settled transaction.** Any code path that cancels/voids a Go
  transaction MUST re-check the transaction's live status first and hard-refuse to
  void a transaction whose status is `SUCCESS` (or intent `SUCCEEDED`) — log it as a
  danger case and leave the invoice untouched instead. This guard belongs in the
  shared void method itself so every caller inherits it for free.
- **Producer-agnostic fix.** The reconciliation widening (Component 2) must not assume
  `markInvoiceCancelled` is the only path that produces orphans — it re-checks gateway
  state at execution time regardless of how the invoice got to a terminal state.
- **Idempotency.** All void calls must no-op (not throw) on an already-terminal
  non-settled transaction (`VOID`/`FAILED`/`REJECTED`), including tolerating a Go `400`
  response, which the existing reconciler already treats as "already terminal".
- Follow this repo's existing patterns exactly: 4-space indent in `services/api`
  TypeScript, Jest `describe/it` with manually-constructed mock objects (no
  auto-mocking library in use), `Test.createTestingModule` for NestJS unit tests,
  Go `testify/require` for table-driven tests.

---

## Task 1 — Shared idempotent void method: `PaymentGatewayClient`

This is the foundational extraction Component 1 depends on. Every caller
(`markInvoiceCancelled`, the portal cancel handler, the admin `updateInvoiceStatus`
writer, the reconciler, and the backfill script) must go through one path so the
"never void a settled transaction" guard only has to be written once.

**Files:**
- Create: `services/api/src/modules/payments/infrastructure/services/gateway-transaction-status.util.ts`
- Create: `services/api/src/modules/payments/infrastructure/services/gateway-transaction-status.util.spec.ts`
- Create: `services/api/src/modules/payments/infrastructure/services/payment-gateway.client.ts`
- Create: `services/api/src/modules/payments/infrastructure/services/payment-gateway.client.spec.ts`
- Modify: `services/api/src/modules/payments/payments.module.ts` (register + export the new provider)

**Interfaces:**
- Consumes: `PaymentServiceHttpClient.get<T>(path, config)` / `.post<T>(path, data, config)`
  (existing, `services/api/src/modules/payments/infrastructure/services/payment-service-http.client.ts:34,38`),
  `ConfigService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '')`.
- Produces:
  ```ts
  export type VoidTransactionOutcome = 'voided' | 'already_terminal' | 'danger_settled' | 'error';
  export interface VoidTransactionResult {
      outcome: VoidTransactionOutcome;
      detail: string;
  }
  export class PaymentGatewayClient {
      async voidTransaction(transactionId: string, invoiceId: string, reason: string): Promise<VoidTransactionResult>;
  }
  ```

### Step 1.1 — failing test for the pure status-classification util

Write `gateway-transaction-status.util.spec.ts`:

```ts
import { extractTopLevelStatus, isSettledStatus, isTerminalNonSettledStatus } from './gateway-transaction-status.util';

describe('gateway-transaction-status.util', () => {
    describe('extractTopLevelStatus', () => {
        it('reads a top-level transaction status', () => {
            expect(extractTopLevelStatus({ status: 'pending' })).toBe('PENDING');
        });

        it('returns empty string for a missing/null payload', () => {
            expect(extractTopLevelStatus(null)).toBe('');
        });
    });

    describe('isSettledStatus', () => {
        it.each(['SUCCESS', 'SUCCEEDED'])('treats %s as settled', (status) => {
            expect(isSettledStatus(status)).toBe(true);
        });

        it.each(['PENDING', 'NEEDS_REVIEW', 'VOID', 'FAILED', ''])('treats %s as not settled', (status) => {
            expect(isSettledStatus(status)).toBe(false);
        });
    });

    describe('isTerminalNonSettledStatus', () => {
        it.each(['FAILED', 'VOID', 'REJECTED', 'CANCELED'])('treats %s as terminal-non-settled', (status) => {
            expect(isTerminalNonSettledStatus(status)).toBe(true);
        });

        it.each(['PENDING', 'NEEDS_REVIEW', 'SUCCESS', ''])('treats %s as NOT terminal-non-settled', (status) => {
            expect(isTerminalNonSettledStatus(status)).toBe(false);
        });
    });
});
```

Run it and confirm it fails on the missing module:

```bash
cd services/api && npm run test -- gateway-transaction-status.util.spec.ts
```

Expect: `Cannot find module './gateway-transaction-status.util'`.

### Step 1.2 — minimal implementation to pass

Create `gateway-transaction-status.util.ts`:

```ts
// services/api/src/modules/payments/infrastructure/services/gateway-transaction-status.util.ts

/**
 * Pure helpers for classifying a Go payment-service transaction/intent payload's
 * status. Shared by PaymentGatewayClient (cascade void), PaymentReconciliationService
 * (terminal-drift scan) and the orphaned-cancellation backfill script, so the
 * "never void a settled transaction" rule lives in exactly one place.
 */
export function extractTopLevelStatus(payload: Record<string, unknown> | null | undefined): string {
    if (!payload) return '';
    return String(payload.status ?? '').toUpperCase();
}

export function isSettledStatus(status: string): boolean {
    return status === 'SUCCESS' || status === 'SUCCEEDED';
}

export function isTerminalNonSettledStatus(status: string): boolean {
    return status === 'FAILED' || status === 'VOID' || status === 'REJECTED' || status === 'CANCELED';
}
```

Run again, expect PASS:

```bash
cd services/api && npm run test -- gateway-transaction-status.util.spec.ts
```

### Step 1.3 — commit

```bash
git add services/api/src/modules/payments/infrastructure/services/gateway-transaction-status.util.ts \
        services/api/src/modules/payments/infrastructure/services/gateway-transaction-status.util.spec.ts
git commit -m "feat: add pure gateway-transaction status classification helpers"
```

### Step 1.4 — failing test for `PaymentGatewayClient.voidTransaction`

Write `payment-gateway.client.spec.ts`, mirroring the mock style already used in
`payment-reconciliation.service.spec.ts`:

```ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentGatewayClient } from './payment-gateway.client';
import { PaymentServiceHttpClient } from './payment-service-http.client';

describe('PaymentGatewayClient.voidTransaction', () => {
    let client: PaymentGatewayClient;
    let mockPaymentClient: { get: jest.Mock; post: jest.Mock };

    beforeEach(async () => {
        mockPaymentClient = { get: jest.fn(), post: jest.fn() };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                PaymentGatewayClient,
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            ],
        }).compile();

        client = module.get<PaymentGatewayClient>(PaymentGatewayClient);
    });

    it('voids a PENDING transaction', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
        mockPaymentClient.post.mockResolvedValue({ data: {} });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'Invoice cancelled');

        expect(result.outcome).toBe('voided');
        expect(mockPaymentClient.post).toHaveBeenCalledWith(
            '/api/v1/payments/txn-1/cancel',
            { reason: 'Invoice cancelled' },
            expect.anything(),
        );
    });

    it('no-ops on an already-VOID transaction without calling cancel', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'VOID' } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('already_terminal');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });

    it('refuses to void a SUCCESS transaction and reports danger_settled', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'SUCCESS' } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('danger_settled');
        expect(mockPaymentClient.post).not.toHaveBeenCalled();
    });

    it('treats a gateway 400 on cancel as already_terminal, not an error', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
        mockPaymentClient.post.mockRejectedValue({ response: { status: 400 } });

        const result = await client.voidTransaction('txn-1', 'inv-1', 'reason');

        expect(result.outcome).toBe('already_terminal');
    });

    it('returns outcome error (not a throw) on a non-400 gateway failure', async () => {
        mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });
        mockPaymentClient.post.mockRejectedValue({ response: { status: 500 }, message: 'timeout' });

        const result = await expect(client.voidTransaction('txn-1', 'inv-1', 'reason')).resolves.toEqual(
            expect.objectContaining({ outcome: 'error' }),
        );
        void result;
    });
});
```

Run and confirm it fails on the missing module:

```bash
cd services/api && npm run test -- payment-gateway.client.spec.ts
```

### Step 1.5 — minimal implementation to pass

Create `payment-gateway.client.ts`:

```ts
// services/api/src/modules/payments/infrastructure/services/payment-gateway.client.ts
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentServiceHttpClient } from './payment-service-http.client';
import {
    extractTopLevelStatus,
    isSettledStatus,
    isTerminalNonSettledStatus,
} from './gateway-transaction-status.util';

export type VoidTransactionOutcome = 'voided' | 'already_terminal' | 'danger_settled' | 'error';

export interface VoidTransactionResult {
    outcome: VoidTransactionOutcome;
    detail: string;
}

/**
 * Single, idempotent path for cancelling a Go payment-service transaction. Every
 * writer that moves an invoice to a terminal state (payment.cancelled handler, the
 * portal self-cancel handler, the admin status-override endpoint, the reconciler,
 * and the orphan backfill script) must call this instead of POSTing
 * /cancel directly, so "never void a settled transaction" is enforced in one place.
 */
@Injectable()
export class PaymentGatewayClient {
    private readonly logger = new Logger(PaymentGatewayClient.name);
    private readonly internalKey: string;

    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly configService: ConfigService,
    ) {
        this.internalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }

    async voidTransaction(
        transactionId: string,
        invoiceId: string,
        reason: string,
    ): Promise<VoidTransactionResult> {
        const headers = this.buildHeaders();
        const payload = await this.fetchTransactionPayload(transactionId, headers);
        const status = extractTopLevelStatus(payload);

        if (isSettledStatus(status)) {
            this.logger.error(
                `[payment-gateway-client] DANGER invoice=${invoiceId} txn=${transactionId} is ${status} at gateway — refusing to void`,
            );
            return { outcome: 'danger_settled', detail: `transaction is ${status} at gateway` };
        }

        if (isTerminalNonSettledStatus(status)) {
            return { outcome: 'already_terminal', detail: `transaction already ${status}` };
        }

        try {
            await this.paymentServiceClient.post(
                `/api/v1/payments/${transactionId}/cancel`,
                { reason },
                { headers },
            );
            return { outcome: 'voided', detail: 'transaction cancelled' };
        } catch (error) {
            const httpStatus = (error as { response?: { status?: number } })?.response?.status;
            if (httpStatus === 400) {
                this.logger.warn(
                    `[payment-gateway-client] cancel for invoice ${invoiceId} txn ${transactionId} returned 400 — already terminal`,
                );
                return { outcome: 'already_terminal', detail: 'gateway returned 400 (already terminal)' };
            }
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error(
                `[payment-gateway-client] void failed invoice=${invoiceId} txn=${transactionId}: ${message}`,
            );
            return { outcome: 'error', detail: message };
        }
    }

    private async fetchTransactionPayload(
        transactionId: string,
        headers: Record<string, string>,
    ): Promise<Record<string, unknown> | null> {
        try {
            const { data } = await this.paymentServiceClient.get(
                `/api/v1/payments/${transactionId}`,
                { headers },
            );
            if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
            const record = data as Record<string, unknown>;
            return record.data && typeof record.data === 'object' && !Array.isArray(record.data)
                ? (record.data as Record<string, unknown>)
                : record;
        } catch (error) {
            // Fetch failure => status unknown. Fall through with status '' so the
            // switch below attempts the cancel (Go's own /cancel endpoint independently
            // tolerates an already-terminal transaction with its 400 response).
            this.logger.warn(
                `[payment-gateway-client] status fetch failed for txn ${transactionId}: ${
                    error instanceof Error ? error.message : String(error)
                }`,
            );
            return null;
        }
    }

    private buildHeaders(): Record<string, string> {
        return this.internalKey ? { 'X-Internal-Service-Key': this.internalKey } : {};
    }
}
```

Run again, expect PASS:

```bash
cd services/api && npm run test -- payment-gateway.client.spec.ts
```

### Step 1.6 — register the provider in `PaymentsModule`

Edit `services/api/src/modules/payments/payments.module.ts`:

```ts
import { PaymentGatewayClient } from './infrastructure/services/payment-gateway.client';
```

Add `PaymentGatewayClient` to `providers` (after `PaymentServiceHttpClient`) and to
`exports` (so `PortalModule`, which already imports `PaymentsModule`, can inject it in
Task 3):

```ts
    providers: [
        // ...
        PaymentServiceHttpClient,
        PaymentGatewayClient,
        // ...
    ],
    exports: ['IPaymentRepository', PaymentServiceHttpClient, PaymentGatewayClient, PaymentOutboxService, RegistrationFeeGateService],
```

Run the full payments test suite to make sure module wiring didn't break anything:

```bash
cd services/api && npm run test -- src/modules/payments
```

Expect: all existing + new specs PASS.

### Step 1.7 — commit

```bash
git add services/api/src/modules/payments/infrastructure/services/payment-gateway.client.ts \
        services/api/src/modules/payments/infrastructure/services/payment-gateway.client.spec.ts \
        services/api/src/modules/payments/payments.module.ts
git commit -m "feat: add idempotent PaymentGatewayClient.voidTransaction shared void path"
```

---

## Task 2 — Component 1a: cascade void in `markInvoiceCancelled`

Fixes the reported bug directly: the `payment.cancelled` RMQ handler must void the
Go transaction before/while flipping the invoice to `cancelled`, and must refuse to
cancel the invoice if the gateway reports the transaction as already `SUCCESS`.

**Files:**
- Modify: `services/api/src/modules/payments/presentation/payment-events.controller.ts`
  (constructor ~:23-32, `markInvoiceCancelled` ~:752-801)
- Modify: `services/api/src/modules/payments/presentation/__tests__/payment-events.controller.idempotency.spec.ts`
  is a sibling pattern to copy, not to edit. Create a new spec file instead:
- Create: `services/api/src/modules/payments/presentation/__tests__/payment-events.controller.cancel-cascade.spec.ts`

**Interfaces:**
- Consumes: `PaymentGatewayClient.voidTransaction(transactionId, invoiceId, reason): Promise<VoidTransactionResult>` (Task 1).
- Produces: `markInvoiceCancelled` behavior change only (same public signature/return type).

### Step 2.1 — failing test: PENDING transaction gets voided before invoice write

```ts
// services/api/src/modules/payments/presentation/__tests__/payment-events.controller.cancel-cascade.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PaymentEventsController } from '../payment-events.controller';
import { MetricsService } from '@shared/infrastructure/monitoring/metrics.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PaymentOutboxService } from '../../infrastructure/services/payment-outbox.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { RmqContext } from '@nestjs/microservices';

function makeRmqContext(): RmqContext {
    const channel = { ack: jest.fn(), nack: jest.fn() };
    const message = { properties: { headers: {} } };
    return {
        getChannelRef: () => channel,
        getMessage: () => message,
        getPattern: () => 'payment.cancelled',
    } as unknown as RmqContext;
}

describe('PaymentEventsController — payment.cancelled cascade void', () => {
    let controller: PaymentEventsController;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock; findFirst: jest.Mock };
        participantApplication: { findUnique: jest.Mock; update: jest.Mock };
        $transaction: jest.Mock;
    };

    const invoiceRow = {
        id: 'inv-1',
        status: 'processing',
        applicationId: 'app-1',
        rejectionReason: null,
        paymentMethod: null,
        externalIntentId: 'intent-1',
        externalTransactionId: 'txn-1',
        pricingTier: { feeType: 'registration_fee' },
        application: { participant: { userId: 'user-1' } },
    };

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockPrisma = {
            applicationInvoice: {
                findUnique: jest.fn().mockResolvedValue(invoiceRow),
                findFirst: jest.fn().mockResolvedValue(invoiceRow),
            },
            participantApplication: {
                findUnique: jest.fn().mockResolvedValue({ participant: { userId: 'user-1' } }),
                update: jest.fn().mockResolvedValue({}),
            },
            $transaction: jest.fn().mockImplementation((ops: Promise<unknown>[]) => Promise.all(ops)),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentEventsController],
            providers: [
                { provide: MetricsService, useValue: { jobProcessingDuration: { observe: jest.fn() } } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: UnitOfWork, useValue: { execute: jest.fn() } },
                { provide: CacheService, useValue: { invalidateKey: jest.fn(), invalidateByPattern: jest.fn() } },
                { provide: PaymentOutboxService, useValue: { enqueueInTransaction: jest.fn(), isEnabled: jest.fn().mockReturnValue(false) } },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
            ],
        }).compile();

        controller = module.get<PaymentEventsController>(PaymentEventsController);
    });

    it('voids the linked Go transaction before cancelling the invoice', async () => {
        const payload = {
            metadata: { application_id: 'app-1', invoice_id: 'inv-1' },
            transaction_id: 'txn-1',
        };

        await controller.handlePaymentCancelled(payload as any, makeRmqContext());

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-1', expect.any(String));
        expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it('does NOT cancel the invoice when the gateway reports danger_settled', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
        const payload = {
            metadata: { application_id: 'app-1', invoice_id: 'inv-1' },
            transaction_id: 'txn-1',
        };

        await controller.handlePaymentCancelled(payload as any, makeRmqContext());

        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
```

Run and confirm it fails (constructor doesn't accept `PaymentGatewayClient` yet, and
`voidTransaction` is never called):

```bash
cd services/api && npm run test -- payment-events.controller.cancel-cascade.spec.ts
```

### Step 2.2 — minimal implementation

Edit `payment-events.controller.ts` constructor (~:23):

```ts
import { PaymentGatewayClient } from '../infrastructure/services/payment-gateway.client';

// ...
    constructor(
        private readonly metricsService: MetricsService,
        private readonly prisma: PrismaService,
        private readonly unitOfWork: UnitOfWork,
        private readonly cacheService: CacheService,
        private readonly paymentOutbox: PaymentOutboxService,
        private readonly producer: RabbitMQProducerService,
        private readonly paymentGatewayClient: PaymentGatewayClient,
        @Optional() private readonly pubSubService?: RedisPubSubService,
        @Optional() private readonly referralFunnel?: ReferralFunnelService,
    ) {}
```

Edit `markInvoiceCancelled` (~:752):

```ts
    private async markInvoiceCancelled(input: {
        applicationId?: string;
        invoiceId?: string;
        intentId?: string;
        transactionId?: string;
        cancellationReason?: string;
        paymentMethod?: string;
    }): Promise<{ userId: string; invoiceId: string } | null> {
        const invoice = await this.resolveFailureInvoice(input);
        if (!invoice) {
            return null;
        }

        const userId = invoice.application.participant.userId;
        if (invoice.status === PaymentStatus.paid || invoice.status === PaymentStatus.cancelled) {
            return { userId, invoiceId: invoice.id };
        }

        const cancellationReason =
            invoice.rejectionReason
            ?? input.cancellationReason
            ?? 'Payment cancelled';

        const transactionId = invoice.externalTransactionId ?? input.transactionId ?? null;
        if (transactionId) {
            const voidResult = await this.paymentGatewayClient.voidTransaction(
                transactionId,
                invoice.id,
                cancellationReason,
            );
            if (voidResult.outcome === 'danger_settled') {
                this.logger.error(
                    `markInvoiceCancelled: refusing to cancel invoice ${invoice.id} — ` +
                    `transaction ${transactionId} is settled at the gateway (${voidResult.detail})`,
                );
                return { userId, invoiceId: invoice.id };
            }
            // 'voided' | 'already_terminal' | 'error' all proceed: a transient gateway
            // failure must not block the invoice write — the widened reconciler
            // (Component 2) is the backstop that will retry the void later.
        }

        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: PaymentStatus.cancelled }
                : { programPaymentStatus: PaymentStatus.cancelled };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: invoice.id },
                data: {
                    status: PaymentStatus.cancelled,
                    paidAt: null,
                    paymentMethod: invoice.paymentMethod ?? input.paymentMethod ?? null,
                    externalIntentId: invoice.externalIntentId ?? input.intentId ?? null,
                    externalTransactionId:
                        invoice.externalTransactionId
                        ?? input.transactionId
                        ?? null,
                    rejectionReason: cancellationReason,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.applicationId },
                data: paymentStatusPatch,
            }),
        ]);

        return { userId, invoiceId: invoice.id };
    }
```

Run again, expect PASS:

```bash
cd services/api && npm run test -- payment-events.controller.cancel-cascade.spec.ts
```

Then run the full existing idempotency spec to make sure the new constructor param
didn't break it (it uses `Test.createTestingModule` without providing
`PaymentGatewayClient` — it must be added there too, or Nest throws a
"missing dependency" error):

```bash
cd services/api && npm run test -- payment-events.controller
```

If it fails with a missing-provider error, add
`{ provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) } }`
to the `providers` array in
`services/api/src/modules/payments/presentation/__tests__/payment-events.controller.idempotency.spec.ts`
(and any other existing spec instantiating `PaymentEventsController` — check with
`grep -rl "controllers: \[PaymentEventsController\]" services/api/src`), then re-run.

### Step 2.3 — commit

```bash
git add services/api/src/modules/payments/presentation/payment-events.controller.ts \
        services/api/src/modules/payments/presentation/__tests__/payment-events.controller.cancel-cascade.spec.ts
git commit -m "fix: void linked Go transaction when payment.cancelled cancels an invoice"
```

If Step 2.2 required editing the idempotency spec, stage and commit that too in the
same commit (it's part of making this change safe, not a separate concern).

---

## Task 3 — Component 1b: refactor `CancelPortalPaymentHandler` onto the shared path

The participant self-cancel handler already voids Go correctly, but does it with a
raw `paymentServiceClient.post('/cancel')` call that duplicates the 400-tolerance
logic and lacks the "never void SUCCESS" guard. Route it through
`PaymentGatewayClient` for consistency, per the design's explicit goal that
"`markInvoiceCancelled`, the reconciler, and the portal cancel handler all call one
path."

**Files:**
- Modify: `services/api/src/modules/portal/application/commands/handlers/cancel-portal-payment.handler.ts`
- Create: `services/api/src/modules/portal/application/commands/handlers/__tests__/cancel-portal-payment.handler.spec.ts`
  (LOCATE FIRST: confirm no existing spec — `find services/api/src/modules/portal -iname "cancel-portal-payment*.spec.ts"`
  returned nothing during planning, so this is a new file, not an edit.)

**Interfaces:**
- Consumes: `PaymentGatewayClient.voidTransaction` (Task 1), already exported from
  `PaymentsModule`, which `PortalModule` already imports
  (`services/api/src/modules/portal/portal.module.ts:4,39`).
- Produces: same `CancelPortalPaymentResponseDto` return shape, no API change.

### Step 3.1 — locate first

```bash
find /Users/hendra/Projects/YBB/ybb-new/ybb-platform/services/api/src/modules/portal -iname "*cancel-portal-payment*"
```

Confirm the handler file exists and no spec exists yet (both true as of planning
time). If a spec already exists by the time this task runs, extend it instead of
creating a new one — this is not a "no new files" milestone violation because it is
targeted regression coverage for a bug-fix refactor, not new product surface.

### Step 3.2 — failing test: the handler should call the shared void, not raw POST

```ts
// services/api/src/modules/portal/application/commands/handlers/__tests__/cancel-portal-payment.handler.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { CancelPortalPaymentHandler } from '../cancel-portal-payment.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../../services/portal-cache.service';
import { PaymentGatewayClient } from '@modules/payments/infrastructure/services/payment-gateway.client';
import { ConfigService } from '@nestjs/config';

describe('CancelPortalPaymentHandler', () => {
    let handler: CancelPortalPaymentHandler;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock };
        $transaction: jest.Mock;
    };

    const invoiceRow = {
        id: 'inv-1',
        status: 'processing',
        externalTransactionId: 'txn-1',
        pricingTier: { feeType: 'registration_fee' },
        application: { id: 'app-1', participantId: 'part-1', programId: 'prog-1' },
    };

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockPrisma = {
            applicationInvoice: { findUnique: jest.fn().mockResolvedValue(invoiceRow) },
            $transaction: jest.fn().mockResolvedValue([{}, {}]),
        };

        const module: TestingModule = await Test.createTestingModule({
            providers: [
                CancelPortalPaymentHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn(), invalidateKey: jest.fn() } },
                { provide: PortalCacheService, useValue: { getParticipantProfile: jest.fn().mockResolvedValue({ id: 'part-1' }) } },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
            ],
        }).compile();

        handler = module.get<CancelPortalPaymentHandler>(CancelPortalPaymentHandler);
    });

    it('voids via the shared PaymentGatewayClient instead of a raw POST', async () => {
        await handler.execute({ userId: 'user-1', invoiceId: 'inv-1', reason: 'changed my mind' } as any);

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-1', 'changed my mind');
    });

    it('blocks the cancel and throws when the gateway reports danger_settled', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });

        await expect(
            handler.execute({ userId: 'user-1', invoiceId: 'inv-1', reason: 'changed my mind' } as any),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
```

Run and confirm it fails (handler still uses `paymentServiceClient`, not injected
`PaymentGatewayClient`):

```bash
cd services/api && npm run test -- cancel-portal-payment.handler.spec.ts
```

### Step 3.3 — minimal implementation

Edit `cancel-portal-payment.handler.ts`:

```ts
import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { CACHE_KEYS } from '@shared/constants/cache-keys';
import { PortalCacheService } from '../../services/portal-cache.service';
import { PaymentGatewayClient } from '@modules/payments/infrastructure/services/payment-gateway.client';
import { CancelPortalPaymentCommand } from '../../queries/portal-queries';
import { CancelPortalPaymentResponseDto } from '../../../presentation/dto/portal-payment.dto';

@Injectable()
export class CancelPortalPaymentHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
        private readonly portalCacheService: PortalCacheService,
        private readonly paymentGatewayClient: PaymentGatewayClient,
    ) {}

    async execute(command: CancelPortalPaymentCommand): Promise<CancelPortalPaymentResponseDto> {
        const participant = await this.portalCacheService.getParticipantProfile(command.userId);
        if (!participant) throw new NotFoundException('Participant not found');

        const invoice = await this.prisma.applicationInvoice.findUnique({
            where: { id: command.invoiceId },
            include: {
                pricingTier: { select: { feeType: true } },
                application: { select: { id: true, participantId: true, programId: true } },
            },
        });

        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.application.participantId !== participant.id) {
            throw new ForbiddenException('Access denied');
        }
        if (invoice.status === 'paid') {
            throw new BadRequestException('Paid invoice cannot be cancelled');
        }
        if (invoice.status !== 'processing') {
            throw new BadRequestException('Only pending payments can be cancelled');
        }
        if (!invoice.externalTransactionId) {
            throw new BadRequestException('No pending transaction found for this invoice');
        }

        const cancellationReason = command.reason?.trim() || 'Cancelled by participant';

        const voidResult = await this.paymentGatewayClient.voidTransaction(
            invoice.externalTransactionId,
            invoice.id,
            cancellationReason,
        );
        if (voidResult.outcome === 'danger_settled') {
            throw new BadRequestException(
                'This payment has already succeeded at the gateway and cannot be cancelled. Contact support.',
            );
        }

        const paymentStatusPatch =
            invoice.pricingTier?.feeType === 'registration_fee'
                ? { registrationPaymentStatus: 'cancelled' as const }
                : { programPaymentStatus: 'cancelled' as const };

        await this.prisma.$transaction([
            this.prisma.applicationInvoice.update({
                where: { id: command.invoiceId },
                data: {
                    status: 'cancelled',
                    rejectionReason: cancellationReason,
                },
            }),
            this.prisma.participantApplication.update({
                where: { id: invoice.application.id },
                data: paymentStatusPatch,
            }),
        ]);

        await Promise.all([
            this.cacheService.invalidateInvoiceCache(command.invoiceId, command.userId),
            this.cacheService.invalidateKey(CACHE_KEYS.PORTAL_PAYMENTS(command.userId)),
            this.cacheService.invalidateKey(
                CACHE_KEYS.PORTAL_PAYMENTS(command.userId, invoice.application.programId),
            ),
        ]);

        return {
            invoice_id: command.invoiceId,
            status: 'CANCELLED',
            message: 'Pending payment cancelled successfully.',
        };
    }
}
```

Note: `ConfigService` is no longer injected directly (the internal-key header
building moved into `PaymentGatewayClient`) — this is a legitimate constructor
signature shrink, not scope creep.

Run again, expect PASS:

```bash
cd services/api && npm run test -- cancel-portal-payment.handler.spec.ts
```

Then check for other specs that instantiate this handler and update their provider
lists (same "missing dependency" risk as Task 2):

```bash
grep -rl "CancelPortalPaymentHandler" services/api/src/modules/portal --include="*.spec.ts"
```

### Step 3.4 — commit

```bash
git add services/api/src/modules/portal/application/commands/handlers/cancel-portal-payment.handler.ts \
        services/api/src/modules/portal/application/commands/handlers/__tests__/cancel-portal-payment.handler.spec.ts
git commit -m "refactor: route portal self-cancel through shared PaymentGatewayClient"
```

---

## Task 4 — Component 1c: parity fix for admin `updateInvoiceStatus`

`PaymentAdminController.updateInvoiceStatus` (~:1224-1391) is a second, independent
writer that can move an invoice to `cancelled` or `refunded` — but its existing
Go-sync block (~:1375-1388) only handles `paid`/`failed` via the `/verify` endpoint.
Setting `cancelled` or `refunded` from this admin endpoint produces the exact same
orphan bug as the unfixed `markInvoiceCancelled`. This is the "audit the failed/
refunded writers" item from the design.

**Files:**
- Modify: `services/api/src/modules/payments/presentation/payment-admin.controller.ts`
  (constructor ~:56-66, `updateInvoiceStatus` ~:1224-1391)
- Create: `services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.status-cascade.spec.ts`

**Interfaces:**
- Consumes: `PaymentGatewayClient.voidTransaction` (Task 1).
- Produces: same `updateInvoiceStatus` response shape (`toInvoiceDto(updatedInvoice)`);
  adds a `BadRequestException` path when the gateway reports `danger_settled`.

### Step 4.1 — failing test

```ts
// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.status-cascade.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';

const MOCK_ADMIN: CurrentUserData = { userId: 'admin-1', email: 'a@test.com', brandId: 'b1', role: [], adminId: 'admin-id-1' };

describe('PaymentAdminController.updateInvoiceStatus — Go cascade parity', () => {
    let controller: PaymentAdminController;
    let mockGatewayClient: { voidTransaction: jest.Mock };
    let mockPrisma: {
        applicationInvoice: { findUnique: jest.Mock };
        $transaction: jest.Mock;
    };

    const invoiceRow = {
        id: '11111111-1111-1111-1111-111111111111',
        status: 'processing',
        externalTransactionId: 'txn-1',
        externalIntentId: 'intent-1',
        pricingTier: { feeType: 'registration_fee' },
        application: { id: 'app-1', participant: { userId: 'user-1' } },
    };

    beforeEach(async () => {
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
        mockPrisma = {
            applicationInvoice: { findUnique: jest.fn().mockResolvedValue(invoiceRow) },
            $transaction: jest.fn().mockResolvedValue([{ ...invoiceRow, status: 'cancelled' }, {}]),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: { get: jest.fn(), post: jest.fn() } },
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: { invalidateInvoiceCache: jest.fn() } },
                { provide: PrismaService, useValue: mockPrisma },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
            ],
        }).compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
    });

    it('voids the Go transaction when an admin sets status=cancelled', async () => {
        await controller.updateInvoiceStatus(
            invoiceRow.id,
            { status: 'cancelled' as any, reason: 'duplicate application' },
            MOCK_ADMIN,
        );

        expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', invoiceRow.id, expect.any(String));
    });

    it('refuses the status change when the gateway reports danger_settled', async () => {
        mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });

        await expect(
            controller.updateInvoiceStatus(invoiceRow.id, { status: 'cancelled' as any, reason: 'duplicate' }, MOCK_ADMIN),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
});
```

Run and confirm it fails (no cascade call happens for `cancelled` today):

```bash
cd services/api && npm run test -- payment-admin.controller.status-cascade.spec.ts
```

### Step 4.2 — minimal implementation

Add `PaymentGatewayClient` to the constructor (~:56):

```ts
    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly paymentGatewayClient: PaymentGatewayClient,
        private readonly configService: ConfigService,
        private readonly fileService: FileServiceClient,
        private readonly cacheService: CacheService,
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) {
```

(add the matching import: `import { PaymentGatewayClient } from '../infrastructure/services/payment-gateway.client';`)

In `updateInvoiceStatus`, insert a cascade-void guard right after the existing
`manualOverride` block and before the `$transaction` write (~:1308, right before
`const trimmedReason = ...`):

```ts
        const isTerminalNonPaid =
            body.status === PaymentStatus.cancelled
            || body.status === PaymentStatus.failed
            || body.status === PaymentStatus.refunded;

        if (isTerminalNonPaid && invoice.externalTransactionId) {
            const voidResult = await this.paymentGatewayClient.voidTransaction(
                invoice.externalTransactionId,
                invoice.id,
                body.reason?.trim() || `Invoice marked ${body.status} by admin`,
            );
            if (voidResult.outcome === 'danger_settled') {
                throw new BadRequestException(
                    `Cannot mark this invoice ${body.status}: the linked transaction has already succeeded at the gateway (${voidResult.detail}).`,
                );
            }
        }

        const trimmedReason = body.reason?.trim() ?? '';
```

Leave the existing `paid`/`failed` `/verify` sync block (~:1375-1388) as-is for
`failed` (that endpoint performs Go's manual-review-reject flow, which is a distinct
"was reviewed" transition, not a cascade cancel) — the new cascade-void guard above
is additive and runs for `cancelled`/`failed`/`refunded` before that block, so
`failed` now gets both the void-check AND the existing `/verify` sync. That's
correct: a `failed` invoice's transaction should also end up terminal, and voiding
first is safe (idempotent no-op if `/verify` already settled it terminal).

Run again, expect PASS:

```bash
cd services/api && npm run test -- payment-admin.controller.status-cascade.spec.ts
```

Then run the full admin-controller suite to catch any other spec instantiating
`PaymentAdminController` without the new provider:

```bash
cd services/api && npm run test -- src/modules/payments/presentation/__tests__/payment-admin.controller
```

Add `{ provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) } }`
to any spec that now fails with a missing-dependency error (expected candidates:
`payment-admin.controller.brand.spec.ts`, `payment-admin.controller.category-filter.spec.ts`).

### Step 4.3 — commit

```bash
git add services/api/src/modules/payments/presentation/payment-admin.controller.ts \
        services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.status-cascade.spec.ts \
        services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.brand.spec.ts \
        services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.category-filter.spec.ts
git commit -m "fix: void linked Go transaction when admin sets invoice to cancelled/refunded/failed"
```

(Only add the brand/category-filter spec files to the commit if Step 4.2 actually
required editing them.)

---

## Task 5 — Component 2: reconciliation widening (terminal-invoice drift scan)

The load-bearing, producer-agnostic safety net: extend
`PaymentReconciliationService` with a second scan class — terminal invoices
(`cancelled`, `failed`, `refunded`) whose linked Go transaction is still live
(`PENDING`/`NEEDS_REVIEW`). Runs on the existing hourly cron alongside the current
`{processing, unpaid}` scan; re-checks gateway state at execution time (never trusts
a stale snapshot).

**Files:**
- Modify: `services/api/src/modules/payments/infrastructure/services/payment-reconciliation.service.ts`
  (constructor ~:79-86, `runScheduledReconciliation` ~:96-116, new method + query)
- Modify: `services/api/src/modules/payments/infrastructure/services/payment-reconciliation.service.spec.ts`
  (new `describe` block — do not touch existing test cases)

**Interfaces:**
- Consumes: `PaymentGatewayClient.voidTransaction` (Task 1), plus existing
  `PaymentServiceHttpClient` for the gateway status fetch (reuses the existing
  private `fetchPaymentPayload` and `isPayloadSettled`/`isPayloadAbandoned` — but for
  the *terminal-invoice* scan the relevant check is simpler: is the linked txn/intent
  still non-terminal at the gateway, or has it settled/gone terminal there too).
- Produces:
  ```ts
  export interface TerminalDriftReport {
      scanned: number;
      voided: number;
      dangerSettled: number;
      skipped: number;
      errors: number;
      details: Array<{ invoiceId: string; outcome: 'voided' | 'already_terminal' | 'danger_settled' | 'skipped' | 'error'; reason: string }>;
  }
  async reconcileTerminalInvoiceDrift(apply: boolean): Promise<TerminalDriftReport>;
  ```

### Step 5.1 — failing test: terminal invoice + live PENDING transaction gets voided

Add to `payment-reconciliation.service.spec.ts` (new `describe` block at the bottom,
before the closing of the outer `describe('PaymentReconciliationService', ...)`).
First, extend the existing mock setup at the top of the file to add
`PaymentGatewayClient` to the providers list in `beforeEach` (~:76-84):

```ts
import { PaymentGatewayClient } from './payment-gateway.client';
// ...
    let mockGatewayClient: { voidTransaction: jest.Mock };
// ... inside beforeEach, before Test.createTestingModule:
        mockGatewayClient = { voidTransaction: jest.fn().mockResolvedValue({ outcome: 'voided', detail: 'ok' }) };
// ... inside providers array:
                { provide: PaymentGatewayClient, useValue: mockGatewayClient },
```

Then append:

```ts
    // ── Component 2: terminal-invoice drift scan ──────────────────────────────

    describe('reconcileTerminalInvoiceDrift', () => {
        const terminalInvoice = (overrides: Record<string, unknown> = {}) => ({
            id: 'inv-cancelled-1',
            applicationId: 'app-1',
            status: 'cancelled',
            externalTransactionId: 'txn-1',
            externalIntentId: 'intent-1',
            ...overrides,
        });

        it('voids a cancelled invoice whose transaction is still PENDING at the gateway', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('voided');
            expect(mockGatewayClient.voidTransaction).toHaveBeenCalledWith('txn-1', 'inv-cancelled-1', expect.any(String));
        });

        it('never voids and flags danger when the gateway reports SUCCESS', async () => {
            mockGatewayClient.voidTransaction.mockResolvedValue({ outcome: 'danger_settled', detail: 'SUCCESS at gateway' });
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('danger_settled');
            expect(report.dangerSettled).toBe(1);
        });

        it('skips invoices with no linked external reference', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([
                terminalInvoice({ externalTransactionId: null, externalIntentId: null }),
            ]);

            const report = await service.reconcileTerminalInvoiceDrift(true);

            expect(report.details[0].outcome).toBe('skipped');
            expect(mockGatewayClient.voidTransaction).not.toHaveBeenCalled();
        });

        it('dry run (apply=false) never calls voidTransaction', async () => {
            mockPrisma.applicationInvoice.findMany.mockResolvedValue([terminalInvoice()]);
            mockPaymentClient.get.mockResolvedValue({ data: { status: 'PENDING' } });

            await service.reconcileTerminalInvoiceDrift(false);

            expect(mockGatewayClient.voidTransaction).not.toHaveBeenCalled();
        });
    });
```

Run and confirm it fails (`reconcileTerminalInvoiceDrift` doesn't exist yet):

```bash
cd services/api && npm run test -- payment-reconciliation.service.spec.ts
```

### Step 5.2 — minimal implementation

Edit `payment-reconciliation.service.ts`. Add the import and constructor param:

```ts
import { PaymentGatewayClient } from './payment-gateway.client';

// ...
    constructor(
        private readonly paymentServiceClient: PaymentServiceHttpClient,
        private readonly paymentGatewayClient: PaymentGatewayClient,
        private readonly configService: ConfigService,
        private readonly prisma: PrismaService,
        private readonly rabbitmqProducer: RabbitMQProducerService,
    ) {
        this.paymentServiceInternalKey = this.configService.get<string>('PAYMENT_SERVICE_INTERNAL_KEY', '');
    }
```

Add the new outcome type + report interface near the top (below `ReconcileOutcome`,
~:15):

```ts
export interface TerminalDriftDetail {
    invoiceId: string;
    outcome: 'voided' | 'already_terminal' | 'danger_settled' | 'skipped' | 'error';
    reason: string;
}

export interface TerminalDriftReport {
    scanned: number;
    voided: number;
    dangerSettled: number;
    skipped: number;
    errors: number;
    details: TerminalDriftDetail[];
}
```

Wire the new scan into the hourly cron (~:96-116), running after the existing scan
so a single cron failure in one doesn't block the other:

```ts
    @Cron('0 * * * *')
    async runScheduledReconciliation(): Promise<void> {
        if (!this.enabled) {
            return;
        }

        try {
            const report = await this.reconcileProcessingInvoices({
                apply: true,
                graceMinutes: this.cronGraceMinutes,
            });
            this.logger.log(
                `[payment-reconciliation] scanned=${report.scanned} settledPaid=${report.settledPaid} ` +
                `revertedUnpaid=${report.revertedUnpaid} skipped=${report.skipped} errors=${report.errors}`,
            );
        } catch (error) {
            this.logger.error(
                `[payment-reconciliation] scheduled run failed: ${toErrorMessage(error)}`,
            );
        }

        try {
            const driftReport = await this.reconcileTerminalInvoiceDrift(true);
            this.logger.log(
                `[payment-reconciliation] terminal-drift scanned=${driftReport.scanned} ` +
                `voided=${driftReport.voided} dangerSettled=${driftReport.dangerSettled} ` +
                `skipped=${driftReport.skipped} errors=${driftReport.errors}`,
            );
            if (driftReport.dangerSettled > 0) {
                this.logger.error(
                    `[payment-reconciliation] DANGER: ${driftReport.dangerSettled} cancelled/failed/refunded ` +
                    `invoice(s) have a SUCCESS transaction at the gateway — needs human refund/un-cancel review`,
                );
            }
        } catch (error) {
            this.logger.error(
                `[payment-reconciliation] terminal-drift run failed: ${toErrorMessage(error)}`,
            );
        }
    }
```

Add the new public method + its private query/per-invoice helper (place after
`reconcileApplicationRegistration`, ~:232):

```ts
    /**
     * Component 2 — producer-agnostic safety net. Scans TERMINAL invoices
     * (cancelled/failed/refunded) whose linked Go transaction is still live
     * (PENDING/NEEDS_REVIEW), re-checks the gateway at execution time, and voids
     * genuinely-unpaid ones via the shared PaymentGatewayClient. Never trusts a
     * cached invoice/transaction status — this is what heals drift regardless of
     * what produced it (including the still-unidentified payment.cancelled
     * producer described in the design doc).
     */
    async reconcileTerminalInvoiceDrift(apply: boolean): Promise<TerminalDriftReport> {
        const report: TerminalDriftReport = {
            scanned: 0,
            voided: 0,
            dangerSettled: 0,
            skipped: 0,
            errors: 0,
            details: [],
        };

        const invoices = await this.prisma.applicationInvoice.findMany({
            where: {
                status: { in: [PaymentStatus.cancelled, PaymentStatus.failed, PaymentStatus.refunded] },
                OR: [
                    { externalIntentId: { not: null } },
                    { externalTransactionId: { not: null } },
                ],
            },
            select: {
                id: true,
                applicationId: true,
                externalIntentId: true,
                externalTransactionId: true,
            },
            take: this.batchSize,
        });

        report.scanned = invoices.length;

        for (const invoice of invoices) {
            try {
                const detail = await this.reconcileTerminalDriftOne(invoice, apply);
                report.details.push(detail);
                if (detail.outcome === 'voided') report.voided += 1;
                else if (detail.outcome === 'danger_settled') report.dangerSettled += 1;
                else if (detail.outcome === 'error') report.errors += 1;
                else report.skipped += 1;
            } catch (error) {
                report.errors += 1;
                const reason = toErrorMessage(error);
                report.details.push({ invoiceId: invoice.id, outcome: 'error', reason });
                this.logger.error(`[payment-reconciliation] terminal-drift invoice=${invoice.id} failed: ${reason}`);
            }
        }

        return report;
    }

    private async reconcileTerminalDriftOne(
        invoice: { id: string; externalTransactionId: string | null; externalIntentId: string | null },
        apply: boolean,
    ): Promise<TerminalDriftDetail> {
        const transactionId = invoice.externalTransactionId?.trim() || null;
        if (!transactionId) {
            return { invoiceId: invoice.id, outcome: 'skipped', reason: 'no linked transaction id' };
        }

        if (!apply) {
            // Dry run: still fetch+classify so a report can be produced, but never call
            // the void path.
            const payload = await this.fetchPaymentPayload(transactionId);
            if (payload === null) {
                return { invoiceId: invoice.id, outcome: 'skipped', reason: 'gateway fetch failed' };
            }
            if (this.isPayloadSettled(payload)) {
                return { invoiceId: invoice.id, outcome: 'danger_settled', reason: 'gateway settled (dry run)' };
            }
            return { invoiceId: invoice.id, outcome: 'skipped', reason: 'would void (dry run)' };
        }

        const result = await this.paymentGatewayClient.voidTransaction(
            transactionId,
            invoice.id,
            'Reconciliation: terminal invoice with live gateway transaction',
        );

        if (result.outcome === 'danger_settled') {
            this.logger.error(
                `[payment-reconciliation] DANGER invoice=${invoice.id} txn=${transactionId} is settled at gateway ` +
                `while invoice is terminal — needs human refund/un-cancel review`,
            );
            return { invoiceId: invoice.id, outcome: 'danger_settled', reason: result.detail };
        }

        return {
            invoiceId: invoice.id,
            outcome: result.outcome === 'voided' ? 'voided' : result.outcome === 'error' ? 'error' : 'already_terminal',
            reason: result.detail,
        };
    }
```

Run again, expect PASS:

```bash
cd services/api && npm run test -- payment-reconciliation.service.spec.ts
```

Then run the whole payments module suite:

```bash
cd services/api && npm run test -- src/modules/payments
```

### Step 5.3 — commit

```bash
git add services/api/src/modules/payments/infrastructure/services/payment-reconciliation.service.ts \
        services/api/src/modules/payments/infrastructure/services/payment-reconciliation.service.spec.ts
git commit -m "feat: widen reconciliation to self-heal terminal invoices with live Go transactions"
```

---

## Task 6 — Component 5: UI defensive fallback (admin payment-detail page)

**Bug location confirmed:** the "Latest Payment Transaction" card header
(`services/admin-dashboard/app/programs/[programId]/payments/[paymentId]/page.tsx:403-407`)
and the "Quick Info" sidebar's "Txn Status" row (same file, `:835-840`) both render
`<StatusPill status={txnStatus} />` unconditionally from the live Go transaction
status, with no regard for `invoice.status`. This is the exact "Pending under
Cancelled" bug. Fix: when `invoice.status` is terminal in the UI sense
(`cancelled`/`failed`/`refunded`), both badges must defer to `invoice.status`.

**Note on test tooling:** `services/admin-dashboard` has no Jest/Vitest/RTL
installed (`package.json` has no test script). The one existing precedent,
`services/admin-dashboard/lib/datetime.test.ts`, is a standalone script run
directly via Node's native TypeScript support (`node lib/datetime.test.ts`) using
`node:assert/strict`. Follow that exact convention — do not introduce a new test
runner as part of a bug-fix milestone.

**Files:**
- Create: `services/admin-dashboard/lib/payment-attempt-status.ts`
- Create: `services/admin-dashboard/lib/payment-attempt-status.test.ts`
- Modify: `services/admin-dashboard/app/programs/[programId]/payments/[paymentId]/page.tsx`
  (lines ~397-441 and ~835-840)

**Interfaces:**
- Produces:
  ```ts
  export type UiTerminalInvoiceStatus = "cancelled" | "failed" | "refunded";
  export function resolveAttemptDisplayStatus(
      invoiceStatus: string,
      txnStatus: string | undefined,
  ): string | undefined;
  ```
  Returns `invoiceStatus` when `invoiceStatus` is one of the UI-terminal set;
  otherwise returns `txnStatus` unchanged (preserves current behavior for
  `unpaid`/`processing`/`paid` invoices).

### Step 6.1 — failing test

```ts
// services/admin-dashboard/lib/payment-attempt-status.test.ts
/**
 * Standalone test for the payment-attempt status fallback helper.
 * The admin dashboard has no test framework; run directly with Node's native
 * TypeScript support:  node lib/payment-attempt-status.test.ts
 */
import assert from "node:assert/strict";
import { resolveAttemptDisplayStatus } from "./payment-attempt-status.ts";

let passed = 0;
function t(name: string, fn: () => void) {
  fn();
  passed++;
  console.log("  ✓", name);
}

t("cancelled invoice overrides a live PENDING txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("cancelled", "PENDING"), "cancelled");
});

t("failed invoice overrides a live NEEDS_REVIEW txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("failed", "NEEDS_REVIEW"), "failed");
});

t("refunded invoice overrides a live SUCCESS txn status", () => {
  assert.equal(resolveAttemptDisplayStatus("refunded", "SUCCESS"), "refunded");
});

t("processing invoice shows the real txn status unchanged", () => {
  assert.equal(resolveAttemptDisplayStatus("processing", "PENDING"), "PENDING");
});

t("paid invoice shows the real txn status unchanged", () => {
  assert.equal(resolveAttemptDisplayStatus("paid", "SUCCESS"), "SUCCESS");
});

t("undefined txn status with a non-terminal invoice stays undefined", () => {
  assert.equal(resolveAttemptDisplayStatus("unpaid", undefined), undefined);
});

console.log(`\n${passed} passed`);
```

Run and confirm it fails (module doesn't exist):

```bash
cd services/admin-dashboard && node lib/payment-attempt-status.test.ts
```

Expect a module-not-found error.

### Step 6.2 — minimal implementation

```ts
// services/admin-dashboard/lib/payment-attempt-status.ts

/**
 * Invoice statuses that must never show a stale "live" gateway attempt status
 * underneath them. Mirrors ApplicationInvoice's terminal set minus `paid` (a paid
 * invoice showing its settling transaction's real status is not contradictory).
 */
const UI_TERMINAL_INVOICE_STATUSES = new Set(["cancelled", "failed", "refunded"]);

/**
 * Component 5 — UI defensive fallback. When the invoice is terminal in a way that
 * implies the attempt must also be terminal (cancelled/failed/refunded), the
 * attempt/transaction badge defers to the invoice status instead of a live gateway
 * status that may not have settled yet (or ever, absent Components 1-2). This
 * guarantees "Pending" can never render under "Cancelled", even during a transient
 * race before the backend cascade void completes.
 */
export function resolveAttemptDisplayStatus(
  invoiceStatus: string,
  txnStatus: string | undefined,
): string | undefined {
  if (UI_TERMINAL_INVOICE_STATUSES.has(invoiceStatus)) {
    return invoiceStatus;
  }
  return txnStatus;
}
```

Run again, expect PASS:

```bash
cd services/admin-dashboard && node lib/payment-attempt-status.test.ts
```

### Step 6.3 — wire the helper into both badge locations

Edit `page.tsx`. Add the import near the other local imports (~:22):

```tsx
import { resolveAttemptDisplayStatus } from "@/lib/payment-attempt-status";
```

Add a derived value next to the existing `txnStatus` const (~:139):

```tsx
  const txnStatus = txn?.status as string | undefined;
  const displayAttemptStatus = invoice ? resolveAttemptDisplayStatus(invoice.status, txnStatus) : txnStatus;
```

Fix the "Latest Payment Transaction" header (~:403-407):

```tsx
                      {displayAttemptStatus && (
                        <span className="ml-auto">
                          <StatusPill status={displayAttemptStatus} />
                        </span>
                      )}
```

Fix the "Quick Info" → "Txn Status" row (~:835-840):

```tsx
                {displayAttemptStatus && (
                  <div className="flex justify-between">
                    <span className="text-zinc-500">Txn Status</span>
                    <StatusPill status={displayAttemptStatus} />
                  </div>
                )}
```

### Step 6.4 — verify the page still builds

```bash
cd services/admin-dashboard && npm run build
```

Expect the Next.js production build to succeed with no new TypeScript errors on
this route.

### Step 6.5 — commit

```bash
git add services/admin-dashboard/lib/payment-attempt-status.ts \
        services/admin-dashboard/lib/payment-attempt-status.test.ts \
        "services/admin-dashboard/app/programs/[programId]/payments/[paymentId]/page.tsx"
git commit -m "fix: attempt-status badges defer to invoice status when invoice is terminal"
```

---

## Task 7 — Component 4: backfill script for the 262 live orphans (dry-run first)

One-off remediation script, following the repo's existing standalone-script
convention (`services/api/src/scripts/backfill-landing-snapshots.ts`): its own
`PrismaClient` with the `pg` adapter (no NestJS DI), `dotenv`, a `--apply` flag
gating any write (default is dry-run), and a JSON report. The classification logic
is written as small pure/testable functions colocated with the script so it can be
unit-tested under Jest (the script's `rootDir` is `src`, which the main
`services/api` jest config already covers), while the script's `main()` (DB/HTTP
side effects) is exercised manually via dry-run against a real environment, not
mocked in CI.

**Files:**
- Create: `services/api/src/scripts/backfill-orphaned-cancellations.ts`
- Create: `services/api/src/scripts/backfill-orphaned-cancellations.spec.ts`
- Modify: `services/api/package.json` (new npm script)

**Interfaces:**
- Consumes: raw `fetch` against `PAYMENT_SERVICE_URL` (same contract as
  `PaymentGatewayClient`: `GET /api/v1/payments/:transactionId`,
  `POST /api/v1/payments/:transactionId/cancel`) — a standalone script has no Nest DI
  container, so it cannot inject `PaymentGatewayClient`; it reimplements the same
  classification via the exported pure helpers from
  `gateway-transaction-status.util.ts` (Task 1) to stay consistent with the shared
  rule, not duplicate it.
- Produces:
  ```ts
  export interface OrphanCandidate {
      invoiceId: string;
      applicationId: string;
      transactionId: string;
      invoiceStatus: string;
  }
  export type OrphanClassification = 'void' | 'skip_already_terminal' | 'danger_settled' | 'skip_no_reference';
  export function classifyOrphan(gatewayStatus: string | null): OrphanClassification;
  ```

### Step 7.1 — failing test: classification is a pure function

```ts
// services/api/src/scripts/backfill-orphaned-cancellations.spec.ts
import { classifyOrphan } from './backfill-orphaned-cancellations';

describe('classifyOrphan', () => {
    it('classifies a live PENDING transaction as void', () => {
        expect(classifyOrphan('PENDING')).toBe('void');
    });

    it('classifies a live NEEDS_REVIEW transaction as void', () => {
        expect(classifyOrphan('NEEDS_REVIEW')).toBe('void');
    });

    it('classifies an already-VOID transaction as skip_already_terminal', () => {
        expect(classifyOrphan('VOID')).toBe('skip_already_terminal');
    });

    it('classifies a FAILED transaction as skip_already_terminal', () => {
        expect(classifyOrphan('FAILED')).toBe('skip_already_terminal');
    });

    it('classifies a SUCCESS transaction as danger_settled — the 1 danger case', () => {
        expect(classifyOrphan('SUCCESS')).toBe('danger_settled');
    });

    it('classifies an unfetchable/null status as skip_no_reference', () => {
        expect(classifyOrphan(null)).toBe('skip_no_reference');
    });
});
```

Run and confirm it fails:

```bash
cd services/api && npm run test -- backfill-orphaned-cancellations.spec.ts
```

### Step 7.2 — minimal implementation (classification + script skeleton)

```ts
// services/api/src/scripts/backfill-orphaned-cancellations.ts
/**
 * One-off remediation for the 262 live-orphan cancelled invoices identified in the
 * 2026-07-01 prod audit: a cancelled invoice whose linked Go transaction is still
 * PENDING/NEEDS_REVIEW (never settled, never voided). Re-queries live gateway state
 * at execution time (does NOT trust the audit snapshot, which is known to be
 * growing). Excludes and reports the 1 danger case (SUCCESS at gateway) for manual
 * refund/un-cancel review.
 *
 * DRY RUN BY DEFAULT. Prints a full action list (void N / skip M / danger K) and
 * writes nothing until re-run with --apply.
 *
 * Run (dry run, from services/api):
 *   DATABASE_URL=... PAYMENT_SERVICE_URL=... PAYMENT_SERVICE_INTERNAL_KEY=... \
 *     npx ts-node -r tsconfig-paths/register src/scripts/backfill-orphaned-cancellations.ts
 *
 * Run (apply, only after reviewing the dry-run report):
 *   ... --apply
 *
 * Prod execution follows the standard prod one-off-script pattern: compile
 * locally, ship the compiled JS into the API container, exec there against
 * ybb_platform_db / the payment service's internal URL. See the prod-access
 * reference before running this against prod.
 */
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { writeFileSync } from 'node:fs';
import * as dotenv from 'dotenv';
import { extractTopLevelStatus, isSettledStatus, isTerminalNonSettledStatus } from '../modules/payments/infrastructure/services/gateway-transaction-status.util';

dotenv.config();

export type OrphanClassification = 'void' | 'skip_already_terminal' | 'danger_settled' | 'skip_no_reference';

export interface OrphanCandidate {
    invoiceId: string;
    applicationId: string;
    transactionId: string;
    invoiceStatus: string;
}

export interface OrphanActionResult {
    invoiceId: string;
    transactionId: string;
    classification: OrphanClassification;
    detail: string;
}

/** Pure classification — no I/O. Kept separate from fetch/void so it's unit-testable. */
export function classifyOrphan(gatewayStatus: string | null): OrphanClassification {
    if (gatewayStatus === null) return 'skip_no_reference';
    if (isSettledStatus(gatewayStatus)) return 'danger_settled';
    if (isTerminalNonSettledStatus(gatewayStatus)) return 'skip_already_terminal';
    return 'void'; // PENDING / NEEDS_REVIEW / unknown-but-live
}

function createPrismaClient(): { prisma: PrismaClient; pool: Pool } {
    const connectionString =
        process.env.DATABASE_URL || 'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });
    return { prisma, pool };
}

function paymentServiceBaseUrl(): string {
    return (process.env.PAYMENT_SERVICE_URL || 'http://localhost:8002').replace(/\/+$/, '');
}

function internalHeaders(): Record<string, string> {
    const key = process.env.PAYMENT_SERVICE_INTERNAL_KEY || '';
    return key ? { 'X-Internal-Service-Key': key } : {};
}

async function fetchGatewayStatus(transactionId: string): Promise<string | null> {
    try {
        const response = await fetch(`${paymentServiceBaseUrl()}/api/v1/payments/${transactionId}`, {
            headers: internalHeaders(),
        });
        if (!response.ok) return null;
        const body = (await response.json()) as Record<string, unknown>;
        const record = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>;
        return extractTopLevelStatus(record) || null;
    } catch {
        return null;
    }
}

async function voidTransaction(transactionId: string, reason: string): Promise<void> {
    const response = await fetch(`${paymentServiceBaseUrl()}/api/v1/payments/${transactionId}/cancel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...internalHeaders() },
        body: JSON.stringify({ reason }),
    });
    if (!response.ok && response.status !== 400) {
        throw new Error(`cancel failed: HTTP ${response.status}`);
    }
}

async function findOrphanCandidates(prisma: PrismaClient): Promise<OrphanCandidate[]> {
    const rows = await prisma.applicationInvoice.findMany({
        where: {
            status: 'cancelled',
            externalTransactionId: { not: null },
        },
        select: { id: true, applicationId: true, externalTransactionId: true, status: true },
    });
    return rows
        .filter((row): row is typeof row & { externalTransactionId: string } => Boolean(row.externalTransactionId))
        .map((row) => ({
            invoiceId: row.id,
            applicationId: row.applicationId,
            transactionId: row.externalTransactionId,
            invoiceStatus: row.status,
        }));
}

async function main(): Promise<void> {
    const apply = process.argv.includes('--apply');
    const { prisma, pool } = createPrismaClient();
    const results: OrphanActionResult[] = [];

    try {
        const candidates = await findOrphanCandidates(prisma);
        console.log(`Found ${candidates.length} cancelled invoices with a linked transaction. Re-checking gateway state...`);

        for (const candidate of candidates) {
            const gatewayStatus = await fetchGatewayStatus(candidate.transactionId);
            const classification = classifyOrphan(gatewayStatus);

            if (classification === 'void' && apply) {
                await voidTransaction(candidate.transactionId, 'Backfill: orphaned cancelled invoice (2026-07-01 audit)');
                await prisma.applicationInvoice.update({
                    where: { id: candidate.invoiceId },
                    data: { lastReconciledAt: new Date() },
                });
            }

            results.push({
                invoiceId: candidate.invoiceId,
                transactionId: candidate.transactionId,
                classification,
                detail: gatewayStatus ?? 'unfetchable',
            });
        }

        const voided = results.filter((r) => r.classification === 'void').length;
        const skipped = results.filter((r) => r.classification === 'skip_already_terminal').length;
        const danger = results.filter((r) => r.classification === 'danger_settled').length;
        const noRef = results.filter((r) => r.classification === 'skip_no_reference').length;

        console.log(`\n${apply ? 'APPLIED' : 'DRY RUN'} — void=${voided} skip_already_terminal=${skipped} danger_settled=${danger} skip_no_reference=${noRef}`);
        if (danger > 0) {
            console.log('\nDANGER CASES (needs human refund/un-cancel review):');
            for (const r of results.filter((r) => r.classification === 'danger_settled')) {
                console.log(`  invoice=${r.invoiceId} txn=${r.transactionId} gatewayStatus=${r.detail}`);
            }
        }

        const reportPath = `backfill-orphaned-cancellations.${apply ? 'applied' : 'dry-run'}.${Date.now()}.json`;
        writeFileSync(reportPath, JSON.stringify(results, null, 2));
        console.log(`\nFull report written to ${reportPath}`);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}

if (require.main === module) {
    main().catch((error) => {
        console.error(error);
        process.exit(1);
    });
}
```

Run again, expect PASS (only the pure `classifyOrphan` export is exercised by the
spec — `main()` is not invoked under Jest since `require.main === module` is false
in that context):

```bash
cd services/api && npm run test -- backfill-orphaned-cancellations.spec.ts
```

### Step 7.3 — add the npm script

Edit `services/api/package.json`, add alongside the existing
`landing:snapshots:backfill` entry:

```json
    "backfill:orphaned-cancellations": "ts-node -r tsconfig-paths/register src/scripts/backfill-orphaned-cancellations.ts",
```

### Step 7.4 — dry-run locally against a non-prod DB, review, THEN apply

This step is manual verification, not an automated test — do not run `--apply`
against prod without a human reviewing the dry-run report first:

```bash
cd services/api
DATABASE_URL="<local-or-staging-url>" PAYMENT_SERVICE_URL="<local-or-staging-payment-url>" \
  npm run backfill:orphaned-cancellations
```

Review the printed summary and the JSON report. Confirm `danger_settled` count and
IDs match the audit's "1 danger case" expectation before ever running `--apply`.
Running `--apply` against prod requires shipping the compiled script into the API
container per the existing prod one-off-script pattern — consult that reference
before executing, and only after sign-off on the dry-run report.

### Step 7.5 — commit

```bash
git add services/api/src/scripts/backfill-orphaned-cancellations.ts \
        services/api/src/scripts/backfill-orphaned-cancellations.spec.ts \
        services/api/package.json
git commit -m "feat: add dry-run-first backfill script for orphaned cancelled invoices"
```

---

## Task 8 — Component 3: gateway naming fix (display + stored)

**Display:** `PaymentAdminController.extractPaymentMethodFromTransaction` /
`decoratePaymentTransaction` (`services/api/src/modules/payments/presentation/payment-admin.controller.ts:1576-1662`)
derive the shown payment method from `payment_method`/`payment_method_id`/etc — never
from `gateway_response.provider`, even though the Go payment service already returns
`gateway_response.provider` (e.g. `"xendit"`) on every transaction payload (confirmed
in `services/payment/internal/infrastructure/gateways/xendit_gateway.go:105`,
`stripe_gateway.go:57`, `paypal_gateway.go:72`, all setting
`"provider": "<name>"` into `ChargeResponse.Metadata`, which becomes
`tx.GatewayResponse` and is exposed as `gateway_response` in
`services/payment/internal/presentation/http/handlers/payment_handler.go:692`). Fix:
prefer `gateway_response.provider` over the legacy method-code-derived label.

**Stored:** `ResolveGatewayName` (`services/payment/internal/domain/services/gateway_resolver.go:10-32`)
already has correct precedence — explicit `method.GatewayName` wins over
code-prefix inference over the default. The `midtrans_cc` mislabeling is therefore a
**data problem**, not a code bug: the `midtrans_cc` payment method row's
`gateway_name` column is empty/wrong, so resolution falls through to
`inferGatewayNameFromCode` (`midtrans_cc` → `midtrans`) even when that method is
actually charged through Xendit. `UpdatePaymentMethodDto` already accepts
`gateway_name` (`services/api/src/modules/payments/presentation/dto/admin-payment-method.dto.ts:63`),
so no DTO/endpoint change is needed — only a one-time data correction via the
existing `PUT /admin/payments/methods/:id` endpoint, done AFTER the display fix lets
you observe the true `gateway_response.provider` on real transactions for that
method.

**Files:**
- Modify: `services/api/src/modules/payments/presentation/payment-admin.controller.ts`
  (`extractPaymentMethodFromTransaction` ~:1576, `decoratePaymentTransaction` ~:1650)
- Create: `services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.gateway-provider-display.spec.ts`
- Create: `services/payment/internal/domain/services/gateway_resolver_test.go` (regression
  coverage locking in the precedence Component 3's "stored" reasoning depends on —
  none exists today)

**Interfaces:**
- Produces: `decoratePaymentTransaction(transaction, catalog)` return shape gains no
  new field — `payment_method_label` now reflects the real provider when
  `gateway_response.provider` is present, instead of the legacy code-derived label.

### Step 8.1 — failing test: display prefers `gateway_response.provider`

Since `extractPaymentMethodFromTransaction`/`decoratePaymentTransaction` are private
methods on `PaymentAdminController`, test them through the public `getInvoice`
endpoint (mirrors the existing pattern in `payment-admin.controller.brand.spec.ts`,
which also drives private-method behavior through a public endpoint):

```ts
// services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.gateway-provider-display.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PaymentAdminController } from '../payment-admin.controller';
import { PaymentServiceHttpClient } from '../../infrastructure/services/payment-service-http.client';
import { PaymentGatewayClient } from '../../infrastructure/services/payment-gateway.client';
import { FileServiceClient } from '@modules/files/infrastructure/clients/file-service.client';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { RabbitMQProducerService } from '@shared/infrastructure/rabbitmq/rabbitmq-producer.service';

describe('PaymentAdminController.getInvoice — gateway_response.provider display', () => {
    let controller: PaymentAdminController;

    const invoiceRow = {
        id: '11111111-1111-1111-1111-111111111111',
        status: 'paid',
        paymentMethod: 'midtrans_cc',
        externalIntentId: null,
        externalTransactionId: 'txn-1',
        pricingTier: null,
        application: { participant: { user: {} } },
    };

    beforeEach(async () => {
        const mockPaymentClient = {
            get: jest.fn().mockResolvedValue({
                data: {
                    type: 'transaction',
                    id: 'txn-1',
                    status: 'SUCCESS',
                    payment_method_id: 'midtrans_cc',
                    gateway_response: { provider: 'xendit', token: 'xnd-token-1' },
                },
            }),
            post: jest.fn(),
        };

        const module: TestingModule = await Test.createTestingModule({
            controllers: [PaymentAdminController],
            providers: [
                { provide: PaymentServiceHttpClient, useValue: mockPaymentClient },
                { provide: PaymentGatewayClient, useValue: { voidTransaction: jest.fn() } },
                { provide: ConfigService, useValue: { get: jest.fn().mockReturnValue('') } },
                { provide: FileServiceClient, useValue: {} },
                { provide: CacheService, useValue: {} },
                { provide: PrismaService, useValue: { applicationInvoice: { findUnique: jest.fn().mockResolvedValue(invoiceRow) } } },
                { provide: RabbitMQProducerService, useValue: { emit: jest.fn() } },
            ],
        }).compile();

        controller = module.get<PaymentAdminController>(PaymentAdminController);
        jest.spyOn(controller as unknown as { getPaymentMethodCatalog: () => Promise<unknown[]> }, 'getPaymentMethodCatalog')
            .mockResolvedValue([]);
    });

    it('labels the transaction using gateway_response.provider (xendit), not the legacy midtrans_cc code', async () => {
        const result = await controller.getInvoice(invoiceRow.id);

        expect((result.transaction as Record<string, unknown>).payment_method_label).toBe('Xendit');
    });
});
```

Run and confirm it fails (today the label comes from `payment_method_id` =
`midtrans_cc` → `"Midtrans Cc"`, not `"Xendit"`):

```bash
cd services/api && npm run test -- payment-admin.controller.gateway-provider-display.spec.ts
```

### Step 8.2 — minimal implementation

Edit `decoratePaymentTransaction` (~:1650-1662) to check `gateway_response.provider`
first:

```ts
    private decoratePaymentTransaction(
        transaction: Record<string, unknown>,
        catalog: Array<{ value: string; label: string }>,
    ): Record<string, unknown> {
        const source = this.unwrapPayloadObject(transaction);
        const providerFromGatewayResponse = this.extractGatewayResponseProvider(source);
        const extractedMethod = providerFromGatewayResponse ?? this.extractPaymentMethodFromTransaction(source);
        const normalizedMethod = this.normalizePaymentMethod(extractedMethod, catalog);

        return {
            ...source,
            payment_method_label: normalizedMethod?.label ?? null,
        };
    }

    /**
     * The Go payment service stamps the real gateway into gateway_response.provider
     * at charge time (e.g. "xendit"), independent of the legacy payment_method_id
     * code (e.g. "midtrans_cc") a method was originally configured with. Preferring
     * this field over the method-code-derived label fixes the display half of the
     * gateway-naming drift without requiring the stored mapping to be corrected
     * first.
     */
    private extractGatewayResponseProvider(transaction: Record<string, unknown>): string | null {
        const gatewayResponse = transaction.gateway_response;
        if (!gatewayResponse || typeof gatewayResponse !== 'object' || Array.isArray(gatewayResponse)) {
            return null;
        }
        const provider = (gatewayResponse as Record<string, unknown>).provider;
        return typeof provider === 'string' && provider.trim() ? provider.trim() : null;
    }
```

Also update `getInvoice`'s method-resolution fallback (~:724-726 and ~:750-752) so it
benefits too — both call sites already flow through `extractPaymentMethodFromTransaction`
directly (not `decoratePaymentTransaction`), so give that method the same
precedence:

```ts
    private extractPaymentMethodFromTransaction(transaction: Record<string, unknown>): string | null {
        const source = this.unwrapPayloadObject(transaction);
        const providerFromGatewayResponse = this.extractGatewayResponseProvider(source);
        if (providerFromGatewayResponse) return providerFromGatewayResponse;
        return this.findPaymentMethodDeep(source, 0);
    }
```

Run again, expect PASS:

```bash
cd services/api && npm run test -- payment-admin.controller.gateway-provider-display.spec.ts
```

Then run the broader admin-controller suite to confirm no regression to the
existing method-normalization tests:

```bash
cd services/api && npm run test -- src/modules/payments/presentation/__tests__/payment-admin.controller
```

### Step 8.3 — commit the display fix

```bash
git add services/api/src/modules/payments/presentation/payment-admin.controller.ts \
        services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.gateway-provider-display.spec.ts
git commit -m "fix: prefer gateway_response.provider over legacy payment_method_id for display"
```

### Step 8.4 — failing Go test: lock in `ResolveGatewayName` precedence

No `gateway_resolver_test.go` exists yet. This regression test protects the
precedence the "stored" half of Component 3 depends on (explicit `GatewayName` must
always win, so once the data is corrected, resolution stays correct):

```go
// services/payment/internal/domain/services/gateway_resolver_test.go
package services_test

import (
	"testing"

	"github.com/stretchr/testify/require"
	"github.com/ybb-platform/payment/internal/domain/entities"
	"github.com/ybb-platform/payment/internal/domain/services"
)

func TestResolveGatewayName(t *testing.T) {
	tests := []struct {
		name            string
		method          *entities.PaymentMethodEntity
		defaultGateway  string
		expectedName    string
		expectErr       bool
	}{
		{
			name: "manual method always resolves to manual regardless of code/gateway_name",
			method: &entities.PaymentMethodEntity{
				Type:        entities.MethodTypeManual,
				Code:        "bank_bca",
				GatewayName: "xendit",
			},
			expectedName: "manual",
		},
		{
			name: "explicit GatewayName wins even when the code prefix suggests a different gateway",
			method: &entities.PaymentMethodEntity{
				Type:        entities.MethodTypeAutomatic,
				Code:        "midtrans_cc",
				GatewayName: "xendit",
			},
			expectedName: "xendit",
		},
		{
			name: "falls back to code-prefix inference when GatewayName is empty",
			method: &entities.PaymentMethodEntity{
				Type: entities.MethodTypeAutomatic,
				Code: "xendit_va",
			},
			expectedName: "xendit",
		},
		{
			name: "falls back to the configured default when neither GatewayName nor code prefix resolve",
			method: &entities.PaymentMethodEntity{
				Type: entities.MethodTypeAutomatic,
				Code: "custom_method",
			},
			defaultGateway: "xendit",
			expectedName:   "xendit",
		},
		{
			name: "errors when nothing resolves and there is no default",
			method: &entities.PaymentMethodEntity{
				Type: entities.MethodTypeAutomatic,
				Code: "custom_method",
			},
			expectErr: true,
		},
		{
			name:      "errors on a nil method",
			method:    nil,
			expectErr: true,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			name, err := services.ResolveGatewayName(tc.method, tc.defaultGateway)
			if tc.expectErr {
				require.Error(t, err)
				return
			}
			require.NoError(t, err)
			require.Equal(t, tc.expectedName, name)
		})
	}
}
```

Run and confirm the test FILE compiles and the cases pass/fail as expected before
touching `gateway_resolver.go` — since we are writing a regression test against
already-correct behavior (not a bug fix), this step's "RED" is verifying the test
would have failed had the precedence been wrong, not that today's code is broken.
Do this by temporarily asserting a wrong expectation, observing the failure, then
restoring the correct expectation:

```bash
cd services/payment && go test ./internal/domain/services/... -run TestResolveGatewayName -v
```

Expect PASS immediately (this is intentional — Step 8.4 documents/locks in existing
correct behavior rather than fixing a bug; there is no Go code change in this task).

### Step 8.5 — commit the regression test

```bash
git add services/payment/internal/domain/services/gateway_resolver_test.go
git commit -m "test: lock in ResolveGatewayName precedence (explicit gateway_name > code prefix > default)"
```

### Step 8.6 — manual data-correction step (no code change)

Per the "stored" half of Component 3: once Step 8.1-8.3 are deployed and you can
observe real `gateway_response.provider` values on the `midtrans_cc` method's live
transactions via the admin invoice-detail page, correct that payment method's
`gateway_name` column via the existing admin endpoint:

```
PUT /admin/payments/methods/:id
{ "gateway_name": "xendit" }
```

(`id` = the `midtrans_cc` payment method's ID; confirm via
`GET /admin/payments/methods` first.) This is a one-time ops action, not a code
change — record it in the deployment/ops log, not in this repo.

---

## Sequencing Recap (matches spec's Rollout section)

1. Task 1 (shared void method) — prerequisite for everything else.
2. Task 2 (Component 1a — `markInvoiceCancelled` cascade).
3. Task 3 (Component 1b — portal handler refactor onto shared path).
4. Task 4 (Component 1c — admin `updateInvoiceStatus` parity).
5. Task 5 (Component 2 — reconciliation widening, the load-bearing safety net).
6. Task 6 (Component 5 — UI defensive fallback, immediate cosmetic correctness).
7. Task 7 (Component 4 — backfill, dry-run → human review → apply).
8. Task 8 (Component 3 — naming fix, display code + stored data correction).

## Open Items Not Covered By This Plan (tracked in the design doc's Open Threads)

- Identifying the actual out-of-band producer of the 262 orphans / the unidentified
  `payment.cancelled` publisher. Operational/security follow-up, not implementable
  as a code task here.
- The audit-layer bypass (manual broker publishes leaving no `payment_events` /
  `data_change_logs` rows). Security/ops hardening item.
- The 1 danger case's actual refund/un-cancel resolution — a human decision made
  after Task 7's dry-run identifies its exact invoice ID; out of scope for
  engineering to auto-resolve.
