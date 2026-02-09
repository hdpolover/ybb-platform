
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { AuthLoggingService } from '../../services/auth-logging.service';
import { AdminLoginCommand } from '../admin-login.command';
import { AdminAuthResponseDto } from '../../../presentation/dto/admin-auth-response.dto';
import { MetricsService } from '../../../../../shared/infrastructure/monitoring/metrics.service';

@Injectable()
export class AdminLoginHandler {
    constructor(
        private readonly prisma: PrismaService,
        private readonly jwtService: JwtService,
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
                email: command.email,
                admin: {
                    isNot: null,
                },
            },
            include: {
                admin: {
                    include: {
                        adminBrands: true,
                        adminPrograms: true,
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

        const isPasswordValid = await bcrypt.compare(
            command.password,
            user.passwordHash,
        );

        if (!isPasswordValid) {
            await this.prisma.user.update({
                where: { id: user.id },
                data: {
                    failedLoginAttempts: user.failedLoginAttempts + 1,
                    lastFailedLogin: new Date(),
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
        const roles: string[] = ['admin'];
        if (user.admin.role) {
            roles.push(user.admin.role.name);
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
            adminId: user.admin.id
        };

        const refreshTokenPayload = {
            sub: user.id,
            email: user.email,
            brandId: user.brandId,
            jti: randomUUID(),
        };

        const accessToken = this.jwtService.sign(accessTokenPayload, {
            expiresIn: '8h', // Admins get longer sessions? Or shorter? 8h is standard work day.
        });

        const refreshToken = this.jwtService.sign(refreshTokenPayload, {
            expiresIn: '7d',
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
                role: user.admin.role?.name || 'No Role',
                accessLevel: user.admin.accessLevel,
                permissions: (user.admin.role?.permissions as string[]) || [], // Type cast JSON
                programs: user.admin.adminPrograms.map(ap => ({
                    programId: ap.programId,
                    role: ap.roleInProgram || 'member'
                })),
                brands: user.admin.adminBrands.map(ab => ({
                    brandId: ab.brandId,
                    role: ab.roleInBrand || 'member'
                }))
            }
        };
    }
}
