import logging
import logging_loki
import os

def init_loki_logging(service_name="ybb-file"):
    loki_url = os.getenv("LOKI_URL", "http://localhost:3100")
    if not loki_url.endswith("/loki/api/v1/push"):
        loki_url = f"{loki_url.rstrip('/')}/loki/api/v1/push"
        
    handler = logging_loki.LokiHandler(
        url=loki_url,
        tags={"job": service_name},
        version="1",
    )
    
    logger = logging.getLogger()
    logger.addHandler(handler)
    logger.setLevel(logging.INFO)
    
    logging.info(f"Loki logging initialized for {service_name} at {loki_url}")
