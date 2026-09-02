# services/file/tests/infrastructure/processors/test_pdf_url_fetcher.py
"""WeasyPrint url_fetcher SSRF/file-read guard.

Caller-supplied HTML (LOA body, receipt data) can embed <img src="..."> or
CSS url()s. These tests cover the fetcher without needing the real
WeasyPrint native libs (cairo/pango) installed: `weasyprint.default_url_fetcher`
is faked via sys.modules for the "allowed" paths, and the "blocked" paths
never reach it at all.
"""
import sys
import types

import pytest

from app.infrastructure.processors.pdf_generator import (
    _pdf_url_allowlist,
    _safe_pdf_url_fetcher,
)


@pytest.fixture
def fake_weasyprint(monkeypatch):
    """Stand in for the real `weasyprint` module so tests don't need cairo/pango."""
    calls = []
    fake = types.ModuleType("weasyprint")
    fake.default_url_fetcher = lambda url: calls.append(url) or {"string": b""}
    monkeypatch.setitem(sys.modules, "weasyprint", fake)
    return calls


def test_allowlist_reads_hosts_from_known_env_vars(monkeypatch):
    monkeypatch.delenv("FILE_SERVICE_URL", raising=False)
    monkeypatch.delenv("FILE_SERVICE_PUBLIC_URL", raising=False)
    monkeypatch.delenv("API_URL", raising=False)
    monkeypatch.delenv("MINIO_ENDPOINT", raising=False)
    monkeypatch.setenv("API_URL", "https://api.ybbhub.com")
    monkeypatch.setenv("MINIO_PUBLIC_ENDPOINT", "cdn.ybbhub.com")

    assert _pdf_url_allowlist() == {"api.ybbhub.com", "cdn.ybbhub.com"}


def test_blocks_file_scheme(fake_weasyprint):
    with pytest.raises(ValueError, match="scheme"):
        _safe_pdf_url_fetcher("file:///etc/passwd")
    assert fake_weasyprint == []


def test_blocks_non_allowlisted_http_host(monkeypatch, fake_weasyprint):
    monkeypatch.setenv("MINIO_PUBLIC_ENDPOINT", "cdn.ybbhub.com")
    with pytest.raises(ValueError, match="allowlist"):
        _safe_pdf_url_fetcher("http://169.254.169.254/latest/meta-data/")
    assert fake_weasyprint == []


def test_allows_data_uri(fake_weasyprint):
    _safe_pdf_url_fetcher("data:image/png;base64,AAAA")
    assert fake_weasyprint == ["data:image/png;base64,AAAA"]


def test_allows_allowlisted_https_host(monkeypatch, fake_weasyprint):
    monkeypatch.setenv("MINIO_PUBLIC_ENDPOINT", "cdn.ybbhub.com")
    _safe_pdf_url_fetcher("https://cdn.ybbhub.com/logo.png")
    assert fake_weasyprint == ["https://cdn.ybbhub.com/logo.png"]
