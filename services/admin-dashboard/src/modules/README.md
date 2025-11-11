# Feature Modules

This directory contains feature-based modules for the Admin Dashboard following clean architecture.

## Module Structure

Each module follows this structure:

```
module-name/
├── domain/                   # Domain Layer
│   ├── entities/            # Frontend domain models
│   └── interfaces/          # API client interfaces
├── application/             # Application Layer
│   ├── use-cases/          # Business logic (use cases)
│   └── dto/                # Data Transfer Objects
├── infrastructure/          # Infrastructure Layer
│   └── api/                # API client implementations
└── presentation/            # Presentation Layer
    ├── components/         # React components
    └── hooks/              # Custom hooks
```

## Existing Modules

- **auth/** - Authentication and user session
- **users/** - User management
- **programs/** - YBB programs
- **applications/** - Program applications

## Flow Example

```
User Action → Component → Hook → Use Case → API Client → Backend
     ↓          ↓          ↓         ↓           ↓
Presentation  Present.  Present.  Application  Infrastructure
```

## Example

```typescript
// users/infrastructure/api/users-api.ts
export class UsersApi implements IUsersApi {
  async getUsers(): Promise<UserDto[]> {
    const response = await fetch('/api/v1/users');
    return response.json();
  }
}

// users/application/use-cases/get-users.use-case.ts
export class GetUsersUseCase {
  constructor(private api: IUsersApi) {}
  
  async execute(): Promise<UserViewModel[]> {
    const users = await this.api.getUsers();
    return users.map(u => this.toViewModel(u));
  }
}

// users/presentation/hooks/use-users.ts
export function useUsers() {
  const api = new UsersApi();
  const useCase = new GetUsersUseCase(api);
  
  return useQuery(['users'], () => useCase.execute());
}

// users/presentation/components/UserList.tsx
export function UserList() {
  const { data: users, isLoading } = useUsers();
  
  if (isLoading) return <Spinner />;
  return <Table data={users} />;
}
```

## Best Practices

1. **No API calls in components** - Use hooks that call use cases
2. **Use cases contain logic** - Transform and validate data
3. **Components are dumb** - Just display data
4. **Type safety** - Use TypeScript interfaces throughout
