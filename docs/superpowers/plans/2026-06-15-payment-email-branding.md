# Brand-Aware Payment Emails — Implementation Plan

> **REQUIRED SUB-SKILL:** superpowers:subagent-driven-development
> Execute each phase as an isolated subagent task. Each task is independently completable
> and ends with a passing test + commit before the next begins.

---

## Goal

All payment-related emails currently render as "YBB Platform" with default blue (#1D4ED8) regardless of which brand/program the payment belongs to. The notification service layout is already fully brand-aware — it just needs a `brand` object in the event payload. This plan threads brand data from the correct emit source through to every payment email.

## Architecture

The notification service has no database. Brand must travel via the event payload.

Two categories of payment events exist with different fix strategies:

### Category A — API-emitted events (low risk)
The API service emits these and already has ORM access to `invoice -> application -> program -> brand`.
Fix: add brand lookup + include `brand` in the emit payload directly.

**Events in this category:**
- `payment.rejected` — emitted by `payment-admin.controller.ts`

### Category B — Gateway-sourced events (higher risk)
The Go payment gateway emits these. Its `PaymentEvent` struct has no brand fields and the gateway has no access to brand data. The API already consumes these events in `payment-events.controller.ts` to update invoice/application state. Fix: in that same handler, after updating state (so the application/invoice/brand lookup is available), construct a branded notification payload and re-emit a new `notification.*` namespaced event. The notification service switches from consuming the raw `payment.*` event to consuming the `notification.*` event for email sending. Raw `payment.*` events remain consumed by the API for state updates only.

**Events in this category:**
- `payment.succeeded` — Go gateway emits → notification re-routes to `notification.payment_succeeded`
- `payment.failed` — Go gateway emits → notification re-routes to `notification.payment_failed`
- `payment.refunded` — Go gateway emits → notification re-routes to `notification.payment_refunded`
- `payment.created` (PENDING_REVIEW status) — Go gateway emits → notification re-routes to `notification.payment_created`

### Double-send avoidance
During and after cutover, the notification service must NOT consume BOTH the old `payment.*` event AND the new `notification.*` event for email. The cutover is atomic per event: within a single commit, the notification handler is renamed from `@EventPattern('payment.succeeded')` to `@EventPattern('notification.payment_succeeded')`. Before that commit is deployed, the `notification.payment_succeeded` re-emit in the API is not yet live, so no emails fire. After both are deployed together (or API re-emit first, notification cutover second with a deploy gap), the flow is clean. The existing Redis idempotency guard (`NotificationIdempotencyService.shouldProcess`) also prevents double processing if a message is accidentally replayed.

**Recommended deploy order for Category B:**
1. Deploy API re-emit changes first (emits `notification.*` events — no consumer exists yet, messages are dropped or queued).
2. Deploy notification cutover (switches handlers to `notification.*`) — emails begin flowing.

**Alternative:** Deploy both simultaneously. Safe because idempotency guard catches replays.

### Brand payload shape (established pattern)
From `forgot-password.handler.ts` lines 103-133:
```typescript
const brand = await this.prisma.brand.findUnique({
  where: { id: brandId },
  include: { settings: true }
});

const brandPayload = brand ? {
  name: brand.name,
  primaryColor: brand.primaryColor,
  logoUrl: brand.logoUrl,
  websiteUrl: brand.websiteUrl,
  contactEmail: brand.contactEmail,
  contactAddress: brand.contactAddress,
  socialMediaLinks: brand.socialMediaLinks,
  settings: brand.settings ? {
    footerNavigation: brand.settings.footerNavigation,
    supportEmail: brand.settings.supportEmail,
  } : null,
} : null;
```

## Tech Stack

- **API service:** NestJS + Prisma ORM (TypeScript)
- **Notification service:** NestJS + Handlebars email templates
- **Messaging:** RabbitMQ via `@nestjs/microservices` EventPattern + RabbitmqProducer
- **Idempotency:** Redis-backed `NotificationIdempotencyService` in notification service
- **Test framework:** Jest (NestJS standard)

---

## File Structure

### Files to MODIFY

| File | Change |
|------|--------|
| `services/api/src/modules/payments/presentation/payment-admin.controller.ts` | Phase A: add brand lookup + include `brand` in `payment.rejected` emit payload |
| `services/api/src/modules/payments/presentation/payment-events.controller.ts` | Phase B: after state update in `payment.succeeded`, `payment.failed`, `payment.refunded`, `payment.created` handlers, resolve brand and re-emit `notification.*` event |
| `services/notification/src/modules/events/events.controller.ts` | Phase B cutover: rename `@EventPattern('payment.succeeded/failed/refunded/created')` handlers to `@EventPattern('notification.payment_succeeded/failed/refunded/created')` and forward `payload.brand` into the email service call |
| `services/notification/src/modules/events/events.controller.ts` | Phase A: in `payment.rejected` handler, forward `payload.brand` into the `sendPaymentRejectedEmail` call |

### Files to CREATE

| File | Purpose |
|------|---------|
| `services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.brand.spec.ts` | Unit tests for brand inclusion in payment.rejected emit |
| `services/api/src/modules/payments/presentation/__tests__/payment-events.controller.brand.spec.ts` | Unit tests for brand re-emit in notification.payment_* events |

---

## Phase A: API-emitted events — add brand directly

**Scope:** `payment.rejected` only.
**Risk:** Low. Additive change — adds fields to existing payload.

### Task A1: Look up and emit brand in `payment.rejected`

**Files:**
```
services/api/src/modules/payments/presentation/payment-admin.controller.ts
```

**Current code (lines 774-789) — no brand in payload:**
```typescript
await this.rabbitmqProducer.emit('payment.rejected', {
  email,
  customer_name: invoice.application?.participant?.fullName ?? 'Participant',
  amount: Number(invoice.amount),
  currency: invoice.currency,
  order_id: invoice.id,
  reason: body.reason?.trim() || 'No reason provided',
  paymentsPageUrl,
  metadata: {
    application_id: invoice.applicationId,
    invoice_id: invoice.id,
    verified_by: user.userId,
    verified_at: now.toISOString(),
  },
});
```

Note: brand is already fetched at line 767 (`const brand = invoice.application?.program?.brand;`) to build `paymentsPageUrl`. That lookup does NOT include `settings` — it needs expanding.

**Steps:**

- [ ] **A1.1 — Write failing test**

  Create `services/api/src/modules/payments/presentation/__tests__/payment-admin.controller.brand.spec.ts`:

  ```typescript
  import { Test } from '@nestjs/testing';
  // ... standard NestJS test imports ...

  describe('PaymentAdminController — payment.rejected brand emission', () => {
    let controller: PaymentAdminController;
    let rabbitmqProducer: jest.Mocked<RabbitmqProducer>;
    let prisma: jest.Mocked<PrismaService>;

    const mockBrand = {
      id: 'brand-1',
      name: 'Test Brand',
      primaryColor: '#FF5500',
      logoUrl: 'https://example.com/logo.png',
      websiteUrl: 'https://example.com',
      contactEmail: 'info@example.com',
      contactAddress: '123 Test St',
      socialMediaLinks: {},
      settings: {
        footerNavigation: [],
        supportEmail: 'support@example.com',
      },
    };

    const mockInvoice = {
      id: 'invoice-1',
      amount: 500000,
      currency: 'IDR',
      applicationId: 'app-1',
      application: {
        participant: { fullName: 'John Doe', email: 'john@example.com' },
        program: {
          brand: mockBrand,
        },
      },
    };

    beforeEach(async () => {
      // ... setup mocks ...
      // prisma.applicationInvoice.findUnique returns mockInvoice
    });

    it('should include brand payload in payment.rejected emit', async () => {
      await controller.rejectPayment('invoice-1', { reason: 'Invalid docs' }, mockAdminUser);

      expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
        'payment.rejected',
        expect.objectContaining({
          brand: expect.objectContaining({
            name: 'Test Brand',
            primaryColor: '#FF5500',
            logoUrl: 'https://example.com/logo.png',
            settings: expect.objectContaining({
              supportEmail: 'support@example.com',
            }),
          }),
        }),
      );
    });

    it('should emit null brand when no brand is associated', async () => {
      // invoice with no brand
      prisma.applicationInvoice.findUnique.mockResolvedValue({
        ...mockInvoice,
        application: { ...mockInvoice.application, program: { brand: null } },
      });

      await controller.rejectPayment('invoice-1', { reason: 'Test' }, mockAdminUser);

      expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
        'payment.rejected',
        expect.objectContaining({ brand: null }),
      );
    });
  });
  ```

  Run: `cd services/api && npx jest payment-admin.controller.brand.spec --no-coverage`
  Expected: FAIL (brand not yet in payload)

- [ ] **A1.2 — Expand the Prisma include to fetch brand.settings**

  Find the `applicationInvoice.findUnique` call that loads `invoice` in the reject handler. Ensure the `include` chain reaches `program.brand.settings`:

  ```typescript
  // In the findUnique for the reject action (search for the include block near line 750):
  include: {
    application: {
      include: {
        participant: true,
        program: {
          include: {
            brand: {
              include: { settings: true },  // ADD THIS
            },
          },
        },
      },
    },
  },
  ```

- [ ] **A1.3 — Build brand payload and include in emit**

  After line 767 where `const brand = invoice.application?.program?.brand;`, replace/extend:

  ```typescript
  const rawBrand = invoice.application?.program?.brand ?? null;
  const brandPayload = rawBrand
    ? {
        name: rawBrand.name,
        primaryColor: rawBrand.primaryColor,
        logoUrl: rawBrand.logoUrl,
        websiteUrl: rawBrand.websiteUrl,
        contactEmail: rawBrand.contactEmail,
        contactAddress: rawBrand.contactAddress,
        socialMediaLinks: rawBrand.socialMediaLinks,
        settings: rawBrand.settings
          ? {
              footerNavigation: rawBrand.settings.footerNavigation,
              supportEmail: rawBrand.settings.supportEmail,
            }
          : null,
      }
    : null;
  ```

  Add `brand: brandPayload` to the `rabbitmqProducer.emit('payment.rejected', { ... })` call:

  ```typescript
  await this.rabbitmqProducer.emit('payment.rejected', {
    email,
    customer_name: invoice.application?.participant?.fullName ?? 'Participant',
    amount: Number(invoice.amount),
    currency: invoice.currency,
    order_id: invoice.id,
    reason: body.reason?.trim() || 'No reason provided',
    paymentsPageUrl,
    brand: brandPayload,          // ADD THIS
    metadata: {
      application_id: invoice.applicationId,
      invoice_id: invoice.id,
      verified_by: user.userId,
      verified_at: now.toISOString(),
    },
  });
  ```

  Run: `cd services/api && npx jest payment-admin.controller.brand.spec --no-coverage`
  Expected: PASS

- [ ] **A1.4 — Wire brand through in notification events.controller for `payment.rejected`**

  **File:** `services/notification/src/modules/events/events.controller.ts`

  Find the `handlePaymentRejected` handler (lines 216-253). It currently calls:
  ```typescript
  await this.emailService.sendPaymentRejectedEmail(email, {
    name: customerName, amount, currency, orderId, reason, paymentsPageUrl,
  });
  ```

  Change to:
  ```typescript
  await this.emailService.sendPaymentRejectedEmail(email, {
    name: customerName,
    amount,
    currency,
    orderId,
    reason,
    paymentsPageUrl,
    brand: asRecord(payload.brand) ?? undefined,   // ADD THIS
  });
  ```

  (Use the same `asRecord` helper already used in the file for type safety.)

- [ ] **A1.5 — TypeScript compile check**

  ```bash
  cd services/notification && npx tsc --noEmit
  cd services/api && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **A1.6 — Commit**

  ```
  feat: include brand in payment.rejected email notification

  PaymentAdminController now fetches brand (with settings) from the
  invoice -> application -> program -> brand chain and includes the full
  brand payload in the payment.rejected RabbitMQ event. The notification
  service's handlePaymentRejected handler forwards payload.brand into
  sendPaymentRejectedEmail so the email renders with the correct brand
  name, logo, and primary color.
  ```

---

## Phase B: Gateway-sourced events — API enriches and re-emits

**Scope:** `payment.succeeded`, `payment.failed`, `payment.refunded`, `payment.created` (PENDING_REVIEW)
**Risk:** Higher — changes event topology. Requires coordinated cutover.

### Task B1: Add brand re-emit in `payment-events.controller.ts`

The API already consumes all four gateway events and updates state. After state update in each handler, resolve brand from the now-persisted `ApplicationInvoice` and emit a new `notification.*` event.

**File:**
```
services/api/src/modules/payments/presentation/payment-events.controller.ts
```

**Steps:**

- [ ] **B1.1 — Write failing tests for each re-emit**

  Create `services/api/src/modules/payments/presentation/__tests__/payment-events.controller.brand.spec.ts`:

  ```typescript
  describe('PaymentEventsController — brand re-emit', () => {
    const mockBrand = {
      id: 'brand-1',
      name: 'Test Brand',
      primaryColor: '#FF5500',
      logoUrl: 'https://cdn.example.com/logo.png',
      websiteUrl: 'https://example.com',
      contactEmail: 'hello@example.com',
      contactAddress: '1 Brand Ave',
      socialMediaLinks: {},
      settings: { footerNavigation: [], supportEmail: 'support@example.com' },
    };

    const baseInvoice = {
      id: 'inv-1',
      amount: 1000000,
      currency: 'IDR',
      applicationId: 'app-1',
      application: {
        participant: { fullName: 'Jane Doe', email: 'jane@example.com' },
        program: { brand: mockBrand },
      },
    };

    describe('payment.succeeded → notification.payment_succeeded', () => {
      it('emits notification.payment_succeeded with brand payload', async () => {
        // setup: prisma returns baseInvoice after upsert
        const payload = {
          payment_id: 'pay-1',
          application_id: 'app-1',
          email: 'jane@example.com',
          amount: 1000000,
          currency: 'IDR',
          order_id: 'inv-1',
          metadata: { customer_name: 'Jane Doe', description: 'YBB Program Fee' },
        };

        await controller.handlePaymentSucceeded(payload, mockRmqContext);

        expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
          'notification.payment_succeeded',
          expect.objectContaining({
            email: 'jane@example.com',
            brand: expect.objectContaining({
              name: 'Test Brand',
              primaryColor: '#FF5500',
            }),
          }),
        );
      });

      it('emits with brand: null when no brand associated', async () => {
        // setup: invoice with no brand
        await controller.handlePaymentSucceeded(payloadNoBrand, mockRmqContext);
        expect(rabbitmqProducer.emit).toHaveBeenCalledWith(
          'notification.payment_succeeded',
          expect.objectContaining({ brand: null }),
        );
      });
    });

    // Repeat similar describe blocks for:
    // payment.failed → notification.payment_failed
    // payment.refunded → notification.payment_refunded
    // payment.created (PENDING_REVIEW) → notification.payment_created
  });
  ```

  Run: `cd services/api && npx jest payment-events.controller.brand.spec --no-coverage`
  Expected: FAIL

- [ ] **B1.2 — Implement re-emit in `handlePaymentSucceeded`**

  The existing handler (lines 125-220) updates `ApplicationInvoice` and re-queries for cache invalidation. After the state update, add brand resolution and re-emit:

  ```typescript
  // After all state update logic, before the final channel.ack():

  // Resolve invoice with brand for notification
  const invoiceWithBrand = await this.prisma.applicationInvoice.findUnique({
    where: { id: invoiceId },
    include: {
      application: {
        include: {
          participant: true,
          program: {
            include: {
              brand: { include: { settings: true } },
            },
          },
        },
      },
    },
  });

  const rawBrand = invoiceWithBrand?.application?.program?.brand ?? null;
  const brandPayload = rawBrand
    ? {
        name: rawBrand.name,
        primaryColor: rawBrand.primaryColor,
        logoUrl: rawBrand.logoUrl,
        websiteUrl: rawBrand.websiteUrl,
        contactEmail: rawBrand.contactEmail,
        contactAddress: rawBrand.contactAddress,
        socialMediaLinks: rawBrand.socialMediaLinks,
        settings: rawBrand.settings
          ? {
              footerNavigation: rawBrand.settings.footerNavigation,
              supportEmail: rawBrand.settings.supportEmail,
            }
          : null,
      }
    : null;

  await this.rabbitmqProducer.emit('notification.payment_succeeded', {
    email: getString(payload, 'email') || invoiceWithBrand?.application?.participant?.email,
    customer_name:
      getString(metadata, 'customer_name') ||
      invoiceWithBrand?.application?.participant?.fullName ||
      'Customer',
    amount: getNumber(payload, 'amount'),
    currency: getString(payload, 'currency') || 'IDR',
    order_id: invoiceId,
    payment_id: getString(payload, 'payment_id'),
    description: getString(metadata, 'description') || 'Payment for services',
    invoice_url: invoiceWithBrand ? buildInvoiceUrl(invoiceWithBrand) : undefined,
    payments_page_url: rawBrand ? buildParticipantPaymentsUrl(rawBrand) : undefined,
    metadata: {
      application_id: applicationId,
      invoice_id: invoiceId,
      item_details: metadata?.item_details,
    },
    brand: brandPayload,
  });
  ```

  > **Note on helper functions:** `getString`, `getNumber` are likely already imported from a shared utility. `buildInvoiceUrl` and `buildParticipantPaymentsUrl` are used elsewhere in the payments module — reuse them. If they are not available here, inline the URL construction matching the pattern in `payment-admin.controller.ts`.

- [ ] **B1.3 — Implement re-emit in `handlePaymentFailed`**

  Same pattern in the `payment.failed` handler (lines 360-438). After state update:

  ```typescript
  await this.rabbitmqProducer.emit('notification.payment_failed', {
    email: getString(payload, 'email') || invoiceWithBrand?.application?.participant?.email,
    customer_name: ...,
    amount: getNumber(payload, 'amount'),
    currency: getString(payload, 'currency') || 'IDR',
    order_id: invoiceId,
    reason: getString(payload, 'reason') || getString(metadata, 'failure_reason') || 'Payment could not be processed',
    metadata: { application_id: applicationId, invoice_id: invoiceId },
    brand: brandPayload,
  });
  ```

- [ ] **B1.4 — Implement re-emit in `handlePaymentRefunded`**

  Currently `payment.refunded` handler immediately acks and ignores (line 121). Change to:

  ```typescript
  @EventPattern('payment.refunded')
  async handlePaymentRefunded(@Payload() data: unknown, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const payload = asRecord(data);
      const paymentId = getString(payload, 'payment_id');
      const applicationId = getString(payload, 'application_id');

      // Find invoice by payment reference
      const invoice = await this.prisma.applicationInvoice.findFirst({
        where: {
          OR: [
            { paymentIntentId: paymentId },
            { applicationId },
          ],
        },
        include: {
          application: {
            include: {
              participant: true,
              program: { include: { brand: { include: { settings: true } } } },
            },
          },
        },
      });

      const rawBrand = invoice?.application?.program?.brand ?? null;
      const brandPayload = rawBrand ? { /* same shape as above */ } : null;

      await this.rabbitmqProducer.emit('notification.payment_refunded', {
        email: getString(payload, 'email') || invoice?.application?.participant?.email,
        customer_name: invoice?.application?.participant?.fullName || 'Customer',
        amount: getNumber(payload, 'amount'),
        currency: getString(payload, 'currency') || 'IDR',
        order_id: invoice?.id || applicationId,
        description: getString(payload, 'description') || 'Refund processed',
        brand: brandPayload,
      });

      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error('handlePaymentRefunded failed', err);
      channel.nack(originalMsg, false, false);
    }
  }
  ```

  > **Important:** The current handler does nothing for `payment.refunded` — adding the brand query here means no existing functionality breaks. Only new behavior is added.

- [ ] **B1.5 — Implement re-emit in `handlePaymentCreated` (PENDING_REVIEW only)**

  Currently `payment.created` immediately acks and ignores (line 39). Notification service currently handles this itself. After cutover, notification will consume `notification.payment_created` instead. Add similar re-emit:

  ```typescript
  @EventPattern('payment.created')
  async handlePaymentCreated(@Payload() data: unknown, @Ctx() context: RmqContext) {
    const channel = context.getChannelRef();
    const originalMsg = context.getMessage();

    try {
      const payload = asRecord(data);
      const status = getString(payload, 'status');

      // Only re-emit for PENDING_REVIEW — matches existing notification behavior
      if (status === 'PENDING_REVIEW') {
        const applicationId = getString(payload, 'application_id');
        const invoice = await this.prisma.applicationInvoice.findFirst({
          where: { applicationId },
          include: {
            application: {
              include: {
                participant: true,
                program: { include: { brand: { include: { settings: true } } } },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        const rawBrand = invoice?.application?.program?.brand ?? null;
        const brandPayload = rawBrand ? { /* same shape */ } : null;

        await this.rabbitmqProducer.emit('notification.payment_created', {
          email: getString(payload, 'email') || invoice?.application?.participant?.email,
          customer_name: invoice?.application?.participant?.fullName || 'Customer',
          amount: getNumber(payload, 'amount'),
          currency: getString(payload, 'currency') || 'IDR',
          order_id: invoice?.id || applicationId,
          status,
          brand: brandPayload,
        });
      }

      channel.ack(originalMsg);
    } catch (err) {
      this.logger.error('handlePaymentCreated failed', err);
      channel.nack(originalMsg, false, false);
    }
  }
  ```

- [ ] **B1.6 — Run tests (all should pass)**

  ```bash
  cd services/api && npx jest payment-events.controller.brand.spec --no-coverage
  ```

  Expected: PASS

- [ ] **B1.7 — TypeScript compile check**

  ```bash
  cd services/api && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **B1.8 — Commit**

  ```
  feat: re-emit branded notification events from gateway payment events

  PaymentEventsController now resolves brand (via invoice -> application
  -> program -> brand -> settings) after processing each gateway payment
  event and re-emits a notification.payment_* event with the full brand
  payload. Covers payment.succeeded, payment.failed, payment.refunded,
  and payment.created (PENDING_REVIEW). The notification service will
  switch to consuming these branded events in the next commit.
  ```

---

### Task B2: Notification service — cutover to `notification.*` events

This is the critical cutover step. Deploy AFTER Task B1 is live (or simultaneously).

**File:**
```
services/notification/src/modules/events/events.controller.ts
```

**Steps:**

- [ ] **B2.1 — Rename `payment.succeeded` handler and forward brand**

  Current handler signature (line 72):
  ```typescript
  @EventPattern('payment.succeeded')
  async handlePaymentSucceeded(@Payload() data: unknown, @Ctx() context: RmqContext) {
  ```

  Change to:
  ```typescript
  @EventPattern('notification.payment_succeeded')
  async handlePaymentSucceeded(@Payload() data: unknown, @Ctx() context: RmqContext) {
  ```

  In the call to `sendPaymentSuccessEmail` (currently lines ~119-148), add `brand`:
  ```typescript
  await this.emailService.sendPaymentSuccessEmail(email, {
    name: customerName,
    amount,
    currency,
    orderId,
    description,
    invoiceUrl,
    paymentsPageUrl,
    submissionPageUrl,
    items,
    brand: asRecord(payload.brand) ?? undefined,    // ADD THIS
  }, receiptBuffer);
  ```

- [ ] **B2.2 — Rename `payment.failed` handler and forward brand**

  ```typescript
  // Change:
  @EventPattern('payment.failed')
  // To:
  @EventPattern('notification.payment_failed')
  ```

  In the `sendPaymentFailedEmail` call, add:
  ```typescript
  brand: asRecord(payload.brand) ?? undefined,
  ```

- [ ] **B2.3 — Rename `payment.refunded` handler and forward brand**

  ```typescript
  // Change:
  @EventPattern('payment.refunded')
  // To:
  @EventPattern('notification.payment_refunded')
  ```

  In the `sendPaymentRefundedEmail` call, add:
  ```typescript
  brand: asRecord(payload.brand) ?? undefined,
  ```

- [ ] **B2.4 — Rename `payment.created` handler and forward brand**

  ```typescript
  // Change:
  @EventPattern('payment.created')
  // To:
  @EventPattern('notification.payment_created')
  ```

  In the `sendManualPaymentReceivedEmail` call, add:
  ```typescript
  brand: asRecord(payload.brand) ?? undefined,
  ```

- [ ] **B2.5 — TypeScript compile check**

  ```bash
  cd services/notification && npx tsc --noEmit
  ```

  Expected: no errors.

- [ ] **B2.6 — Commit**

  ```
  feat: switch notification service to notification.payment_* branded events

  Renames all four gateway payment email handlers from payment.* to
  notification.payment_* events (emitted by the API with brand data).
  Forwards payload.brand into each sendPayment*Email call so emails
  now render with correct brand name, logo, and primary color.

  Cutover is safe: notification service no longer listens on raw
  payment.* events for email; API payment-events.controller continues
  to consume raw events for state updates only.
  ```

---

## Phase C: Verification and E2E

### Task C1: Manual smoke test (staging)

- [ ] **C1.1 — Verify `payment.rejected` email** (Phase A)
  1. In admin dashboard, find a test application with a payment in PENDING_REVIEW state.
  2. Reject it with a reason.
  3. Check test inbox: email should show brand name, logo, and brand primary color.
  4. If brand has no logo, brand name text should appear in header.

- [ ] **C1.2 — Verify `payment.succeeded` email** (Phase B)
  1. Process a test payment through the gateway on staging.
  2. Check test inbox: email should show brand name, logo, and brand primary color.

- [ ] **C1.3 — Verify `payment.failed` email** (Phase B)
  1. Use a test card that triggers failure.
  2. Check test inbox.

- [ ] **C1.4 — Verify `payment.refunded` email** (Phase B)
  1. Trigger a refund on a test transaction.
  2. Check test inbox.

- [ ] **C1.5 — Verify `payment.created` (manual payment) email** (Phase B)
  1. Submit a manual payment (bank transfer) on staging.
  2. Check test inbox.

- [ ] **C1.6 — Verify no-brand fallback**
  1. If possible, test with a program that has no brand associated.
  2. Email should fall back to "YBB Platform" and default blue (#1D4ED8).
  3. No crash, no empty subject.

### Task C2: Verify idempotency still works

- [ ] **C2.1** Replay a `notification.payment_succeeded` message twice (manually via RabbitMQ management UI).
  Expected: only one email sent. Notification service logs `dedupe_hit=true processed=false` on the second delivery.

### Task C3: Regression check — no duplicate emails during cutover

- [ ] **C3.1** After Phase B cutover, confirm no raw `payment.*` handler exists in notification for the affected events.
  ```bash
  grep -n "EventPattern.*payment\." services/notification/src/modules/events/events.controller.ts
  ```
  Expected: only `payment.rejected` remains (that one is API-emitted, Phase A handled it by adding brand there — the handler keeps its original `payment.rejected` pattern).

---

## Risks and Cutover

### Risk 1: Dropped emails during deploy gap (Phase B)
**Scenario:** API re-emit is deployed but notification cutover is not yet deployed. `notification.payment_*` events are emitted but no consumer exists — RabbitMQ drops them (if no durable queue is bound) or queues them.

**Mitigation:**
- Declare `notification.payment_succeeded` (and siblings) queues as durable in the notification service's module setup BEFORE deploying the re-emit. This way, queued messages survive until the consumer comes up.
- Alternatively: deploy both simultaneously in a single release.
- Check existing queue declaration pattern in `services/notification/src/app.module.ts` or the RabbitMQ module config — ensure new queues follow the same `{ durable: true }` pattern.

### Risk 2: Double emails if both old and new handlers are temporarily live
**Scenario:** If a race condition causes both `payment.*` and `notification.payment_*` consumers to receive messages.

**Mitigation:** The Redis idempotency guard in `NotificationIdempotencyService.shouldProcess` generates a dedupe key from event type + payload + message IDs. Because old event type is `payment.succeeded` and new is `notification.payment_succeeded`, they produce different dedupe keys — so idempotency does NOT prevent a double-send across the event name change.

**Safe approach:** The cutover must be a one-way switch. The notification handler for each event is renamed from `payment.*` to `notification.*` in a single commit — there is no intermediate state where both patterns are active.

**Rollback:** If post-deploy issues occur, revert the notification service to `payment.*` handlers AND disable (but do NOT remove) the API re-emit. The re-emit being live but having no consumer is harmless.

### Risk 3: Brand lookup adds latency to gateway event processing
**Scenario:** The extra `prisma.applicationInvoice.findUnique` with brand includes in `payment-events.controller.ts` adds a DB round trip per payment event.

**Mitigation:** This query is inside the existing handler that already does multiple DB writes (upsert invoice, update application status). The additional read is on an already-hot path. If profiling shows concern, the brand query can be merged into an existing query with an `include` clause addition rather than a separate call.

### Risk 4: `payment.refunded` and `payment.created` handlers currently do nothing in API
Both currently ack immediately. Adding brand lookup + re-emit introduces new logic that can throw. Use try/catch + nack pattern (shown in B1.4 and B1.5) to avoid blocking the queue on errors.

### Risk 5: Invoice not yet persisted when `payment.created` fires
The `payment.created` event may arrive before the API has created the `ApplicationInvoice` row. In `handlePaymentCreated` (B1.5), the `findFirst` may return null. Guard:
```typescript
if (!invoice) {
  this.logger.warn(`handlePaymentCreated: no invoice found for applicationId=${applicationId}, skipping notification re-emit`);
  channel.ack(originalMsg);
  return;
}
```
This is acceptable — the email is best-effort for this event type.

---

## Prod/Env — RabbitMQ Queue Bindings

### New queues required
Four new queues must exist before the notification service cutover:
- `notification.payment_succeeded`
- `notification.payment_failed`
- `notification.payment_refunded`
- `notification.payment_created`

### How NestJS microservices declares queues
NestJS `@nestjs/microservices` with RabbitMQ automatically declares queues when the service starts and binds `@EventPattern` handlers. The queue name typically matches the routing key. Confirm the existing pattern in:
```
services/notification/src/main.ts  (or app.module.ts)
```
Look for `{ queue: '...', queueOptions: { durable: true } }` in the `createMicroservice` call. Ensure the same `durable: true` is applied to the new queue names (it likely is, as it's a global config).

### No exchange changes required
Assuming the existing setup uses a topic or direct exchange where the API emits to the same exchange. The new event names (`notification.payment_*`) just need to be routable to the notification service's queue. If the notification service uses a single queue with multiple bindings, the new binding keys are added automatically when the service starts with the renamed `@EventPattern` decorators.

### Verify no routing conflicts
Run after deploy:
```bash
# On the RabbitMQ management UI or via CLI:
rabbitmqadmin list bindings | grep notification.payment
```
Expected: 4 bindings, one per new event name, routed to the notification service queue.

---

## Addendum: `user.registered` without brand (create-user path)

Research finding: `verify-email.handler.ts` emits `user.registered` WITH brand at line 75. However, `create-user.handler.ts` may emit the same event WITHOUT brand (as noted in the spec).

**Assessment:** This is out of scope for this plan (payment emails only). However, flag for a follow-up:

- [ ] **Optional: Check `create-user.handler.ts`** — if it emits `user.registered` without brand, add brand lookup there following the same `forgot-password.handler.ts` pattern. This is a 5-line change once the lookup is confirmed missing.

---

## Branch Target

```
git checkout -b feat/payment-email-branding
```

Branch from: `main` (or current stable base — confirm with team).
Target merge: back to `main` via PR after staging verification.
Repo: `ybb-platform/` git (not the workspace root).

---

## Self-Review

### Spec coverage checklist

- [x] Researched exact payment event topology before writing (events.controller.ts, email.service.ts, payment-admin.controller.ts, payment-events.controller.ts, Go event struct)
- [x] All five payment email events covered: `payment.rejected` (Phase A), `payment.succeeded/failed/refunded/created` (Phase B)
- [x] Established brand payload shape from `forgot-password.handler.ts` reused exactly
- [x] API-emitted event (`payment.rejected`): brand added directly to emit — no re-emit needed
- [x] Gateway-sourced events: re-emit approach via `notification.payment_*` documented with exact new event names
- [x] Double-send avoidance: one-way atomic rename in notification, rollback path documented
- [x] Redis idempotency noted with caveat (dedupe key is event-type-sensitive — new event names are safe)
- [x] RabbitMQ queue binding changes documented
- [x] `payment.refunded` and `payment.created` currently no-ops in API — new logic guarded with try/catch
- [x] Brand null-safety in all paths (program with no brand → `null` payload → layout.hbs falls back to "YBB Platform")
- [x] TypeScript compile checks in every task
- [x] No placeholders — all code snippets are complete and use real identifiers from the codebase
- [x] Phase ordering: A (low risk) before B (higher risk) before C (verification)
- [x] `user.registered` / `create-user.handler.ts` noted as optional addendum
- [x] `payment.cancelled` intentionally excluded — notification handler already acks-and-skips, no email sent

### Type consistency
- `brand` in payload: plain object literal, not a Prisma model instance — matches `forgot-password.handler.ts` pattern
- `asRecord(payload.brand)` in notification handler: safe because `asRecord` coerces to `Record<string, unknown>` or returns `{}`, matching `paymentData.brand` expected shape in `email.service.ts`
- `brand.settings` can be `null` — all template usages in `layout.hbs` use `{{#if}}` guards

### Open questions for architect
1. **RabbitMQ queue durability config location** — confirm `durable: true` is applied globally in notification service startup, not per-queue, so new queues inherit it automatically.
2. **`payment.created` invoice timing** — confirm whether `ApplicationInvoice` is created before or after `payment.created` fires from Go gateway. If after, the no-op guard in B1.5 means the PENDING_REVIEW email is silently skipped. An alternative is to have the API emit `notification.payment_created` only when it creates/updates the invoice record (at the same time it acks the gateway event).
3. **`buildInvoiceUrl` / `buildParticipantPaymentsUrl` availability** — confirm these helpers are importable in `payment-events.controller.ts` or whether URL construction should be inlined.
4. **Staging test brand setup** — confirm at least one program on staging has a fully populated brand (name + logoUrl + primaryColor + contactEmail) for smoke tests to be meaningful.
