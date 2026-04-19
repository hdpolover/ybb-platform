"""File upload/download API routes."""
from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from typing import Annotated
from io import BytesIO
from app.application.commands.upload_file_command import UploadFileCommand
from app.application.commands.create_upload_url_command import CreateUploadUrlCommand
from app.application.commands.mark_file_ready_command import MarkFileReadyCommand
from app.application.commands.handlers.upload_file_handler import UploadFileHandler
from app.application.commands.handlers.create_upload_url_handler import CreateUploadUrlHandler
from app.application.commands.handlers.mark_file_ready_handler import MarkFileReadyHandler
from app.application.queries.get_file_query import GetFileQuery
from app.application.queries.handlers.get_file_handler import GetFileHandler
from app.application.dto.file_dto import (
    CreateUploadUrlRequestDto,
    CreateUploadUrlResponseDto,
    FileDto,
    UploadFileResponseDto,
)
from app.domain.exceptions.file_exceptions import (
    FileDomainException,
    FileNotFoundException,
    FileNotUploadedException,
    InvalidFileTypeException,
    FileSizeLimitException,
)
from app.presentation.dependencies.container import (
    get_create_upload_url_handler,
    get_get_file_handler,
    get_mark_file_ready_handler,
    get_storage_service,
    get_upload_handler,
)


router = APIRouter(prefix="/files", tags=["files"])


@router.post("/upload", response_model=UploadFileResponseDto, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: Annotated[UploadFile, File(description="File to upload")],
    user_id: Annotated[str, Form(description="User ID (Global Identity)")],
    brand_id: Annotated[str, Form(description="Brand ID")],
    bucket: Annotated[str, Form(description="Category (e.g., documents, essays, payments)")] = "documents",
    program_id: Annotated[str, Form(description="Program ID (Optional - for Program Context)")] = None,
    participant_id: Annotated[str, Form(description="Participant ID (Optional - for Program Context)")] = None,
    asset_type: Annotated[str, Form(description="Asset type for media library (Optional)")] = None,
    upload_handler: UploadFileHandler = Depends(get_upload_handler)
):
    """
    Upload a file to MinIO/Spaces storage.
    
    Path Strategy:
    1. **Program Context** (If program_id & participant_id provided):
       `/{env}/{brand}/{program_id}/{participant_id}/{category}/{filename}`
    
    2. **Global User Context** (Default):
       `/{env}/{brand}/users/{user_id}/{category}/{filename}`
    
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
            bucket=bucket,
            program_id=program_id,
            participant_id=participant_id,
            asset_type=asset_type,
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


@router.post(
    "/upload-url",
    response_model=CreateUploadUrlResponseDto,
    status_code=status.HTTP_201_CREATED,
    summary="Request a presigned PUT URL for direct-to-storage upload",
)
async def request_upload_url(
    body: CreateUploadUrlRequestDto,
    handler: CreateUploadUrlHandler = Depends(get_create_upload_url_handler),
) -> CreateUploadUrlResponseDto:
    """
    Step 1 of the presigned-URL flow. Validates MIME/size, reserves a File row with
    status=PROCESSING, and returns a presigned PUT URL. Client then PUTs the file bytes
    directly to `upload_url` (the API never sees them) and calls PATCH /files/{id}/ready.

    Allowed MIME types: PDF, Word, Excel, JPEG/PNG/WebP/GIF.
    Max size: 10 MB for documents, 5 MB for images.
    """
    try:
        command = CreateUploadUrlCommand(
            filename=body.filename,
            content_type=body.content_type,
            size=body.size,
            user_id=body.user_id,
            brand_id=body.brand_id,
            bucket=body.bucket,
            program_id=body.program_id,
            participant_id=body.participant_id,
            asset_type=body.asset_type,
        )
        return await handler.execute(command)
    except InvalidFileTypeException as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
    except FileSizeLimitException as e:
        raise HTTPException(status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, detail=str(e))
    except FileDomainException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.patch(
    "/{file_id}/ready",
    response_model=FileDto,
    summary="Mark a file as READY after the client PUT to the presigned URL succeeded",
)
async def mark_file_ready(
    file_id: str,
    brand_id: str = Query(..., description="Brand ID — must match the row's brand_id"),
    actual_size: int | None = Query(None, description="Optional: correct size learned after upload"),
    handler: MarkFileReadyHandler = Depends(get_mark_file_ready_handler),
) -> FileDto:
    """
    Step 2 of the presigned-URL flow. Verifies the object exists on storage and
    transitions the File row from PROCESSING to READY. Idempotent — calling on a
    READY file returns the current state without error.
    """
    try:
        command = MarkFileReadyCommand(
            file_id=file_id,
            brand_id=brand_id,
            actual_size=actual_size,
        )
        return await handler.execute(command)
    except FileNotFoundException as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except FileNotUploadedException as e:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(e))
    except FileDomainException as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/{file_id}", response_model=FileDto)
async def get_file(
    file_id: str,
    user_id: str,
    brand_id: str,
    get_file_handler: GetFileHandler = Depends(get_get_file_handler)
):
    """
    Get file metadata and download URL.
    
    Note: The presigned URL works when the public endpoint matches where you access MinIO.
    For reliable downloads across all environments, use GET /files/{file_id}/download instead.
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


@router.get("/{file_id}/download")
async def download_file(
    file_id: str,
    user_id: str,
    brand_id: str,
    get_file_handler: GetFileHandler = Depends(get_get_file_handler),
    storage_service = Depends(get_storage_service)
):
    """
    Download file content directly (streams through API).
    
    This endpoint is more reliable than presigned URLs as it works
    regardless of network configuration (Docker, production, etc).
    """
    try:
        # Get file metadata
        query = GetFileQuery(
            file_id=file_id,
            user_id=user_id,
            brand_id=brand_id,
            generate_download_url=False
        )
        file_dto = await get_file_handler.execute(query)
        
        # Download file content from MinIO
        file_content = await storage_service.download(
            bucket=file_dto.bucket,
            object_name=file_dto.storage_path
        )
        
        # Stream the file back to the client
        return StreamingResponse(
            BytesIO(file_content),
            media_type=file_dto.content_type,
            headers={
                "Content-Disposition": f'attachment; filename="{file_dto.original_filename}"',
                "Content-Length": str(file_dto.size)
            }
        )
        
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
    return {"status": "healthy", "service": "file"}
