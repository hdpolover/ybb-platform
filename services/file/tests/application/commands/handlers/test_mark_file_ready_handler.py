from datetime import datetime
import asyncio

from app.application.commands.handlers.mark_file_ready_handler import MarkFileReadyHandler
from app.application.commands.mark_file_ready_command import MarkFileReadyCommand
from app.domain.entities.file import File, FileStatus
from app.domain.exceptions.file_exceptions import FileNotFoundException


class _Repo:
    def __init__(self, file_obj: File):
        self.file = file_obj
        self.saved = False

    async def find_by_id(self, file_id: str):
        if self.file.id == file_id:
            return self.file
        return None

    async def save(self, file_obj: File):
        self.saved = True
        self.file = file_obj
        return file_obj


class _Storage:
    def __init__(self, exists: bool = True):
        self._exists = exists

    async def exists(self, bucket: str, object_name: str):
        return self._exists


def _build_file() -> File:
    return File(
        id="file-1",
        filename="doc.pdf",
        original_filename="doc.pdf",
        file_type="document",
        mime_type="application/pdf",
        file_size=100,
        storage_path="dev/brand-1/users/user-1/documents/doc.pdf",
        bucket="ybb",
        user_id="user-1",
        brand_id="brand-1",
        uploaded_at=datetime.utcnow(),
        status=FileStatus.PROCESSING,
    )


def test_mark_ready_rejects_mismatched_user():
    file_obj = _build_file()
    handler = MarkFileReadyHandler(_Storage(exists=True), _Repo(file_obj))
    command = MarkFileReadyCommand(file_id="file-1", brand_id="brand-1", user_id="user-2")

    try:
        asyncio.run(handler.execute(command))
        assert False, "Expected FileNotFoundException"
    except FileNotFoundException:
        assert True


def test_mark_ready_succeeds_for_matching_user_and_brand():
    file_obj = _build_file()
    repo = _Repo(file_obj)
    handler = MarkFileReadyHandler(_Storage(exists=True), repo)
    command = MarkFileReadyCommand(file_id="file-1", brand_id="brand-1", user_id="user-1")

    result = asyncio.run(handler.execute(command))

    assert result.status == FileStatus.READY
    assert repo.saved is True


def test_mark_ready_succeeds_even_when_caller_brand_differs_from_file_brand():
    # Regression for fix/file-brand-attribution: a file's brand_id is derived from its
    # PROGRAM at creation time, not the uploader's JWT home brand. A multi-brand admin's
    # JWT brand_id can legitimately differ from the file's brand_id — ownership is by
    # user_id only, so this must still succeed.
    file_obj = _build_file()
    repo = _Repo(file_obj)
    handler = MarkFileReadyHandler(_Storage(exists=True), repo)
    command = MarkFileReadyCommand(file_id="file-1", brand_id="some-other-brand", user_id="user-1")

    result = asyncio.run(handler.execute(command))

    assert result.status == FileStatus.READY
    assert repo.saved is True
