# Domain Layer

This directory contains the core business entities and domain logic for the File Service.

## Structure

- **entities/** - File domain entities (File, FileMetadata)
- **repositories/** - Repository interface definitions (ABC)
- **services/** - Domain service interfaces (Storage, Processor)
- **exceptions/** - Domain-specific exceptions

## Rules

1. **Pure Python** - No framework dependencies
2. **Abstract Base Classes** - Use ABC for interfaces
3. **Domain logic only** - Business rules and validations

## Example

```python
# entities/file.py
from dataclasses import dataclass
from datetime import datetime

@dataclass
class File:
    id: str
    filename: str
    content_type: str
    size: int
    user_id: str
    storage_path: str
    created_at: datetime
    
    def is_image(self) -> bool:
        return self.content_type.startswith('image/')
    
    def is_valid_size(self, max_size: int) -> bool:
        return self.size <= max_size

# repositories/file_repository.py
from abc import ABC, abstractmethod
from typing import List, Optional
from ..entities.file import File

class FileRepository(ABC):
    @abstractmethod
    async def find_by_id(self, file_id: str) -> Optional[File]:
        pass
    
    @abstractmethod
    async def save(self, file: File) -> File:
        pass
    
    @abstractmethod
    async def delete(self, file_id: str) -> bool:
        pass
```
