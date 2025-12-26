# Grafana Configuration

Grafana provides visualization dashboards for monitoring the YBB Platform.

## Access

| Environment | URL | Credentials |
|-------------|-----|-------------|
| Development | http://localhost:43000 | admin / admin123 |
| Production | https://grafana.ybbhub.com | admin / (from .env) |

## Configuration

### Data Source

Prometheus is configured as the default data source in `provisioning/datasources/datasource.yml`:

```yaml
datasources:
  - name: Prometheus
    type: prometheus
    url: http://prometheus:9090
    isDefault: true
```

### Dashboards

Pre-configured dashboards are in `provisioning/dashboards/`:

- **Platform Overview** - Overall system health
- **API Gateway** - NestJS API metrics
- **Database** - PostgreSQL performance

## Adding Custom Dashboards

1. Create dashboard JSON in `provisioning/dashboards/`
2. Restart Grafana: `docker-compose restart grafana`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `GF_SECURITY_ADMIN_USER` | Admin username | `admin` |
| `GF_SECURITY_ADMIN_PASSWORD` | Admin password | `admin123` |
| `GF_USERS_ALLOW_SIGN_UP` | Allow self-registration | `false` |

## Useful Queries

### Request Rate
```promql
rate(http_requests_total[5m])
```

### Error Rate
```promql
rate(http_requests_total{status=~"5.."}[5m])
```

### Response Time
```promql
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```
