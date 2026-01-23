# Custom Payment Gateway Integration Plan

## 1. Overview
This document outlines the architectural changes required to support a **Hybrid Payment System** for the YBB Platform. It integrates **Custom Payment UI** (Core API) for automatic gateways (Midtrans, Xendit) and **Manual Payment** workflows (Bank Transfer, PayPal, Western Union + Proof Upload).

### 1.1. Architecture Roles (3-Tier)
The system adopts a clear separation of concerns:

1.  **Frontend (Next.js)**: 
    *   Handles all **UI/UX components** (Payment Method Selection, Instructions Display, Proof Upload Form).
    *   Directly interacts with the **Gateway SDKs** (e.g., Midtrans Snap.js or Core JS) for client-side tokenization.
    *   Communicates primarily with the **API Service**.

2.  **API Service (Main Orchestrator)**:
    *   Acts as the bridge between the Frontend and the Payment Domain.
    *   Handles **Business Context**: Knows *what* the user is buying (e.g., "Program A - Gold Tier").
    *   Creates the `PaymentIntent` by passing amount + metadata to the Payment Service.

3.  **Payment Service (Domain Logic)**:
    *   **The "Brain"**: Handles the complexity of Gateways, Retries, Idempotency, and State Machines.
    *   **Agnostic**: Ideally, it doesn't know about "Programs" or "Tiers" directly, but stores this context in **Metadata** so the Admin Dashboard can filter/report on it.
    *   Manages the `PaymentConfiguration` (Server Keys).

The system priorities are:
1.  **Unified Experience**: Frontend controls the look and feel.
2.  **Context Preservation**: Metadata ensures Admin Dashboards know exactly *what* was paid for.
3.  **Manual Verification**: Robust flow for uploading proofs and admin approval.

### 1.2. The "Security Triangle" (Tokenization Flow)
To strictly adhere to PCI-DSS standards (and avoid handling raw credit card violations), the Frontend performs a **side-channel request** before calling our API.

1.  **User Input**: User types Card Number into our Frontend.
2.  **Token Request**: Frontend sends this data DIRECTLY to the Gateway (Midtrans/Xendit JS SDK).
3.  **Token Response**: Gateway validates and returns a temporary `token_id` (e.g., "tok_123").
4.  **Charge Request**: Frontend sends `token_id` to our API Service.
5.  **Charge Execution**: API Service sends `token_id` + `Secret Key` to Gateway to capture funds.

*Result*: Our server never sees the Card Number, only the Token.

## 2. Architecture & Data Flow

### 2.1. Logic Flow (Automatic vs Manual)
1.  **Intent**: User creates a `PaymentIntent`.
2.  **Method Selection**: User picks a method from our `PaymentMethod` master list.
    *   *If Automatic (e.g. Credit Card)*: Tokenize -> Charge -> Gateway Transaction.
    *   *If Manual (e.g. Bank Transfer, PayPal)*: Return `ManualPaymentDetail` (Account/Email/Instructions) -> User pays offline -> User uploads proof.
3.  **Transaction**:
    *   *Automatic*: Status updates via Gateway Response/Webhook.
    *   *Manual*: Status starts at `PENDING_REVIEW` -> Admin clicks Approve -> `SUCCESS`.

## 3. Database Schema Restructuring

### 3.1. Payment Configuration & Methods
We maintain a master list of methods to allow custom icons, ordering, and manual options.

