# Service Communication Strategies

This document outlines the communication protocols used between the various services in the YBB Platform architecture. We utilize a hybrid approach combining **REST**, **gRPC**, and **RabbitMQ** to optimize for performance, type safety, and reliability.

## 1. Overview

| Protocol | Type | Primary Use Case |
| :--- | :--- | :--- |
| **REST (HTTP/JSON)** | Synchronous | Public-facing APIs, Webhooks, Browser communication. |
| **gRPC (Protobuf)** | Synchronous | Internal high-performance service-to-service calls. |
| **RabbitMQ (AMQP)** | Asynchronous | Event-driven logic (e.g., "Send Email after Payment"). |

## 2. Communication Map

### 2.1. Public / External Communication (REST)
*Standard HTTP/JSON is required here for compatibility with browsers and 3rd party providers.*

| Source (Client) | Target (Server) | Protocol | Rationale |
| :--- | :--- | :--- | :--- |
| **Admin Dashboard** (Next.js) | **API Service** (Gateway) | **REST** | Browsers speak JSON natively. Easy debugging in DevTools. |
| **YBB Program** (Next.js) | **API Service** (Gateway) | **REST** | Universal standard for frontend-backend communication. |
| **Payment Gateways** (Midtrans/Stripe) | **Payment Service** | **REST** | External providers send status updates via HTTP POST webhooks. |

### 2.2. Internal Synchronous Communication (gRPC)
*Used when Service A needs an immediate answer or data from Service B to fulfill a user request.*

| Source | Target | Protocol | Rationale |
| :--- | :--- | :--- | :--- |
| **API Service** | **Payment Service** | **gRPC** | **Low Latency**: Fetching payment status requires high speed.<br>**Type Safety**: Contracts are enforced at build time. |
| **API Service** | **File Service** | **gRPC** | **Streaming**: Uploading/downloading large files via gRPC streams is significantly more memory-efficient than buffering JSON. |

### 2.3. Internal Asynchronous Communication (RabbitMQ)
*Used for "fire-and-forget" tasks where the caller doesn't need to wait for the result.*

| Source | Target | Protocol | Rationale |
| :--- | :--- | :--- | :--- |
| **Payment Service** | **Notification Service** | **RabbitMQ** | **Resilience**: If the email server is down, the payment should still succeed. The message waits in the queue until the service recovers. |
| **API Service** | **Notification Service** | **RabbitMQ** | **Decoupling**: User registration triggers a "Welcome" event. The API service doesn't care *how* that event is handled (email, SMS, etc.). |

---

## 3. Implementation Checklist

To achieve this architecture, services should be configured as follows:

### API Service (NestJS)
- **Server**: Exposes **REST** API (Port 4000) for frontends.
- **Client**: Connects to Payment/File services using **@GrpcClient**.
- **Client**: Publishes events to **RabbitMQ** for notifications.

### Payment Service (Go)
- **Server**: Exposes **gRPC** (Port 50051) for internal queries (Create Intent, Get Status).
- **Server**: Exposes **REST** (Port 8002) **only** for Webhooks callback endpoints.
- **Client**: Publishes "PaymentSuccess" events to **RabbitMQ**.

### File Service (Python)
- **Server**: Exposes **gRPC** (Port 50052) for file operations.
- **Note**: Python's gRPC implementation significantly improves creating/parsing large payloads compared to single-threaded JSON parsing.

### Notification Service (NestJS)
- **Server**: Consumes messages from **RabbitMQ**.
- **Note**: Unless a "View Email History" API is required, this service does not need an HTTP or gRPC server.

## 4. Performance Expectations (REST vs gRPC)

Switching internal traffic to gRPC is expected to yield:
- **~30-50% Reduction** in internal network latency.
- **~30% Reduction** in CPU usage on the API Gateway (due to removing JSON parsing overhead).
- **Significant Stability** improvements for large file uploads via streaming.
