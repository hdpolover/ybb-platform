"""Storage service interface."""
from abc import ABC, abstractmethod
from typing import BinaryIO, Optional


class IStorageService(ABC):
    """Interface for object storage operations."""
    
    @abstractmethod
    async def upload(
        self, 
        bucket: str, 
        object_name: str, 
        file_data: BinaryIO, 
        content_type: str,
        size: int,
        is_public: bool = False
    ) -> str:
        """
        Upload file to storage.
        
        Args:
            bucket: Bucket name
            object_name: Object path in bucket
            file_data: File binary data
            content_type: MIME type
            size: File size in bytes
            is_public: Whether object should be publicly readable
            
        Returns:
            Storage URL or path
        """
        pass
    
    @abstractmethod
    async def download(self, bucket: str, object_name: str) -> bytes:
        """
        Download file from storage.
        
        Args:
            bucket: Bucket name
            object_name: Object path in bucket
            
        Returns:
            File binary data
        """
        pass
    
    @abstractmethod
    async def delete(self, bucket: str, object_name: str) -> bool:
        """
        Delete file from storage.
        
        Args:
            bucket: Bucket name
            object_name: Object path in bucket
            
        Returns:
            True if deleted successfully
        """
        pass
    
    @abstractmethod
    async def get_presigned_url(
        self, 
        bucket: str, 
        object_name: str, 
        expiry_seconds: int = 3600
    ) -> str:
        """
        Get presigned URL for direct download.
        
        Args:
            bucket: Bucket name
            object_name: Object path in bucket
            expiry_seconds: URL expiry time in seconds
            
        Returns:
            Presigned URL
        """
        pass
    
    @abstractmethod
    async def exists(self, bucket: str, object_name: str) -> bool:
        """Check if object exists in storage."""
        pass
