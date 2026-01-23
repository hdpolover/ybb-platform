# Payment Gateway Journey & Sequence

This document details the exact sequence of operations when a user attempts a payment, specifically focusing on **when** the Payment Service calls the Gateway Provider (Midtrans/Xendit).

## 1. The "Click Pay" Journey (Synchronous)

This flow describes what happens immediately after the user enters their credit card details or selects a Virtual Account method and clicks "Pay".

### 1.1. Sequence Diagram

```mermaid
sequenceDiagram
    participant User
    participant FE as Frontend (Next.js)
    participant GW_JS as Gateway JS SDK
    participant API as API Service
    participant PAY as Payment Service
    participant DB as Database
    participant GW_API as Gateway Core API

    Note over User, FE: User enters Card Details
    
    User->>FE: Clicks "Pay"
    
    rect rgb(240, 248, 255)
        Note right of FE: 1. Client-Side Tokenization
        FE->>GW_JS: Send Card Data
        GW_JS-->>FE: Return Verification Token (one-time use)
    end

    rect rgb(255, 250, 240)
        Note right of FE: 2. Backend Charge Request
        FE->>API: POST /intents/{id}/confirm
        API->>PAY: POST /internal/v1/intents/{id}/confirm
    end

    rect rgb(255, 255, 240)
        Note right of PAY: 3. Pre-Flight Checks
        PAY->>DB: Check Idempotency Key
        PAY->>DB: Validate Intent Status (must be REQUIRES_PAYMENT_METHOD)
    end

    rect rgb(240, 255, 240)
        Note right of PAY: 4. Transaction Creation
        PAY->>DB: Create PaymentTransaction (Status: PENDING)
        Note right of PAY: THIS is where the Attempt is recorded
    end

    rect rgb(255, 240, 240)
        Note right of PAY: 5. Gateway Call
        PAY->>GW_API: POST /charge (Server Key + Token + Amount)
        GW_API-->>PAY: Return Response (Success/Pending/Fail)
    end

    rect rgb(240, 255, 240)
        Note right of PAY: 6. Post-Flight Update
        PAY->>DB: Update PaymentTransaction (Status based on GW response)
        
        alt Payment Successful Immediately
            PAY->>DB: Update PaymentIntent = SUCCEEDED
        else Payment Pending (e.g. VA)
            PAY->>DB: Update PaymentIntent = PROCESSING
        else Payment Failed
            PAY->>DB: Update PaymentIntent = REQUIRES_PAYMENT_METHOD
        end
    end

    PAY-->>API: Return Result
    API-->>FE: Return JSON (Success or Redirect URL)
    FE-->>User: Show Success or "Check your Banking App"
```

### 1.2. Key Moments

1.  **Tokenization (Client-Side)**: We **never** touch raw credit card numbers on our server. The Frontend talks directly to the Gateway first to get a safe `Token`.
2.  **The "Commit" Point (Step 4)**: Before calling the Gateway, we **must** create a `PaymentTransaction` record with status `PENDING`.
    *   *Why?* If the server crashes *during* the Gateway call, we need a record that we *tried* so we can check the status later (reconciliation).
3.  **The Gateway Call (Step 5)**: This is the single synchronous HTTP call to Midtrans/Xendit Core API.
    *   We send the `Token` we got from the Frontend.
    *   We send our `PaymentTransaction.id` as the `order_id` (so the Gateway knows our reference).

## 2. The Webhook Journey (Asynchronous)

For many methods (Virtual Accounts, E-Wallets, some Cards), the initial response is just "Pending". The actual success comes later via Webhook.

### 2.1. Sequence Diagram

