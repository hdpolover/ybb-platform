# File Service - Enhanced Documentation

## Overview

The YBB File Service is a comprehensive Python microservice built with FastAPI that provides:

1. **File Upload/Download** - MinIO S3-compatible object storage
2. **Excel Export** - Generate formatted Excel reports
3. **PDF Generation** - Create receipts, offer letters, and documents
4. **Certificate Generation** - Digital certificates with QR code verification

## Architecture

```
app/
├── domain/                    # Business logic layer
│   ├── entities/              # Domain entities (File)
│   ├── repositories/          # Repository interfaces
│   ├── services/              # Service interfaces
│   └── exceptions/            # Domain exceptions
├── application/               # Use cases layer
│   ├── commands/              # Write operations
│   ├── queries/               # Read operations
│   └── dto/                   # Data transfer objects
├── infrastructure/            # Technical implementation
│   ├── persistence/           
│   │   ├── postgres/          # PostgreSQL repository
│   │   └── in_memory/         # In-memory repository (testing)
│   ├── storage/               # MinIO storage implementation
│   └── processors/            # Document generation
│       ├── excel_export.py    # Excel report generator
│       ├── pdf_generator.py   # PDF document generator
│       └── certificate_generator.py  # Certificate generator
└── presentation/              # API layer
    ├── api/routes/            # REST endpoints
    └── dependencies/          # Dependency injection
```

## Features

### 1. File Storage
- Upload files to MinIO (S3-compatible)
- Download with presigned URLs
- Brand and user-scoped storage
- File type validation
- File size limits

### 2. Excel Export
Generate professional Excel reports:
- **Participant Reports** - List of program participants
- **Payment Reports** - Financial transaction reports with totals
- **Custom Reports** - Flexible data export with custom headers

Features:
- Formatted headers with colors
- Auto-column sizing
- Cell borders and styling
- Metadata (generation date, totals)

### 3. PDF Generation
Create PDF documents:
- **Payment Receipts** - Formatted transaction receipts
- **Offer Letters** - Admission/acceptance letters
- **Custom PDFs** - Template-based generation

Features:
- Professional formatting
- Table layouts
- Custom styling
- Template support (Jinja2)

### 4. Certificate Generation
Generate digital certificates:
- **Completion Certificates** - Program completion
- **Participation Certificates** - Event participation

Features:
- High-resolution (300 DPI) PNG images
- Customizable templates
- QR code for verification
- Unique verification hash
- Professional design with borders

## API Endpoints

### File Operations
```
POST   /api/v1/files/upload          # Upload file
GET    /api/v1/files/{file_id}       # Get file with presigned URL
GET    /api/v1/files/health           # Health check
```

### Excel Export
```
POST   /api/v1/documents/export/participants     # Export participant list
POST   /api/v1/documents/export/payments         # Export payment report
POST   /api/v1/documents/export/custom           # Export custom report
```

### PDF Generation
```
POST   /api/v1/documents/generate/receipt        # Generate receipt
POST   /api/v1/documents/generate/offer-letter   # Generate offer letter
```

### Certificate Generation
```
POST   /api/v1/documents/generate/certificate    # Generate certificate
GET    /api/v1/documents/verify/{hash}           # Verify certificate
GET    /api/v1/documents/health                  # Health check
```

## Installation

### 1. Install Dependencies

```bash
cd services/file-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install -r requirements.txt
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and configure:

```env
# MinIO Configuration
MINIO_ENDPOINT=localhost:9000
MINIO_ACCESS_KEY=minioadmin
MINIO_SECRET_KEY=minioadmin
MINIO_SECURE=false

# PostgreSQL Configuration
DATABASE_URL=postgresql://ybb_user:ybb_password@localhost:5432/ybb_files_db

# Certificate Configuration
CERTIFICATE_SIGNING_KEY=your-secret-signing-key
CERTIFICATE_VERIFICATION_URL=https://verify.ybb.org

# Service Configuration
SERVICE_PORT=8001
```

### 3. Database Setup

Run the migration to create the files table:

```bash
psql -U ybb_user -d ybb_files_db -f ../../database/migrations/008_create_files_table.sql
```

Or with Docker:

```bash
docker exec -i ybb-postgres psql -U ybb_user -d ybb_files_db < database/migrations/008_create_files_table.sql
```

### 4. Run the Service

**Standalone:**
```bash
uvicorn app.main:app --host 0.0.0.0 --port 8001 --reload
```

**With Docker Compose:**
```bash
docker-compose up file-service
```

## Usage Examples

### 1. Upload a File

```bash
curl -X POST "http://localhost:8001/api/v1/files/upload" \
  -F "file=@document.pdf" \
  -F "user_id=user123" \
  -F "brand_id=ybb" \
  -F "bucket=documents"
```

Response:
```json
{
  "file": {
    "id": "abc-123",
    "filename": "abc-123.pdf",
    "original_filename": "document.pdf",
    "storage_path": "ybb/user123/abc-123.pdf",
    "uploaded_at": "2025-12-01T10:00:00"
  },
  "message": "File uploaded successfully"
}
```

### 2. Export Participant Report

```bash
curl -X POST "http://localhost:8001/api/v1/documents/export/participants" \
  -H "Content-Type: application/json" \
  -d '{
    "program_name": "YBB 2025",
    "participants": [
      {
        "name": "John Doe",
        "email": "john@example.com",
        "phone": "+62812345678",
        "status": "Active",
        "registration_date": "2025-01-15"
      }
    ]
  }' \
  --output participants_ybb_2025.xlsx
