from app.application.services.file_path_service import FilePathService


def test_build_storage_filename_clamps_long_extension():
    file_id = "11111111-1111-1111-1111-111111111111"
    original_filename = "photo." + ("x" * 350)

    storage_filename = FilePathService.build_storage_filename(file_id, original_filename)

    prefix, extension = storage_filename.split(".", 1)
    assert prefix == file_id
    assert len(extension) == FilePathService.MAX_EXTENSION_LENGTH
    assert len(storage_filename) == len(file_id) + 1 + FilePathService.MAX_EXTENSION_LENGTH


def test_build_storage_filename_keeps_short_extension_lowercased():
    file_id = "22222222-2222-2222-2222-222222222222"

    storage_filename = FilePathService.build_storage_filename(file_id, "Report.PDF")

    assert storage_filename == f"{file_id}.pdf"


def test_build_storage_filename_handles_missing_extension():
    file_id = "33333333-3333-3333-3333-333333333333"

    storage_filename = FilePathService.build_storage_filename(file_id, "noextension")

    assert storage_filename == file_id


def test_build_storage_filename_keeps_storage_path_within_column_limits():
    """Regression test for the 22001 overflow: a pathological extension must not blow
    files.filename VARCHAR(255) or files.storage_path VARCHAR(500)."""
    file_id = "44444444-4444-4444-4444-444444444444"
    original_filename = "photo." + ("x" * 350)

    storage_filename = FilePathService.build_storage_filename(file_id, original_filename)
    storage_path, _, _ = FilePathService.get_storage_path(
        brand_id="brand-1",
        user_id="user-1",
        bucket="documents",
        filename=storage_filename,
        program_id="program-1",
        participant_id="11111111-1111-1111-1111-111111111111",
    )

    assert len(storage_filename) <= 255
    assert len(storage_path) <= 500
