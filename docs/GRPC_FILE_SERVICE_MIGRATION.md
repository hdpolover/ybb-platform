# gRPC Migration Plan: API Service <-> File Service

**Status**: Planning
**Date**: January 23, 2026

## 1. Overview
The goal is to implement gRPC communication between the **API Service** (NestJS) and the **File Service** (Python) to improve performance, particularly for large file handling, and type safety.

This migration will be **gradual**. We will introduce gRPC alongside the existing REST API. Both protocols will be active simultanously ("side-by-side") to ensure backward compatibility and allow for safe testing.

## 2. Implementation Strategy

### Phase 1: Preparation & Definition
- [ ] Create a `protos/` directory (shared or copied to both services).
- [ ] Define `file_service.proto` with service methods (e.g., `UploadFile`, `GetFile`, `DeleteFile`).

### Phase 2: File Service (Python Server)
- [ ] Add gRPC dependencies (`grpcio`, `grpcio-tools`) to `requirements.txt`.
- [ ] Generate Python gRPC code from `.proto`.
- [ ] Implement the `FileServiceServicer` class.
- [ ] specific gRPC server entry point (different port, e.g., 50052).
- [ ] Update `Dockerfile` to expose the new gRPC port.
- [ ] Ensure it runs alongside the existing REST app (using a supervisor or separate process if needed, or just a separate entrypoint for now for testing).

### Phase 3: API Service (NestJS Client)
- [ ] Add gRPC dependencies to `package.json`.
- [ ] Configure `ClientsModule` in NestJS to connect to the File Service via gRPC.
- [ ] Create a `FileGrpcService` wrapper to abstract the gRPC calls.
- [ ] Expose a test endpoint (e.g., `/files/grpc-test`) to invoke the gRPC logic manually.

### Phase 4: Performance Comparison
- [ ] Create a benchmark script/task.
- [ ] Measure **Latency** (TTFB, Total Time) for small vs. large files.
- [ ] Measure **Throughput** (Req/sec).
- [ ] Measure **Resource Usage** (CPU/RAM) during load.

## 3. Architecture Comparison

| Feature | Current (REST) | New (gRPC) |
| :--- | :--- | :--- |
| **Protocol** | HTTP/1.1 (JSON) | HTTP/2 (Protobuf) |
| **Payload definition** | Loose (JSON Schema/DTO) | Strict (.proto) |
| **Streaming** | Chunked Transfer (limited control) | Bidirectional Streaming |
| **Performance** | Higher overhead for binary data (Base64 or multipart) | Efficient binary serialization |

## 4. To-Do List

### Shared
- [ ] Define `file.proto`

### File Service (Python)
- [ ] `pip install grpcio grpcio-tools`
- [ ] Generate python proto code
- [ ] Implement `server.py` (gRPC)
- [ ] Update build/run scripts

### API Service (NestJS)
- [ ] `npm install @nestjs/microservices @grpc/grpc-js @grpc/proto-loader`
- [ ] Configure `ClientGrpc`
- [ ] Implement client adapter

### Verification
- [ ] Verify file upload via gRPC
- [ ] Verify file retrieval via gRPC
- [ ] Run benchmarks
