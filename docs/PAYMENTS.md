# Payments

The YBB payment system is layered across two databases and two services:

- **NestJS API** (PostgreSQL `ybb-api-db`) owns `ApplicationInvoice`, `ProgramPricingTier`, and `ParticipantApplication`.
- **Go Payment Service** (PostgreSQL `ybb_payments_db`) owns `payment_intents` and `payment_transactions`.

Invoices are created in the API DB first. The gateway result must sync back via a `payment.succeeded` event (RabbitMQ). If that event does not arrive, the invoice stays `processing` while the gateway has already marked the intent `SUCCEEDED`. The reconciliation scripts cover this drift.

---

## 1. Fee Types and Order

Programs define one or more **pricing tiers** (admin-configured). Each tier has a `feeType`:

| feeType | Priority | Notes |
|---------|----------|-------|
| `registration_fee` | 1 | Upfront enrollment fee. Required before submission. |
| `program_fee_1` | 2 | First program installment. |
| `full_fee` | 2 | Treated as the same stage as `program_fee_1`. |
| `program_fee_2` | 3 | Second program installment. |

Priority is determined by `getFeeTypePriority` in `get-portal-payments.handler.ts`. Within the same priority level, tiers are further sorted by the tier's `order` field, then by start date, then by name.

### Applicable Tiers

Each tier carries an `allowedCategories` array (e.g., `['self_funded']`, `['fully_funded']`, or empty for all). A tier is **applicable** to a participant only if `allowedCategories` is empty OR it includes the participant's `applicationCategory`.

This means the visible payment sequence is participant-specific. A `fully_funded` participant will skip any `program_fee_1` tier restricted to `self_funded`, resulting in a sequence of: registration fee, then program fee 2 (if applicable). This is by design, not a bug.

---

## 2. Sequential Reveal

The participant payments list shows applicable tiers in fee-stage order and enforces a strict reveal rule:

1. Iterate applicable tiers in priority order.
2. For each tier: if it has no invoice yet, show it as "available" and stop (do not reveal anything after it).
3. If it has an invoice that is not `paid`, show it as outstanding and stop.
4. If it has a `paid` invoice, add it to history and continue to the next tier.
5. A tier whose start date has not yet been reached also stops the reveal.

**Implications:**

- Paid stages remain visible in history regardless of whether their tier is still active.
- A participant cannot see (or pay) a later fee stage before all earlier stages are paid.
- If a `fully_funded` participant has no applicable `program_fee_1` tier, the system skips directly from registration to `program_fee_2`. No action is required.

### Orphan Invoices

When a tier is deactivated, deleted, or the participant's category changes after an invoice is created, that invoice becomes an "orphan" (its tier is no longer in the applicable set). Orphan invoices surface as archived history so participants can see their own payment records. New payments cannot be initiated from them (`canPay: false`). If an orphan invoice exists for a fee stage, the system will not also show a new "available method" row for the same fee stage.

---

## 3. Registration Fee Gate

**Rule: a participant cannot submit an application until the registration fee is paid.**

Enforced by `RegistrationFeeGateService` (`services/api/src/modules/payments/application/services/registration-fee-gate.service.ts`). Both the portal submit path and the admin submit path use the same service, so they cannot diverge.

### How the Gate Decides

1. Look for an active `registration_fee` pricing tier on the program. If none exists, the gate is a no-op (allow).
2. If a tier exists: pass if `application.registrationPaymentStatus === 'paid'` (fast path).
3. If not, also accept a `paid` `ApplicationInvoice` for a `registration_fee` tier (race-condition guard for in-flight event propagation).
4. Otherwise: throw `BadRequestException('Registration fee must be paid before submission.')`.

### No Category Bypass

Both `fully_funded` and `self_funded` participants must pay the registration fee before submitting. The reimbursement model applies: pay first, receive a reimbursement later if applicable.

There is no ambassador exemption. A person who is both an ambassador and an applicant must pay like any other participant.

---

## 4. Dual Pricing

Every pricing tier carries `usdPrice` and `idrPrice` fields in addition to the legacy `price`/`currency` fields.

**Canonical handling:**

- USD is the canonical amount for gateway (online) payments.
- IDR is the settlement amount for manual bank transfers.
- Invoices snapshot `amountUsd`, `amountIdr`, and `exchangeRateSnapshot` at creation time. Later tier edits or FX rate changes do not retroactively alter what the participant owed.

**Exchange Rate Resolution (at invoice/intent creation):**

