"""Get presigned URL (internal) query handler."""
import time

from app.application.queries.get_presigned_url_internal_query import GetPresignedUrlInternalQuery
from app.application.dto.file_dto import PresignedUrlInternalDto
from app.domain.repositories.file_repository import IFileRepository
from app.domain.services.storage_service import IStorageService
from app.domain.exceptions.file_exceptions import FileNotFoundException, FileCategoryNotAllowedException


class GetPresignedUrlInternalHandler:
    """Handler for internal-only presign requests — skips the per-user ownership check.

    The gRPC caller (NestJS API) has already run its own eligibility check; this handler's
    only remaining job is to refuse to sign anything outside the private-category
    allowlist. It is NOT a general presign service.
    """

    DEFAULT_EXPIRY_SECONDS = 3600

    # Mirrors GetFileHandler.PUBLIC_CATEGORIES but inverted in intent: this is an allowlist
    # of PRIVATE categories this RPC is permitted to sign. Everything else — including the
    # public categories in GetFileHandler — must be rejected.
    ALLOWED_CATEGORIES = {'documents', 'signed-copies'}

    def __init__(
        self,
        file_repository: IFileRepository,
        storage_service: IStorageService
    ):
        """Initialize handler with dependencies."""
        self.file_repository = file_repository
        self.storage_service = storage_service

    async def execute(self, query: GetPresignedUrlInternalQuery) -> PresignedUrlInternalDto:
        """
        Execute get-presigned-url-internal query.

        Args:
            query: Get presigned URL (internal) query

        Returns:
            PresignedUrlInternalDto with a fresh presigned GET URL

        Raises:
            FileNotFoundException: If no active file exists at storage_path
            FileCategoryNotAllowedException: If storage_path's category isn't private
        """
        file = await self.file_repository.find_by_storage_path(query.storage_path)

        if not file or getattr(file, "is_deleted", False):
            raise FileNotFoundException(query.storage_path)

        # Derive category from path, e.g. dev/brand/users/user_id/documents/file.pdf -> "documents"
        parts = query.storage_path.split('/')
        category = parts[-2] if len(parts) >= 2 else ''

        if category not in self.ALLOWED_CATEGORIES:
            raise FileCategoryNotAllowedException(category, query.storage_path)

        expiry_seconds = (
            query.expiry_seconds if query.expiry_seconds and query.expiry_seconds > 0
            else self.DEFAULT_EXPIRY_SECONDS
        )

        # Always sign against the file row's OWN bucket — never a caller-supplied one.
        presigned_url = await self.storage_service.get_presigned_url(
            bucket=file.bucket,
            object_name=file.storage_path,
            expiry_seconds=expiry_seconds
        )

        expires_at_unix = int(time.time()) + expiry_seconds

        return PresignedUrlInternalDto(
            presigned_url=presigned_url,
            expires_at_unix=expires_at_unix
        )
