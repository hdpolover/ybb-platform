# Go CancelPayment: void locally when gateway checkout is expired — Design

- **Date:** 2026-07-02
- **Status:** Draft, pending approval
- **Follow-up to:** invoice↔transaction status-sync (PR #73). This is item "B" — the Go-side robustness fix.

## Problem

`CancelPayment` in `services/payment/internal/presentation/http/handlers/payment_handler.go` (~:530-541) requires the upstream gateway cancel to succeed before it marks the local transaction `VOID`:

```go
gatewayName, gatewayOrderID := resolveGatewayCancelTarget(tx)
if gatewayName != "" && gatewayOrderID != "" {
    gateway, gwErr := h.gatewayFactory.GetGateway(gatewayName)
    if gwErr != nil { c.JSON(502, ...); return }
    if cancelErr := gateway.CancelPayment(ctx, gatewayOrderID); cancelErr != nil {
        c.JSON(http.StatusBadGateway, ...)  // 502 — returns here, never marks VOID
        return
    }
}
tx.Status = VOID   // only reached if the gateway cooperated
```

For Xendit, `CancelPayment` calls the **expire-invoice** endpoint (`xendit_gateway.go:182` → `InvoiceApi.ExpireInvoice`). When the checkout has already **expired** (Xendit invoices expire ~24h after creation), Xendit rejects the expire call, so Go returns **502 and leaves the transaction `PENDING` forever**.

Impact (observed 2026-07-01): the reconciler and backfill could not drain orphaned cancelled invoices whose Xendit checkout had expired — 251 of 262 hit this 502. They were cleared by a one-off DB remediation, but the underlying endpoint is still wrong: any future expired-checkout cancel 502s and the reconciler will 502-loop on it.

This is low-urgency because the cascade-void from PR #73 fires while the checkout is still live (Xendit cancel succeeds then), so new expired orphans should not accumulate. But the endpoint should be correct so reconciliation is self-sufficient.

## Root cause

The cancel endpoint conflates two different failures: "the gateway checkout is gone/expired (nothing to cancel — the desired end state is already true)" vs "the gateway call failed transiently (checkout may still be live and payable)". It treats both as a hard 502 and never reconciles local state.

## Design

Use the gateway's **actual invoice status** as the discriminator. The `PaymentGateway` interface already exposes `VerifyPayment(ctx, gatewayOrderID) (*entities.Payment, error)` (`internal/domain/gateways/payment_gateway.go:70`). For Xendit it calls `GetInvoiceById` and maps status via `mapXenditInvoiceStatus` (`xendit_gateway.go`): `PAID/SETTLED → Success`, `EXPIRED → Failed`, else `Pending`. Midtrans implements `VerifyPayment` equivalently. No interface or SDK changes are needed.

**New behavior:** when `gateway.CancelPayment` returns an error, do NOT immediately 502. Instead call `gateway.VerifyPayment(ctx, gatewayOrderID)` and branch on the real gateway status:

| VerifyPayment result | Meaning | Action | HTTP |
|---|---|---|---|
| `Failed` (Xendit `EXPIRED`) or not-found | Checkout is gone/expired — the "cancel" end state is already true | Mark transaction `VOID` locally, intent `CANCELED` (the existing success path) | **200** |
| `Success` (`PAID`/`SETTLED`) | Checkout was actually **paid** (local `PENDING` was stale — lost webhook) | Do NOT void. **Reconcile local → `SUCCESS`** (intent `SUCCEEDED`) so the true state surfaces, and return a settled/conflict error so the caller does not cancel the invoice | **409** |
| `Pending` (still live) | Genuine transient cancel failure; checkout may still be payable | Leave `PENDING`, return the existing gateway error | **502** (unchanged) |
| `VerifyPayment` itself errors (network, or not-implemented) | Uncertain | Conservative: leave `PENDING`, return 502 | **502** (unchanged) |

Key properties:
- **Only triggers on cancel failure** — the happy path (live checkout, cancel succeeds) is unchanged, no extra gateway call.
- **Safe for all adapters.** Stripe/PayPal `CancelPayment` are no-ops (`return nil`) so they never enter this branch; manual gateway cancel always succeeds. Only Xendit and Midtrans — both of which implement `VerifyPayment` — reach it. If a gateway without `VerifyPayment` ever did, its `VerifyPayment` error routes to the conservative 502.
- **The `PAID` branch is a safety bonus:** it catches the exact "hidden danger" case (local stale `PENDING`, gateway actually paid) and reconciles it to `SUCCESS` instead of ever voiding a paid transaction — reinforcing the same invariant PR #73 protects.

### Caller interaction (API side)

The NestJS `PaymentGatewayClient.voidTransaction` (from PR #73) maps a Go `400` → `already_terminal`, non-400 error → `error`, `200` → `voided`. With this fix:
- Expired → 200 → `voided` (correct; the orphan drains).
- Transient → 502 → `error` → reconciler retries next run (correct).
- Paid → 409 → `error` for this call, BUT Go has reconciled its local status to `SUCCESS`, so the caller's next status GET returns `SUCCESS` → the API client's own settled-guard flags it `danger_settled` and refuses to cancel the invoice. The danger self-surfaces without an API-side change.

No change to the deployed API client is required. (A future enhancement could give Go a distinct "settled" response the client maps straight to `danger_settled`, but it is not needed for correctness.)

## Non-goals

- No change to the `PaymentGateway` interface or the Xendit SDK usage.
- No change to the API-side `PaymentGatewayClient` (PR #73).
- Not implementing `VerifyPayment` for Stripe/PayPal (out of scope; their cancel is a no-op).
- Not re-running any prod remediation (the 262 backlog is already cleared).

## Error classification detail

`VerifyPayment` for Xendit already handles the not-found case by string-matching `404`/`NOT_FOUND` and returning a synthetic `Pending` — for our purposes a 404 (invoice id unknown at the gateway) should be treated as **gone → void locally**, same as `EXPIRED`. So the "safe to void" condition is: `VerifyPayment` returns `Failed`, OR returns the not-found sentinel. Implementation should treat both as void-eligible. (The Xendit SDK also exposes a structured `common.XenditSdkError` with `.Status()`/`.ErrorCode()` reachable via `errors.As`; the codebase idiom today is string-matching, so we follow the existing `VerifyPayment` pattern rather than introduce SDK-internal coupling.)

## Testing

`payment_handler_test.go` has a `stubPaymentGateway` implementing the full interface but no `CancelPayment` tests today. Add table/unit tests driving the handler with a stub whose `CancelPayment` errors and whose `VerifyPayment` returns each status:

- cancel succeeds → txn `VOID`, 200 (regression guard on the happy path).
- cancel fails + VerifyPayment `Failed`(EXPIRED) → txn `VOID`, 200.
- cancel fails + VerifyPayment not-found → txn `VOID`, 200.
- cancel fails + VerifyPayment `Success`(PAID) → txn `SUCCESS` (reconciled), intent `SUCCEEDED`, 409, NOT void.
- cancel fails + VerifyPayment `Pending` → txn stays `PENDING`, 502.
- cancel fails + VerifyPayment errors → txn stays `PENDING`, 502.
- already-terminal txn (existing guard) → 400, unchanged.

Go conventions: `go test` + `testify/require`, `gin.TestMode`, `httptest`, in-memory stub repos (mirror the existing handler tests). `gofmt` clean.

## Rollout

Single Go PR to `dev` (auto-deploys the payment service). Behavior is additive and only changes the cancel-failure path. After deploy, the reconciler's terminal-drift scan becomes fully self-sufficient: expired orphans drain to `VOID` on their own, transient failures retry, and any lost-webhook paid case reconciles to `SUCCESS` and is flagged rather than voided.

## Risk

- Voiding a checkout that is actually still live: prevented — the `Pending` branch keeps 502 and never voids; only confirmed `Failed`/not-found voids.
- Voiding a paid transaction: prevented — the `Success` branch reconciles to `SUCCESS` and refuses.
- Extra latency: one additional `VerifyPayment` call, only on the cancel-failure path.