```prisma
// ============================================================================
// ENUMS
// ============================================================================

enum PaymentIntentStatus {
  REQUIRES_PAYMENT_METHOD // Waiting for user to pick a method or retry
  PROCESSING              // Waiting for gateway (e.g. VA pending)
  SUCCEEDED               // Done
  CANCELED                // User canceled
}

enum PaymentTransactionStatus {
  PENDING
  NEEDS_REVIEW // Specifically for Manual Payments waiting for Admin
  SUCCESS
  FAILED
  VOID
  REJECTED // Admin rejected proof
}

// Global or Program-specific configuration
model PaymentGatewayConfig {
  id                String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  
  // Scope: If programCategoryId is null, it's the GLOBAL default.
  programCategoryId String?  @map("program_category_id") @db.Uuid
  
  provider          String   @db.VarChar(50) // 'midtrans', 'xendit'
  mode              String   @default("sandbox") @db.VarChar(20)
  
  serverKey         String   @map("server_key") @db.Text 
  clientKey         String   @map("client_key") @db.Text
  webhookSecret     String?  @map("webhook_secret") @db.Text
  
  isActive          Boolean  @default(true) @map("is_active")
  
  @@map("payment_gateway_configs")
  @@index([programCategoryId])
}

// Master list of available methods (Manual + Gateway)
model PaymentMethod {
  id                String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  
  code              String   @unique @db.VarChar(50) // 'manual_bca', 'manual_paypal', 'midtrans_gopay'
  name              String   @db.VarChar(100) // 'Bank Transfer BCA', 'PayPal'
  type              String   @db.VarChar(20) // 'MANUAL', 'AUTOMATIC'
  provider          String?  @db.VarChar(50) // 'midtrans', null (for manual)
  
  logoUrl           String?  @map("logo_url") @db.Text
  isEnabled         Boolean  @default(true) @map("is_enabled")
  description       String?  @db.Text // Simple instructions
  
  // For Manual Payments: What details to show user? (Bank, PayPal email, etc)
  manualPaymentDetails ManualPaymentDetail[]
  
  createdAt         DateTime @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt         DateTime @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("payment_methods")
}

// Details for Manual Transfers (Bank, PayPal, Western Union, etc)
model ManualPaymentDetail {
  id                String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  paymentMethodId   String   @map("payment_method_id") @db.Uuid
  
  // Generic fields for flexibility
  providerName      String   @map("provider_name") @db.VarChar(100) // 'BCA', 'PayPal', 'Western Union'
  accountNumber     String   @map("account_number") @db.VarChar(100) // Account No, or Email, or Phone
  accountHolder     String   @map("account_holder") @db.VarChar(100) // Name of owner
  
  instructionText   String?  @map("instruction_text") @db.Text // "Send to this email...", "Include ref..."
  
  paymentMethod     PaymentMethod @relation(fields: [paymentMethodId], references: [id], onDelete: Cascade)
  
  @@map("manual_payment_details")
}
```

### 3.2. Orders & Transactions
The core payment logic.

```prisma
model PaymentIntent {
  id                   String              @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  userId               String              @map("user_id") @db.Uuid
  participantId        String?             @map("participant_id") @db.Uuid
  
  amount               Decimal             @db.Decimal(12, 2)
  currency             String              @default("IDR") @db.VarChar(3)
  status               PaymentIntentStatus @default(REQUIRES_PAYMENT_METHOD) // PROCESSING, SUCCEEDED...
  
  // Context Persistence
  // Stores "program_id", "pricing_tier_id", "application_id", "program_name"
  // Allows Admin Dashboard to filter payments by Program without hard FKs to the Program Service
  metadata             Json?               @default("{}") @db.JsonB
  
  transactions         PaymentTransaction[]
  
  createdAt            DateTime            @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime            @updatedAt @map("updated_at") @db.Timestamptz(6)

  @@map("payment_intents")
}

model PaymentTransaction {
  id                   String                   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  paymentIntentId      String                   @map("payment_intent_id") @db.Uuid
  
  // Snapshots
  paymentMethodName    String?                  @map("payment_method_name") @db.VarChar(100)
  
  // Flow Type
  isManual             Boolean                  @default(false) @map("is_manual")
  
  // Gateway Data
  gatewayReferenceId   String?                  @map("gateway_reference_id") @db.Text
  gatewayResponse      Json?                    @map("gateway_response") @db.JsonB
  
  // Manual Data
  proofFileUrl         String?                  @map("proof_file_url") @db.Text
  adminNotes           String?                  @map("admin_notes") @db.Text
  reviewedBy           String?                  @map("reviewed_by") @db.Uuid // specific admin ID
  reviewedAt           DateTime?                @map("reviewed_at") @db.Timestamptz(6)
  
  status               PaymentTransactionStatus @default(PENDING) // PENDING, NEEDS_REVIEW, SUCCESS, FAILED
  
  createdAt            DateTime                 @default(now()) @map("created_at") @db.Timestamptz(6)
  updatedAt            DateTime                 @updatedAt @map("updated_at") @db.Timestamptz(6)

  paymentIntent        PaymentIntent            @relation(fields: [paymentIntentId], references: [id], onDelete: Cascade)

  @@map("payment_transactions")
}

model PaymentEvent {
  id                   String   @id @default(dbgenerated("uuid_generate_v4()")) @db.Uuid
  paymentIntentId      String?  @map("payment_intent_id") @db.Uuid
  paymentTransactionId String?  @map("payment_transaction_id") @db.Uuid
  
  eventType            String   @map("event_type") @db.VarChar(100) // 'intent.created', 'transaction.failed'
  payload              Json?    @db.JsonB
  
  // Audit
  ipAddress            String?  @map("ip_address") @db.Inet
  userAgent            String?  @map("user_agent") @db.Text
  idempotencyKey       String?  @map("idempotency_key") @db.Text
  requestId            String?  @map("request_id") @db.Text
  
  createdAt            DateTime @default(now()) @map("created_at") @db.Timestamptz(6)

  @@map("payment_events")
}
```

