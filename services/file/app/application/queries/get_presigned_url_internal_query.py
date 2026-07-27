"""Get presigned URL (internal) query."""
from dataclasses import dataclass


@dataclass
class GetPresignedUrlInternalQuery:
    """Query to mint a fresh presigned GET URL for a private file, by storage path.

    No user/brand ownership check — the caller (NestJS API) has already run its own
    eligibility check before invoking this RPC.
    """

    storage_path: str
    expiry_seconds: int = 3600  # caller passes <=0 to mean "use default"
