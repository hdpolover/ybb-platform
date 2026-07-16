# Events & Monitoring Specification

This document defines how the Payment Service communicates asynchronously using RabbitMQ and how it exposes metrics for Prometheus.

## 1. Asynchronous Events (RabbitMQ)

The Payment Service is a **Producer** of domain events. It does not consume events in this version (unless we add async compensation later).

### 1.1. Connection Details
*   **Host**: `rabbitmq` (Internal Docker DNS)
*   **Port**: `5672`
*   **Credentials**: `guest`/`guest` (or via `RABBITMQ_URI` env var)
*   **Exchange Name**: `ybb.events` (Topic Exchange)
    *   *Note*: Ensure this exchange is declared. The Notification Service's queue (`notification_queue`) must be bound to this exchange with routing key `payment.#` or `payment.succeeded`.

### 1.2. Published Events

#### Event: `payment.succeeded`
Triggered when a Transaction moves to `SUCCESS`. The Notification Service consumes this to send the "Payment Successful" email.

*   **Routing Key**: `payment.succeeded`
*   **Payload (JSON)**:
    ```json
    {
      "order_id": "txn_uuid_v4",      // Reference ID from PaymentTransaction.id
      "amount": 150000,
      "currency": "IDR",
      "user_id": "user_123",          // For user lookup
      "email": "user@example.com",    // OPTIONAL: If known, saves a DB lookup
      "customer_name": "Hendra",      // OPTIONAL
      "program_name": "YBB 2026",     // From Metadata
      "payment_method": "BCA VA",
      "paid_at": "2026-01-23T10:00:00Z"
    }
    ```

#### Event: `payment.failed`
Triggered when a Transaction is explicitly denied or expired.

*   **Routing Key**: `payment.failed`
*   **Payload**:
    ```json
    {
      "order_id": "txn_uuid_v4",      // Reference ID from PaymentTransaction.id
      "reason": "Insufficient Funds",
      "email": "user@example.com"
    }
    ```

### 1.3. Integration with Notification Service
The Notification Service (NestJS) uses a custom `InboundMessageDeserializer` that maps the AMQP **Routing Key** to the NestJS **Event Pattern**.
*   **Contract**: You MUST set the RabbitMQ `routing_key` correctly. The JSON body type is flexible but must match the schema above.

---

## 2. Monitoring & Observability (Prometheus)

The Payment Service must expose an HTTP endpoint for scraping.

### 2.1. Scrape Config
*   **Endpoint**: `GET /metrics`
*   **Port**: `8002` (Internal Service Port)
*   **Format**: Standard Prometheus Text Format

### 2.2. Key Metrics to Record

#### A. Business Metrics (Counter)
Critical for Business Dashboards.

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `payment_intents_total` | Counter | `program_id`, `currency` | Total intents created. |
| `payment_transactions_total` | Counter | `status` (success/fail), `method` (bca, gopay) | Total payment attempts. |
| `payment_revenue_total` | Counter | `currency`, `program_id` | Sum of successful amounts. |

#### B. Technical Metrics
For SRE/DevOps.

| Metric Name | Type | Labels | Description |
| :--- | :--- | :--- | :--- |
| `http_request_duration_seconds` | Histogram | `handler`, `method`, `status` | Latency of API calls. |
| `http_requests_total` | Counter | `handler`, `code` | Traffic volume. |
| `midtrans_api_errors_total` | Counter | `endpoint` | Failures when calling Gateway. |

### 2.3. Health Checks
*   **Endpoint**: `GET /health`
*   **Response**: `200 OK` if DB is connected and RabbitMQ is reachable. `503` otherwise.

---

## 3. Implementation Plan

### 3.1. Go Libraries
*   **RabbitMQ**: `github.com/rabbitmq/amqp091-go`
*   **Metrics**: `github.com/prometheus/client_golang/prometheus`

### 3.2. Middleware
*   Implement a Gin/Echo middleware that wraps every request to record `http_request_duration_seconds`.
*   Implement a "Publisher Service" struct that initializes the RabbitMQ connection on startup and handles re-connection logic.

### 3.3. Alerts (Grafana)
*   **High Failure Rate**: If `payment_transactions_total{status="failed"}` > 10% of total over 5m.
*   **Zero Revenue**: If `payment_revenue_total` does not increase for 1 hour (during day time).
