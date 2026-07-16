import logging
import os
import socket
from urllib.parse import urlparse

from opentelemetry import trace
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor


def _parse_endpoint(endpoint: str) -> tuple[str, int]:
    """Accepts either a full URL (http://host:port) or bare host:port."""
    if "://" in endpoint:
        parsed = urlparse(endpoint)
        host = parsed.hostname or "localhost"
        port = parsed.port or (443 if parsed.scheme == "https" else 4317)
        return host, port
    if ":" in endpoint:
        host, _, port_str = endpoint.rpartition(":")
        return host or "localhost", int(port_str)
    return endpoint or "localhost", 4317


def init_telemetry(app, service_name="ybb-file"):
    """Enable OTLP tracing if the collector is reachable; otherwise skip.

    Absent a running OTEL collector (typical in local dev), BatchSpanProcessor
    fires grpc UNAVAILABLE errors every export cycle and dumps long tracebacks
    into stdout. Same rationale as `init_loki_logging` — fail silent, keep logs
    readable.
    """
    # FastAPI is always instrumented — spans go nowhere if no processor is set.
    FastAPIInstrumentor.instrument_app(app)

    endpoint = os.getenv("OTEL_EXPORTER_OTLP_ENDPOINT", "").strip()
    if not endpoint:
        logging.info(f"OTEL tracing disabled for {service_name} (OTEL_EXPORTER_OTLP_ENDPOINT not set)")
        return None

    host, port = _parse_endpoint(endpoint)
    try:
        with socket.create_connection((host, port), timeout=0.5):
            pass
    except OSError as e:
        logging.warning(
            f"OTEL collector at {host}:{port} unreachable ({e}); skipping span exporter for {service_name}"
        )
        return None

    resource = Resource.create({"service.name": service_name})
    provider = TracerProvider(resource=resource)
    exporter = OTLPSpanExporter(endpoint=endpoint, insecure=True)
    provider.add_span_processor(BatchSpanProcessor(exporter))
    trace.set_tracer_provider(provider)
    return provider
