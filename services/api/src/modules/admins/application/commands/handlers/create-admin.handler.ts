
import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CreateAdminCommand } from '../create-admin.command';
import * as bcrypt from 'bcrypt';
import { normalizePermissions } from '../../../../../shared/admin-access-response';

@Injectable()
export class CreateAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: CreateAdminCommand) {
        // 1. Check if user exists
        const existingUser = await this.prisma.user.findFirst({
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

        const resolvedBrandIds = Array.from(
            new Set([...(command.brandIds ?? []), ...programs.map((program) => program.brandId)]),
        );

        // 2. Hash Password
        const passwordHash = await bcrypt.hash(command.password, 10);

        // 3. Resolve Brand (Admins need a primary brand for the User record, usually system default or first brand)
        // For now, we'll pick the first active brand if brandIds provided, or default
        let primaryBrandId = resolvedBrandIds[0];

        if (!primaryBrandId) {
            const defaultBrand = await this.prisma.brand.findFirst({ select: { id: true } });
            if (!defaultBrand) throw new BadRequestException('No brands available to assign to admin.');
            primaryBrandId = defaultBrand.id;
        }

        const assignmentPermissions = normalizePermissions(role?.permissions);
        const assignmentRoleName = role?.name ?? 'Admin';

        // 4. Create User & Admin in Transaction
        return this.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
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
