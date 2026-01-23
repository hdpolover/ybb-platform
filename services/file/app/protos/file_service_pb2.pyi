from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class UploadFileRequest(_message.Message):
    __slots__ = ("metadata", "chunk_data")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    CHUNK_DATA_FIELD_NUMBER: _ClassVar[int]
    metadata: FileMetadata
    chunk_data: bytes
    def __init__(self, metadata: _Optional[_Union[FileMetadata, _Mapping]] = ..., chunk_data: _Optional[bytes] = ...) -> None: ...

class FileMetadata(_message.Message):
    __slots__ = ("filename", "content_type", "user_id", "brand_id", "bucket", "program_id", "participant_id")
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    BRAND_ID_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    PROGRAM_ID_FIELD_NUMBER: _ClassVar[int]
    PARTICIPANT_ID_FIELD_NUMBER: _ClassVar[int]
    filename: str
    content_type: str
    user_id: str
    brand_id: str
    bucket: str
    program_id: str
    participant_id: str
    def __init__(self, filename: _Optional[str] = ..., content_type: _Optional[str] = ..., user_id: _Optional[str] = ..., brand_id: _Optional[str] = ..., bucket: _Optional[str] = ..., program_id: _Optional[str] = ..., participant_id: _Optional[str] = ...) -> None: ...

class UploadFileResponse(_message.Message):
    __slots__ = ("id", "url", "storage_path", "original_filename", "content_type", "size", "bucket")
    ID_FIELD_NUMBER: _ClassVar[int]
    URL_FIELD_NUMBER: _ClassVar[int]
    STORAGE_PATH_FIELD_NUMBER: _ClassVar[int]
    ORIGINAL_FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    id: str
    url: str
    storage_path: str
    original_filename: str
    content_type: str
    size: int
    bucket: str
    def __init__(self, id: _Optional[str] = ..., url: _Optional[str] = ..., storage_path: _Optional[str] = ..., original_filename: _Optional[str] = ..., content_type: _Optional[str] = ..., size: _Optional[int] = ..., bucket: _Optional[str] = ...) -> None: ...

class DownloadFileRequest(_message.Message):
    __slots__ = ("file_id", "user_id", "brand_id")
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    BRAND_ID_FIELD_NUMBER: _ClassVar[int]
    file_id: str
    user_id: str
    brand_id: str
    def __init__(self, file_id: _Optional[str] = ..., user_id: _Optional[str] = ..., brand_id: _Optional[str] = ...) -> None: ...

class DownloadFileResponse(_message.Message):
    __slots__ = ("chunk_data",)
    CHUNK_DATA_FIELD_NUMBER: _ClassVar[int]
    chunk_data: bytes
    def __init__(self, chunk_data: _Optional[bytes] = ...) -> None: ...

class GetFileRequest(_message.Message):
    __slots__ = ("file_id", "user_id", "brand_id")
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    BRAND_ID_FIELD_NUMBER: _ClassVar[int]
    file_id: str
    user_id: str
    brand_id: str
    def __init__(self, file_id: _Optional[str] = ..., user_id: _Optional[str] = ..., brand_id: _Optional[str] = ...) -> None: ...

class FileResponse(_message.Message):
    __slots__ = ("id", "original_filename", "content_type", "size", "url", "bucket", "storage_path", "created_at", "updated_at")
    ID_FIELD_NUMBER: _ClassVar[int]
    ORIGINAL_FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    URL_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    STORAGE_PATH_FIELD_NUMBER: _ClassVar[int]
    CREATED_AT_FIELD_NUMBER: _ClassVar[int]
    UPDATED_AT_FIELD_NUMBER: _ClassVar[int]
    id: str
    original_filename: str
    content_type: str
    size: int
    url: str
    bucket: str
    storage_path: str
    created_at: str
    updated_at: str
    def __init__(self, id: _Optional[str] = ..., original_filename: _Optional[str] = ..., content_type: _Optional[str] = ..., size: _Optional[int] = ..., url: _Optional[str] = ..., bucket: _Optional[str] = ..., storage_path: _Optional[str] = ..., created_at: _Optional[str] = ..., updated_at: _Optional[str] = ...) -> None: ...
