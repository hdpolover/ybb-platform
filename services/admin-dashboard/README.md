# YBB Admin Dashboard

Next.js-based administration interface for managing the YBB (Youth Break the Boundaries) Platform.

## Overview

The Admin Dashboard provides a web-based interface for platform administrators to manage:
- **Programs** - Create and manage YBB programs and events
- **Users** - View and manage user accounts
- **Admins** - Manage administrator accounts and roles
- **Categories** - Organize programs by category
- **Analytics** - View platform metrics and statistics
- **Settings** - Configure platform settings

## Technology Stack

| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 16.0.5 | React framework with App Router |
| React | 19.2.0 | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 4.x | Utility-first CSS |
| Recharts | 3.5.1 | Data visualization |
| Heroicons | 2.2.0 | Icons |

## Project Structure

```
admin-dashboard/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout
│   ├── page.tsx                 # Landing/home page
│   ├── globals.css              # Global styles
│   ├── login/                   # Authentication
│   ├── platform/                # Main dashboard area
│   │   ├── layout.tsx          # Dashboard layout (sidebar, header)
│   │   ├── page.tsx            # Dashboard home
│   │   ├── admins/             # Admin management
│   │   ├── analytics/          # Analytics views
│   │   ├── categories/         # Category management
│   │   ├── programs/           # Program management
│   │   ├── settings/           # Settings
│   │   └── users/              # User management
│   ├── programs/                # Public program views
│   ├── components/              # Shared components
│   └── contexts/                # React contexts
├── public/                      # Static assets
├── Dockerfile.dev              # Development with hot reload
├── Dockerfile.prod             # Production build
└── package.json
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Development

```bash
npm install
npm run dev
```

Access at: **http://localhost:4001**

### With Docker

```bash
# From project root
docker-compose up admin-dashboard
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NEXT_PUBLIC_API_URL` | API Gateway base URL | `http://localhost:4000/v1` |
| `PORT` | Dashboard port | `4001` |
| `NODE_ENV` | Environment | `development` |

## Available Scripts

```bash
npm run dev      # Development server with hot reload
npm run build    # Build production bundle
npm run start    # Start production server
npm run lint     # Run ESLint
```

## API Integration

The dashboard communicates with the API Gateway:

```typescript
const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/programs`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }
});
```

## Production Deployment

```bash
# Build and run
npm run build
npm run start

# Or with Docker
docker build -f Dockerfile.prod -t ybb-admin-dashboard:prod .
```

## Related Documentation

- [Architecture](../../docs/architecture.md)
- [Setup Guide](../../docs/setup.md)
- [API Documentation](http://localhost:4000/api/docs)

## License

Private - YBB Platform