```mermaid
sequenceDiagram
    participant GW_API as Gateway (Server)
    participant API as API Service (Facade)
    participant PAY as Payment Service
    participant DB as Database

    Note over GW_API: User pays via Banking App

    GW_API->>API: POST /webhooks (Public Webhook)
    
    rect rgb(240, 248, 255)
        Note right of API: 1. Public Inception
        API->>API: Verify Signature (HMAC)
        API->>PAY: POST /internal/v1/webhook/handler
    end

    rect rgb(240, 255, 240)
        Note right of PAY: 2. Internal Processing
        PAY->>DB: Find PaymentTransaction by `order_id`
        PAY->>DB: Log to PaymentEvent (Audit)
    end

    rect rgb(255, 250, 240)
        Note right of PAY: 3. State Update
        
        alt Status = SETTLEMENT / CAPTURE
            PAY->>DB: Update PaymentTransaction = SUCCESS
            PAY->>DB: Update PaymentIntent = SUCCEEDED
            Note right of PAY: Unlock Program/Ticket for User
            
        else Status = EXPIRE / DENY
            PAY->>DB: Update PaymentTransaction = FAILED
            PAY->>DB: Update PaymentIntent = REQUIRES_PAYMENT_METHOD
            Note right of PAY: User must try again
        end
    end

    PAY-->>API: 200 OK
    API-->>GW_API: 200 OK (Ack)
```

## 3. Manual Payment Comparison

For Manual payments, the journey stops at Step 4 of the Synchronous flow.

1.  **User Clicks Pay**.
2.  **API Service** sees `PaymentMethod.type = MANUAL`.
3.  **Payment Service**:
    *   Creates `PaymentTransaction` (Status: `PENDING_REVIEW`).
    *   **Skips** Gateway Call.
    *   Returns generic instructions (`ManualPaymentDetail`) to Frontend.
4.  **User** transfers money offline.
5.  **User** uploads proof (New Flow: `POST /proof`).
6.  **Admin** reviews and manually triggers the "Webhook Journey" logic (Approve/Reject).

## 4. Error Analysis (The "Unhappy" Paths)

Developers must handle these scenarios gracefully.

| Scenario | Symptom | Action Needed |
| :--- | :--- | :--- |
| **User Cancelled** | User closes the Credit Card 3DS popup. | Gateway returns "Deny/Cancel". Mark Transaction `FAILED`. Show User "Payment Cancelled". |
| **Insufficient Funds** | Gateway returns 4xx error. | Mark Transaction `FAILED`. Show User "Card Declined". **DO NOT** Fail the Intent; let them try again. |
| **Network Timeout** | Our API times out waiting for Gateway. | Keep Transaction as `PENDING`. Background Job (Chronos) checks status later (Re-query Gateway API). |
| **Invalid Config** | Server Key is wrong/expired. | Log Error. Alert Devs. Return 500 to User. |

## 5. State Machine Transition Diagram

Visualizing how `PaymentIntent` and `PaymentTransaction` statuses interact.

```mermaid
stateDiagram-v2
    [*] --> IntentCreated
    
    state IntentCreated {
        [*] --> REQUIRES_PAYMENT_METHOD
    }

    state "User Tries Payment 1 (Failed)" as Attempt1 {
        REQUIRES_PAYMENT_METHOD --> TransactionCreated: Click Pay
        TransactionCreated --> TransactionFailed: Gateway Reject
        TransactionFailed --> REQUIRES_PAYMENT_METHOD: User sees error
    }

    state "User Tries Payment 2 (Success)" as Attempt2 {
        REQUIRES_PAYMENT_METHOD --> Transaction2Created: Click Pay Again
        Transaction2Created --> TransactionPending: Gateway Processing (VA)
        TransactionPending --> PROCESSING: Update Intent
        
        PROCESSING --> TransactionSuccess: Webhook Received
        TransactionSuccess --> SUCCEEDED: Unlock Feature
    }
    
    SUCCEEDED --> [*]
```

## 6. FAQ for Developers

**Q: Where do I find the Server Key?**
A: It's in the `payment_gateway_configs` table. Do NOT hardcode it in `.env` if we support multiple programs.

**Q: Can a User have two `PENDING` transactions?**
A: Ideally no. If they try to pay again while one is Pending, we should probably cancel the old one or warn them. But technically the DB allows it.

**Q: How do I test Webhooks locally?**
A: Use **Ngrok**. Run `ngrok http 3000`, put the ngrok URL in the Midtrans Dashboard. Or use the internal `POST /test/webhook` endpoint if you built the mock.

**Q: What if the Admin rejects a Manual Payment?**
A: The Transaction becomes `REJECTED`. The Intent goes back to `REQUIRES_PAYMENT_METHOD`. The user gets an email saying "Please upload a clearer photo".
