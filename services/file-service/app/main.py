"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.presentation.api.routes import files, documents


app = FastAPI(
    title="YBB File Service",
    description="File upload/download, Excel export, PDF generation, and certificate generation service",
    version="2.0.0"
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure based on environment
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(files.router, prefix="/api/v1")
app.include_router(documents.router, prefix="/api/v1")


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "YBB File Service",
        "version": "2.0.0",
        "status": "running",
        "features": {
            "file_storage": "MinIO S3-compatible storage",
            "excel_export": "Participant and payment reports",
            "pdf_generation": "Receipts and offer letters",
            "certificates": "Completion and participation certificates with QR verification"
        }
    }
