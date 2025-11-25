# File Service - Implementation Summary

## ✅ Completed Tasks

### 1. Docker Configuration Updated
- Changed MinIO volume from Docker volume to VPS folder path
- Configuration in `docker-compose.yml`:
  ```yaml
  volumes:
    - /var/ybb-storage:/data  # VPS production
    # - minio_data:/data       # Local development
  ```

### 2. File Service Built (Clean Architecture)

#### **Domain Layer** (`app/domain/`)
- **Entities**: `File` entity with validation methods
- **Repositories**: `IFileRepository` interface
- **Services**: `IStorageService` interface  
- **Exceptions**: Custom domain exceptions (FileNotFoundException, InvalidFileTypeException, etc.)

#### **Infrastructure Layer** (`app/infrastructure/`)
- **MinIO Storage**: Full S3-compatible storage implementation
  - Upload with auto bucket creation
  - Download
  - Delete
  - Presigned URLs (1 hour expiry)
- **In-Memory Repository**: For testing (replace with PostgreSQL later)

#### **Application Layer** (`app/application/`)
- **Commands**: `UploadFileCommand` + `UploadFileHandler`
- **Queries**: `GetFileQuery` + `GetFileHandler`
- **DTOs**: `FileDto`, `UploadFileResponseDto`
- **Validation**:
  - Images: JPEG, PNG, GIF, WebP (max 5MB)
  - Documents: PDF, Word, Excel (max 10MB)

#### **Presentation Layer** (`app/presentation/`)
- **FastAPI Routes**:
  - `POST /api/v1/files/upload` - Upload files
  - `GET /api/v1/files/{file_id}` - Get file with presigned URL
  - `GET /api/v1/files/health` - Health check
- **Error Handling**: HTTP status codes with detailed messages

### 3. MinIO Web Console
- Accessible at: **http://localhost:9001**
- Username: `minioadmin`
- Password: `minioadmin`
- Created buckets: `documents/`, `avatars/`, `applications/`

## 📁 VPS Storage Integration

### How It Works
```
Application → MinIO API (S3) → /var/ybb-storage (VPS folder)
             (Port 9000)        (physical storage)
```

### File Storage Structure
```
/var/ybb-storage/
├── documents/
│   └── {brand_id}/
│       └── {user_id}/
│           └── {file_id}.ext
├── avatars/
└── applications/
```

### Physical Storage
Files are stored as MinIO objects with metadata:
```
/var/ybb-storage/documents/ybb/user123/
└── 100f633a-3f2a-4325-9a0d-b50ab6aa66d9.md/
    └── xl.meta  (contains file + metadata)
```

## 🧪 Testing

### Start File Service
```bash
cd services/file-service
./venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

### Upload File
```bash
curl -X POST "http://localhost:8001/api/v1/files/upload" \
  -F "file=@README.md;type=application/pdf" \
  -F "user_id=user123" \
  -F "brand_id=ybb" \
  -F "bucket=documents"
```

**Response:**
```json
{
  "file": {
    "id": "100f633a-3f2a-4325-9a0d-b50ab6aa66d9",
    "filename": "100f633a-3f2a-4325-9a0d-b50ab6aa66d9.md",
    "original_filename": "README.md",
    "storage_path": "ybb/user123/100f633a-3f2a-4325-9a0d-b50ab6aa66d9.md",
    "uploaded_at": "2025-11-25T08:05:07.087812"
  },
  "message": "File uploaded successfully"
}
```

### Verify Physical Storage
```bash
docker exec ybb-minio mc ls local/documents/ybb/user123/
```

## 🚀 VPS Deployment

### 1. On Your VPS
```bash
# Create storage directory
sudo mkdir -p /var/ybb-storage
sudo chown -R 1000:1000 /var/ybb-storage

# Deploy with Docker Compose
docker-compose up -d minio file-service
```

### 2. Configuration
The file service automatically uses MinIO at `minio:9000` (Docker network).

Environment variables in `.env`:
```env
MINIO_ENDPOINT=minio:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false
```

### 3. Access Files
- **API**: Upload/download through FastAPI endpoints
- **Direct Access**: Files physically in `/var/ybb-storage/`
- **MinIO Console**: Web UI for bucket management

## 🔧 Features Implemented

- ✅ Brand-scoped file isolation (`{brand_id}/{user_id}/`)
- ✅ Content-type validation
- ✅ File size validation  
- ✅ Automatic bucket creation
- ✅ Presigned URLs for secure downloads
- ✅ Clean architecture (Domain → Application → Infrastructure → Presentation)
- ✅ Error handling with custom exceptions
- ✅ Health check endpoint
- ✅ VPS-ready configuration

## 📝 Next Steps

1. **Replace In-Memory Repository** with PostgreSQL for file metadata
2. **Add File Deletion** endpoint
3. **Implement File Listing** by user/brand
4. **Add Image Processing** (thumbnails, compression)
5. **Integrate with API Gateway** for authentication
6. **Add File Versioning** support
7. **Implement Virus Scanning** before storage

## 🐛 Bugs Fixed

1. ✅ MinIO `bucket_exists()` parameter naming
2. ✅ MinIO `presigned_get_object()` parameter naming  
3. ✅ BytesIO conversion for file upload
4. ✅ Python 3.14 compatibility (updated pydantic)

## 📚 Dependencies Installed

- fastapi >= 0.115.0
- uvicorn[standard] >= 0.32.0
- python-multipart >= 0.0.12
- minio >= 7.2.0
- python-dotenv >= 1.0.0
- pydantic >= 2.10.0
- pydantic-settings >= 2.6.0

All dependencies installed in virtual environment at `services/file-service/venv/`.
