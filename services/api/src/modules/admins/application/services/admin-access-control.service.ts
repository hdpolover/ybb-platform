import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { normalizePermissions } from '@shared/admin-access-response';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  getAdminRank,
  isSuperAdminRole,
  isSuperAdminTier,
  RankedRole,
} from '../utils/admin-rank.util';

export type AdminTargetAction = 'update' | 'reset-password' | 'delete' | 'restore';

export type AdminTargetChanges = {
  roleId?: string | null;
  isActive?: boolean;
};

// Schema default for admins.access_level; POST /admins has no way to set it.
const NEW_ADMIN_ACCESS_LEVEL = 1;

const ACCESS_INCLUDE = {
  role: { select: { name: true, permissions: true } },
  adminBrands: { select: { permissions: true } },
  adminPrograms: { select: { permissions: true } },
} satisfies Prisma.AdminInclude;

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

  /**
   * Rank ceiling for POST /admins: the new admin (level 1 plus the chosen role)
   * must rank strictly below the creator. Super-admin tier is exempt.
   */
  async assertCanCreateAdmin(currentUser: CurrentUserData, roleId?: string | null): Promise<void> {
    const actor = await this.getCurrentAdminAccess(currentUser);
    if (isSuperAdminTier(actor)) return;

    const role = await this.findRole(roleId);
    if (getAdminRank({ accessLevel: NEW_ADMIN_ACCESS_LEVEL, role }) >= getAdminRank(actor)) {
      throw new ForbiddenException('You cannot create an administrator at or above your own rank.');
    }
  }

  /**
   * Rank rule for mutating an existing admin. assertCanManageAdmins only says
   * the caller may manage admins at all; without this an "Admin" (level 800)
   * could reset a Super Admin's password and log in as them.
   *
   * Non-super callers must outrank the target both as it is and as it would be
   * after a role change. Super-admin tier may manage anyone, each other included.
   * Self: profile edits only; never your own role, status or deletion.
   */
  async assertCanManageAdmin(
    currentUser: CurrentUserData,
    targetAdminId: string,
    action: AdminTargetAction,
    changes: AdminTargetChanges = {},
  ): Promise<void> {
    const actor = await this.getCurrentAdminAccess(currentUser);
    const target = await this.prisma.admin.findFirst({
      // Restore acts on a deleted row; the explicit filter overrides the
      // soft-delete extension's injected `deletedAt: null`.
      where: { id: targetAdminId, ...(action === 'restore' ? { deletedAt: { not: null } } : {}) },
      include: { ...ACCESS_INCLUDE, user: { select: { isActive: true } } },
    });

    if (!target) {
      throw new NotFoundException('Admin not found');
    }

    const isRoleChange = changes.roleId !== undefined && changes.roleId !== target.roleId;

    if (target.id === currentUser.adminId) {
      if (action === 'delete') {
        throw new ForbiddenException('You cannot delete your own administrator account.');
      }
      if (isRoleChange) {
        throw new ForbiddenException('You cannot change your own role.');
      }
      if (changes.isActive !== undefined && changes.isActive !== target.user.isActive) {
        throw new ForbiddenException('You cannot change your own account status.');
      }
      if (action === 'update') return;
    }

    if (isSuperAdminTier(actor)) return;

    const nextRole = isRoleChange ? await this.findRole(changes.roleId) : target.role;
    const targetRank = Math.max(getAdminRank(target), getAdminRank({ ...target, role: nextRole }));

    if (targetRank >= getAdminRank(actor)) {
      throw new ForbiddenException('You cannot manage an administrator at or above your own rank.');
    }
  }

  /**
   * Rank ceiling for /admin-roles writes. Editing a role edits every admin
   * holding it, so a non-super caller may not touch a super-admin role, mint
   * one, or change a role held by anyone they do not outrank (their own role
   * included, which is how they would otherwise raise their own permissions).
   */
  async assertCanWriteRole(
    currentUser: CurrentUserData,
    current: ({ id: string } & RankedRole) | null,
    next: RankedRole,
  ): Promise<void> {
    const actor = await this.getCurrentAdminAccess(currentUser);
    if (isSuperAdminTier(actor)) return;

    if (isSuperAdminRole(current) || isSuperAdminRole(next)) {
      throw new ForbiddenException('Only a super admin can create or change a super-admin role.');
    }

    if (!current) return;

    const holders = await this.prisma.admin.findMany({
      where: { roleId: current.id, deletedAt: null },
      select: {
        accessLevel: true,
        customPermissions: true,
        adminBrands: { select: { permissions: true } },
        adminPrograms: { select: { permissions: true } },
      },
    });

    const actorRank = getAdminRank(actor);
    if (holders.some((holder) => getAdminRank({ ...holder, role: current }) >= actorRank)) {
      throw new ForbiddenException(
        'You cannot change a role held by an administrator at or above your own rank, including your own.',
      );
    }
  }

  private async findRole(roleId?: string | null) {
    if (!roleId) return null;
    return this.prisma.adminRole.findFirst({
      where: { id: roleId },
      select: { name: true, permissions: true },
    });
  }

  private async getCurrentAdminAccess(currentUser: CurrentUserData): Promise<AdminAccessSnapshot> {
    if (!currentUser.adminId) {
      throw new UnauthorizedException('Admin access required');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: currentUser.adminId },
      include: ACCESS_INCLUDE,
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
