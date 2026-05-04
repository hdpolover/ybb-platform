"""Get file query handler."""
from app.application.queries.get_file_query import GetFileQuery
from app.application.dto.file_dto import FileDto
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService
from app.domain.exceptions.file_exceptions import FileNotFoundException


class GetFileHandler:
    """Handler for getting file information."""
    
    # Public categories that support direct URL access.
    # Includes singular path-segment forms (e.g. 'banner' from .../banner/file.webp)
    # as well as the full bucket-path forms used at upload time.
    PUBLIC_CATEGORIES = [
        'gallery', 'programs', 'banners', 'assets', 'partners',
        'sponsors', 'speakers', 'content', 'announcements', 'faq',
        'payment_icons', 'payment-methods', 'payment_methods',
        'banner', 'logo', 'thumbnail',
        'brands', 'brands/logos', 'brands/banners', 'brands/sponsor-logos',
        'programs/banners', 'programs/logos', 'programs/thumbnails',
    ]
    
    def __init__(
        self,
        file_repository: IFileRepository,
        storage_service: IStorageService
    ):
        """Initialize handler with dependencies."""
        self.file_repository = file_repository
        self.storage_service = storage_service
    
    async def execute(self, query: GetFileQuery) -> FileDto:
        """
        Execute get file query.
        
        Args:
            query: Get file query
            
        Returns:
            FileDto with file information
            
        Raises:
            FileNotFoundException: If file not found
        """
        # Get file from repository
        file = await self.file_repository.find_by_id(query.file_id)
        
        if not file:
            raise FileNotFoundException(query.file_id)
        
        # Verify user has access (brand-scoped)
        if file.user_id != query.user_id or file.brand_id != query.brand_id:
            raise FileNotFoundException(query.file_id)

        # Generate public URL if file is in public bucket
        # Note: file.bucket stores the Physical Bucket Name (e.g., "ybb").
        # Examples of storage_path: 
        # - dev/brand/programs/prog_id/banners/file.png (parts[-2] = category)
        # - dev/brand/users/user_id/payment_icons/file.png (parts[-2] = category)
        public_url = None
        
        # Try to infer category from path
        is_public_category = False
        parts = file.storage_path.split('/')
        if len(parts) >= 2:
            category = parts[-2]
            if category in self.PUBLIC_CATEGORIES:
                is_public_category = True
        
        if is_public_category:
            public_url = self.storage_service.get_public_url(
                bucket=file.bucket,
                object_name=file.storage_path
            )
        
        # Generate download URL if requested
        download_url = None
        if query.generate_download_url:
            download_url = await self.storage_service.get_presigned_url(
                bucket=file.bucket,
                object_name=file.storage_path,
                expiry_seconds=3600  # 1 hour
            )
        
        return FileDto.from_entity(file, download_url=download_url, url=public_url)
