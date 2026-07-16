# Payment Service Documentation Guide

Welcome to the Payment Service documentation. This guide lists the recommended reading order to understand the architecture, API contracts, and integration details.

## 📚 Recommended Reading Order

### 1. The Master Plan & Architecture
**Start Here:** [CUSTOM_PAYMENT_FLOW.md](CUSTOM_PAYMENT_FLOW.md)
*   **What it covers:** The high-level 3-Tier Architecture (Frontend <-> API <-> Payment), the "Security Triangle" concept, and the complete Database Schema (Prisma).
*   **Who should read it:** Everyone (Frontend, Backend, Product).

### 2. Visualizing the Flow
**Read Next:** [PAYMENT_GATEWAY_JOURNEY.md](PAYMENT_GATEWAY_JOURNEY.md)
*   **What it covers:** Sequence diagrams showing exactly what happens when a user clicks "Pay" and how Webhooks are processed asynchronously.
*   **Key Concept:** The "Synchronous vs Asynchronous" duality of payments.

### 3. API Specifications (The "Contract")
**For Implementation:** [API_CONTRACT.md](API_CONTRACT.md)
*   **What it covers:** The strict JSON payloads, endpoints, and error codes used by:
    *   **Frontend Developers**: Public payment flows mediated by the Main API Service.
    *   **Backend Developers**: Internal Payment Service APIs under `/api/v1/*` plus the direct public webhook endpoint.

### 4. Midtrans Integration Details
**For Backend Integration:** [MIDTRANS_SPEC.md](MIDTRANS_SPEC.md)
*   **What it covers:** The specific JSON payloads sent to Midtrans Core API (`/v2/charge`), how to map our internal payment codes to Midtrans types, and the mandatory Signature Key verification logic.

### 5. Events & Monitoring
**For DevOps & Infrastructure:** [EVENTS_AND_MONITORING.md](EVENTS_AND_MONITORING.md)
*   **What it covers:** Definition of RabbitMQ events (`payment.succeeded`) consumed by the Notification Service, and the Prometheus `/metrics` schema.

---

## 📂 Quick Links

| Topic | File | Description |
| :--- | :--- | :--- |
| **Database** | [`CUSTOM_PAYMENT_FLOW.md`](CUSTOM_PAYMENT_FLOW.md#3-database-schema-restructuring) | Prisma Schema definitions (PaymentIntent, Transaction). |
| **Auth** | [`API_CONTRACT.md`](API_CONTRACT.md#31-security--authentication) | Service-to-Service Keys (`X-Internal-Service-Key`). |
| **Webhooks** | [`MIDTRANS_SPEC.md`](MIDTRANS_SPEC.md#41-webhook-notification) | Direct gateway-to-payment webhook flow and signature verification. |
| **Diagrams** | [`PAYMENT_GATEWAY_JOURNEY.md`](PAYMENT_GATEWAY_JOURNEY.md#11-sequence-diagram) | Mermaid charts for Charge & Webhook flows. |

## 🗑 Legacy Documentation
Old documentation (Swagger/Go docs generated from previous prototypes) has been moved to:
`ybb-platform/legacy_archive/services/payment/old_docs/`
