# Invoice ↔ Gateway-Transaction Status Sync — Design

- **Date:** 2026-07-01
- **Milestone:** Bug Fix & Security Hardening
- **Status:** Approved design, pending implementation plan
- **Author:** Investigation + design session (Opus orchestrator + Sonnet trace/audit subagents)

## Problem

The admin payment-detail page shows a top-level status badge of **Cancelled** while the
payment attempt inside the same page reads **Pending**. This is not one row with two
conflicting fields — it is **two services drifting apart**:

- **Invoice/order status** lives in the NestJS API (`ybb_platform_db`), model
  `ApplicationInvoice.status`, enum `PaymentStatus` = `unpaid | paid | processing | failed |
  refunded | cancelled` (`services/api/prisma/schema/applications.prisma`, `enums.prisma`).
- **Attempt/transaction status** lives in the **Go payment service**
  (`ybb_payments_db`, separate Postgres container). `PaymentIntent`
  (`REQUIRES_PAYMENT_METHOD | PROCESSING | SUCCEEDED | CANCELED`) is the "payment", and
  `PaymentTransaction` (`PENDING | NEEDS_REVIEW | SUCCESS | FAILED | VOID | REJECTED`) is the
  "attempt". Go is the **source of truth for gateway state**.

The two are independent state machines synced by RabbitMQ events and internal HTTP calls,
linked by `application_invoices.external_intent_id = payment_intents.id` and
`external_transaction_id = payment_transactions.id`. There is no shared FK, so they can drift.

The admin page stitches both services into one screen, which is why the drift looks like a
parent/child contradiction on a single object.

## Root Cause

When an invoice is moved to a terminal `cancelled` state, the outstanding Go transaction is
**not settled**. Specifically:

1. `markInvoiceCancelled` (`services/api/src/modules/payments/presentation/payment-events.controller.ts:752`,
   wired to `@EventPattern('payment.cancelled')` at `:101`) writes `ApplicationInvoice.status =
   cancelled` and patches the application, but **never calls the Go service to void the
   transaction**. Every other cancel path does void Go first:
   - Participant self-cancel: `services/api/src/modules/portal/application/commands/handlers/cancel-portal-payment.handler.ts`
   - Reconciler abandoned path: `payment-reconciliation.service.ts:462` via
     `cancelGatewayTransaction` (`:493`, POSTs `/api/v1/payments/:txnId/cancel`).
2. Reconciliation cannot self-heal it. The hourly cron
   (`payment-reconciliation.service.ts:96`) only scans invoices in `{processing, unpaid}`
   (`:149`), so a `cancelled` invoice is permanently out of scope.

Result: a `cancelled` invoice keeps a **live** `PENDING` gateway transaction that no code will
ever settle, unless a gateway webhook happens to arrive (in which case Go could flip it to
`SUCCESS` — collecting money on an already-cancelled invoice).

### Unresolved producer question (tracked, not blocking)

The trigger that fired `payment.cancelled` for the reported record could not be identified in
code. There is **no publisher of `payment.cancelled` anywhere in the workspace** — the Go
event constant (`payment/internal/domain/events/payment_event.go:15`) is defined but never
used; all real publish sites emit only succeeded/failed. Prod logs show no new broker
connection, no restart/replay, and no API self-publish around the cancel timestamp, pointing to
an **out-of-band manual publish** to the `payment-events` exchange (RabbitMQ Management UI or an
ad-hoc script).

However, the audit found **262 orphaned records spanning 90+ days**, which a handful of manual
injections cannot explain. So a routine producer of "cancel invoice without voiding Go" exists
and is not fully understood. **This is why the fix must be producer-agnostic** — patching
`markInvoiceCancelled` alone would leave the tail leaking. The reconciliation widening
(Component 2) is the load-bearing fix precisely because it heals the drift regardless of cause.

## Evidence (prod audit, read-only, 2026-07-01)

Invoice status distribution: `unpaid 706`, `cancelled 381`, `paid 118`, `processing 2`. Zero
`failed`, zero `refunded` in prod — the entire terminal-suspect set is `cancelled`.

Of the 381 cancelled invoices:

