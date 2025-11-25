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


class StorageException(FileDomainException):
    """Raised when storage operation fails."""
    
    def __init__(self, message: str):
        super().__init__(f"Storage error: {message}")
