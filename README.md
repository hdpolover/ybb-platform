# YBB Platform

YBB Platform is a microservices workspace containing the API gateway, payment, file, notification, admin dashboard, and landing content services.

## Services

| Service | Directory | App Port |
| --- | --- | ---: |
| API Gateway | `services/api` | 4000 |
| Payment Service | `services/payment` | 8002 |
| File Service | `services/file` | 8001 |
| Notification Service | `services/notification` | 4002 |
| Admin Dashboard | `services/admin-dashboard` | 4001 |
| Landing Content Service | `services/landing-content` | 4003 |

## Quick start

### Prerequisites
- Docker + Docker Compose
- Make

### Run all services
```bash
make start
make status
make stop
```

### Run one service
```bash
make start-api
make logs-api
make restart-api
```

## Documentation

- Main docs index: [`docs/README.md`](./docs/README.md)
- Optimization roadmap and execution log: [`docs/PLATFORM_OPTIMIZATION_RECOMMENDATIONS.md`](./docs/PLATFORM_OPTIMIZATION_RECOMMENDATIONS.md)
- Potential future service split notes: [`docs/POTENTIAL_NEW_SERVICES.md`](./docs/POTENTIAL_NEW_SERVICES.md)

## Notes

- Service-specific envs and compose files live in each `services/<name>/` directory.
- Root orchestration behavior is defined in [`Makefile`](./Makefile).
