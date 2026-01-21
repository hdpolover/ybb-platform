"""In-memory file repository for development/testing."""
from typing import Optional, List
from app.domain.entities.file import File
from app.domain.repositories.file_repository import IFileRepository


class InMemoryFileRepository(IFileRepository):
    """In-memory implementation of file repository."""
    
    def __init__(self):
        """Initialize with empty storage."""
        self._storage: dict[str, File] = {}
    
    async def find_by_id(self, file_id: str) -> Optional[File]:
        """Find file by ID."""
        return self._storage.get(file_id)
    
    async def find_by_user(self, user_id: str, brand_id: str) -> List[File]:
        """Find all files for a user in a specific brand."""
        return [
            file for file in self._storage.values()
            if file.user_id == user_id and file.brand_id == brand_id
        ]
    
    async def save(self, file: File) -> File:
        """Save file metadata."""
        self._storage[file.id] = file
        return file
    
    async def delete(self, file_id: str) -> bool:
        """Delete file metadata."""
        if file_id in self._storage:
            del self._storage[file_id]
            return True
        return False
    
    async def exists(self, file_id: str) -> bool:
        """Check if file exists."""
        return file_id in self._storage
