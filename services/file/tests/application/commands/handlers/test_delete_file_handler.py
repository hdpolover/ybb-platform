"""Tests for DeleteFileHandler ownership scoping (audit M184).

The handler had no test file at all before this. It checked only brand_id, so a
caller authorised for programme A could delete a file belonging to programme B
in the same brand - a supported admin configuration, not a hypothetical one.

The nullable half is the part worth pinning: program_id is nullable and the
majority of real files have none (user avatars, payment-method icons, brand
logos), so a plain `file.program_id != command.program_id` check - which is what
the audit item prescribes - would make most of the library undeletable.
"""
import asyncio

import pytest

from app.application.commands.delete_file_command import DeleteFileCommand
from app.application.commands.handlers.delete_file_handler import DeleteFileHandler
from app.domain.exceptions.file_exceptions import FileNotFoundException


class _File:
    def __init__(self, brand_id, program_id):
        self.id = "file-1"
        self.brand_id = brand_id
        self.program_id = program_id
        self.bucket = "media"
        self.storage_path = "media/file-1.png"


class _Repo:
    def __init__(self, file):
        self._file = file
        self.deleted = []

    async def find_by_id(self, file_id):
        return self._file

    async def delete(self, file_id):
        self.deleted.append(file_id)


class _Storage:
    def __init__(self):
        self.removed = []

    async def delete(self, bucket, path):
        self.removed.append((bucket, path))


def _handler(file):
    repo = _Repo(file)
    storage = _Storage()
    return DeleteFileHandler(repo, storage), repo, storage


def test_deletes_a_file_belonging_to_the_named_programme():
    handler, repo, storage = _handler(_File("brand-1", "program-a"))

    asyncio.run(
        handler.execute(
            DeleteFileCommand(file_id="file-1", brand_id="brand-1", program_id="program-a")
        )
    )

    assert repo.deleted == ["file-1"]
    assert storage.removed == [("media", "media/file-1.png")]


def test_refuses_a_file_owned_by_a_different_programme_in_the_same_brand():
    """The actual vulnerability: brand matches, programme does not."""
    handler, repo, storage = _handler(_File("brand-1", "program-b"))

    with pytest.raises(FileNotFoundException):
        asyncio.run(
            handler.execute(
                DeleteFileCommand(file_id="file-1", brand_id="brand-1", program_id="program-a")
            )
        )

    assert repo.deleted == []
    # Nothing is removed from storage either - the refusal must come first.
    assert storage.removed == []


def test_still_deletes_a_file_that_belongs_to_no_programme():
    """program_id is nullable and most real files have none.

    Refusing these would make user avatars, payment-method icons and brand logos
    permanently undeletable. A file owned by no programme also has no
    cross-programme victim to protect, so the brand check alone governs it.
    """
    handler, repo, _ = _handler(_File("brand-1", None))

    asyncio.run(
        handler.execute(
            DeleteFileCommand(file_id="file-1", brand_id="brand-1", program_id="program-a")
        )
    )

    assert repo.deleted == ["file-1"]


def test_still_refuses_a_file_from_another_brand():
    handler, repo, _ = _handler(_File("brand-2", "program-a"))

    with pytest.raises(FileNotFoundException):
        asyncio.run(
            handler.execute(
                DeleteFileCommand(file_id="file-1", brand_id="brand-1", program_id="program-a")
            )
        )

    assert repo.deleted == []


def test_omitting_the_programme_falls_back_to_the_brand_check():
    """Backwards compatible: a caller that sends no program_id behaves as before."""
    handler, repo, _ = _handler(_File("brand-1", "program-b"))

    asyncio.run(handler.execute(DeleteFileCommand(file_id="file-1", brand_id="brand-1")))

    assert repo.deleted == ["file-1"]
