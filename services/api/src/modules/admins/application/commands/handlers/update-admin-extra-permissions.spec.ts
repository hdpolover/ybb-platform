// services/api/src/modules/admins/application/commands/handlers/update-admin-extra-permissions.spec.ts
//
// Per-admin extra permissions on PATCH /admins/:id. Additive only, never
// privileged, only catalog keys; stored privileged entries are preserved.
import { BadRequestException } from '@nestjs/common';
import { UpdateAdminHandler } from './update-admin.handler';
import { UpdateAdminCommand } from '../update-admin.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

const ROLE = { id: 'role-1', name: 'Program Admin', permissions: ['program:read'] };

function build(customPermissions: unknown) {
    const tx = {
        user: { update: jest.fn() },
        admin: { update: jest.fn() },
        adminBrand: { deleteMany: jest.fn(), createMany: jest.fn() },
        adminProgram: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const prisma = {
        admin: {
            findUnique: jest.fn().mockResolvedValue({
                id: 'admin-1',
                userId: 'user-1',
                user: { id: 'user-1', brandId: 'brand-a' },
                role: ROLE,
                customPermissions,
                adminBrands: [],
                adminPrograms: [],
            }),
        },
        adminRole: { findFirst: jest.fn().mockResolvedValue(ROLE) },
        program: { findMany: jest.fn().mockResolvedValue([]) },
        $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    const handler = new UpdateAdminHandler(prisma as unknown as PrismaService);
    const run = (updates: ConstructorParameters<typeof UpdateAdminCommand>[1]) =>
        handler.execute(new UpdateAdminCommand('admin-1', updates, 'actor-1'));
    return { tx, run };
}

const writtenCustomPermissions = (tx: ReturnType<typeof build>['tx']) =>
    tx.admin.update.mock.calls.map(([arg]) => arg.data.customPermissions);

describe('UpdateAdminHandler customPermissions', () => {
    it('leaves the column unchanged when customPermissions is absent', async () => {
        const { tx, run } = build(['*', 'program:read']);

        const result = await run({ fullName: 'New Name' });

        expect(writtenCustomPermissions(tx)).toEqual([undefined]);
        expect(result.customPermissions).toEqual(['*', 'program:read']);
    });

    it('writes normalised extras', async () => {
        const { tx, run } = build([]);

        await run({ customPermissions: [' Payments:Read', 'applications:read', 'payments:read'] });

        expect(writtenCustomPermissions(tx)).toEqual([['applications:read', 'payments:read']]);
    });

    it('preserves stored privileged entries while replacing the extras', async () => {
        const { tx, run } = build(['*', 'admin.manage', 'program:read']);

        const result = await run({ customPermissions: ['payments:read'] });

        expect(writtenCustomPermissions(tx)).toEqual([['*', 'admin.manage', 'payments:read']]);
        expect(result.customPermissions).toEqual(['*', 'admin.manage', 'payments:read']);
    });

    it('an empty submission clears extras but keeps privileged entries', async () => {
        const { tx, run } = build(['admin.manage', 'program:read']);

        await run({ customPermissions: [] });

        expect(writtenCustomPermissions(tx)).toEqual([['admin.manage']]);
    });

    it.each(['*', 'admin.*', 'platform.*', 'platform_access', 'platform.manage', 'brand.manage', 'admin.manage', 'roles.manage'])(
        'rejects privileged %s without writing',
        async (permission) => {
            const { tx, run } = build([]);

            await expect(run({ customPermissions: ['program:read', permission] })).rejects.toBeInstanceOf(BadRequestException);

            expect(tx.admin.update).not.toHaveBeenCalled();
        },
    );

    it('rejects unknown keys without writing', async () => {
        const { tx, run } = build([]);

        await expect(run({ customPermissions: ['payments:destroy'] })).rejects.toBeInstanceOf(BadRequestException);

        expect(tx.admin.update).not.toHaveBeenCalled();
    });

    it('writes extras alone (no name or role change)', async () => {
        const { tx, run } = build([]);

        await run({ customPermissions: ['program:read'] });

        expect(tx.admin.update).toHaveBeenCalledTimes(1);
        expect(tx.adminProgram.deleteMany).not.toHaveBeenCalled();
    });
});
