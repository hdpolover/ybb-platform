
import { Injectable, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { CreateAdminCommand } from '../create-admin.command';
import * as bcrypt from 'bcrypt';

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

        // 2. Hash Password
        const passwordHash = await bcrypt.hash(command.password, 10);

        // 3. Resolve Brand (Admins need a primary brand for the User record, usually system default or first brand)
        // For now, we'll pick the first active brand if brandIds provided, or default
        let primaryBrandId = command.brandIds?.[0];

        if (!primaryBrandId) {
            const defaultBrand = await this.prisma.brand.findFirst({ select: { id: true } });
            if (!defaultBrand) throw new BadRequestException('No brands available to assign to admin.');
            primaryBrandId = defaultBrand.id;
        }

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
            if (command.brandIds && command.brandIds.length > 0) {
                await tx.adminBrand.createMany({
                    data: command.brandIds.map(brandId => ({
                        adminId: admin.id,
                        brandId: brandId,
                        roleInBrand: 'admin' // Default role
                    }))
                });
            }

            return admin;
        });
    }
}
