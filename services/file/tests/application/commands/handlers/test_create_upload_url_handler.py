import asyncio

from app.application.commands.handlers.create_upload_url_handler import CreateUploadUrlHandler
from app.application.commands.create_upload_url_command import CreateUploadUrlCommand
from app.domain.exceptions.file_exceptions import FileSizeLimitException, InvalidFilenameException


class _Storage:
    async def get_presigned_upload_url(self, **kwargs):
        return "http://example.test/upload"

    def get_public_url(self, bucket, object_name):
        return "http://example.test/" + object_name


class _Repo:
    async def save(self, file_obj):
        return file_obj


def _build_command(filename: str) -> CreateUploadUrlCommand:
    return CreateUploadUrlCommand(
        filename=filename,
        content_type="application/pdf",
        size=4,
        user_id="user-1",
        brand_id="brand-1",
    )


def test_create_upload_url_rejects_filename_over_255_chars():
    handler = CreateUploadUrlHandler(_Storage(), _Repo())
    command = _build_command("a" * 256 + ".pdf")

    try:
        asyncio.run(handler.execute(command))
        assert False, "Expected InvalidFilenameException"
    except InvalidFilenameException:
        assert True


def test_create_upload_url_accepts_filename_at_255_chars():
    handler = CreateUploadUrlHandler(_Storage(), _Repo())
    command = _build_command("a" * 251 + ".pdf")  # exactly 255 chars
    assert len(command.filename) == 255

    response = asyncio.run(handler.execute(command))

    assert response.upload_url == "http://example.test/upload"


def _build_image_command(size: int) -> CreateUploadUrlCommand:
    return CreateUploadUrlCommand(
        filename="photo.jpg",
        content_type="image/jpeg",
        size=size,
        user_id="user-1",
        brand_id="brand-1",
    )


def test_create_upload_url_rejects_image_over_reconciled_10mb_limit():
    # Reconciled image size policy: 10MB everywhere (matches
    # UploadFileHandler.MAX_IMAGE_SIZE and services/api MAX_FILE_SIZE). This
    # was previously 20MB here, disagreeing with the other two enforcement
    # points.
    handler = CreateUploadUrlHandler(_Storage(), _Repo())
    command = _build_image_command(10 * 1024 * 1024 + 1)

    try:
        asyncio.run(handler.execute(command))
        assert False, "Expected FileSizeLimitException"
    except FileSizeLimitException as e:
        assert e.max_size == 10 * 1024 * 1024
