"""Handler for listing files by program (media library query)."""
import math
from app.application.queries.list_files_by_program_query import ListFilesByProgramQuery
from app.application.dto.file_dto import FileDto, PaginatedFilesDto
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService


# Buckets that serve public URLs directly (no presigned token needed).
# Includes singular path-segment forms (e.g. 'banner' from .../banner/file.webp).
PUBLIC_CATEGORIES = {
    'gallery', 'programs', 'banners', 'assets', 'partners',
    'sponsors', 'speakers', 'content', 'announcements', 'faq',
    'payment_icons', 'payment_methods',
    'banner', 'logo', 'thumbnail',
    'brands', 'brands/logos', 'brands/banners', 'brands/sponsor-logos',
    'programs/banners', 'programs/logos', 'programs/thumbnails',
}


class ListFilesByProgramHandler:
    """Return a paginated, optionally filtered list of files for a program."""

    def __init__(
        self,
        file_repository: IFileRepository,
        storage_service: IStorageService,
    ):
        self.file_repository = file_repository
        self.storage_service = storage_service

    async def execute(self, query: ListFilesByProgramQuery) -> PaginatedFilesDto:
        files, total = await self.file_repository.find_by_program(
            program_id=query.program_id,
            brand_id=query.brand_id,
            asset_type=query.asset_type,
            bucket=query.bucket,
            page=query.page,
            limit=query.limit,
        )

        dtos: list[FileDto] = []
        for file in files:
            # Resolve URL: public bucket → direct URL, private → presigned
            parts = file.storage_path.split('/')
            category = parts[-2] if len(parts) >= 2 else ''
            is_public = category in PUBLIC_CATEGORIES

            url = None
            download_url = None
            if is_public:
                url = self.storage_service.get_public_url(
                    file.bucket, file.storage_path
                )
            else:
                download_url = await self.storage_service.get_presigned_url(
                    file.bucket, file.storage_path
                )

            dtos.append(FileDto.from_entity(file, download_url=download_url, url=url))

        total_pages = max(1, math.ceil(total / query.limit))
        return PaginatedFilesDto(
            files=dtos,
            total=total,
            page=query.page,
            limit=query.limit,
            total_pages=total_pages,
        )
