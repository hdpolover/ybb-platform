import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { createHash, randomBytes, randomUUID } from 'crypto';
import * as bcrypt from 'bcrypt';
import { ChangeType, ChangedByType } from '@prisma/client';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CurrentUserData } from '@shared/decorators/current-user.decorator';
import {
  CreateSupportImpersonationDto,
  UpdateSupportAccessConfigDto,
} from '../../presentation/dto/support-access.dto';

type SupportConfigResponse = {
  isEnabled: boolean;
  hasSecret: boolean;
  updatedAt: string | null;
  lastRotatedAt: string | null;
  updatedByAdminId: string | null;
  participantPortalOrigin: string | null;
};

type ImpersonationStartResponse = {
  loginUrl: string;
  expiresAt: string;
  participantEmail: string;
};

type ImpersonationExchangeResponse = {
  accessToken: string;
  refreshToken: string;
  redirectTo: string;
};

@Injectable()
export class SupportAccessService {
  private static readonly CONFIG_KEY = 'global';
  private static readonly TICKET_TTL_MS = 5 * 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  async getConfig(currentUser: CurrentUserData): Promise<SupportConfigResponse> {
    await this.assertSuperAdmin(currentUser);
    const config = await this.prisma.supportAccessConfig.findUnique({
      where: { key: SupportAccessService.CONFIG_KEY },
    });

    return this.toConfigResponse(config);
  }

  async updateConfig(
    currentUser: CurrentUserData,
    dto: UpdateSupportAccessConfigDto,
  ): Promise<SupportConfigResponse> {
    await this.assertSuperAdmin(currentUser);

    const existing = await this.prisma.supportAccessConfig.findUnique({
      where: { key: SupportAccessService.CONFIG_KEY },
    });

    if (dto.isEnabled && !dto.newSecret && !existing?.secretHash) {
      throw new BadRequestException('Set a support secret before enabling support access.');
    }

    const now = new Date();
    const nextSecretHash = dto.newSecret ? await bcrypt.hash(dto.newSecret, 12) : undefined;

    const updated = await this.prisma.supportAccessConfig.upsert({
      where: { key: SupportAccessService.CONFIG_KEY },
      create: {
        key: SupportAccessService.CONFIG_KEY,
        isEnabled: dto.isEnabled ?? false,
        secretHash: nextSecretHash ?? null,
        lastRotatedAt: nextSecretHash ? now : null,
        updatedByAdminId: currentUser.adminId!,
      },
      update: {
        isEnabled: dto.isEnabled ?? existing?.isEnabled ?? false,
        ...(nextSecretHash
          ? {
              secretHash: nextSecretHash,
              lastRotatedAt: now,
            }
          : {}),
        updatedByAdminId: currentUser.adminId!,
      },
    });

    await this.prisma.dataChangeLog.create({
      data: {
        entityType: 'SupportAccessConfig',
        entityId: updated.id,
        action: ChangeType.update,
        actorType: ChangedByType.admin,
        actorId: currentUser.adminId!,
        source: 'http',
        endpoint: 'PUT /v1/admins/support-access/config',
        httpMethod: 'PUT',
        riskLevel: 'high',
        status: 'SUCCESS',
        changedFields: ['isEnabled', ...(nextSecretHash ? ['secretHash'] : [])],
        afterState: {
          isEnabled: updated.isEnabled,
          hasSecret: Boolean(updated.secretHash),
          lastRotatedAt: updated.lastRotatedAt?.toISOString() ?? null,
        },
      },
    });

    return this.toConfigResponse(updated);
  }

