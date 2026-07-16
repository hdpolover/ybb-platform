import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !user.role) {
        // If user has no role but resource requires one, deny
        return false;
    }

    // Check if user has any of the required roles
    // Assuming user.role is a string or array of strings
    if (Array.isArray(user.role)) {
        return requiredRoles.some((role) => user.role.includes(role));
    }
    return requiredRoles.includes(user.role);
  }
}
