import logging
import os
import socket
from urllib.parse import urlparse

import logging_loki


def init_loki_logging(service_name="ybb-file"):
    """Attach a Loki logging handler if (and only if) Loki looks reachable.

    If `LOKI_URL` is empty/unset, skip. If it's set but the host:port isn't
    accepting TCP connections within 500ms, skip. This avoids every log line
    emitting a connection-refused traceback when the observability stack isn't
    running (typical in local dev).
    """
    loki_url = os.getenv("LOKI_URL", "").strip()
    if not loki_url:
        logging.info(f"Loki logging disabled for {service_name} (LOKI_URL not set)")
        return

    if not loki_url.endswith("/loki/api/v1/push"):
        loki_url = f"{loki_url.rstrip('/')}/loki/api/v1/push"

    parsed = urlparse(loki_url)
    host = parsed.hostname or "localhost"
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    try:
        with socket.create_connection((host, port), timeout=0.5):
            pass
    except OSError as e:
        logging.warning(
            f"Loki at {host}:{port} unreachable ({e}); skipping Loki handler for {service_name}"
        )
        return

    handler = logging_loki.LokiHandler(
        url=loki_url,
        tags={"job": service_name},
        version="1",
    )
    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    logging.info(f"Loki logging initialized for {service_name} at {loki_url}")
