"""Domain exceptions for file operations."""


class FileDomainException(Exception):
    """Base exception for file domain."""
    pass


class FileNotFoundException(FileDomainException):
    """Raised when file is not found."""
    
    def __init__(self, file_id: str):
        self.file_id = file_id
        super().__init__(f"File {file_id} not found")


class InvalidFileTypeException(FileDomainException):
    """Raised when file type is not allowed."""
    
    def __init__(self, content_type: str, allowed_types: list[str]):
        self.content_type = content_type
        self.allowed_types = allowed_types
        super().__init__(f"File type {content_type} not allowed. Allowed types: {', '.join(allowed_types)}")


class FileSizeLimitException(FileDomainException):
    """Raised when file exceeds size limit."""

    def __init__(self, size: int, max_size: int):
        self.size = size
        self.max_size = max_size
        super().__init__(f"File size {size} bytes exceeds limit of {max_size} bytes")


class InvalidFilenameException(FileDomainException):
    """Raised when the client-supplied filename exceeds the storable length.

    original_filename is displayed back to users (e.g. download headers), so it must be
    rejected rather than silently truncated/mangled — see files.original_filename VARCHAR(255).
    """

    def __init__(self, filename_length: int, max_length: int):
        self.filename_length = filename_length
        self.max_length = max_length
        super().__init__(
            f"Filename length {filename_length} exceeds maximum of {max_length} characters"
        )


class StorageException(FileDomainException):
    """Raised when storage operation fails."""

    def __init__(self, message: str):
        super().__init__(f"Storage error: {message}")


class FileNotUploadedException(FileDomainException):
    """Raised when a client asks to mark a file ready but the object isn't on storage yet."""

    def __init__(self, file_id: str, storage_path: str):
        self.file_id = file_id
        self.storage_path = storage_path
        super().__init__(
            f"File {file_id} has no object at {storage_path} — client must PUT to the upload URL before marking ready"
        )
