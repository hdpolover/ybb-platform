// services/api/src/modules/admin-access-requests/admin-access-requests.service.ts
import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { randomBytes } from 'crypto';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AdminAccessControlService } from '../admins/application/services/admin-access-control.service';
import { AdminPasswordLinkService } from '../admins/application/services/admin-password-link.service';
import { CreateAdminHandler } from '../admins/application/commands/handlers/create-admin.handler';
import { CreateAdminCommand } from '../admins/application/commands/create-admin.command';
import { ADMIN_DIVISIONS, divisionByKey, isPlatformTierRole } from './admin-divisions';
import { CreateAccessRequestDto } from './dto/create-access-request.dto';
import { ApproveAccessRequestDto } from './dto/approve-access-request.dto';

export type AccessRequestStatus = 'pending' | 'approved' | 'rejected';
const LIST_LIMIT = 200;

const programSelect = { id: true, name: true, brand: { select: { name: true } } } as const;
const toProgramOption = (p: { id: string; name: string; brand: { name: string } }) => ({
  id: p.id,
  name: p.name,
  brandName: p.brand.name,
});

const unique = <T>(values: T[]) => Array.from(new Set(values));

@Injectable()
export class AdminAccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AdminAccessControlService,
    private readonly createAdmin: CreateAdminHandler,
    private readonly links: AdminPasswordLinkService,
  ) {}

  async getOptions() {
    const programs = await this.prisma.program.findMany({
      where: { isActive: true, deletedAt: null },
      select: programSelect,
      orderBy: [{ brand: { name: 'asc' } }, { name: 'asc' }],
    });
    return {
      divisions: ADMIN_DIVISIONS.map(({ key, label }) => ({ key, label })),
      programs: programs.map(toProgramOption),
    };
  }

  /** Always resolves the same way for the caller; see the controller for why. */
  async submit(dto: CreateAccessRequestDto, ip: string, userAgent: string): Promise<void> {
    const email = dto.email.trim().toLowerCase();
    const requestedIds = unique(dto.programIds);
    const valid = requestedIds.length
      ? await this.prisma.program.findMany({
          where: { id: { in: requestedIds }, isActive: true, deletedAt: null },
          select: { id: true },
        })
      : [];
    const data = {
      fullName: dto.fullName.trim(),
      whatsapp: dto.whatsapp?.trim() || null,
      division: dto.division,
      requestedProgramIds: valid.map((p) => p.id),
      note: dto.note?.trim() || null,
      ip,
      userAgent: userAgent.slice(0, 500),
    };

    const existing = await this.prisma.adminAccessRequest.findFirst({
      where: { email, status: 'pending' },
      select: { id: true },
    });
    if (existing) {
      await this.prisma.adminAccessRequest.update({ where: { id: existing.id }, data });
      return;
    }
    try {
      await this.prisma.adminAccessRequest.create({ data: { ...data, email, status: 'pending' } });
    } catch (error) {
      // The partial unique index (one pending row per email) caught a concurrent twin submit.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  async list(status: AccessRequestStatus) {
    const rows = await this.prisma.adminAccessRequest.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      take: LIST_LIMIT,
    });

    const roleNames = unique(ADMIN_DIVISIONS.flatMap((d) => (d.defaultRoleName ? [d.defaultRoleName] : [])));
    const programIds = unique(rows.flatMap((r) => r.requestedProgramIds));
    const reviewerIds = unique(rows.flatMap((r) => (r.reviewedByAdminId ? [r.reviewedByAdminId] : [])));
    const emails = unique(rows.map((r) => r.email));

    const [roles, programs, reviewers, users] = await Promise.all([
      this.prisma.adminRole.findMany({
        where: { name: { in: roleNames }, isActive: true, deletedAt: null },
        select: { id: true, name: true, permissions: true },
      }),
      programIds.length
        ? this.prisma.program.findMany({ where: { id: { in: programIds }, deletedAt: null }, select: programSelect })
        : [],
      reviewerIds.length
        ? this.prisma.admin.findMany({ where: { id: { in: reviewerIds } }, select: { id: true, fullName: true } })
        : [],
      emails.length
        ? this.prisma.user.findMany({
            where: { OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })), admin: { isNot: null } },
            select: { email: true, admin: { select: { id: true } } },
          })
        : [],
    ]);

    // A platform-tier role is never a default, even if someone renamed it into the slot.
    const safeRoles = new Map(roles.filter((r) => !isPlatformTierRole(r)).map((r) => [r.name, r] as const));
    const programById = new Map(programs.map((p) => [p.id, toProgramOption(p)] as const));
    const reviewerName = new Map(reviewers.map((a) => [a.id, a.fullName] as const));
    const adminIdByEmail = new Map(users.map((u) => [u.email.toLowerCase(), u.admin?.id ?? null] as const));

    const items = rows.map((row) => {
      const division = divisionByKey(row.division);
      const defaultRole = division?.defaultRoleName ? safeRoles.get(division.defaultRoleName) : undefined;
      return {
        id: row.id,
        fullName: row.fullName,
        email: row.email,
        whatsapp: row.whatsapp,
        division: row.division,
        divisionLabel: division?.label ?? row.division,
        defaultRoleId: defaultRole?.id ?? null,
        defaultRoleName: defaultRole?.name ?? null,
        requestedPrograms: row.requestedProgramIds.flatMap((id) => programById.get(id) ?? []),
        note: row.note,
        status: row.status as AccessRequestStatus,
        createdAt: row.createdAt,
        reviewedAt: row.reviewedAt ?? null,
        reviewedByName: row.reviewedByAdminId ? (reviewerName.get(row.reviewedByAdminId) ?? null) : null,
        rejectReason: row.rejectReason ?? null,
        existingAdminId: adminIdByEmail.get(row.email.toLowerCase()) ?? null,
      };
    });
    // { data, total } -> wire { data: items, meta: { total } } (same as GET /admins).
    return { data: items, total: items.length };
  }

  async pendingCount() {
    return { count: await this.prisma.adminAccessRequest.count({ where: { status: 'pending' } }) };
  }

  async approve(currentUser: CurrentUserData, id: string, dto: ApproveAccessRequestDto) {
    await this.access.assertCanManageAdmins(currentUser);
    const reviewerId = currentUser.adminId;
    if (!reviewerId) throw new UnauthorizedException('Admin access required');

    const request = await this.prisma.adminAccessRequest.findUnique({ where: { id } });
    if (!request || request.status !== 'pending') {
      throw new ConflictException('This access request is not pending.');
    }

    // Case-insensitive on purpose: CreateAdminHandler's own duplicate check is exact-match.
    const existing = await this.prisma.user.findFirst({
      where: { email: { equals: request.email, mode: 'insensitive' }, admin: { isNot: null } },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('This email already belongs to an admin. Use "Send password link" instead.');
    }

    await this.access.assertCanCreateAdmin(currentUser, dto.roleId);

    const role = await this.prisma.adminRole.findFirst({
      where: { id: dto.roleId, deletedAt: null, isActive: true },
      select: { id: true, name: true },
    });
    if (!role) throw new BadRequestException('Selected role was not found or is inactive.');

    const programIds = unique(dto.programIds);
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
    const existingUserId = await this.findAttachableUserId(request.email, homeBrandId);

    // CreateAdminHandler wants a password; hand it one nobody ever sees. issue() nulls it below.
    const admin = await this.createAdmin.execute(
      new CreateAdminCommand(
        request.email, request.fullName, randomBytes(48).toString('base64url'), reviewerId, role.id, [], programIds,
        homeBrandId, existingUserId,
      ),
    );

    await this.prisma.adminAccessRequest.update({
      where: { id },
      data: { status: 'approved', reviewedByAdminId: reviewerId, reviewedAt: new Date(), createdAdminId: admin.id },
    });

    await this.links.issue({
      userId: admin.userId,
      email: request.email,
      fullName: request.fullName,
      kind: 'invite',
      roleName: role.name,
      // An attached participant account keeps its old password otherwise; a new user has none.
      invalidateCredentials: true,
    });
    return { adminId: admin.id };
  }

  /** Brand of the first approved program; with no programs, the brand create-admin defaults to. */
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

  async reject(currentUser: CurrentUserData, id: string, reason?: string) {
    await this.access.assertCanManageAdmins(currentUser);
    const reviewerId = currentUser.adminId;
    if (!reviewerId) throw new UnauthorizedException('Admin access required');

    const { count } = await this.prisma.adminAccessRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'rejected', reviewedByAdminId: reviewerId, reviewedAt: new Date(), rejectReason: reason?.trim() || null },
    });
    if (count === 0) throw new ConflictException('This access request is not pending.');
    return { ok: true };
  }
}