  async createImpersonation(
    currentUser: CurrentUserData,
    dto: CreateSupportImpersonationDto,
    ipAddress: string,
    userAgent: string,
  ): Promise<ImpersonationStartResponse> {
    await this.assertSuperAdmin(currentUser);

    const config = await this.prisma.supportAccessConfig.findUnique({
      where: { key: SupportAccessService.CONFIG_KEY },
    });

    if (!config?.isEnabled || !config.secretHash) {
      throw new ForbiddenException('Support access is disabled.');
    }

    const secretOk = await bcrypt.compare(dto.supportSecret, config.secretHash);
    if (!secretOk) {
      throw new UnauthorizedException('Invalid support secret.');
    }

    const reason = dto.reason.trim();
    if (reason.length < 10) {
      throw new BadRequestException('Reason must be at least 10 characters.');
    }

    const target = await this.resolveTargetParticipant(dto);
    const portalOrigin = this.resolveParticipantPortalOrigin(
      target.user.brand.websiteUrl,
      target.user.brand.landingUrl,
    );
    if (!portalOrigin) {
      throw new BadRequestException('Participant portal URL is not configured.');
    }

    const rawToken = `${randomUUID()}.${randomBytes(16).toString('hex')}`;
    const tokenHash = this.hashToken(rawToken);
    const expiresAt = new Date(Date.now() + SupportAccessService.TICKET_TTL_MS);

    const ticket = await this.prisma.supportAccessImpersonationTicket.create({
      data: {
        adminId: currentUser.adminId!,
        targetUserId: target.user.id,
        targetParticipantId: target.id,
        targetProgramId: dto.programId ?? null,
        targetBrandId: target.user.brandId,
        reason,
        tokenHash,
        expiresAt,
        createdIpAddress: ipAddress,
        createdUserAgent: userAgent,
      },
    });

    await this.prisma.dataChangeLog.create({
      data: {
        entityType: 'SupportAccessImpersonation',
        entityId: ticket.id,
        action: ChangeType.create,
        actorType: ChangedByType.admin,
        actorId: currentUser.adminId!,
        source: 'http',
        endpoint: 'POST /v1/admins/support-access/impersonations',
        httpMethod: 'POST',
        riskLevel: 'high',
        reason,
        status: 'SUCCESS',
        changedFields: ['targetUserId', 'targetParticipantId', 'expiresAt'],
        afterState: {
          targetUserId: ticket.targetUserId,
          targetParticipantId: ticket.targetParticipantId,
          targetProgramId: ticket.targetProgramId,
          expiresAt: ticket.expiresAt.toISOString(),
        },
      },
    });

    return {
      loginUrl: `${portalOrigin}/admin-impersonation?token=${encodeURIComponent(rawToken)}`,
      expiresAt: expiresAt.toISOString(),
      participantEmail: target.user.email,
    };
  }

