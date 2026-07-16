import asyncio

from fastapi import HTTPException

from app.presentation.dependencies.internal_auth import require_internal_service_key


def test_internal_auth_allows_missing_key_in_development(monkeypatch):
    monkeypatch.setenv("PYTHON_ENV", "development")
    monkeypatch.delenv("FILE_SERVICE_INTERNAL_KEY", raising=False)

    asyncio.run(require_internal_service_key(None))


def test_internal_auth_rejects_invalid_key(monkeypatch):
    monkeypatch.setenv("PYTHON_ENV", "production")
    monkeypatch.setenv("FILE_SERVICE_INTERNAL_KEY", "secret-123")

    try:
        asyncio.run(require_internal_service_key("wrong"))
        assert False, "Expected HTTPException"
    except HTTPException as exc:
        assert exc.status_code == 401


def test_internal_auth_accepts_matching_key(monkeypatch):
    monkeypatch.setenv("PYTHON_ENV", "production")
    monkeypatch.setenv("FILE_SERVICE_INTERNAL_KEY", "secret-123")

    asyncio.run(require_internal_service_key("secret-123"))
