# YBB Platform - Overview

## What is YBB Platform?

The **YBB (Youth Break the Boundaries) Platform** is a comprehensive web application for managing youth empowerment programs, participant applications, and payments. It provides tools for:

- **Program Management** - Create and manage educational programs and events
- **Participant Applications** - Handle registration and application workflows
- **Payment Processing** - Automated and manual payment collection
- **File Management** - Document uploads, certificates, and reports
- **Notifications** - Email and system notifications
- **Analytics** - Track program performance and engagement

## Business Domain

YBB Platform serves organizations that run youth development programs:

```
┌─────────────────────────────────────────────────────────────┐
│                    YBB Platform                              │
├─────────────────────────────────────────────────────────────┤
│  Programs     │  Applications  │  Payments    │  Files      │
│  - Events     │  - Register    │  - Automatic │  - Uploads  │
│  - Categories │  - Review      │  - Manual    │  - Certs    │
│  - Sessions   │  - Approve     │  - Receipts  │  - Reports  │
└─────────────────────────────────────────────────────────────┘
```

## Architecture at a Glance

The platform is built as a **microservices architecture**:

| Service | Technology | Responsibility |
|---------|------------|----------------|
| **API Gateway** | NestJS (TypeScript) | Authentication, routing, main business logic |
| **Admin Dashboard** | Next.js (React) | Web interface for administrators |
| **Payment Service** | Go | Payment processing with Midtrans/Stripe |
| **File Service** | Python (FastAPI) | File storage, PDF/Excel generation, certificates |
| **Notification Service** | NestJS | Email notifications via RabbitMQ events |

## Infrastructure

| Component | Technology | Purpose |
|-----------|------------|---------|
| **Database** | PostgreSQL 16 | Primary data storage |
| **Cache** | Redis | Session & query caching |
| **Storage** | MinIO | S3-compatible file storage |
| **Message Queue** | RabbitMQ | Event-driven communication |
| **Monitoring** | Prometheus + Grafana | Metrics and dashboards |
| **Reverse Proxy** | Nginx | Load balancing, SSL termination |

## Key Features

### For Administrators
- Manage programs and events
- Review and approve applications
- Process payments (automatic and manual)
- Generate reports and certificates
- Monitor platform analytics

### For Participants
- Browse available programs
- Submit applications with documents
- Make payments online
- Download certificates and receipts

## Getting Started

1. **Development Setup**: See [Setup Guide](./setup.md)
2. **Architecture Details**: See [Architecture](./architecture.md)
3. **Deployment**: See [Deployment Guide](./deployment.md)

## Quick Start

```bash
git clone https://github.com/hdpolover/ybb-platform.git
cd ybb-platform
make start
```

Access Points:
- Admin Dashboard: http://localhost:4001
- API Gateway: http://localhost:4000
- API Docs: http://localhost:4000/api/docs

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: NestJS, Go, Python (FastAPI)
- **Database**: PostgreSQL 16, Redis 7
- **Infrastructure**: Docker, Docker Compose, Nginx
- **CI/CD**: GitHub Actions

## Repository Structure

```
ybb-platform/
├── services/           # Microservices
│   ├── api/           # NestJS API Gateway
│   ├── admin-dashboard/ # Next.js Admin UI
│   ├── payment-service/ # Go Payment Processing
│   ├── file-service/   # Python File Management
│   └── notification-service/ # NestJS Notifications
├── infrastructure/     # Docker, Nginx, PostgreSQL configs
├── docs/              # Documentation
└── scripts/           # Automation scripts
```

## License

Proprietary - YBB Platform
