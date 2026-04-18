"""Media library API routes — program-scoped file listing and deletion."""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from typing import Optional

from app.application.queries.list_files_by_program_query import ListFilesByProgramQuery
from app.application.queries.handlers.list_files_by_program_handler import ListFilesByProgramHandler
from app.application.commands.delete_file_command import DeleteFileCommand
from app.application.commands.handlers.delete_file_handler import DeleteFileHandler
from app.application.dto.file_dto import PaginatedFilesDto
from app.domain.exceptions.file_exceptions import FileNotFoundException
from app.presentation.dependencies.container import (
    get_list_files_by_program_handler,
    get_delete_file_handler,
)

router = APIRouter(prefix="/media", tags=["Media Library"])


@router.get(
    "/program/{program_id}",
    response_model=PaginatedFilesDto,
    summary="List program media assets",
)
async def list_program_media(
    program_id: str,
    brand_id: str = Query(..., description="Brand ID the program belongs to"),
    asset_type: Optional[str] = Query(
        None,
        description="Filter by asset type: image, document, logo, banner, gallery, certificate, other",
    ),
    bucket: Optional[str] = Query(None, description="Filter by storage bucket/category"),
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=200),
    handler: ListFilesByProgramHandler = Depends(get_list_files_by_program_handler),
) -> PaginatedFilesDto:
    """Return a paginated list of media files for a program (media library view)."""
    query = ListFilesByProgramQuery(
        program_id=program_id,
        brand_id=brand_id,
        asset_type=asset_type,
        bucket=bucket,
        page=page,
        limit=limit,
    )
    return await handler.execute(query)


@router.delete(
    "/{file_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Delete a media asset",
)
async def delete_media_file(
    file_id: str,
    brand_id: str = Query(..., description="Brand ID — used to verify ownership"),
    handler: DeleteFileHandler = Depends(get_delete_file_handler),
) -> None:
    """Soft-delete a file record and remove it from object storage."""
    try:
        await handler.execute(DeleteFileCommand(file_id=file_id, brand_id=brand_id))
    except FileNotFoundException:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"File '{file_id}' not found or access denied.",
        )
