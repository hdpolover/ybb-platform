import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { adminRoleSlug, normalizePermissions } from '@shared/admin-access-response';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import {
  getAdminRank,
  isReservedRoleName,
  isSuperAdminRole,
  isSuperAdminTier,
  RankedRole,
} from '../utils/admin-rank.util';

export type AdminTargetAction = 'update' | 'reset-password' | 'delete' | 'restore';

export type AdminTargetChanges = {
  roleId?: string | null;
  isActive?: boolean;
  brandIds?: string[];
  programIds?: string[];
};

/** True when `next` is absent (field not sent) or names exactly the current ids. */
function sameIds(next: string[] | undefined, current: string[]): boolean {
  if (next === undefined) return true;
  const wanted = new Set(next);
  return wanted.size === new Set(current).size && current.every((id) => wanted.has(id));
}

// Schema default for admins.access_level; POST /admins has no way to set it.
const NEW_ADMIN_ACCESS_LEVEL = 1;

const ACCESS_INCLUDE = {
  role: { select: { name: true, permissions: true } },
  adminBrands: { select: { brandId: true, permissions: true } },
  adminPrograms: { select: { programId: true, permissions: true } },
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

// Permissions that widen scope or grant admin management. Below super tier a
// caller may only hand these out (via a role) if they already hold them, so a
// level-800 Admin cannot mint a platform_access / roles.manage sock puppet.
const PRIVILEGED_PERMISSIONS = ['platform_access', 'platform.manage', 'admin.manage', 'roles.manage'];

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
    this.assertGrantsWithinActor(actor, role);
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
      // The dashboard resends the current assignments on a profile save; only a change is refused.
      if (
        !sameIds(changes.brandIds, target.adminBrands.map((assignment) => assignment.brandId)) ||
        !sameIds(changes.programIds, target.adminPrograms.map((assignment) => assignment.programId))
      ) {
        throw new ForbiddenException('You cannot change your own brand or program assignments.');
      }
      if (action === 'update') return;
    }

    if (isSuperAdminTier(actor)) return;

    const nextRole = isRoleChange ? await this.findRole(changes.roleId) : target.role;
    if (isRoleChange) this.assertGrantsWithinActor(actor, nextRole);
    const targetRank = Math.max(getAdminRank(target), getAdminRank({ ...target, role: nextRole }));

    if (targetRank >= getAdminRank(actor)) {
      throw new ForbiddenException('You cannot manage an administrator at or above your own rank.');
    }
  }

  /**
   * Rank ceiling for /admin-roles writes. Editing a role edits every admin
   * holding it, so a non-super caller may not touch a super-admin role, mint
   * one, give a role a name whose token slug is a UserRole value, or change a
   * role held by anyone they do not outrank, before or after the edit (their
   * own role included, which is how they would otherwise raise their own
   * permissions). The grant ceiling covers only what an edit adds, so renaming
   * a role does not require holding every permission already on it.
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
    const isNameChange = !!next?.name && adminRoleSlug(next.name.trim()) !== adminRoleSlug((current?.name ?? '').trim());
    if (isNameChange && isReservedRoleName(next?.name)) {
      throw new ForbiddenException('Only a super admin can give a role a reserved name.');
    }
    this.assertGrantsWithinActor(actor, next, current);

    if (!current) return;

    const holders = await this.prisma.admin.findMany({
      where: { roleId: current.id, deletedAt: null },
      select: {
        accessLevel: true,
        canManageAdmins: true,
        canAssignRoles: true,
        customPermissions: true,
        adminBrands: { select: { permissions: true } },
        adminPrograms: { select: { permissions: true } },
      },
    });

    const actorRank = getAdminRank(actor);
    const holderRank = (holder: (typeof holders)[number]) =>
      Math.max(getAdminRank({ ...holder, role: current }), next ? getAdminRank({ ...holder, role: next }) : 0);
    if (holders.some((holder) => holderRank(holder) >= actorRank)) {
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

  /** `alreadyGranted`: the role as it stands, for an edit; only what the edit adds is checked. */
  private assertGrantsWithinActor(actor: AdminAccessSnapshot, role: RankedRole, alreadyGranted?: RankedRole): void {
    const held = new Set([...this.permissionSet(actor), ...this.lowerPermissions(alreadyGranted?.permissions)]);
    const missing = this.lowerPermissions(role?.permissions)
      // Any wildcard counts as privileged too: matching is exact today, but a
      // future prefix matcher must not turn a granted "roles.*" into a bypass.
      .filter((permission) => (PRIVILEGED_PERMISSIONS.includes(permission) || permission.endsWith('*')) && !held.has(permission));
    if (missing.length > 0) {
      throw new ForbiddenException(`You cannot grant permissions you do not hold: ${missing.join(', ')}.`);
    }
  }

  private lowerPermissions(value: unknown): string[] {
    return normalizePermissions(value).map((permission) => permission.trim().toLowerCase());
  }

  private permissionSet(access: AdminAccessSnapshot): Set<string> {
    return new Set([
      ...this.lowerPermissions(access.role?.permissions),
      ...this.lowerPermissions(access.customPermissions),
      // Assignment rows (brand or program) scope access inside one program; they neither
      // grant admin management nor raise the ceiling for what a role may hand out.
    ]);
  }

  private hasPermission(access: AdminAccessSnapshot, candidates: string[]): boolean {
    const permissionSet = this.permissionSet(access);
    return candidates.some((candidate) => permissionSet.has(candidate.toLowerCase()));
  }
}
