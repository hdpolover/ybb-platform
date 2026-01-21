# Prometheus Configuration

Prometheus collects metrics from all YBB Platform services.

## Access

| Environment | URL |
|-------------|-----|
| Development | http://localhost:49090 |
| Production | https://prometheus.ybbhub.com |

## Configuration

The main configuration is in `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  - job_name: 'api-gateway'
    static_configs:
      - targets: ['api:4000']

  - job_name: 'payment-service'
    static_configs:
      - targets: ['payment-service:8002']

  - job_name: 'file-service'
    static_configs:
      - targets: ['file-service:8001']

  - job_name: 'notification-service'
    static_configs:
      - targets: ['notification-service:4002']
```

## Scrape Targets

| Service | Endpoint | Port |
|---------|----------|------|
| API Gateway | /metrics | 4000 |
| Payment Service | /metrics | 8002 |
| File Service | /metrics | 8001 |
| Notification Service | /metrics | 4002 |

## Useful PromQL Queries

### Service Health
```promql
up{job="api-gateway"}
```

### Request Rate
```promql
rate(http_requests_total[5m])
```

### Memory Usage
```promql
process_resident_memory_bytes
```

### CPU Usage
```promql
rate(process_cpu_seconds_total[5m])
```

## Alerts (Optional)

Add alert rules in `alert.rules.yml`:

```yaml
groups:
  - name: service-alerts
    rules:
      - alert: ServiceDown
        expr: up == 0
        for: 1m
        labels:
          severity: critical
```

## Data Retention

Default retention is 15 days. Configure with:

```yaml
--storage.tsdb.retention.time=30d
```
