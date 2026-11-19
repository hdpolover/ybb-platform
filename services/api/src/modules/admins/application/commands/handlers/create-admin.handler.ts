
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CreateAdminCommand } from '../create-admin.command';
import * as bcrypt from 'bcrypt';
import { normalizePermissions } from '../../../../../shared/admin-access-response';

@Injectable()
export class CreateAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: CreateAdminCommand) {
        // A caller that names the home brand (access-request approval) has already resolved the
        // user per brand: the email may legitimately exist as a participant in other brands, and
        // admin login finds the admin by email across brands, so the global check below would
        // wrongly refuse it. Unique (email, brand_id) still guards the insert.
        const callerVetted = command.homeBrandId !== undefined || command.existingUserId !== undefined;

        // 1. Check if user exists
        const existingUser = callerVetted
            ? null
            : await this.prisma.user.findFirst({
                where: { email: command.email }
            });

        if (existingUser) {
            throw new ConflictException('User with this email already exists.');
        }

        const role = command.roleId
            ? await this.prisma.adminRole.findFirst({
                where: {
                    id: command.roleId,
                    deletedAt: null,
                    isActive: true,
                },
            })
            : null;

        if (command.roleId && !role) {
            throw new BadRequestException('Selected role was not found or is inactive.');
        }

        const nextProgramIds = Array.from(new Set(command.programIds ?? []));
        const programs = nextProgramIds.length > 0
            ? await this.prisma.program.findMany({
                where: {
                    id: { in: nextProgramIds },
                    deletedAt: null,
                },
                select: {
                    id: true,
                    brandId: true,
                },
            })
            : [];

        if (programs.length !== nextProgramIds.length) {
            throw new BadRequestException('One or more selected programs were not found.');
        }

        // Brand rows come only from the brandIds sent: a program assignment must not
        // become a brand grant (that is brand_scope over the whole brand).
        const resolvedBrandIds = Array.from(new Set(command.brandIds ?? []));

        // 2. Hash Password
        const passwordHash = await bcrypt.hash(command.password, 10);

        // 3. Resolve Brand (Admins need a primary brand for the User record, usually system default or first brand)
        // For now, we'll pick the first active brand if brandIds provided, or default
        // The user's home brand, not a grant: a program-only admin lives in their program's brand.
        let primaryBrandId = command.homeBrandId ?? resolvedBrandIds[0] ?? programs[0]?.brandId;

        if (!primaryBrandId) {
            const defaultBrand = await this.prisma.brand.findFirst({ select: { id: true } });
            if (!defaultBrand) throw new BadRequestException('No brands available to assign to admin.');
            primaryBrandId = defaultBrand.id;
        }

        // The duplicate check at the top of this handler cannot see a
        // soft-deleted user: the Prisma soft-delete extension injects
        // `deletedAt: null` into every findFirst. But the row is still there,
        // still occupying @@unique([email, brandId]), and nothing ever purges
        // admins - so tx.user.create below would fail with an opaque P2002 and
        // that email would be blocked for that brand forever, with no route
        // forward. Name the cause and point at the way out.
        //
        // This is also why the backlog's stated fix for M218 (add
        // `deletedAt: null` to the check above) is a no-op: it is already there
        // implicitly. The cause is the surviving row, not the missing filter.
        const deletedConflict = callerVetted ? null : await this.prisma.user.findFirst({
            where: {
                email: command.email,
                brandId: primaryBrandId,
                deletedAt: { not: null },
            },
            select: { admin: { select: { id: true } } },
        });

        if (deletedConflict?.admin) {
            throw new ConflictException({
                message:
                    'An admin with this email was deleted previously for this brand. Restore that admin instead of creating a new one.',
                errorCode: 'DELETED_ADMIN_EMAIL_CONFLICT',
                adminId: deletedConflict.admin.id,
            });
        }

        const assignmentPermissions = normalizePermissions(role?.permissions);
        const assignmentRoleName = role?.name ?? 'Admin';

        // 4. Create User & Admin in Transaction
        return this.prisma.$transaction(async (tx) => {
            const user = command.existingUserId
                ? { id: command.existingUserId }
                : await tx.user.create({
                    data: {
                        email: command.email,
                        passwordHash,
                        brandId: primaryBrandId,
                        isActive: true,
                        emailVerified: true, // Admins auto-verified?
                    }
                });

            const admin = await tx.admin.create({
                data: {
                    userId: user.id,
                    fullName: command.fullName,
                    createdBy: command.createdBy,
                    roleId: command.roleId,
                }
            });

            // 5. Assign Brands
            if (resolvedBrandIds.length > 0) {
                await tx.adminBrand.createMany({
                    data: resolvedBrandIds.map(brandId => ({
                        adminId: admin.id,
                        brandId: brandId,
                        roleInBrand: assignmentRoleName,
                        permissions: assignmentPermissions,
                    }))
                });
            }

            if (nextProgramIds.length > 0) {
                await tx.adminProgram.createMany({
                    data: nextProgramIds.map((programId) => ({
                        adminId: admin.id,
                        programId,
                        roleInProgram: assignmentRoleName,
                        permissions: assignmentPermissions,
                        assignedBy: command.createdBy,
                    })),
                });
            }

            return admin;
        });
    }
}