## 4. API Specification

### 4.1. Configuration
*   `GET /v1/methods`: Returns list of enabled method.
*   `GET /v1/config`: Returns public keys (Client Key) for the current context (Global or Program).

### 4.2. Checkout Flow
1.  `POST /v1/intents`: Create Intent.
    *   **Payload**: `{ amount: 50000, user_id: "...", metadata: { program_id: "xyz", tier_id: "abc" } }`
    *   **Result**: Returns `intent_id`.
2.  `POST /v1/intents/{id}/confirm`:
    *   Payload: `{ payment_method_id: "..." }`
    *   **If Automatic**: Returns `{ action: "redirect", url: "..." }` or `{ status: "success" }`.
    *   **If Manual**: Returns `{ action: "display_instructions", payment_details: { ... } }`. Transaction status -> `PENDING`.

### 4.3. Manual Proof
*   `POST /v1/transactions/{id}/proof`:
    *   Payload: `{ file_url: "https://..." }`
    *   Action: Updates Transaction `proofFileUrl`, sets status to `NEEDS_REVIEW`.
    *   Note: Requires the User to be the Intent owner.

### 4.4. Admin Review
*   `POST /v1/admin/transactions/{id}/approve`:
    *   Action: Sets Transaction `SUCCESS`, Intent `SUCCEEDED`.
*   `POST /v1/admin/transactions/{id}/reject`:
    *   Payload: `{ reason: "Invalid amount" }`
    *   Action: Sets Transaction `FAILED` (or `REJECTED`), Intent `REQUIRES_PAYMENT_METHOD` (User must retry).

## 5. Implementation Strategy
1.  **Schema**: Apply the new tables.
2.  **Seed**: Populate `PaymentMethod` with standard Manual options (BCA, PayPal) and Gateway options (Midtrans GoPay, CC).
3.  **Service Logic**:
    *   Check `PaymentMethod.type` before processing charge.
    *   If Manual, skip Gateway call, create Transaction directly.

## 6. Reliability & Retries

### 6.1. Retry Mechanism
Failures happen (Gateway downtime, Insufficient funds). The architecture handles this via the **Intent-Transaction** split:

1.  **Failure Scenario**:
    *   User attempts to pay using `Credit Card A`.
    *   Gateway returns `FAILED` (e.g. Insufficient Funds).
    *   **PaymentTransaction** is marked `FAILED`.
    *   **PaymentIntent** status reverts to/remains `REQUIRES_PAYMENT_METHOD`.

2.  **Retry Action**:
    *   Frontend sees the error.
    *   User selects a **New Method** (e.g. `Bank Transfer`) or tries a different card.
    *   Frontend calls `confirm` again on the **SAME** `PaymentIntent`.
    *   System creates a **NEW** `PaymentTransaction` linked to that Intent.

This ensures we have a history of failed attempts without duplicating the "Order".

