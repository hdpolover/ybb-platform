"""Create-upload-URL command — request a presigned PUT URL for direct-to-storage uploads."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class CreateUploadUrlCommand:
    """Reserve a File row and return a presigned PUT URL the client can upload to directly.

    The bytes never pass through the API — the client PUTs to the returned URL and then
    calls MarkFileReady to transition the row from PROCESSING to READY.
    """

    filename: str
    content_type: str
    size: int
    user_id: str
    brand_id: str
    bucket: str = "documents"
    program_id: Optional[str] = None
    participant_id: Optional[str] = None
    asset_type: Optional[str] = None
    metadata: Optional[dict] = None
    title: Optional[str] = None
    alt_text: Optional[str] = None
    expires_in_seconds: int = 300  # presigned URL TTL; matches test-prep-platform default
