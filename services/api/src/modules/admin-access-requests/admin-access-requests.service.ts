// services/api/src/modules/admin-access-requests/admin-access-requests.service.ts
import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { AdminAccessControlService } from '../admins/application/services/admin-access-control.service';
import { AdminInviteService, InviteAdminResult } from '../admins/application/services/admin-invite.service';
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

// Requestable = live program on a live brand, and not hidden from the public site.
// No isTest flag exists on Program: hide a test program by clearing isVisibleToUsers.
const requestableProgram = { isActive: true, isVisibleToUsers: true, deletedAt: null, brand: { isActive: true } } as const;

const unique = <T>(values: T[]) => Array.from(new Set(values));

@Injectable()
export class AdminAccessRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: AdminAccessControlService,
    private readonly invites: AdminInviteService,
  ) {}

  async getOptions() {
    const programs = await this.prisma.program.findMany({
      where: requestableProgram,
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
    // A pending row for this email wins and is never touched: letting an anonymous caller
    // overwrite it would let them rewrite a real request (name, programs, note) before review.
    const existing = await this.prisma.adminAccessRequest.findFirst({
      where: { email, status: 'pending' },
      select: { id: true },
    });
    if (existing) return;

    const requestedIds = unique(dto.programIds);
    const valid = requestedIds.length
      ? await this.prisma.program.findMany({
          where: { id: { in: requestedIds }, ...requestableProgram },
          select: { id: true },
        })
      : [];
    try {
      await this.prisma.adminAccessRequest.create({
        data: {
          fullName: dto.fullName.trim(),
          email,
          whatsapp: dto.whatsapp?.trim() || null,
          division: dto.division,
          requestedProgramIds: valid.map((p) => p.id),
          note: dto.note?.trim() || null,
          status: 'pending',
          ip,
          userAgent: userAgent.slice(0, 500),
        },
      });
    } catch (error) {
      // The partial unique index (one pending row per email) caught a concurrent twin submit.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return;
      throw error;
    }
  }

  async list(status: AccessRequestStatus) {
    const rows = await this.prisma.adminAccessRequest.findMany({
      where: { status },
      // Pending oldest first: a flood of junk can never push early real requests past the cap.
      orderBy: { createdAt: status === 'pending' ? 'asc' : 'desc' },
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
            where: { OR: emails.map((email) => ({ email: { equals: email, mode: 'insensitive' as const } })) },
            select: { email: true, admin: { select: { id: true } }, brand: { select: { name: true } } },
          })
        : [],
    ]);

    // A platform-tier role is never a default, even if someone renamed it into the slot.
    const safeRoles = new Map(roles.filter((r) => !isPlatformTierRole(r)).map((r) => [r.name, r] as const));
    const programById = new Map(programs.map((p) => [p.id, toProgramOption(p)] as const));
    const reviewerName = new Map(reviewers.map((a) => [a.id, a.fullName] as const));
    const adminIdByEmail = new Map<string, string>();
    const participantBrandsByEmail = new Map<string, Set<string>>();
    for (const u of users) {
      const key = u.email.toLowerCase();
      if (u.admin) {
        adminIdByEmail.set(key, u.admin.id);
      } else {
        participantBrandsByEmail.set(key, (participantBrandsByEmail.get(key) ?? new Set()).add(u.brand.name));
      }
    }

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
        // Brands where this email already has a (non-deleted) participant account: approving attaches to it.
        participantBrands: [...(participantBrandsByEmail.get(row.email.toLowerCase()) ?? [])].sort(),
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

    // Claim first: only one concurrent approve gets count 1, so only one creates the admin.
    const claimed = await this.prisma.adminAccessRequest.updateMany({
      where: { id, status: 'pending' },
      data: { status: 'approved', reviewedByAdminId: reviewerId, reviewedAt: new Date() },
    });
    if (claimed.count === 0) throw new ConflictException('This access request is not pending.');

    let invited: InviteAdminResult;
    try {
      invited = await this.invites.invite(currentUser, {
        email: request.email,
        fullName: request.fullName,
        roleId: dto.roleId,
        programIds: dto.programIds,
      });
    } catch (error) {
      await this.prisma.adminAccessRequest.updateMany({
        where: { id, status: 'approved', createdAdminId: null },
        data: { status: 'pending', reviewedByAdminId: null, reviewedAt: null },
      });
      throw error;
    }

    await this.prisma.adminAccessRequest.update({ where: { id }, data: { createdAdminId: invited.adminId } });
    return invited;
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