### 6.2. Idempotency
To prevent double-charging (e.g. User double-clicks "Pay"), we use `Idempotency-Key`.

*   **Header**: `Idempotency-Key: <UUID>` (Generated by Frontend per attempt)
*   **Storage**: We store this key in the `payment_events` table (or Redis cache).
*   **Logic**:
    1.  Frontend generates a UUID when the user lands on the checkout page (or clicks Pay).
    2.  Frontend sends this key in the header of `POST /confirm`.
    3.  Backend checks if this Key exists.
        *   **If Exists**: Return the *existing* Transaction result immediately. Do NOT call Gateway.
        *   **If New**: Proceed to create Transaction and call Gateway.

---

## 7. Implementation Guide

### 7.1. Database & Initial Setup
1.  **Schema Update**: Open `schema.prisma`. Copy the ENUMs and Models from Section 3.
2.  **Migration**: Run `npx prisma migrate dev --name init_payment_system`.
3.  **Seed Data**: Create a seed script to insert `PaymentGatewayConfig` (Sandbox keys) and `PaymentMethod` (e.g., 'manual_bca', 'midtrans_gopay').

### 7.2. Payment Service Logic (Backend)
1.  **Structs**: Create Go structs for the new models.
2.  **Repository**: Implement `CreateIntent`, `CreateTransaction` in the Data Access Layer.
3.  **Gateway Interface**: Create a `GatewayProvider` interface (Charge, Refund) so we can swap Midtrans/Xendit easily.
    *   *Tip*: Start with a `MockProvider` that always returns Success to test the flow without API keys.

### 7.3. Client-Side Integration (Frontend Requirements)
Even though the Payment Service is a backend API, the Frontend (Next.js Application) acts as the **Consumer** and must implement the following:
1.  **Checkout UI**: Dynamically render payment buttons based on `GET /v1/payment-methods`.
2.  **Status Handling**: Build a listener/poller for `PaymentIntent.status`.
    *   If `REQUIRES_PAYMENT_METHOD`: Show the payment options again (or the retry screen).
    *   If `PROCESSING`: Show a spinner or "Waiting for Payment" screen (especially for VAs).
3.  **Tokenization**: Implement the Gateway SDKs (as described in Section 1.2) to convert Card Numbers -> Tokens *before* calling the API.

## 8. Glossary & Key Concepts

*   **Tokenization**: The process of exchanging sensitive card data (PAN) for a secure "Token" string on the Client Side. We send the Token to our server, not the Card Number.
*   **PaymentIntent**: The "Bill" or "Order". It says "User X owes $50". It persists until paid.
*   **PaymentTransaction**: The "Attempt". It says "User X tried to pay the Bill using Visa". A Bill can have many Attempts (if some fail).
*   **Idempotency**: The property that doing something twice yields the same result as doing it once. Crucial for payments to avoid double-charging.
*   **Webhook**: A notification sent from the Gateway to *our* server when a payment status changes (e.g., "User finally transferred the money").

## 9. Edge Cases Breakdown

| Scenario | Expected Behavior |
| :--- | :--- |
| **Gateway Timeout** | API returns 504. The Transaction exists in DB as `PENDING`. Background job checks status later. |
| **User Close Window** | If they closed *after* entering OTP, Webhook will eventually mark it `SUCCESS`. |
| **Double Click Pay** | Idempotency Key catches the second click. Returns the result of the first click. |
| **Partial Payment** | Not supported. Intent Amount must match Transaction Amount exactly. |
| **Over Payment** | Handled manually by Support. Gateway usually accepts it, Webhook marks `SUCCESS`. |

## 10. Testing Strategy

1.  **Unit Tests**: Test the Idempotency logic. (Send same key twice, assert DB only has 1 record).
2.  **Integration Tests**: Use the `MockProvider`.
3.  **End-to-End**:
    *   Use **Midtrans Simulator** (Sandbox).
    *   Test "Happy Path" (Credit Card Success).
    *   Test "Sad Path" (Credit Card Denied).
    *   Test "Manual Path" (Upload a random image as proof, Admin approves).

