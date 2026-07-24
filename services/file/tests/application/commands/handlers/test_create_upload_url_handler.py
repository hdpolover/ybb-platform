import asyncio

from app.application.commands.handlers.create_upload_url_handler import CreateUploadUrlHandler
from app.application.commands.create_upload_url_command import CreateUploadUrlCommand
from app.domain.exceptions.file_exceptions import InvalidFilenameException


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
