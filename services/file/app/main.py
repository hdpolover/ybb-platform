"""FastAPI application entry point."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_fastapi_instrumentator import Instrumentator
from app.presentation.api.routes import files, documents, images, media
from app.infrastructure.persistence.postgres.database import connect_db, disconnect_db
from app.middleware.cache_headers import CacheControlMiddleware
from app.infrastructure.telemetry.otel import init_telemetry
from app.infrastructure.telemetry.loki import init_loki_logging


app = FastAPI(
    title="YBB File Service",
    description="File upload/download, Excel export, PDF generation, and certificate generation service",
    version="2.0.0"
)

# Initialize Telemetry
init_telemetry(app, service_name="ybb-file")
init_loki_logging(service_name="ybb-file")

# Cache control middleware (must be before CORS)
app.add_middleware(CacheControlMiddleware)

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
app.include_router(images.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")

# Instrument Prometheus
Instrumentator().instrument(app).expose(app)


@app.on_event("startup")
async def startup_event():
    """Initialize database on startup."""
    await connect_db()


@app.on_event("shutdown")
async def shutdown_event():
    """Disconnect database on shutdown."""
    await disconnect_db()


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "YBB File Service",
        "version": "2.0.0",
        "status": "running",
        "features": {
            "file_storage": "MinIO S3-compatible storage",
            "image_upload": "Avatar, program images, banners with auto-processing",
            "excel_export": "Participant and payment reports",
            "pdf_generation": "Receipts and offer letters",
            "certificates": "Completion and participation certificates with QR verification"
        }
    }
