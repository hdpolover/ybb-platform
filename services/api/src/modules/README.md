# Feature Modules

This directory contains feature-based modules following clean architecture.

## Module Structure

Each module follows this structure:

```
module-name/
├── module-name.module.ts
├── application/          # Use Cases (Business Logic)
│   ├── commands/        # Write operations (Create, Update, Delete)
│   │   ├── create-entity.command.ts
│   │   └── handlers/
│   │       └── create-entity.handler.ts
│   ├── queries/         # Read operations (Get, List)
│   │   ├── get-entity.query.ts
│   │   └── handlers/
│   │       └── get-entity.handler.ts
│   └── dto/             # Data Transfer Objects
│       ├── create-entity.dto.ts
│       └── entity-response.dto.ts
├── infrastructure/       # Technical Implementation
│   ├── persistence/     # Database repositories
│   │   └── entity.repository.ts
│   ├── services/        # External services
│   └── mappers/         # Domain ↔ DTO mappers
└── presentation/         # API Layer
    ├── entity.controller.ts
    └── dto/
        ├── create-entity-request.dto.ts
        └── entity-response.dto.ts
```

## Existing Modules

- **auth/** - Authentication and authorization
- **users/** - User management
- **programs/** - YBB programs
- **applications/** - Program applications
- **health/** - Health check endpoints

## Module Communication

Modules communicate through:
1. **Exported services** via module exports
2. **Domain events** for async communication
3. **Well-defined interfaces** for dependencies

## Example

```typescript
// users.module.ts
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [
    CreateUserHandler,
    GetUserHandler,
    UserRepository,
  ],
  controllers: [UsersController],
  exports: [GetUserHandler], // Export for other modules
})
export class UsersModule {}
```
