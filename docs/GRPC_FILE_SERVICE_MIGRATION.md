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
- [x] Verify file upload via gRPC
- [x] Verify file retrieval via gRPC
- [x] Run benchmarks

### Deployment / CI Updates (`Dokploy`)
To ensure deployments work correctly on Dokploy and other environments, we have updated the Dockerfiles.

**File Service (`services/file/Dockerfile`)**:
- Installs `grpcio-tools`.
- Generates Python gRPC code during build.
- Starts both Uvicorn (REST) and `grpc_main.py` (gRPC).

**API Service (`services/api/Dockerfile.prod`)**:
- Copies `src/protos` to `dist/src/protos` explicitly.
- Ensures `@grpc/grpc-js` and `@grpc/proto-loader` are in `package.json`.

**Note**: Since `file_service.proto` is shared, we should ideally use a submodule or a build script to sync it. For now, it is duplicated in:
1. `services/api/src/protos/file_service.proto`
2. `services/file/app/protos/file_service.proto`

**Action Item for Devs**: When updating `protos/file_service.proto`, manually copy it to both locations or run a sync script.

## 5. Benchmark Results (Initial)
**Date**: January 24, 2026
**File Size**: 10MB
**Environment**: Local Docker (macOS)

| Method | Total Time | Notes |
| :--- | :--- | :--- |
| **REST** | 13.65s | Uses Multipart/Form-Data, standard NestJS HttpService |
| **gRPC** | 9.42s | Uses HTTP/2 Streaming, NestJS gRPC Client |

**Result**: gRPC is **~31% faster** for 10MB file uploads even with in-memory buffering.

### Benchmark Results (Various Sizes)
**Date:** January 24, 2026
**Environment:** Local Docker -> DigitalOcean Spaces (SGP1)

| Size | REST | gRPC | Improvement |
| :--- | :--- | :--- | :--- |
| **0.1 MB** (Avatar) | 0.22s | 0.16s | **~30% faster** |
| **1 MB** (Photo/Doc) | 0.81s | 0.75s | **~7% faster** |
| **5 MB** (Asset) | 5.34s | 4.56s | **~15% faster** |
| **10 MB** (Large) | 7.20s | 5.66s | **~21% faster** |

### Analysis
- **Small Files (<1MB)**: gRPC's performance gain is noticeable (~30%) because the protocol overhead (establishing connections, parsing headers) is a larger percentage of the total time.
- **Medium Files (1-5MB)**: The difference narrows as the raw network transfer time to DigitalOcean dominates the total duration.
- **Scalability**: The "Piped Streaming" implementation ensures that gRPC memory usage remains constant (~64KB) even for large files, whereas the REST implementation linearly increases memory usage with file size.

### 5. Implementation Details (Optimized)
The final implementation uses **Piped Streaming** with `os.pipe` and threaded executions to minimize memory usage:
1.  **Metadata First**: The client sends file metadata (including size) in the first packet.
2.  **Piping**: The Python server creates an OS pipe (`r`, `w`).
3.  **Concurrency**:
    -   **Producer**: An async loop reads chunks from the gRPC stream and writes them to the pipe's write-end.
    -   **Consumer**: A background thread (non-blocking to the event loop) reads from the pipe's read-end and streams directly to DigitalOcean Spaces via `minio.put_object`.
4.  **No Buffering**: This architecture effectively removes the need to buffer the entire file in RAM, enabling constant memory usage (~64KB + buffers) regardless of file size.

### 6. Deployment Checklist
The **File Service** uses the `minio` Python client library to communicate with S3-compatible storage. In this project, the actual storage backend is **DigitalOcean Spaces** for all environments (Development, Staging, Production). References to "MinIO" in the code (e.g., `MinIOStorage` class) refer to the client implementation, not necessarily a self-hosted MinIO instance.

