from google.protobuf.internal import containers as _containers
from google.protobuf import descriptor as _descriptor
from google.protobuf import message as _message
from collections.abc import Mapping as _Mapping
from typing import ClassVar as _ClassVar, Optional as _Optional, Union as _Union

DESCRIPTOR: _descriptor.FileDescriptor

class GenerateCertificateRequest(_message.Message):
    __slots__ = ("participant_name", "program_name", "issued_at", "template_type", "metadata")
    class MetadataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    PARTICIPANT_NAME_FIELD_NUMBER: _ClassVar[int]
    PROGRAM_NAME_FIELD_NUMBER: _ClassVar[int]
    ISSUED_AT_FIELD_NUMBER: _ClassVar[int]
    TEMPLATE_TYPE_FIELD_NUMBER: _ClassVar[int]
    METADATA_FIELD_NUMBER: _ClassVar[int]
    participant_name: str
    program_name: str
    issued_at: str
    template_type: str
    metadata: _containers.ScalarMap[str, str]
    def __init__(self, participant_name: _Optional[str] = ..., program_name: _Optional[str] = ..., issued_at: _Optional[str] = ..., template_type: _Optional[str] = ..., metadata: _Optional[_Mapping[str, str]] = ...) -> None: ...

class GenerateReceiptRequest(_message.Message):
    __slots__ = ("receipt_number", "transaction_id", "amount", "currency", "payer_name", "date", "payment_method", "status", "additional_data")
    class AdditionalDataEntry(_message.Message):
        __slots__ = ("key", "value")
        KEY_FIELD_NUMBER: _ClassVar[int]
        VALUE_FIELD_NUMBER: _ClassVar[int]
        key: str
        value: str
        def __init__(self, key: _Optional[str] = ..., value: _Optional[str] = ...) -> None: ...
    RECEIPT_NUMBER_FIELD_NUMBER: _ClassVar[int]
    TRANSACTION_ID_FIELD_NUMBER: _ClassVar[int]
    AMOUNT_FIELD_NUMBER: _ClassVar[int]
    CURRENCY_FIELD_NUMBER: _ClassVar[int]
    PAYER_NAME_FIELD_NUMBER: _ClassVar[int]
    DATE_FIELD_NUMBER: _ClassVar[int]
    PAYMENT_METHOD_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    ADDITIONAL_DATA_FIELD_NUMBER: _ClassVar[int]
    receipt_number: str
    transaction_id: str
    amount: float
    currency: str
    payer_name: str
    date: str
    payment_method: str
    status: str
    additional_data: _containers.ScalarMap[str, str]
    def __init__(self, receipt_number: _Optional[str] = ..., transaction_id: _Optional[str] = ..., amount: _Optional[float] = ..., currency: _Optional[str] = ..., payer_name: _Optional[str] = ..., date: _Optional[str] = ..., payment_method: _Optional[str] = ..., status: _Optional[str] = ..., additional_data: _Optional[_Mapping[str, str]] = ...) -> None: ...

class GenerateDocumentResponse(_message.Message):
    __slots__ = ("file_data", "filename", "content_type")
    FILE_DATA_FIELD_NUMBER: _ClassVar[int]
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    file_data: bytes
    filename: str
    content_type: str
    def __init__(self, file_data: _Optional[bytes] = ..., filename: _Optional[str] = ..., content_type: _Optional[str] = ...) -> None: ...

class GetPresignedUploadUrlRequest(_message.Message):
    __slots__ = ("filename", "content_type", "user_id", "brand_id", "bucket", "program_id", "participant_id", "size")
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    BRAND_ID_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    PROGRAM_ID_FIELD_NUMBER: _ClassVar[int]
    PARTICIPANT_ID_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    filename: str
    content_type: str
    user_id: str
    brand_id: str
    bucket: str
    program_id: str
    participant_id: str
    size: int
    def __init__(self, filename: _Optional[str] = ..., content_type: _Optional[str] = ..., user_id: _Optional[str] = ..., brand_id: _Optional[str] = ..., bucket: _Optional[str] = ..., program_id: _Optional[str] = ..., participant_id: _Optional[str] = ..., size: _Optional[int] = ...) -> None: ...