- **52** have no linked Go IDs (never reached the gateway) — nothing to sync.
- **329** are linked to Go. Of these:
  - **262 live orphans** — transaction `PENDING` (259) or `NEEDS_REVIEW` (3). **Safe to void:**
    `payment_events = 0` for all of them (no webhook of any kind ever fired → none settled at
    the gateway). Essentially all **Xendit**.
  - **66** are already `VOID` at the transaction level (participant self-cancels), but their
    intent is cosmetically stuck at `REQUIRES_PAYMENT_METHOD`. No money risk; backfill may tidy
    the intent to `CANCELED`.
  - **1 danger case** — a cancelled invoice whose transaction is `SUCCESS` / intent
    `SUCCEEDED`. **Money was collected on a cancelled invoice.** Excluded from the void set;
    requires a human refund/un-cancel decision.

The set is **live and growing** (cancelled ticked 380→381 during the audit), so remediation
must re-check `payment_events` at execution time, not trust this snapshot.

Reported record `6c836b64-f952-4282-9ec6-ffbb275d9212` (intent
`b687ac07-7a53-4d72-9af3-525fb522cead`, txn `ebeea1df-600d-40c3-95cf-1fe8ceea2139`) is confirmed
in the live-orphan set.

## Goals

- A terminal invoice never leaves a live (non-terminal) gateway transaction.
- Drift self-heals regardless of what produced the cancellation.
- Admin UI reflects the real gateway (not the legacy `midtrans_cc` label) and never shows a
  live attempt status under a terminal invoice.
- Existing 262 orphans are safely reconciled; the 1 danger case is surfaced for a human.

## Non-Goals

- Identifying/closing the manual-broker-injection path (operational/security follow-up, tracked
  in Open Threads).
- Refactoring the two-service architecture into a shared store.
- Handling the 1 danger case automatically (human decision).

## Design

### Component 1 — Cascade void at write-time

Make every invoice → terminal transition also settle the Go transaction.

- Extract the existing void logic (`cancelGatewayTransaction`,
  `payment-reconciliation.service.ts:493`) into a **shared, idempotent gateway-void method**
  (e.g. a `PaymentGatewayClient.voidTransaction(transactionId, invoiceId)`), so
  `markInvoiceCancelled`, the reconciler, and the portal cancel handler all call one path.
- In `markInvoiceCancelled` (`payment-events.controller.ts:752`), call the shared void for the
  invoice's `externalTransactionId` when present, before/after flipping the invoice to
  `cancelled`.
