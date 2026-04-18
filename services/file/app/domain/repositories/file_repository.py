"""File repository interface."""
from abc import ABC, abstractmethod
from typing import Optional, List
from ..entities.file import File


class IFileRepository(ABC):
    """Repository interface for file metadata operations."""
    
    @abstractmethod
    async def find_by_id(self, file_id: str) -> Optional[File]:
        """Find file by ID."""
        pass
    
    @abstractmethod
    async def find_by_user(self, user_id: str, brand_id: str) -> List[File]:
        """Find all files for a user in a specific brand."""
        pass

    @abstractmethod
    async def find_by_program(
        self,
        program_id: str,
        brand_id: str,
        asset_type: Optional[str] = None,
        bucket: Optional[str] = None,
        page: int = 1,
        limit: int = 50,
    ) -> tuple[List[File], int]:
        """
        Find all non-deleted files for a program with optional filters.
        
        Returns:
            (files, total_count) tuple.
        """
        pass

    @abstractmethod
    async def save(self, file: File) -> File:
        """Save file metadata."""
        pass
    
    @abstractmethod
    async def delete(self, file_id: str) -> bool:
        """Delete file metadata."""
        pass
    
    @abstractmethod
    async def exists(self, file_id: str) -> bool:
        """Check if file exists."""
        pass
