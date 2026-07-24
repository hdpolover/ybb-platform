import asyncio
from io import BytesIO

from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.commands.upload_file_command import UploadFileCommand
from app.domain.exceptions.file_exceptions import InvalidFilenameException


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
