import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { normalizePermissions } from '@shared/admin-access-response';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

type AdminAccessSnapshot = {
  accessLevel: number;
  canManageAdmins: boolean;
  canAssignRoles: boolean;
  customPermissions: unknown;
  role: {
    name: string;
    permissions: unknown;
  } | null;
  adminBrands: Array<{ permissions: unknown }>;
  adminPrograms: Array<{ permissions: unknown }>;
};

@Injectable()
export class AdminAccessControlService {
  constructor(private readonly prisma: PrismaService) {}

  async assertCanManageAdmins(currentUser: CurrentUserData): Promise<void> {
    const access = await this.getCurrentAdminAccess(currentUser);
    if (
      access.canManageAdmins ||
      access.accessLevel >= 10 ||
      this.hasPermission(access, ['*', 'admin.*', 'admin.manage', 'platform.*'])
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to manage administrators.');
  }

  async assertCanAssignRoles(currentUser: CurrentUserData): Promise<void> {
    const access = await this.getCurrentAdminAccess(currentUser);
    if (
      access.canAssignRoles ||
      access.accessLevel >= 10 ||
      this.hasPermission(access, ['*', 'admin.*', 'admin.manage', 'roles.manage', 'platform.*'])
    ) {
      return;
    }

    throw new ForbiddenException('You do not have permission to manage admin roles.');
  }

  private async getCurrentAdminAccess(currentUser: CurrentUserData): Promise<AdminAccessSnapshot> {
    if (!currentUser.adminId) {
      throw new UnauthorizedException('Admin access required');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: currentUser.adminId },
      include: {
        role: {
          select: {
            name: true,
            permissions: true,
          },
        },
        adminBrands: {
          select: {
            permissions: true,
          },
        },
        adminPrograms: {
          select: {
            permissions: true,
          },
        },
      },
    });

    if (!admin || admin.deletedAt) {
      throw new UnauthorizedException('Admin access required');
    }

    return admin;
  }

  private hasPermission(access: AdminAccessSnapshot, candidates: string[]): boolean {
    const permissionSet = new Set(
      [
        ...normalizePermissions(access.role?.permissions),
        ...normalizePermissions(access.customPermissions),
        ...access.adminBrands.flatMap((assignment) => normalizePermissions(assignment.permissions)),
        ...access.adminPrograms.flatMap((assignment) => normalizePermissions(assignment.permissions)),
      ].map((permission) => permission.toLowerCase()),
    );

    return candidates.some((candidate) => permissionSet.has(candidate.toLowerCase()));
  }
}
