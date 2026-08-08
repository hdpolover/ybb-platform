import asyncio
from io import BytesIO

from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.commands.upload_file_command import UploadFileCommand
from app.domain.exceptions.file_exceptions import (
    FileSizeLimitException,
    InvalidFileTypeException,
    InvalidFilenameException,
)


class _Storage:
    async def upload(self, **kwargs):
        return "stored"

    def get_public_url(self, bucket, object_name):
        return "http://example.test/" + object_name


class _Repo:
    async def save(self, file_obj):
        return file_obj


def _build_command(filename: str) -> UploadFileCommand:
    return UploadFileCommand(
        file_data=BytesIO(b"data"),
        filename=filename,
        content_type="application/pdf",
        size=4,
        user_id="user-1",
        brand_id="brand-1",
    )


def test_upload_rejects_filename_over_255_chars():
    handler = UploadFileHandler(_Storage(), _Repo())
    command = _build_command("a" * 256 + ".pdf")

    try:
        asyncio.run(handler.execute(command))
        assert False, "Expected InvalidFilenameException"
    except InvalidFilenameException:
        assert True


def test_upload_accepts_filename_at_255_chars():
    handler = UploadFileHandler(_Storage(), _Repo())
    command = _build_command("a" * 251 + ".pdf")  # exactly 255 chars
    assert len(command.filename) == 255

    file_dto = asyncio.run(handler.execute(command))

    assert file_dto.original_filename == command.filename


def _build_image_command(size: int, content_type: str = "image/jpeg") -> UploadFileCommand:
    return UploadFileCommand(
        file_data=BytesIO(b"data"),
        filename="photo.jpg",
        content_type=content_type,
        size=size,
        user_id="user-1",
        brand_id="brand-1",
    )


def test_upload_rejects_image_over_reconciled_10mb_limit():
    # Reconciled image size policy: 10MB everywhere (matches
    # services/api/src/common/constants/index.ts MAX_FILE_SIZE and
    # CreateUploadUrlHandler.MAX_IMAGE_SIZE). A real phone photo (3-8MB) must
    # fit comfortably under this — the old 5MB cap here rejected ordinary
    # photos, which is exactly what broke participant photo uploads.
    handler = UploadFileHandler(_Storage(), _Repo())
    command = _build_image_command(10 * 1024 * 1024 + 1)

    try:
        asyncio.run(handler.execute(command))
        assert False, "Expected FileSizeLimitException"
    except FileSizeLimitException as e:
        assert e.max_size == 10 * 1024 * 1024


def test_upload_accepts_8mb_phone_photo():
    # A typical modern phone photo (well within the reconciled 10MB cap, but
    # over the old 5MB cap) must be accepted.
    handler = UploadFileHandler(_Storage(), _Repo())
    command = _build_image_command(8 * 1024 * 1024)

    file_dto = asyncio.run(handler.execute(command))

    assert file_dto.size == 8 * 1024 * 1024


def test_upload_rejects_unsupported_image_type_with_specific_message():
    handler = UploadFileHandler(_Storage(), _Repo())
    command = _build_image_command(1024, content_type="image/heic")

    try:
        asyncio.run(handler.execute(command))
        assert False, "Expected InvalidFileTypeException"
    except InvalidFileTypeException as e:
        assert e.content_type == "image/heic"
        assert "image/jpeg" in str(e)
