import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { resolveUsersBrandFilter, assertCanChangeUserStatus } from './user-access.util';

// Shapes resolveRevenueAccessScope reads: accessLevel/role/adminBrands decide
// whether the caller is platform, brand-scoped, or program-assigned.
const platformAdmin = {
    accessLevel: 5,
    canManageAdmins: true,
    canAssignRoles: true,
    customPermissions: [],
    role: { name: 'super_admin', permissions: ['platform_access'] },
    adminBrands: [],
    adminPrograms: [],
};
const brandAdmin = (brandIds: string[]) => ({
    accessLevel: 2,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: brandIds.map((brandId) => ({ brandId, permissions: [] })),
    adminPrograms: [],
});

const makePrisma = (admin: unknown) => ({
    admin: { findUnique: jest.fn().mockResolvedValue(admin), findFirst: jest.fn() },
}) as never;

const actor = { userId: 'user-1', email: 'a@b.c', brandId: 'brand-1', adminId: 'admin-1' };

describe('resolveUsersBrandFilter', () => {
    it('lets a brand admin act on a brand they own', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1', 'brand-2']));

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-2')).resolves.toBe('brand-2');
    });

    // A brand-scope admin can legitimately own several brands, so a naive
    // "brandId === caller.brandId" check would lock real admins out.
    it('honours every brand a multi-brand admin owns, not just their token brand', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1', 'brand-9']));

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-9')).resolves.toBe('brand-9');
    });

    it('refuses a brand the caller does not own', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1']));

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-other')).rejects.toThrow(ForbiddenException);
    });

    // THE hole: `where.brandId = undefined` is "no condition" to Prisma, so simply
    // OMITTING the parameter returned every user in every brand. No id to guess.
    // Any equality-based fix that only rejects mismatches leaves this open.
    it('refuses to run unscoped when a non-platform admin omits brandId', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1']));

        await expect(resolveUsersBrandFilter(prisma, actor, undefined)).rejects.toThrow(BadRequestException);
        await expect(resolveUsersBrandFilter(prisma, actor, '')).rejects.toThrow(BadRequestException);
    });

    // The platform users page deliberately lists across brands.
    it('allows a platform admin to list across every brand', async () => {
        const prisma = makePrisma(platformAdmin);

        await expect(resolveUsersBrandFilter(prisma, actor, undefined)).resolves.toBeNull();
    });

    it('fails closed when the caller has no admin record at all', async () => {
        const prisma = makePrisma(null);

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-1')).rejects.toThrow(ForbiddenException);
    });
});

describe('assertCanChangeUserStatus', () => {
    const prismaWith = (target: unknown, self: unknown) => ({
        admin: {
            findUnique: jest.fn().mockImplementation(({ where }: { where: { userId?: string; id?: string } }) =>
                Promise.resolve(where.userId ? target : self),
            ),
        },
    }) as never;

    it('allows acting on an ordinary user who holds no admin record', async () => {
        await expect(assertCanChangeUserStatus(prismaWith(null, null), actor, 'user-2')).resolves.toBeUndefined();
    });

    it('refuses self-deactivation', async () => {
        await expect(assertCanChangeUserStatus(prismaWith(null, null), actor, actor.userId)).rejects.toThrow(
            ForbiddenException,
        );
    });

    // Brand scoping alone does not close this: an admin could still deactivate
    // their own brand's super admin, and JwtStrategy re-checks isActive on every
    // request, so their live sessions die immediately.
    it('refuses to deactivate an admin the caller does not outrank', async () => {
        const prisma = prismaWith({ accessLevel: 5 }, { accessLevel: 2, canManageAdmins: true });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('refuses at EQUAL access level, not just above it', async () => {
        const prisma = prismaWith({ accessLevel: 3 }, { accessLevel: 3, canManageAdmins: true });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('refuses when the caller cannot manage admins at all, however senior', async () => {
        const prisma = prismaWith({ accessLevel: 1 }, { accessLevel: 9, canManageAdmins: false });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2')).rejects.toThrow(ForbiddenException);
    });

    it('allows a manager to act on a strictly junior admin', async () => {
        const prisma = prismaWith({ accessLevel: 1 }, { accessLevel: 5, canManageAdmins: true });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2')).resolves.toBeUndefined();
    });
});
