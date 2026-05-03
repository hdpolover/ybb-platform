# YBB Platform Documentation

## Overview

Welcome to the YBB Platform documentation. This directory contains comprehensive guides for development, deployment, and architecture.

## Quick Links

| Document | Description |
|----------|-------------|
| [Platform Overview](./OVERVIEW.md) | What is YBB Platform and why it exists |
| [Architecture](./architecture.md) | System design and service communication |
| [Setup Guide](./setup.md) | Development environment setup |
| [Deployment](./deployment.md) | Production deployment guide |
| [Ambassador System](./AMBASSADOR_REFERRAL.md) | Anonymous referral & tracking guide |
| [Service Credentials](./SERVICE_CREDENTIALS.md) | Default logins and access info |
| [Clean Architecture](./clean-architecture-guide.md) | Code organization principles |

## Development URLs

| Service | URL |
|---------|-----|
| **Admin Dashboard** | http://localhost:4001 |
| **API Gateway** | http://localhost:4000 |
| **API Documentation** | http://localhost:4000/api/docs |
| **Payment Service** | http://localhost:8002 |
| **File Service** | http://localhost:8001 |
| **File Service Docs** | http://localhost:8001/docs |
| **Notification Service** | http://localhost:4002 |
| **Landing Content Service** | http://localhost:4003 |
| **MinIO Console** | http://localhost:9001 |
| **RabbitMQ Console** | http://localhost:15672 |
| **pgAdmin** | http://localhost:5050 |
| **Grafana** | http://localhost:43000 |
| **Prometheus** | http://localhost:49090 |

## Internal Security Notes

- `services/file` now uses `FILE_SERVICE_INTERNAL_KEY` to protect private file/media/image endpoints.
- Set the same value in `services/api` (`FILE_SERVICE_INTERNAL_KEY`) and `services/file` (`FILE_SERVICE_INTERNAL_KEY`).
- In production-like environments, missing/invalid key is rejected.

## Production URLs

| Service | URL |
|---------|-----|
| **Admin Dashboard** | https://admin.ybbhub.com |
| **API Gateway** | https://api.ybbhub.com |
| **Payment Service** | https://payments.ybbhub.com |
| **File Service** | https://files.ybbhub.com |
| **Notification Service** | https://notification.ybbhub.com |
| **Landing Content Service** | Internal only (`http://ybb-prod-landing-content:4003` on `dokploy-network`) |
| **MinIO Console** | https://minio.ybbhub.com |
| **S3 Storage** | https://s3.ybbhub.com |
| **RabbitMQ Console** | https://rabbitmq.ybbhub.com |
| **Grafana** | https://grafana.ybbhub.com |
| **Prometheus** | https://prometheus.ybbhub.com |
| **pgAdmin** | https://pgadmin.ybbhub.com |

## Support

For issues and questions, please open an issue on GitHub or contact the development team.
