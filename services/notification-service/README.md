# YBB Notification Service

NestJS-based microservice for handling platform notifications via RabbitMQ message queue.

## Overview

The Notification Service listens for events from other services via RabbitMQ and sends notifications:
- **Email** - Transactional and notification emails
- **In-App** - Real-time notifications (planned)
- **Push** - Mobile push notifications (planned)

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| NestJS | 10.x | Node.js framework |
| TypeScript | 5.x | Type safety |
| RabbitMQ | 3.x | Message queue for events |

## Architecture

```
notification-service/
├── src/
│   ├── main.ts                  # Application bootstrap
│   ├── app.module.ts            # Root module
│   ├── app.controller.ts        # Health check endpoint
│   ├── app.service.ts           # Base service
│   └── modules/
│       ├── email/               # Email sending module
│       └── notifications/       # Core notification handling
├── Dockerfile.dev              # Development with hot reload
└── package.json
```

## Event Types

The service listens for RabbitMQ events:

| Event | Description | Action |
|-------|-------------|--------|
| `payment.succeeded` | Payment completed | Send confirmation email |
| `payment.failed` | Payment failed | Send failure notification |
| `application.submitted` | New application | Send confirmation |
| `application.approved` | Application approved | Send approval email |
| `application.rejected` | Application rejected | Send rejection email |

## Getting Started

### Prerequisites
- Node.js 18+
- RabbitMQ (or Docker Compose)

### Development

```bash
npm install
npm run start:dev
```

### With Docker

```bash
# From project root
docker-compose up notification-service
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Service port | `4002` |
| `NODE_ENV` | Environment | `development` |
| `RABBITMQ_URL` | RabbitMQ connection | `amqp://guest:guest@rabbitmq:5672/` |
| `SMTP_HOST` | Email server host | - |
| `SMTP_PORT` | Email server port | `587` |
| `SMTP_USER` | Email username | - |
| `SMTP_PASS` | Email password | - |

## Available Scripts

```bash
npm run start:dev    # Development with hot reload
npm run start:prod   # Production mode
npm run build        # Compile TypeScript
npm run test         # Run tests
```

## RabbitMQ Integration

```typescript
@RabbitSubscribe({
  exchange: 'payment-events',
  routingKey: 'payment.succeeded',
  queue: 'notification-payment-queue',
})
async handlePaymentSuccess(data: PaymentSuccessDto) {
  await this.emailService.sendPaymentConfirmation(data);
}
```

## Health Check

```bash
curl http://localhost:4002/health
# {"status": "ok"}
```

## Future Enhancements

- [ ] Email templates with Handlebars
- [ ] In-app notification storage
- [ ] Push notifications (Firebase/APNs)
- [ ] Notification preferences per user
- [ ] Retry mechanism for failed deliveries

## Related Documentation

- [Architecture](../../docs/architecture.md)
- [Infrastructure - RabbitMQ](../../infrastructure/README.md)

## License

Private - YBB Platform