class GetPresignedUploadUrlResponse(_message.Message):
    __slots__ = ("upload_url", "file_id", "storage_path", "bucket")
    UPLOAD_URL_FIELD_NUMBER: _ClassVar[int]
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    STORAGE_PATH_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    upload_url: str
    file_id: str
    storage_path: str
    bucket: str
    def __init__(self, upload_url: _Optional[str] = ..., file_id: _Optional[str] = ..., storage_path: _Optional[str] = ..., bucket: _Optional[str] = ...) -> None: ...

class ConfirmUploadRequest(_message.Message):
    __slots__ = ("storage_path", "bucket", "size")
    STORAGE_PATH_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    storage_path: str
    bucket: str
    size: int
    def __init__(self, storage_path: _Optional[str] = ..., bucket: _Optional[str] = ..., size: _Optional[int] = ...) -> None: ...

class ConfirmUploadResponse(_message.Message):
    __slots__ = ("success", "file_id", "status")
    SUCCESS_FIELD_NUMBER: _ClassVar[int]
    FILE_ID_FIELD_NUMBER: _ClassVar[int]
    STATUS_FIELD_NUMBER: _ClassVar[int]
    success: bool
    file_id: str
    status: str
    def __init__(self, success: bool = ..., file_id: _Optional[str] = ..., status: _Optional[str] = ...) -> None: ...

class UploadFileRequest(_message.Message):
    __slots__ = ("metadata", "chunk_data")
    METADATA_FIELD_NUMBER: _ClassVar[int]
    CHUNK_DATA_FIELD_NUMBER: _ClassVar[int]
    metadata: FileMetadata
    chunk_data: bytes
    def __init__(self, metadata: _Optional[_Union[FileMetadata, _Mapping]] = ..., chunk_data: _Optional[bytes] = ...) -> None: ...

class FileMetadata(_message.Message):
    __slots__ = ("filename", "content_type", "user_id", "brand_id", "bucket", "program_id", "participant_id", "size")
    FILENAME_FIELD_NUMBER: _ClassVar[int]
    CONTENT_TYPE_FIELD_NUMBER: _ClassVar[int]
    USER_ID_FIELD_NUMBER: _ClassVar[int]
    BRAND_ID_FIELD_NUMBER: _ClassVar[int]
    BUCKET_FIELD_NUMBER: _ClassVar[int]
    PROGRAM_ID_FIELD_NUMBER: _ClassVar[int]
    PARTICIPANT_ID_FIELD_NUMBER: _ClassVar[int]
    SIZE_FIELD_NUMBER: _ClassVar[int]
    filename: str
    content_type: str
    user_id: str
    brand_id: str
    bucket: str
    program_id: str
    participant_id: str
    size: int
    def __init__(self, filename: _Optional[str] = ..., content_type: _Optional[str] = ..., user_id: _Optional[str] = ..., brand_id: _Optional[str] = ..., bucket: _Optional[str] = ..., program_id: _Optional[str] = ..., participant_id: _Optional[str] = ..., size: _Optional[int] = ...) -> None: ...

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

class GetPresignedUrlInternalRequest(_message.Message):
    __slots__ = ("storage_path", "expiry_seconds")
    STORAGE_PATH_FIELD_NUMBER: _ClassVar[int]
    EXPIRY_SECONDS_FIELD_NUMBER: _ClassVar[int]
    storage_path: str
    expiry_seconds: int
    def __init__(self, storage_path: _Optional[str] = ..., expiry_seconds: _Optional[int] = ...) -> None: ...

class GetPresignedUrlInternalResponse(_message.Message):
    __slots__ = ("presigned_url", "expires_at_unix")
    PRESIGNED_URL_FIELD_NUMBER: _ClassVar[int]
    EXPIRES_AT_UNIX_FIELD_NUMBER: _ClassVar[int]
    presigned_url: str
    expires_at_unix: int
    def __init__(self, presigned_url: _Optional[str] = ..., expires_at_unix: _Optional[int] = ...) -> None: ...
