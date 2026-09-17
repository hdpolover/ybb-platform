import asyncio
from io import BytesIO

import pytest

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


# ── Content type inference for generic/missing types ─────────────────────────
#
# Some Android pickers and browsers send an ordinary PDF or photo with an empty
# type, which reaches this handler as application/octet-stream. The allowlist
# used to reject those outright ("File type application/octet-stream not
# allowed"), which participants hit uploading their signed agreement letter.


class _RecordingStorage(_Storage):
    def __init__(self):
        self.calls = []

    async def upload(self, **kwargs):
        self.calls.append(kwargs)
        return "stored"


def _build_typed_command(filename: str, content_type: str, size: int = 4) -> UploadFileCommand:
    return UploadFileCommand(
        file_data=BytesIO(b"data"),
        filename=filename,
        content_type=content_type,
        size=size,
        user_id="user-1",
        brand_id="brand-1",
        bucket="signed-copies",
    )


@pytest.mark.parametrize(
    "filename,reported,expected",
    [
        ("signed.pdf", "application/octet-stream", "application/pdf"),
        ("SIGNED.PDF", "", "application/pdf"),
        ("letter.doc", "application/octet-stream", "application/msword"),
        (
            "letter.docx",
            "application/octet-stream",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ),
        ("page.jpg", "application/octet-stream", "image/jpeg"),
        ("page.JPEG", "", "image/jpeg"),
        ("page.png", "binary/octet-stream", "image/png"),
    ],
)
def test_upload_infers_type_from_extension_when_reported_type_is_generic(filename, reported, expected):
    storage = _RecordingStorage()
    handler = UploadFileHandler(storage, _Repo())

    file_dto = asyncio.run(handler.execute(_build_typed_command(filename, reported)))

    # The inferred type is what gets stored and served, not just what passes validation.
    assert file_dto.content_type == expected
    assert storage.calls[0]["content_type"] == expected


class _RecordingRepo(_Repo):
    def __init__(self):
        self.saved = []

    async def save(self, file_obj):
        self.saved.append(file_obj)
        return file_obj


def test_upload_classifies_and_persists_inferred_image_as_image():
    repo = _RecordingRepo()
    handler = UploadFileHandler(_RecordingStorage(), repo)

    asyncio.run(handler.execute(_build_typed_command("page.jpg", "application/octet-stream")))

    assert repo.saved[0].file_type == "image"
    assert repo.saved[0].mime_type == "image/jpeg"


@pytest.mark.parametrize("filename", ["payload.exe", "archive.zip", "noextension", "photo.heic"])
def test_upload_still_rejects_generic_type_with_unlisted_extension(filename):
    handler = UploadFileHandler(_RecordingStorage(), _Repo())

    with pytest.raises(InvalidFileTypeException) as exc_info:
        asyncio.run(handler.execute(_build_typed_command(filename, "application/octet-stream")))

    assert exc_info.value.content_type == "application/octet-stream"


def test_upload_does_not_override_a_specific_reported_type_with_the_extension():
    # A file that says it is a zip is not trusted to be a PDF because of its name.
    handler = UploadFileHandler(_RecordingStorage(), _Repo())

    with pytest.raises(InvalidFileTypeException) as exc_info:
        asyncio.run(handler.execute(_build_typed_command("signed.pdf", "application/zip")))

    assert exc_info.value.content_type == "application/zip"


def test_upload_inferred_type_still_gets_the_size_limit():
    handler = UploadFileHandler(_RecordingStorage(), _Repo())

    with pytest.raises(FileSizeLimitException):
        asyncio.run(
            handler.execute(
                _build_typed_command("signed.pdf", "application/octet-stream", size=10 * 1024 * 1024 + 1)
            )
        )
