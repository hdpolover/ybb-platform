# Shared Utilities

Cross-cutting concerns and utilities shared across all modules.

## Structure

- **decorators/** - Custom decorators (e.g., @CurrentUser, @Roles)
- **interceptors/** - Request/response interceptors (e.g., logging, transformation)
- **filters/** - Exception filters (error handling)
- **pipes/** - Validation and transformation pipes
- **utils/** - Utility functions

## Guidelines

1. **No business logic** - Only technical utilities
2. **Reusable** - Can be used by any module
3. **Framework-specific** - Can depend on NestJS

## Example

```typescript
// decorators/current-user.decorator.ts
export const CurrentUser = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);

// filters/domain-exception.filter.ts
@Catch(DomainException)
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: DomainException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    
    response.status(400).json({
      statusCode: 400,
      message: exception.message,
    });
  }
}
```
