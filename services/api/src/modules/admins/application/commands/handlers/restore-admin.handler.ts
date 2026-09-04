
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';
import { RestoreAdminCommand } from '../restore-admin.command';

/**
 * The inverse of DeleteAdminHandler, and the missing half of it.
 *
 * Deleting an admin soft-deletes the user and the admin row but leaves the
 * (email, brandId) slot occupied, and nothing purges admins. Re-creating that
 * person then fails on the unique constraint with no way forward - the email is
 * blocked permanently. Restore is that way forward.
 *
 * It deliberately does NOT touch AdminBrand/AdminProgram, because delete never
 * touched them either. Restore returns the account to exactly the state it was
 * in before deletion, which is the only non-surprising definition; adding or
 * dropping grants here would make restore silently mean something else. The
 * response reports how many grants came back so the operator can see what they
 * just reinstated, and PATCH /admins/:id already reconciles them if it is wrong.
 */
@Injectable()
export class RestoreAdminHandler {
    constructor(private readonly prisma: PrismaService) { }

    async execute(command: RestoreAdminCommand) {
        const { id } = command;

        // `deletedAt: { not: null }` is an explicit override of the soft-delete
        // extension's injected `deletedAt: null` (it spreads args.where last), so
        // this is one of the few reads that deliberately looks at deleted rows.
        const admin = await this.prisma.admin.findFirst({
            where: { id, deletedAt: { not: null } },
            select: {
                id: true,
                userId: true,
                _count: { select: { adminBrands: true, adminPrograms: true } },
            },
        });

        if (!admin) {
            throw new NotFoundException('No deleted admin with that id');
        }

        await this.prisma.$transaction([
            this.prisma.user.update({
                where: { id: admin.userId },
                data: { isActive: true, deletedAt: null },
            }),
            this.prisma.admin.update({
                where: { id },
                data: { deletedAt: null, deletedBy: null },
            }),
        ]);

        return {
            success: true,
            adminId: admin.id,
            restoredGrants: {
                brands: admin._count.adminBrands,
                programs: admin._count.adminPrograms,
            },
        };
    }
}
