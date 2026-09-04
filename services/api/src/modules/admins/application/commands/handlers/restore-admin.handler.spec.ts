// services/api/src/modules/admins/application/commands/handlers/restore-admin.handler.spec.ts
//
// Audit M218. Deleting an admin soft-deletes the user and the admin row but
// leaves the (email, brandId) slot occupied, and nothing ever purges admins, so
// re-creating that person failed on the unique constraint with no route
// forward. Two production admins are in exactly that state.
//
// The backlog's stated fix - add `deletedAt: null` to the duplicate check in
// create-admin - is a NO-OP: the Prisma soft-delete extension already injects
// that filter into every findFirst. The check is not too permissive, it is
// already blind; the surviving row is the cause.
import { NotFoundException } from '@nestjs/common';
import { RestoreAdminHandler } from './restore-admin.handler';
import { RestoreAdminCommand } from '../restore-admin.command';
import { CreateAdminHandler } from './create-admin.handler';
import { CreateAdminCommand } from '../create-admin.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

describe('RestoreAdminHandler (audit M218)', () => {
    const makePrisma = (admin: unknown) => ({
        admin: {
            findFirst: jest.fn().mockResolvedValue(admin),
            update: jest.fn().mockReturnValue({ __op: 'admin.update' }),
        },
        user: { update: jest.fn().mockReturnValue({ __op: 'user.update' }) },
        $transaction: jest.fn().mockResolvedValue([{}, {}]),
    });

    const deletedAdmin = {
        id: 'admin-1',
        userId: 'user-1',
        _count: { adminBrands: 2, adminPrograms: 3 },
    };

    it('looks only at DELETED admins, overriding the soft-delete extension default', async () => {
        const prisma = makePrisma(deletedAdmin);
        const handler = new RestoreAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(new RestoreAdminCommand('admin-1', 'actor-1'));

        // `deletedAt: { not: null }` is the whole point: every other findFirst in
        // the codebase is silently filtered to deletedAt: null by the extension,
        // so without the explicit override this read would find nothing.
        expect(prisma.admin.findFirst).toHaveBeenCalledWith(
            expect.objectContaining({
                where: { id: 'admin-1', deletedAt: { not: null } },
            }),
        );
    });

    it('clears deletedAt on both rows and reactivates the user, in one transaction', async () => {
        const prisma = makePrisma(deletedAdmin);
        const handler = new RestoreAdminHandler(prisma as unknown as PrismaService);

        const result = await handler.execute(new RestoreAdminCommand('admin-1', 'actor-1'));

        expect(prisma.user.update).toHaveBeenCalledWith({
            where: { id: 'user-1' },
            data: { isActive: true, deletedAt: null },
        });
        expect(prisma.admin.update).toHaveBeenCalledWith({
            where: { id: 'admin-1' },
            data: { deletedAt: null, deletedBy: null },
        });
        expect(prisma.$transaction).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            success: true,
            adminId: 'admin-1',
            // Reported so an operator can see which grants came back. Restore is
            // the exact inverse of delete, and delete never touched
            // AdminBrand/AdminProgram, so these are reinstated as they were.
            restoredGrants: { brands: 2, programs: 3 },
        });
    });

    it('refuses to restore an admin that is not deleted', async () => {
        const prisma = makePrisma(null);
        const handler = new RestoreAdminHandler(prisma as unknown as PrismaService);

        await expect(
            handler.execute(new RestoreAdminCommand('admin-1', 'actor-1')),
        ).rejects.toThrow(NotFoundException);
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });
});

describe('CreateAdminHandler deleted-email conflict (audit M218)', () => {
    const buildPrisma = (deletedConflict: unknown) => ({
        user: {
            // The live duplicate check finds nothing: the extension hides the
            // soft-deleted row from it.
            findFirst: jest
                .fn()
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(deletedConflict),
        },
        adminRole: { findFirst: jest.fn().mockResolvedValue(null) },
        brand: { findFirst: jest.fn().mockResolvedValue({ id: 'brand-1' }) },
        adminBrand: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn(),
    });

    const command = new CreateAdminCommand(
        'reonboarded@example.com',
        'Re Onboarded',
        'password',
        'creator-admin-1',
    );

    it('returns an actionable 409 naming the admin to restore, instead of an opaque P2002', async () => {
        const prisma = buildPrisma({ admin: { id: 'admin-9' } });
        const handler = new CreateAdminHandler(prisma as unknown as PrismaService);

        await expect(handler.execute(command)).rejects.toMatchObject({
            response: expect.objectContaining({
                errorCode: 'DELETED_ADMIN_EMAIL_CONFLICT',
                adminId: 'admin-9',
            }),
        });
        // It must fail BEFORE attempting the create that would P2002.
        expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('scopes the conflict check to the brand the admin is being created in', async () => {
        const prisma = buildPrisma(null);
        const handler = new CreateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(command).catch(() => undefined);

        // The constraint is @@unique([email, brandId]), so a deleted admin with
        // the same email in a DIFFERENT brand must not block this create.
        expect(prisma.user.findFirst).toHaveBeenLastCalledWith(
            expect.objectContaining({
                where: expect.objectContaining({
                    email: 'reonboarded@example.com',
                    brandId: 'brand-1',
                    deletedAt: { not: null },
                }),
            }),
        );
    });

    it('does not raise the deleted conflict when the surviving row is not an admin', async () => {
        // A soft-deleted plain user with that email is not an admin to restore, so
        // this must NOT hijack the create - it proceeds to the transaction, where
        // the real unique constraint decides.
        const prisma = buildPrisma({ admin: null });
        const handler = new CreateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(command).catch(() => undefined);

        expect(prisma.$transaction).toHaveBeenCalled();
    });
});
