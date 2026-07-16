"""Mark-file-ready command — called by the client after a successful PUT to the presigned URL."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class MarkFileReadyCommand:
    """Transition a File row from PROCESSING to READY after the client uploads to storage.

    `brand_id` and `user_id` are required so the caller cannot flip the status
    of a file they don't own
    (defense-in-depth even though the gateway also enforces auth).
    """

    file_id: str
    brand_id: str
    user_id: str
    # Optional — if the client learned the real size post-upload, we can correct the stored value
    actual_size: Optional[int] = None
