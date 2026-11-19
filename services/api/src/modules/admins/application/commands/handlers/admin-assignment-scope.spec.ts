// services/api/src/modules/admins/application/commands/handlers/admin-assignment-scope.spec.ts
//
// Create/update used to add the brand of every assigned program to admin_brands,
// so saving an admin meant for one program made them brand_scope over that whole
// brand (all its programs, users and payments). Brand rows now come only from the
// brandIds the caller sent.
import { CreateAdminHandler } from './create-admin.handler';
import { UpdateAdminHandler } from './update-admin.handler';
import { CreateAdminCommand } from '../create-admin.command';
import { UpdateAdminCommand } from '../update-admin.command';
import { PrismaService } from '../../../../../shared/infrastructure/prisma/prisma.service';

const ROLE = { id: 'role-1', name: 'Program Admin', permissions: ['applications.read'] };
// prog-a belongs to brand-a, prog-b to brand-b.
const PROGRAMS = [
    { id: 'prog-a', brandId: 'brand-a' },
    { id: 'prog-b', brandId: 'brand-b' },
];

function buildPrisma(admin?: unknown) {
    const tx = {
        user: { create: jest.fn().mockResolvedValue({ id: 'user-new' }), update: jest.fn() },
        admin: { create: jest.fn().mockResolvedValue({ id: 'admin-new' }), update: jest.fn() },
        adminBrand: { deleteMany: jest.fn(), createMany: jest.fn() },
        adminProgram: { deleteMany: jest.fn(), createMany: jest.fn() },
    };
    const prisma = {
        user: { findFirst: jest.fn().mockResolvedValue(null) },
        admin: { findUnique: jest.fn().mockResolvedValue(admin) },
        adminRole: { findFirst: jest.fn().mockResolvedValue(ROLE) },
        brand: { findFirst: jest.fn().mockResolvedValue({ id: 'brand-default' }) },
        program: {
            findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
                Promise.resolve(PROGRAMS.filter((program) => where.id.in.includes(program.id))),
            ),
        },
        $transaction: jest.fn((fn: (client: typeof tx) => unknown) => fn(tx)),
    };
    return { prisma, tx };
}

const brandRowsWritten = (tx: ReturnType<typeof buildPrisma>['tx']) =>
    tx.adminBrand.createMany.mock.calls.flatMap(([arg]) => arg.data.map((row: { brandId: string }) => row.brandId));

const existingAdmin = (brandIds: string[], programIds: string[]) => ({
    id: 'admin-1',
    userId: 'user-1',
    user: { id: 'user-1', brandId: brandIds[0] ?? 'brand-a' },
    role: ROLE,
    adminBrands: brandIds.map((brandId) => ({ brandId })),
    adminPrograms: programIds.map((programId) => ({ programId })),
});

describe('UpdateAdminHandler program vs brand assignment', () => {
    it('programIds only (what the dashboard form sends): no brand rows added for those programs', async () => {
        const { prisma, tx } = buildPrisma(existingAdmin([], ['prog-a']));
        const handler = new UpdateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(new UpdateAdminCommand('admin-1', { roleId: 'role-1', programIds: ['prog-a', 'prog-b'] }, 'actor-1'));

        expect(brandRowsWritten(tx)).toEqual([]);
        expect(tx.adminProgram.createMany).toHaveBeenCalledWith({
            data: [
                expect.objectContaining({ adminId: 'admin-1', programId: 'prog-a' }),
                expect.objectContaining({ adminId: 'admin-1', programId: 'prog-b' }),
            ],
        });
    });

    it('explicit brandIds are saved as-is, without the programs\' brands', async () => {
        const { prisma, tx } = buildPrisma(existingAdmin([], ['prog-a']));
        const handler = new UpdateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(new UpdateAdminCommand('admin-1', { brandIds: ['brand-c'], programIds: ['prog-a'] }, 'actor-1'));

        expect(brandRowsWritten(tx)).toEqual(['brand-c']);
    });

    it('editing an existing brand_scope admin without brandIds keeps their brands', async () => {
        const { prisma, tx } = buildPrisma(existingAdmin(['brand-a', 'brand-c'], ['prog-a']));
        const handler = new UpdateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(new UpdateAdminCommand('admin-1', { roleId: 'role-1', programIds: ['prog-b'] }, 'actor-1'));

        expect(brandRowsWritten(tx)).toEqual(['brand-a', 'brand-c']);
        expect(tx.adminBrand.deleteMany).toHaveBeenCalledTimes(1);
    });

    it('a programIds-only change leaves brand rows untouched', async () => {
        const { prisma, tx } = buildPrisma(existingAdmin(['brand-a'], ['prog-a']));
        const handler = new UpdateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(new UpdateAdminCommand('admin-1', { programIds: ['prog-b'] }, 'actor-1'));

        expect(tx.adminBrand.deleteMany).not.toHaveBeenCalled();
        expect(tx.adminBrand.createMany).not.toHaveBeenCalled();
    });
});

describe('CreateAdminHandler program vs brand assignment', () => {
    const create = (brandIds?: string[], programIds?: string[]) =>
        new CreateAdminCommand('new@example.com', 'New Admin', 'password123', 'actor-1', 'role-1', brandIds, programIds);

    it('programIds only: no brand rows, and the user lives in the program\'s brand', async () => {
        const { prisma, tx } = buildPrisma();
        const handler = new CreateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(create(undefined, ['prog-a']));

        expect(brandRowsWritten(tx)).toEqual([]);
        expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ brandId: 'brand-a' }) });
        expect(tx.adminProgram.createMany).toHaveBeenCalledWith({
            data: [expect.objectContaining({ adminId: 'admin-new', programId: 'prog-a' })],
        });
    });

    it('explicit brandIds are saved, and only those', async () => {
        const { prisma, tx } = buildPrisma();
        const handler = new CreateAdminHandler(prisma as unknown as PrismaService);

        await handler.execute(create(['brand-c'], ['prog-a']));

        expect(brandRowsWritten(tx)).toEqual(['brand-c']);
        expect(tx.user.create).toHaveBeenCalledWith({ data: expect.objectContaining({ brandId: 'brand-c' }) });
    });
});
