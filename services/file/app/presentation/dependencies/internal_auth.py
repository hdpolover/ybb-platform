"""Internal service authentication dependency for private file endpoints."""
import hmac
import os
from typing import Optional

from fastapi import Header, HTTPException, status


_PROD_ENVS = {"staging", "production"}


def _is_prod_like() -> bool:
    return os.getenv("PYTHON_ENV", "development").strip().lower() in _PROD_ENVS


async def require_internal_service_key(
    x_internal_service_key: Optional[str] = Header(default=None, alias="x-internal-service-key"),
) -> None:
    """Validate shared internal service key for private routes."""
    expected = os.getenv("FILE_SERVICE_INTERNAL_KEY", "").strip()

    if not expected:
        if _is_prod_like():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Internal service key is not configured",
            )
        return

    provided = (x_internal_service_key or "").strip()
    if not provided or not hmac.compare_digest(provided, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Unauthorized",
        )
