# Application Layer

This directory contains use cases (commands and queries) for the File Service.

## Structure

- **commands/** - Write operations (Upload, Delete, Process)
  - **handlers/** - Command handler implementations
- **queries/** - Read operations (Get, List)
  - **handlers/** - Query handler implementations
- **dto/** - Data Transfer Objects (Pydantic models)

## CQRS Pattern

Separate commands and queries for clear separation of concerns.

## Example

```python
# commands/upload_file.py
from dataclasses import dataclass

@dataclass
class UploadFileCommand:
    filename: str
    content: bytes
    content_type: str
    user_id: str
    entity_type: str
    entity_id: str

# commands/handlers/upload_file_handler.py
from typing import Protocol
from ...domain.repositories.file_repository import FileRepository
from ...domain.services.storage_service import StorageService
from ...domain.entities.file import File
from ..dto.file_response_dto import FileResponseDTO

class UploadFileHandler:
    def __init__(
        self,
        file_repository: FileRepository,
        storage_service: StorageService,
    ):
        self.file_repository = file_repository
        self.storage_service = storage_service
    
    async def handle(self, command: UploadFileCommand) -> FileResponseDTO:
        # 1. Upload to storage
        storage_path = await self.storage_service.upload(
            command.content,
            command.filename,
            command.content_type
        )
        
        # 2. Create file entity
        file = File(
            id=generate_id(),
            filename=command.filename,
            content_type=command.content_type,
            size=len(command.content),
            user_id=command.user_id,
            storage_path=storage_path,
            created_at=datetime.utcnow()
        )
        
        # 3. Save to database
        saved_file = await self.file_repository.save(file)
        
        return FileResponseDTO.from_entity(saved_file)
```
