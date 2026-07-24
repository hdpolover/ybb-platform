import asyncio

import grpc

from app.grpc_main import FileService
from app.protos import file_service_pb2


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