  async exchangeImpersonationToken(
    token: string,
    ipAddress: string,
    userAgent: string,
  ): Promise<ImpersonationExchangeResponse> {
    const tokenHash = this.hashToken(token);
    const now = new Date();

    const ticket = await this.prisma.supportAccessImpersonationTicket.findUnique({
      where: { tokenHash },
    });
    if (!ticket) {
      throw new UnauthorizedException('Invalid or expired impersonation token.');
    }
    if (ticket.revokedAt || ticket.consumedAt || ticket.expiresAt <= now) {
      throw new UnauthorizedException('Invalid or expired impersonation token.');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: ticket.targetUserId },
      select: {
        id: true,
        email: true,
        brandId: true,
        isActive: true,
        deletedAt: true,
        isOnboardingCompleted: true,
      },
    });
    if (!user || !user.isActive || user.deletedAt) {
      throw new NotFoundException('Participant account is not available.');
    }

    const accessToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        brandId: user.brandId,
        jti: randomUUID(),
        roles: [],
      },
      { expiresIn: this.configService.get<string>('JWT_EXPIRES_IN', '1h') },
    );

    const refreshToken = this.jwtService.sign(
      {
        sub: user.id,
        email: user.email,
        brandId: user.brandId,
        jti: randomUUID(),
      },
      { expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d') },
    );

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginAttempts: 0,
          lastLoginAt: now,
        },
      }),
      this.prisma.userSession.create({
        data: {
          userId: user.id,
          sessionToken: randomUUID(),
          refreshToken,
          deviceName: 'admin-impersonation',
          browser: userAgent.slice(0, 100),
          ipAddress,
          expiresAt,
        },
      }),
      this.prisma.supportAccessImpersonationTicket.update({
        where: { id: ticket.id },
        data: {
          consumedAt: now,
          consumedIpAddress: ipAddress,
          consumedUserAgent: userAgent,
          status: 'consumed',
        },
      }),
      this.prisma.dataChangeLog.create({
        data: {
          entityType: 'SupportAccessImpersonation',
          entityId: ticket.id,
          action: ChangeType.status_change,
          actorType: ChangedByType.admin,
          actorId: ticket.adminId,
          source: 'http',
          endpoint: 'POST /v1/admins/support-access/impersonations/exchange',
          httpMethod: 'POST',
          riskLevel: 'high',
          status: 'SUCCESS',
          changedFields: ['status', 'consumedAt'],
          afterState: {
            status: 'consumed',
            consumedAt: now.toISOString(),
          },
        },
      }),
    ]);

    return {
      accessToken,
      refreshToken,
      redirectTo: user.isOnboardingCompleted ? '/dashboard' : '/onboarding',
    };
  }

  private async assertSuperAdmin(currentUser: CurrentUserData): Promise<void> {
    if (!currentUser.adminId) {
      throw new UnauthorizedException('Admin access required.');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { id: currentUser.adminId },
      include: { role: true },
    });
    if (!admin) {
      throw new UnauthorizedException('Admin record not found.');
    }

    const roleName = (admin.role?.name || '').toLowerCase().replace(/\s+/g, '_');
    const tokenRoles = Array.isArray(currentUser.role)
      ? currentUser.role.map((value) => value.toLowerCase())
      : typeof currentUser.role === 'string'
        ? [currentUser.role.toLowerCase()]
        : [];

    const isSuperByRoleName = ['super_admin', 'super-admin', 'owner'].includes(roleName);
    const isSuperByToken = tokenRoles.includes('super_admin') || tokenRoles.includes('owner');
    const isSuperByAccess =
      admin.accessLevel >= 10 || admin.canManageAdmins || admin.canAssignRoles;

    if (!isSuperByRoleName && !isSuperByToken && !isSuperByAccess) {
      throw new ForbiddenException('Only Super Admin can use support access.');
    }
  }

  private toConfigResponse(
    config: {
      isEnabled: boolean;
      secretHash: string | null;
      updatedAt: Date;
      lastRotatedAt: Date | null;
      updatedByAdminId: string | null;
    } | null,
  ): SupportConfigResponse {
    return {
      isEnabled: config?.isEnabled ?? false,
      hasSecret: Boolean(config?.secretHash),
      updatedAt: config?.updatedAt?.toISOString() ?? null,
      lastRotatedAt: config?.lastRotatedAt?.toISOString() ?? null,
      updatedByAdminId: config?.updatedByAdminId ?? null,
      participantPortalOrigin: this.resolveParticipantPortalOrigin(null, null),
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private resolveParticipantPortalOrigin(
    websiteUrl: string | null,
    landingUrl: string | null,
  ): string | null {
    const fromEnv = this.configService.get<string>('SUPPORT_PARTICIPANT_PORTAL_ORIGIN')?.trim();
    const raw = fromEnv || landingUrl || websiteUrl;
    if (!raw) return null;

    const value = raw.trim();
    if (!value) return null;

    try {
      const parsed = value.startsWith('http://') || value.startsWith('https://')
        ? new URL(value)
        : new URL(`https://${value}`);
      return parsed.origin;
    } catch {
      return null;
    }
  }

  private async resolveTargetParticipant(dto: CreateSupportImpersonationDto) {
    if (!dto.participantId && !dto.participantEmail) {
      throw new BadRequestException('participantId or participantEmail is required.');
    }

    if (dto.participantId) {
      const participant = await this.prisma.participant.findUnique({
        where: { id: dto.participantId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              brandId: true,
              brand: {
                select: {
                  websiteUrl: true,
                  landingUrl: true,
                },
              },
            },
          },
        },
      });
      if (!participant) {
        throw new NotFoundException('Participant not found.');
      }

      if (dto.programId) {
        const application = await this.prisma.participantApplication.findFirst({
          where: {
            participantId: participant.id,
            programId: dto.programId,
            deletedAt: null,
          },
          select: { id: true },
        });
        if (!application) {
          throw new BadRequestException('Participant is not registered in the selected program.');
        }
      }

      return participant;
    }

    if (!dto.programId) {
      throw new BadRequestException('programId is required when using participantEmail.');
    }

    const application = await this.prisma.participantApplication.findFirst({
      where: {
        programId: dto.programId,
        deletedAt: null,
        participant: {
          user: {
            email: dto.participantEmail!,
          },
        },
      },
      include: {
        participant: {
          include: {
            user: {
              select: {
                id: true,
                email: true,
                brandId: true,
                brand: {
                  select: {
                    websiteUrl: true,
                    landingUrl: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!application?.participant) {
      throw new NotFoundException('Participant not found for the selected program.');
    }

    return application.participant;
  }
}
