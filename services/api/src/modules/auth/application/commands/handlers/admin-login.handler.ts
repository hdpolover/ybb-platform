
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { AdminLoginCommand } from '../admin-login.command';
import { AdminAuthResponseDto } from '../../../presentation/dto/admin-auth-response.dto';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';
import {
    buildAccessiblePrograms,
    getAdminProgramAccessScope,
    mapAdminBrandAssignment,
    mapAdminProgramAssignment,
    normalizePermissions,
} from '../../../../../shared/admin-access-response';
import { MAX_FAILED_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MINUTES } from '../../services/account-lockout.constants';

@Injectable()
export class AdminLoginHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly authLoggingService: AuthLoggingService,
        private readonly metricsService: MetricsService,
    ) { }

    async execute(command: AdminLoginCommand): Promise<AdminAuthResponseDto> {
        // 1. Find User who is an Admin
        // We search for ANY user with this email who has an admin record
        // This allows admin login regardless of the specific brand context of the request,
        // assuming the admin "persona" is tied to one primary user account.
        const user = await this.prisma.user.findFirst({
            where: {
                email: { equals: command.email, mode: 'insensitive' },
                admin: {
                    isNot: null,
                },
                deletedAt: null,
            },
            orderBy: { createdAt: 'asc' },
            include: {
                admin: {
                    include: {
                        adminBrands: {
                            include: {
                                brand: {
                                    select: {
                                        id: true,
                                        name: true,
                                        slug: true,
                                        isActive: true,
                                        logoUrl: true,
                                        logoWhiteUrl: true,
                                        logoColorUrl: true,
                                        logoIconUrl: true,
                                    },
                                },
                            },
                        },
                        adminPrograms: {
                            include: {
                                program: {
                                    select: {
                                        id: true,
                                        brandId: true,
                                        name: true,
                                        slug: true,
                                        year: true,
                                        status: true,
                                        isActive: true,
                                        startDate: true,
                                        endDate: true,
                                        logoUrl: true,
                                        logoWhiteUrl: true,
                                        logoColorUrl: true,
                                        logoIconUrl: true,
                                        brand: {
                                            select: {
                                                id: true,
                                                name: true,
                                                slug: true,
                                                isActive: true,
                                                logoUrl: true,
                                                logoWhiteUrl: true,
                                                logoColorUrl: true,
                                                logoIconUrl: true,
                                            },
                                        },
                                    },
                                },
                            },
                        },
                        role: true,
                    },
                },
                brand: true, // Include the brand of the user record
            },
        });

        // 2. Validate User & Password
        if (!user || !user.admin) {
            // Log failed attempt (obscure that user doesn't exist vs password wrong?)
            // Standard practice: "Invalid credentials"
            this.metricsService.loginTotal.inc({ method: 'admin_email', result: 'failure' });
            throw new UnauthorizedException('Invalid credentials');
        }

        if (!user.isActive) {
            throw new UnauthorizedException('Account is not active');
        }

        // Admin specific active check (if schema supports it - Admin doesn't have isActive, relying on User.isActive and AdminRole)
        if (user.admin.role && !user.admin.role.isActive) {
            throw new UnauthorizedException('Admin role is not active');
        }

        // Verify Password
        // Admins must have a password hash (local auth)
        if (!user.passwordHash) {
            throw new UnauthorizedException('Admin account has no password set. Please use other login method or reset password.');
        }

        // Locked out from prior failed attempts
        if (user.lockedUntil && user.lockedUntil > new Date()) {
            throw new UnauthorizedException('Too many failed attempts. Try again later.');
        }

        const isPasswordValid = await bcrypt.compare(
            command.password,
            user.passwordHash,
        );

        if (!isPasswordValid) {
            const failedLoginAttempts = user.failedLoginAttempts + 1;
            const lockedUntil =
                failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS
                    ? new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60_000)
                    : null;

            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts,
                    lastFailedLogin: new Date(),
                    lockedUntil,
                },
            });

            await this.authLoggingService.logFailedLogin(user.email, command.ipAddress, command.userAgent, 'Invalid Admin Password');
            this.metricsService.loginTotal.inc({ method: 'admin_email', result: 'failure' });
            throw new UnauthorizedException('Invalid credentials');
        }

        // 3. Login Success
        // Reset failed attempts
        await this.prisma.user.update({
            where: { id: user.id },
            data: {
                failedLoginAttempts: 0,
                lastLoginAt: new Date(),
                lockedUntil: null,
            },
        });

        // Update Admin last active
        await this.prisma.admin.update({
            where: { id: user.admin.id },
            data: {
                lastActiveAt: new Date(),
            },
        });

        await this.authLoggingService.logSuccessfulLogin(user.id, command.ipAddress, command.userAgent);
        this.metricsService.loginTotal.inc({ method: 'admin_email', result: 'success' });

        // 4. Generate Tokens
        const sessionId = randomUUID();
        const roles: string[] = ['admin'];
        if (user.admin.role) {
            roles.push(user.admin.role.name);
            // Also push a normalized slug so RolesGuard can match UserRole enum values
            // (e.g. "Super Admin" → "super_admin"). Without this, @Roles(UserRole.SUPER_ADMIN)
            // never matches because the token only carries the human-readable display name.
            const slug = user.admin.role.name.toLowerCase().replace(/\s+/g, '_');
            if (slug !== user.admin.role.name) roles.push(slug);
        }
        // Add brand roles
        user.admin.adminBrands.forEach(ab => {
            if (ab.roleInBrand) roles.push(`brand:${ab.brandId}:${ab.roleInBrand}`);
        });

        const accessTokenPayload = {
            sub: user.id,
            email: user.email,
            brandId: user.brandId,
            jti: randomUUID(),
            roles: roles,
            isAdmin: true, // Explicit flag
            adminId: user.admin.id,
            sid: sessionId,
            type: 'access' as const,
        };

        const refreshTokenPayload = {
            sub: user.id,
            email: user.email,
            brandId: user.brandId,
            jti: randomUUID(),
            adminId: user.admin.id,
            isAdmin: true,
            sid: sessionId,
            type: 'refresh' as const,
        };

        const accessToken = this.jwtService.sign(accessTokenPayload, {
            expiresIn: this.configService.get<string>('JWT_ADMIN_EXPIRES_IN', '8h'),
        });

        const refreshToken = this.jwtService.sign(refreshTokenPayload, {
            expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
        });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7);

        await this.prisma.userSession.create({
            data: {
                userId: user.id,
                sessionToken: sessionId,
                refreshToken,
                deviceName: command.userAgent.slice(0, 100),
                browser: command.userAgent.slice(0, 100),
                ipAddress: command.ipAddress,
                expiresAt,
            },
        });

        const accessScope = getAdminProgramAccessScope(user.admin);
        const accessiblePrograms = accessScope === 'assigned'
            ? user.admin.adminPrograms.map((assignment) => mapAdminProgramAssignment(assignment))
            : buildAccessiblePrograms({
                availablePrograms: await this.prisma.program.findMany({
                    where: {
                        deletedAt: null,
                        ...(accessScope === 'brand_scope'
                            ? { brandId: { in: user.admin.adminBrands.map((assignment) => assignment.brandId) } }
                            : {}),
                    },
                    select: {
                        id: true,
                        brandId: true,
                        name: true,
                        slug: true,
                        year: true,
                        status: true,
                        isActive: true,
                        startDate: true,
                        endDate: true,
                        logoUrl: true,
                        logoWhiteUrl: true,
                        logoColorUrl: true,
                        logoIconUrl: true,
                        brand: {
                            select: {
                                id: true,
                                name: true,
                                slug: true,
                                isActive: true,
                                logoUrl: true,
                                logoWhiteUrl: true,
                                logoColorUrl: true,
                                logoIconUrl: true,
                            },
                        },
                    },
                    orderBy: [{ isActive: 'desc' }, { year: 'desc' }, { name: 'asc' }],
                }),
                assignments: user.admin.adminPrograms,
                unassignedAccessType: accessScope,
            });

        // 5. Build Response
        return {
            accessToken,
            refreshToken,
            user: {
                id: user.id,
                email: user.email,
                brandId: user.brandId,
                isActive: user.isActive,
                isOnboardingCompleted: user.isOnboardingCompleted,
            },
            admin: {
                id: user.admin.id,
                fullName: user.admin.fullName,
                avatarUrl: user.admin.avatarUrl || undefined,
                roleId: user.admin.roleId || '',
                role: user.admin.role?.name || 'No Role',
                accessLevel: user.admin.accessLevel,
                permissions: normalizePermissions(user.admin.role?.permissions),
                customPermissions: normalizePermissions(user.admin.customPermissions),
                canManageAdmins: user.admin.canManageAdmins,
                canAssignRoles: user.admin.canAssignRoles,
                programs: user.admin.adminPrograms.map((assignment) => mapAdminProgramAssignment(assignment)),
                accessiblePrograms,
                brands: user.admin.adminBrands.map((assignment) => mapAdminBrandAssignment(assignment)),
            }
        };
    }
}
