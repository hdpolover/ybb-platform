# Core Domain Layer

This directory contains the core business logic and domain entities.

## Structure

- **entities/** - Domain entities (business objects with identity)
- **interfaces/** - Repository and service contracts
  - **repositories/** - Repository interface definitions
  - **services/** - Domain service interface definitions
- **exceptions/** - Domain-specific exceptions
- **value-objects/** - Immutable value objects (e.g., Email, Money)

## Rules

1. **NO external dependencies** - This layer should not depend on frameworks or infrastructure
2. **Pure business logic** - Only business rules and domain concepts
3. **Framework agnostic** - Can be tested without any infrastructure

## Example

```typescript
// entities/user.entity.ts
export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email, // Value object
    public firstName: string,
    public lastName: string,
  ) {}
  
  // Domain methods
  updateProfile(firstName: string, lastName: string): void {
    // Business validation
    this.firstName = firstName;
    this.lastName = lastName;
  }
}

// interfaces/repositories/user.repository.interface.ts
export interface IUserRepository {
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  save(user: User): Promise<User>;
  delete(id: string): Promise<void>;
}
```
