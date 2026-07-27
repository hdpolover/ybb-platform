"""Tests for GetPresignedUrlInternalHandler — internal-only presign, no ownership check."""
from datetime import datetime
import asyncio

from app.application.queries.handlers.get_presigned_url_internal_handler import GetPresignedUrlInternalHandler
from app.application.queries.get_presigned_url_internal_query import GetPresignedUrlInternalQuery
from app.domain.entities.file import File, FileStatus
from app.domain.exceptions.file_exceptions import FileNotFoundException, FileCategoryNotAllowedException


class _Repo:
    def __init__(self, file_obj):
        self.file = file_obj

    async def find_by_storage_path(self, storage_path: str):
        if self.file and self.file.storage_path == storage_path:
            return self.file
        return None


class _PoisonStorage:
    """Fails loudly if get_presigned_url is reached for a rejected/missing file."""

    async def get_presigned_url(self, **kwargs):
        raise AssertionError("storage should not be touched when the file is rejected")


class _RecordingStorage:
    def __init__(self, url: str = "https://minio.internal/signed"):
        self.url = url
        self.calls = []

    async def get_presigned_url(self, bucket, object_name, expiry_seconds):
        self.calls.append({
            "bucket": bucket,
            "object_name": object_name,
            "expiry_seconds": expiry_seconds,
        })
        return self.url


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


def test_presigns_documents_category_with_file_row_bucket():
    storage_path = "dev/brand-1/users/user-1/documents/doc.pdf"
    file_obj = _build_file(storage_path, bucket="ybb")
    storage = _RecordingStorage()
    handler = GetPresignedUrlInternalHandler(_Repo(file_obj), storage)

    query = GetPresignedUrlInternalQuery(storage_path=storage_path, expiry_seconds=1800)
    result = asyncio.run(handler.execute(query))

    assert result.presigned_url == storage.url
    assert storage.calls == [{
        "bucket": "ybb",
        "object_name": storage_path,
        "expiry_seconds": 1800,
    }]
    assert result.expires_at_unix > 0


def test_presigns_signed_copies_category():
    storage_path = "dev/brand-1/programs/prog-1/signed-copies/loa.pdf"
    file_obj = _build_file(storage_path, bucket="ybb-loa")
    storage = _RecordingStorage()
    handler = GetPresignedUrlInternalHandler(_Repo(file_obj), storage)

    query = GetPresignedUrlInternalQuery(storage_path=storage_path)
    result = asyncio.run(handler.execute(query))

    assert result.presigned_url == storage.url
    assert storage.calls[0]["bucket"] == "ybb-loa"
    assert storage.calls[0]["object_name"] == storage_path


def test_uses_default_expiry_when_non_positive():
    storage_path = "dev/brand-1/users/user-1/documents/doc.pdf"
    file_obj = _build_file(storage_path)
    storage = _RecordingStorage()
    handler = GetPresignedUrlInternalHandler(_Repo(file_obj), storage)

    query = GetPresignedUrlInternalQuery(storage_path=storage_path, expiry_seconds=0)
    asyncio.run(handler.execute(query))

    assert storage.calls[0]["expiry_seconds"] == GetPresignedUrlInternalHandler.DEFAULT_EXPIRY_SECONDS


def test_rejects_non_private_category_gallery():
    storage_path = "dev/brand-1/programs/prog-1/gallery/photo.jpg"
    file_obj = _build_file(storage_path)
    handler = GetPresignedUrlInternalHandler(_Repo(file_obj), _PoisonStorage())

    query = GetPresignedUrlInternalQuery(storage_path=storage_path)
    try:
        asyncio.run(handler.execute(query))
        assert False, "Expected FileCategoryNotAllowedException"
    except FileCategoryNotAllowedException:
        assert True


def test_rejects_non_private_category_avatars():
    storage_path = "dev/brand-1/users/user-1/avatars/pic.png"
    file_obj = _build_file(storage_path)
    handler = GetPresignedUrlInternalHandler(_Repo(file_obj), _PoisonStorage())

    query = GetPresignedUrlInternalQuery(storage_path=storage_path)
    try:
        asyncio.run(handler.execute(query))
        assert False, "Expected FileCategoryNotAllowedException"
    except FileCategoryNotAllowedException:
        assert True


def test_raises_not_found_when_file_missing():
    handler = GetPresignedUrlInternalHandler(_Repo(None), _PoisonStorage())

    query = GetPresignedUrlInternalQuery(storage_path="dev/brand-1/users/user-1/documents/missing.pdf")
    try:
        asyncio.run(handler.execute(query))
        assert False, "Expected FileNotFoundException"
    except FileNotFoundException:
        assert True


def test_raises_not_found_when_file_is_deleted():
    storage_path = "dev/brand-1/users/user-1/documents/doc.pdf"
    file_obj = _build_file(storage_path)
    file_obj.is_deleted = True  # simulate a soft-deleted row surfacing (defensive check)
    handler = GetPresignedUrlInternalHandler(_Repo(file_obj), _PoisonStorage())

    query = GetPresignedUrlInternalQuery(storage_path=storage_path)
    try:
        asyncio.run(handler.execute(query))
        assert False, "Expected FileNotFoundException"
    except FileNotFoundException:
        assert True