```

### 3. Generate Payment Receipt

```bash
curl -X POST "http://localhost:8001/api/v1/documents/generate/receipt" \
  -H "Content-Type: application/json" \
  -d '{
    "transaction_data": {
      "receipt_number": "RCP-2025-001",
      "transaction_id": "TXN-ABC123",
      "date": "2025-12-01",
      "payer_name": "John Doe",
      "payer_email": "john@example.com",
      "payer_phone": "+62812345678",
      "description": "Program Registration Fee",
      "amount": 5000000,
      "payment_method": "Bank Transfer",
      "status": "PAID"
    }
  }' \
  --output receipt.pdf
```

### 4. Generate Certificate

```bash
curl -X POST "http://localhost:8001/api/v1/documents/generate/certificate" \
  -H "Content-Type: application/json" \
  -d '{
    "certificate_type": "completion",
    "participant_data": {
      "name": "John Doe",
      "email": "john@example.com"
    },
    "program_data": {
      "name": "Young Business Bootcamp 2025",
      "completion_date": "December 1, 2025"
    }
  }' \
  --output certificate.png
```

### 5. Export Payment Report

```bash
curl -X POST "http://localhost:8001/api/v1/documents/export/payments" \
  -H "Content-Type: application/json" \
  -d '{
    "program_name": "YBB 2025",
    "start_date": "2025-01-01",
    "end_date": "2025-12-31",
    "payments": [
      {
        "date": "2025-01-15",
        "participant_name": "John Doe",
        "amount": 5000000,
        "payment_method": "Bank Transfer",
        "status": "Paid",
        "transaction_id": "TXN-001",
        "reference": "REF-001"
      }
    ]
  }' \
  --output payments_report.xlsx
```

## Integration with API Gateway

The file service integrates with the NestJS API Gateway:

```typescript
// In API Gateway
@Post('reports/participants')
async exportParticipants(@Body() dto: ExportParticipantsDto) {
  const response = await this.httpService.post(
    `${FILE_SERVICE_URL}/api/v1/documents/export/participants`,
    dto
  );
  return response.data;
}
```

## Certificate Verification

Certificates include:
1. **QR Code** - Links to verification URL
2. **Verification Hash** - Unique 16-character hash
3. **Verification URL** - `{CERTIFICATE_VERIFICATION_URL}/verify/{hash}`

To verify a certificate:
```bash
curl "http://localhost:8001/api/v1/documents/verify/abc123def456"
```

## Database Schema

### Files Table
```sql
CREATE TABLE files (
    id VARCHAR(36) PRIMARY KEY,
    filename VARCHAR(255) NOT NULL,
    original_filename VARCHAR(255) NOT NULL,
    file_type VARCHAR(50) NOT NULL,
    mime_type VARCHAR(100) NOT NULL,
    file_size INTEGER NOT NULL,
    storage_path VARCHAR(500) NOT NULL,
    bucket VARCHAR(100) NOT NULL,
    user_id VARCHAR(36) NOT NULL,
    brand_id VARCHAR(50) NOT NULL,
    metadata JSONB,
    uploaded_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE,
    deleted_at TIMESTAMP WITH TIME ZONE,
    is_deleted BOOLEAN DEFAULT FALSE,
    document_type VARCHAR(50),
    generated BOOLEAN DEFAULT FALSE,
    template_id VARCHAR(36),
    version INTEGER DEFAULT 1
);
```

### Certificate Verifications Table
```sql
CREATE TABLE certificate_verifications (
    id SERIAL PRIMARY KEY,
    verification_hash VARCHAR(32) UNIQUE NOT NULL,
    file_id VARCHAR(36) REFERENCES files(id),
    participant_name VARCHAR(255) NOT NULL,
    program_name VARCHAR(255) NOT NULL,
    issue_date DATE NOT NULL,
    certificate_type VARCHAR(50) NOT NULL,
    verified_count INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE,
    last_verified_at TIMESTAMP WITH TIME ZONE
);
```

## Development

### Run Tests
```bash
pytest tests/
```

### Code Style
```bash
black app/
flake8 app/
```

### Type Checking
```bash
mypy app/
```

## Production Deployment

### 1. Update Environment Variables
- Change `MINIO_SECURE` to `true`
- Use production database URL
- Set strong `CERTIFICATE_SIGNING_KEY`
- Configure proper `CERTIFICATE_VERIFICATION_URL`

### 2. Use Production Dockerfile
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app/ ./app/
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
```

### 3. Security Considerations
- Enable HTTPS (MINIO_SECURE=true)
- Use strong signing keys
- Implement authentication middleware
- Rate limiting
- File size limits
- Virus scanning

## Future Enhancements

- [ ] Image processing (resize, compress, thumbnails)
- [ ] Batch certificate generation
- [ ] Custom certificate templates
- [ ] Email integration (send documents)
- [ ] File versioning
- [ ] Audit logging
- [ ] Advanced PDF templates with WeasyPrint
- [ ] Digital signatures for PDFs
- [ ] Watermarking
- [ ] OCR for uploaded documents

## Troubleshooting

### Common Issues

**1. Font not found error in certificates**
- Update font path in `certificate_generator.py`
- Install system fonts or provide custom font files

**2. MinIO connection error**
- Verify MinIO is running: `docker ps | grep minio`
- Check endpoint configuration
- Ensure network connectivity

**3. Database connection error**
- Run migration: `008_create_files_table.sql`
- Verify PostgreSQL is running
- Check DATABASE_URL

**4. Import errors**
- Ensure all dependencies are installed: `pip install -r requirements.txt`
- Activate virtual environment

## Support

For issues or questions:
- Check logs: `docker logs ybb-file-service`
- Review error messages
- Verify environment configuration
- Test endpoints with health checks

## License

Part of the YBB Platform project.