- Idempotency: the void must tolerate an already-terminal transaction (VOID/SUCCESS/FAILED) —
  no-op, do not error. If Go reports the transaction is `SUCCESS`, **do not cancel the
  invoice**; log and surface as a danger case (mirrors the audit's 1 record).
- Audit the other invoice→terminal writer, `PaymentAdminController.updateInvoiceStatus`
  (`payment-admin.controller.ts` ~:1224): today its Go-sync block only handles `paid`/`failed`
  via `/verify`, so an admin setting `cancelled`/`refunded` produces the same orphan bug. Route
  it through the shared void for parity. (The earlier `:375`/`:564` references were groupBy/count
  aggregations, not status writers — corrected during planning.)

### Component 2 — Reconciliation widening (load-bearing safety net)

Extend `payment-reconciliation.service.ts` beyond its `{processing, unpaid}` scope
(`:149`) with a new drift class:

- Scan **terminal invoices** (`cancelled`, and `failed`/`refunded` if they ever occur) whose
  linked Go transaction is **non-terminal** (`PENDING`/`NEEDS_REVIEW`) or whose intent is
  non-terminal.
- For each: **re-check the gateway / `payment_events` at execution time.** Only void if the
  transaction is genuinely unpaid/unsettled. If the gateway shows a settlement, skip and emit a
  danger alert (never void a paid transaction).
- Void via the shared method from Component 1. Optionally advance the intent to `CANCELED` so
  intent status reflects reality.
- This runs on the hourly cron and is producer-agnostic — it heals drift no matter what created
  it, which is the whole point given the unidentified producer.

### Component 3 — Gateway naming fix (stored + display)

The `midtrans_cc` label is decoupled from the actual gateway, which is resolved at charge time
in `services/payment/internal/domain/services/gateway_resolver.go:10` (`ResolveGatewayName`:
`method.GatewayName` wins, else infer from code prefix, else `DEFAULT_PAYMENT_GATEWAY`).

- **Display:** in the admin stitch layer, derive the shown provider/method from
  `gateway_response.provider` (the truth, e.g. `xendit`) rather than the legacy
  `payment_method_id` / `payment_method_label`.
- **Stored (going forward):** correct the method's `GatewayName` / the stored
  `payment_method_id` mapping so new records carry the real gateway, so display and storage
  agree without a derivation shim over time. Confirm the exact write path in the Go charge flow
  (`confirm_intent_handler.go`, `grpc/server.go`) during planning.

### Component 4 — Backfill (gateway-checked, dry-run first)

One-off remediation script (follows the prod-access run pattern: compile TS→JS locally, ship
into the container, exec):

- Re-query the live orphan set (do **not** trust the audit snapshot).
- For each orphan, confirm via gateway/`payment_events` that it is genuinely unpaid, then void
  the Go transaction (and tidy the intent to `CANCELED`). Skip and report anything that looks
  settled.
- Exclude and report the danger case(s) — cancelled invoice with a `SUCCESS`/`SUCCEEDED` Go side
  — for manual refund/un-cancel.
- **Dry-run mode first**: print the full action list (void N, skip M, danger K) for review
  before any write. Idempotent and re-runnable.

### Component 5 — UI defensive fallback

In the admin payment-detail view, when the invoice status is terminal
(`cancelled`/`failed`/`refunded`), the attempt card must **defer to the invoice status** rather
than render a stale live attempt status. This guarantees the "Pending under Cancelled" display
can never recur, even during a transient race before Components 1–2 settle the Go side.

## Data Model / Status Reference

| Layer | Field | Terminal values | Non-terminal (live) |
|-------|-------|-----------------|---------------------|
| Invoice (API) | `ApplicationInvoice.status` | `paid`, `cancelled`, `failed`, `refunded` | `unpaid`, `processing` |
| Intent (Go) | `PaymentIntent.status` | `SUCCEEDED`, `CANCELED` | `REQUIRES_PAYMENT_METHOD`, `PROCESSING` |
| Transaction (Go) | `PaymentTransaction.status` | `SUCCESS`, `FAILED`, `VOID`, `REJECTED` | `PENDING`, `NEEDS_REVIEW` |

Invariant this design enforces: **invoice terminal ⇒ its linked transaction must be terminal.**

## Error Handling & Idempotency

- All void calls no-op on already-terminal transactions and never throw on "already cancelled".
- Gateway/network failure during a cascade void must not block the invoice write, but must
  leave the record visible to the reconciler for retry (i.e. do not swallow silently; the
  reconciler is the backstop).
- Never void a transaction the gateway reports as settled — hard guard in Components 2 and 4.

## Testing

- **Unit:** shared void method idempotency (terminal → no-op, SUCCESS → danger, PENDING →
  void); reconciler drift-class selection (terminal invoice + live txn selected;
  terminal+terminal ignored; paid → skipped).
- **Integration:** cancelling an invoice voids the linked Go transaction end-to-end; a
  `payment.cancelled` event on an already-`SUCCESS` transaction does not cancel the invoice and
  raises a danger signal.
- **UI:** attempt card renders invoice status when invoice is terminal.
- **Backfill:** dry-run output matches the audit intersection; re-run is a no-op.

## Rollout / Sequencing

1. Component 1 + shared void method (stops new orphans from the known handler).
2. Component 2 reconciliation widening (catches the unidentified producer's tail).
3. Component 5 UI fallback (immediate cosmetic correctness).
4. Component 4 backfill dry-run → review → execute (clears the 262 + reports the 1 danger).
5. Component 3 naming (stored + display).

## Open Threads (tracked, not in this implementation)

- **Producer of the 262 orphans / manual `payment.cancelled` injection.** No code publisher
  exists; volume rules out pure manual injection. Needs a follow-up dig (broker access /
  credential surface, and whether a non-workspace service or DB-direct write sets `cancelled`).
- **Audit-layer bypass.** Manual broker publishes and the cancel path leave no
  `payment_events` / `data_change_logs` rows. Security/ops hardening item.
- **The 1 danger case** — cancelled invoice with `SUCCESS` gateway transaction. Human
  refund/un-cancel decision required; ID to be provided from the live re-query.

## Risks

- Voiding a transaction the gateway actually settled would lose money — mitigated by the hard
  "never void settled" guard and the `payment_events`-at-execution-time re-check.
- The reconciler widening increases its per-run work; scope the query by the same linkage/index
  (`external_intent_id`, `external_transaction_id` are indexed) and batch.
