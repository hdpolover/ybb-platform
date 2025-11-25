"""File upload/download API routes."""
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, status
from typing import Annotated
from app.application.commands.upload_file_command import UploadFileCommand
from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.queries.get_file_query import GetFileQuery
from app.application.queries.handlers.get_file_handler import GetFileHandler
from app.application.dto.file_dto import UploadFileResponseDto, FileDto
from app.domain.exceptions.file_exceptions import (
    FileDomainException,
    FileNotFoundException,
    InvalidFileTypeException,
    FileSizeLimitException
)
from app.presentation.dependencies.container import get_upload_handler, get_get_file_handler


router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=UploadFileResponseDto, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, File(description="File to upload")],
    user_id: Annotated[str, Form(description="User ID")],
    brand_id: Annotated[str, Form(description="Brand ID")],
    bucket: Annotated[str, Form(description="Bucket name")] = "documents",
    upload_handler: UploadFileHandler = Depends(get_upload_handler)
):
    """
    Upload a file to MinIO storage.
    
    Supported file types:
    - Images: JPEG, PNG, GIF, WebP (max 5MB)
    - Documents: PDF, Word, Excel (max 10MB)
    """
    try:
        # Read file content
        contents = await file.read()
        
        # Create file-like object from bytes
        from io import BytesIO
        file_data = BytesIO(contents)
        
        # Create command
        command = UploadFileCommand(
            file_data=file_data,
            filename=file.filename or "unknown",
            content_type=file.content_type or "application/octet-stream",
            size=len(contents),
            user_id=user_id,
            brand_id=brand_id,
            bucket=bucket
        )
        
        # Execute upload
        file_dto = await upload_handler.execute(command)
        
        return UploadFileResponseDto(file=file_dto)
        
    except InvalidFileTypeException as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e)
        )
    except FileSizeLimitException as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e)
        )
    except FileDomainException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/{file_id}", response_model=FileDto)
async def get_file(
    file_id: str,
    user_id: str,
    brand_id: str,
    get_file_handler: GetFileHandler = Depends(get_get_file_handler)
):
    """
    Get file information and download URL.
    
    Returns a presigned URL valid for 1 hour.
    """
    try:
        query = GetFileQuery(
            file_id=file_id,
            user_id=user_id,
            brand_id=brand_id,
            generate_download_url=True
        )
        
        file_dto = await get_file_handler.execute(query)
        return file_dto
        
    except FileNotFoundException as e:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=str(e)
        )
    except FileDomainException as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """Health check endpoint."""
    return {"status": "healthy", "service": "file-service"}