1. Use `program.usdInIdr` if set.
2. Fall back to `brandSetting.usdInIdr` if the program rate is not set.
3. If neither is set and the payment is a USD gateway payment, throw `PreconditionFailedException` immediately (fail-fast before the intent is written to the Go DB).
4. Manual transfers (IDR) do not require a rate at intent creation, but the IDR snapshot must be present on the invoice for the currency flip to work.

**The `amount` field on an invoice:**

- At creation: `amount` is USD if dual pricing is enabled, or the legacy `price`/`currency` otherwise.
- After a manual transfer confirmation: `amount` and `currency` are flipped to the IDR snapshot (`amountIdr`).

---

## 5. Payment Methods

### Online Gateway

The participant initiates via `ConfirmPortalPayment`. The API creates an intent in the Go Payment Service and calls `processPayment`. The gateway (Midtrans or Stripe) returns a redirect/checkout action. On gateway success, `payment.succeeded` fires and syncs the invoice to `paid`.

Both the invoice and the application status update after the sync.

### Manual Bank Transfer

The participant submits account name, source name, payment date, and a proof file URL. The API creates an intent and calls `submitManualPayment` on the Go service. The invoice is immediately set to `processing`.

An admin must then verify the proof and Approve or Reject via the admin payments interface. Approval marks the invoice `paid`; rejection marks it `failed`.

**Known limitation:** There is no dedicated pending-review queue in the admin UI. Admins find manual transfers awaiting review by filtering by payment method (`manual_transfer`) and status (`processing`).

---

## 6. Duplicate-Payment Guard

Two guards prevent a participant from paying the registration fee twice:

1. **Pre-intent check** (`ConfirmPortalPaymentHandler`, `CreateRegistrationPaymentIntentHandler`): Before creating a new payment intent, `RegistrationFeeGateService.isRegistrationFeePaid` checks the application status and any existing paid invoices. If already paid, `BadRequestException` is thrown.

2. **Invoice status check**: Attempting to pay an invoice already in `paid` or `processing` status throws `BadRequestException` before any intent is created.

The cross-invoice case is also covered: even if a different registration-fee invoice was paid (from a previous attempt), the guard catches it.

---

## 7. Admin Tooling

### Admin Creates a Registration Intent on Behalf of a Participant

`CreateRegistrationPaymentIntentHandler` provides the admin path. It applies the same dual-pricing logic and exchange-rate resolution as the portal path. The participant must own the application, and the application must have a selected `registration_fee` tier.

### Admin Payments View: Ambassador Badge

The invoice list response includes an `ambassador` field on the `participant` object:

```json
{
  "referralCode": "ABC12345",
  "isActive": true,
  "isSameProgram": true
}
```

This is `null` when the payer is not an ambassador. When present, the admin dashboard can surface an "Ambassador" badge showing the referral code, active/inactive state, and whether the ambassador's assigned program matches the invoice's program.

### Approve / Reject Manual Transfer

Admin calls the payment service HTTP client to approve or reject a manual transfer transaction. Approval triggers `payment.succeeded`; rejection marks the invoice `failed` with a `rejectionReason`.

---

## 8. Operational Scripts

Located at `services/api/scripts/`:

| Script | Purpose |
|--------|---------|
| `reconcile-paid-intents.ts` | Re-syncs invoices stuck at `processing` when the gateway shows `SUCCEEDED` but the `payment.succeeded` event never arrived. |
| `revert-unpaid-submissions.ts` | Reverts applications that reached `submitted` status without paying the registration fee (pre-gate-hardening). |

Both scripts default to **dry run**. Pass `--apply` to write changes. Run inside the API container or with `DATABASE_URL` set.

`reconcile-paid-intents.ts` must be run first to prevent `revert-unpaid-submissions.ts` from reverting applications that actually paid but whose DB state has not synced.

---

## 9. Architecture Caveat: Split Databases

Payment intents and transactions live only in the Go Payment Service DB (`ybb_payments_db`). The NestJS API DB has no `payment_intents` table. The only signal the API has for a "maybe paid but unconfirmed" state is an invoice with `status='processing'` and a non-null `externalIntentId`.

When investigating a drift case:

1. Check the Go service DB directly for `payment_intents.status` and `payment_transactions.status`.
2. If the intent is `SUCCEEDED` but the invoice is `processing`, use `reconcile-paid-intents.ts` to repair.
3. If there is no intent at all, the participant abandoned before completing payment.
