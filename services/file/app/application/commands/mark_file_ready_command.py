"""Mark-file-ready command — called by the client after a successful PUT to the presigned URL."""
from dataclasses import dataclass
from typing import Optional


@dataclass
class MarkFileReadyCommand:
    """Transition a File row from PROCESSING to READY after the client uploads to storage.

    `user_id` is the ownership credential the handler checks against the stored file row
    (defense-in-depth even though the gateway also enforces auth). `brand_id` is carried
    for logging/back-compat only — it is NOT checked, since a program-scoped file's
    brand_id is derived from its program and can legitimately differ from the caller's
    JWT home brand (e.g. a multi-brand admin).
    """

    file_id: str
    brand_id: str
    user_id: str
    # Optional — if the client learned the real size post-upload, we can correct the stored value
    actual_size: Optional[int] = None
