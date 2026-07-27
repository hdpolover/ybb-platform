from datetime import datetime
import asyncio

import grpc

from app.grpc_main import FileService
from app.protos import file_service_pb2
from app.application.queries.handlers.get_presigned_url_internal_handler import GetPresignedUrlInternalHandler
from app.domain.entities.file import File, FileStatus


class _FakeContext:
    """Records the abort call instead of actually tearing down a real RPC."""

    def __init__(self):
        self.aborted_with = None

    async def abort(self, code, details):
        self.aborted_with = (code, details)


class _PoisonStorage:
    """Fails loudly if GetPresignedUploadUrl reaches storage after an invalid filename."""

    async def get_presigned_upload_url(self, **kwargs):
        raise AssertionError("storage should not be touched when the filename is rejected")


class _PoisonRepo:
    """Fails loudly if GetPresignedUploadUrl tries to save a File row after rejection."""

    async def save(self, file_obj):
        raise AssertionError("repo.save should not be called when the filename is rejected")


class _WorkingStorage:
    async def get_presigned_upload_url(self, **kwargs):
        return "http://example.test/upload"


class _WorkingRepo:
    async def save(self, file_obj):
        return file_obj


def _build_service(storage, repo) -> FileService:
    # Bypass FileService.__init__ (it wires real Postgres/MinIO/RabbitMQ dependencies via
    # the DI container) and set only what GetPresignedUploadUrl touches.
    service = object.__new__(FileService)
    service.storage = storage
    service.repo = repo
    return service


def test_get_presigned_upload_url_rejects_filename_over_255_chars():
    service = _build_service(_PoisonStorage(), _PoisonRepo())
    request = file_service_pb2.GetPresignedUploadUrlRequest(
        filename="a" * 256 + ".pdf",
        content_type="application/pdf",
        user_id="user-1",
        brand_id="brand-1",
        bucket="documents",
    )
    context = _FakeContext()

    asyncio.run(service.GetPresignedUploadUrl(request, context))

    assert context.aborted_with is not None
    code, details = context.aborted_with
    assert code == grpc.StatusCode.INVALID_ARGUMENT
    assert "exceeds maximum of 255" in details


def test_get_presigned_upload_url_accepts_filename_at_255_chars():
    service = _build_service(_WorkingStorage(), _WorkingRepo())
    filename = "a" * 251 + ".pdf"  # exactly 255 chars
    assert len(filename) == 255
    request = file_service_pb2.GetPresignedUploadUrlRequest(
        filename=filename,
        content_type="application/pdf",
        user_id="user-1",
        brand_id="brand-1",
        bucket="documents",
    )
    context = _FakeContext()

    response = asyncio.run(service.GetPresignedUploadUrl(request, context))

    assert context.aborted_with is None
    assert response.upload_url == "http://example.test/upload"


# --- GetPresignedUrlInternal ---------------------------------------------------------

class _PresignRepo:
    def __init__(self, file_obj=None):
        self.file = file_obj

    async def find_by_storage_path(self, storage_path: str):
        if self.file and self.file.storage_path == storage_path:
            return self.file
        return None


class _PresignStorage:
    def __init__(self, url: str = "https://minio.internal/signed"):
        self.url = url

    async def get_presigned_url(self, bucket, object_name, expiry_seconds):
        return self.url


class _PoisonPresignStorage:
    async def get_presigned_url(self, **kwargs):
        raise AssertionError("storage should not be touched when the request is rejected")


def _build_file(storage_path: str, bucket: str = "ybb") -> File:
    return File(
        id="file-1",
        filename="doc.pdf",
        original_filename="doc.pdf",
        file_type="document",
        mime_type="application/pdf",
        file_size=100,
        storage_path=storage_path,
        bucket=bucket,
        user_id="user-1",
        brand_id="brand-1",
        uploaded_at=datetime.utcnow(),
        status=FileStatus.READY,
    )


def _build_presign_service(storage, repo) -> FileService:
    # Bypass FileService.__init__ (real Postgres/MinIO/RabbitMQ wiring) and set only
    # what GetPresignedUrlInternal touches.
    service = object.__new__(FileService)
    service.presign_internal_handler = GetPresignedUrlInternalHandler(
        file_repository=repo, storage_service=storage
    )
    return service


def test_get_presigned_url_internal_returns_signed_url_for_documents():
    storage_path = "dev/brand-1/users/user-1/documents/doc.pdf"
    file_obj = _build_file(storage_path)
    service = _build_presign_service(_PresignStorage(), _PresignRepo(file_obj))
    request = file_service_pb2.GetPresignedUrlInternalRequest(
        storage_path=storage_path, expiry_seconds=900
    )
    context = _FakeContext()

    response = asyncio.run(service.GetPresignedUrlInternal(request, context))

    assert context.aborted_with is None
    assert response.presigned_url == "https://minio.internal/signed"
    assert response.expires_at_unix > 0


def test_get_presigned_url_internal_rejects_non_private_category():
    storage_path = "dev/brand-1/programs/prog-1/gallery/photo.jpg"
    file_obj = _build_file(storage_path)
    service = _build_presign_service(_PoisonPresignStorage(), _PresignRepo(file_obj))
    request = file_service_pb2.GetPresignedUrlInternalRequest(storage_path=storage_path)
    context = _FakeContext()

    asyncio.run(service.GetPresignedUrlInternal(request, context))

    assert context.aborted_with is not None
    code, _details = context.aborted_with
    assert code == grpc.StatusCode.PERMISSION_DENIED


def test_get_presigned_url_internal_not_found_maps_to_not_found():
    service = _build_presign_service(_PoisonPresignStorage(), _PresignRepo(None))
    request = file_service_pb2.GetPresignedUrlInternalRequest(
        storage_path="dev/brand-1/users/user-1/documents/missing.pdf"
    )
    context = _FakeContext()

    asyncio.run(service.GetPresignedUrlInternal(request, context))

    assert context.aborted_with is not None
    code, _details = context.aborted_with
    assert code == grpc.StatusCode.NOT_FOUND
