// services/api/src/modules/admins/application/services/admin-invite.service.ts
import { BadRequestException, ConflictException, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AdminAccessControlService } from './admin-access-control.service';
import { AdminPasswordLinkService } from './admin-password-link.service';
import { CreateAdminHandler } from '../commands/handlers/create-admin.handler';
import { CreateAdminCommand } from '../commands/create-admin.command';

export type InviteAdminParams = {
  email: string;
  fullName: string;
  roleId: string;
  programIds: string[];
};

export type InviteAdminResult = { adminId: string; roleId: string; programIds: string[]; emailSent: boolean };

const unique = <T>(values: T[]) => Array.from(new Set(values));

/**
 * The one way an admin is onboarded without anybody typing a password: create the admin with a
 * null credential (attaching to an existing participant account when there is one) and email a
 * single-use set-password link. Used by access-request approval and by POST /admins/invite.
 */
@Injectable()
export class AdminInviteService {
  private readonly logger = new Logger(AdminInviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AdminAccessControlService,
    private readonly createAdmin: CreateAdminHandler,
    private readonly links: AdminPasswordLinkService,
  ) {}

  /** Case-insensitive on purpose: CreateAdminHandler's own duplicate check is exact-match. */
  async findAdminIdByEmail(email: string): Promise<string | null> {
    const user = await this.prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' }, admin: { isNot: null } },
      select: { admin: { select: { id: true } } },
    });
    return user?.admin?.id ?? null;
  }

  /** What the invite dialog warns about: an existing admin, or participant accounts that get converted. */
  async check(email: string) {
    const normalized = email.trim().toLowerCase();
    const users = await this.prisma.user.findMany({
      where: { email: { equals: normalized, mode: 'insensitive' }, deletedAt: null },
      select: { admin: { select: { id: true } }, brand: { select: { name: true } } },
    });
    const adminUser = users.find((u) => u.admin);
    const participantBrands = unique(users.filter((u) => !u.admin).map((u) => u.brand.name)).sort();
    return { existingAdminId: adminUser?.admin?.id ?? null, participantBrands };
  }

  async invite(currentUser: CurrentUserData, params: InviteAdminParams): Promise<InviteAdminResult> {
    const createdBy = currentUser.adminId;
    if (!createdBy) throw new UnauthorizedException('Admin access required');

    if (await this.findAdminIdByEmail(params.email)) {
      throw new ConflictException('This email already belongs to an admin. Use "Send password link" instead.');
    }

    await this.access.assertCanCreateAdmin(currentUser, params.roleId);

    const role = await this.prisma.adminRole.findFirst({
      where: { id: params.roleId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });
    if (!role) throw new BadRequestException('Selected role was not found or is inactive.');

    const programIds = unique(params.programIds);
    const found = programIds.length
      ? await this.prisma.program.findMany({
          where: { id: { in: programIds }, isActive: true, deletedAt: null },
          select: { id: true, brandId: true },
        })
      : [];
    if (found.length !== programIds.length) {
      throw new BadRequestException('One or more selected programs were not found or are inactive.');
    }

    const homeBrandId = await this.resolveHomeBrandId(found.find((p) => p.id === programIds[0])?.brandId);
    const existingUserId = await this.findAttachableUserId(params.email, homeBrandId);

    // password null: the handler leaves the user with no usable credential (an attached
    // participant account is wiped in the same transaction as the admin row).
    const admin = await this.createAdmin.execute(
      new CreateAdminCommand(
        params.email, params.fullName, null, createdBy, role.id, [], programIds, homeBrandId, existingUserId,
      ),
    );

    // The admin exists and cannot be un-created here: a mail failure is reported, not thrown,
    // so the caller can use "Send password link" instead of retrying into a 409.
    let emailSent = true;
    try {
      await this.links.issue({
        userId: admin.userId,
        email: params.email,
        fullName: params.fullName,
        kind: 'invite',
        roleName: role.name,
      });
    } catch (error) {
      emailSent = false;
      // Never log the event payload: it carries the raw token.
      this.logger.error(`Invite link failed for new admin ${admin.id}: ${error instanceof Error ? error.message : 'unknown error'}`);
    }
    return { adminId: admin.id, roleId: role.id, programIds, emailSent };
  }

  /** Brand of the first program; with no programs, the brand create-admin defaults to. */
  private async resolveHomeBrandId(firstProgramBrandId: string | undefined): Promise<string> {
    if (firstProgramBrandId) return firstProgramBrandId;
    const fallback = await this.prisma.brand.findFirst({ select: { id: true } });
    if (!fallback) throw new BadRequestException('No brands available to assign to admin.');
    return fallback.id;
  }

  /**
   * Team members are often ex-participants: the email may already have a user row in the
   * target brand. Attach the admin to it (admin login finds users by email across brands).
   * A deactivated or deleted row must be reactivated by hand, never silently revived.
   */
  private async findAttachableUserId(email: string, brandId: string): Promise<string | undefined> {
    const sameBrand = { email: { equals: email, mode: 'insensitive' as const }, brandId };
    const live = await this.prisma.user.findFirst({ where: sameBrand, select: { id: true, isActive: true } });
    const deleted = live ? null : await this.prisma.user.findFirst({ where: { ...sameBrand, deletedAt: { not: null } }, select: { id: true } });
    if (!live && !deleted) return undefined;
    if (live?.isActive) return live.id;
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId }, select: { name: true } });
    throw new ConflictException(
      `This email's account in ${brand?.name ?? 'the target brand'} is deactivated; reactivate it first.`,
    );
  }
}
