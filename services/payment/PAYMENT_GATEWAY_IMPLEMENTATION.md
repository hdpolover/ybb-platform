# Payment Gateway Implementation Progress (Custom UI)

## Overview
This document tracks the progress of implementing the **Custom Payment UI** flow using Midtrans Core API. The goal is to allow the frontend to fully control the checkout experience (selecting methods, entering details) without redirecting to Midtrans Snap.

## Architecture Status

### 1. Payment Service (Backend)
- [x] **Gateway Integration (`midtrans_gateway.go`)**:
    - `ChargePayment` implemented using Core API.
    - Supports mapping `bca_va`, `permata_va`, `credit_card`, `gopay`, etc. to Midtrans types.
    - Handles specific metadata (VA numbers, deep links).
- [x] **Intent Management**:
    - `CreateIntent` is working (stores order in DB).
    - `ConfirmIntent` logic exists (calls Gateway Charge).
- [x] **Feature: Payment Methods**:
    - `GetPaymentMethods` RPC exists.
    - Returns active methods with fee calculation.
- [ ] **Missing**: `ProcessPayment` response is missing `metadata` (VA Number, Expiry Time). It only returns `ActionURL` and `ActionType`.

### 2. API Service (Gateway)
- [x] **Endpoints**:
    - `POST /payments/intents` (Created)
    - `POST /payments/intents/:id/confirm` (Created)
- [x] **gRPC Client**:
    - Methods wired up to Payment Service.

### 3. Frontend (Planned)
- To be implemented (out of scope for now, but API must support it).

## Required Changes

### 1. Protocol Buffers (`payment_service.proto`)
The `ProcessPaymentResponse` is currently insufficient for Virtual Accounts.
**Current:**
```protobuf
message ProcessPaymentResponse {
  string status = 1;
  string transaction_id = 2;
  ProcessPaymentAction action = 3;
}
```
**Required:**
We need to add a way to return arbitrary data like VA numbers.
```protobuf
message ProcessPaymentResponse {
  // ...
  map<string, string> metadata = 4; // To hold va_number, bank, expiration_time
}
```

### 2. Payment Service Logic (`server.go`)
- Update `ProcessPayment` to map `gatewayResp.Metadata` (which contains `va_number`) to the new proto response field.

### 3. API Service
- Update `ProcessPayment` handler to pass this new data to the frontend.

## Next Steps
1.  Update `payment_service.proto` to include `metadata` in `ProcessPaymentResponse`.
2.  Re-generate gRPC code.
3.  Update `ProcessPayment` in `payment_grpc_server.go` to populate this metadata.
4.  Update API Service to expose this to the frontend.
