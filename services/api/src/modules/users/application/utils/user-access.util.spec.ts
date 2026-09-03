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

const assignedAdmin = (programIds: string[]) => ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'reviewer', permissions: [] },
    adminBrands: [],
    adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});

const makePrisma = (admin: unknown, programBrandIds: string[] = []) => ({
    admin: { findUnique: jest.fn().mockResolvedValue(admin), findFirst: jest.fn() },
    program: { findMany: jest.fn().mockResolvedValue(programBrandIds.map((brandId) => ({ brandId }))) },
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
    // THE hole: `where.brandId = undefined` is "no condition" to Prisma, so
    // simply OMITTING the parameter returned every user in every brand. No id to
    // guess. A scoped admin must therefore never come back with null - either a
    // concrete brand, or an error. Never "no filter".
    it('never resolves to an unscoped filter for a non-platform admin', async () => {
        const single = await resolveUsersBrandFilter(makePrisma(brandAdmin(['brand-1'])), actor, undefined);
        expect(single).toBe('brand-1');

        await expect(
            resolveUsersBrandFilter(makePrisma(brandAdmin(['brand-1', 'brand-2'])), actor, undefined),
        ).rejects.toThrow(BadRequestException);
        await expect(
            resolveUsersBrandFilter(makePrisma(assignedAdmin([]), []), actor, undefined),
        ).rejects.toThrow(ForbiddenException);
    });

    // The platform users page deliberately lists across brands.
    it('allows a platform admin to list across every brand', async () => {
        const prisma = makePrisma(platformAdmin);

        await expect(resolveUsersBrandFilter(prisma, actor, undefined)).resolves.toBeNull();
    });

    // The regression this exists to prevent. A program-scoped admin ('assigned'
    // scope: adminPrograms populated, adminBrands empty) manages the participants
    // of their assigned programs and the Users pages have always allowed it. The
    // first version of this helper handed their brandId straight to
    // assertBrandAccess, whose docblock says 'assigned' never passes - so they
    // got a 403 with the parameter and a 400 without it. No way through.
    it('lets a program-scoped admin act on the brand of a program they are assigned to', async () => {
        const prisma = makePrisma(assignedAdmin(['program-1']), ['brand-7']);

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-7')).resolves.toBe('brand-7');
    });

    it('still refuses a program-scoped admin a brand none of their programs belong to', async () => {
        const prisma = makePrisma(assignedAdmin(['program-1']), ['brand-7']);

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-other')).rejects.toThrow(ForbiddenException);
    });

    // Avoids a 400 the frontend would have to learn to dodge: with one brand
    // there is nothing to disambiguate.
    it('infers the brand when a scoped admin has exactly one and sent none', async () => {
        expect(await resolveUsersBrandFilter(makePrisma(assignedAdmin(['program-1']), ['brand-7']), actor)).toBe('brand-7');
        expect(await resolveUsersBrandFilter(makePrisma(brandAdmin(['brand-3'])), actor)).toBe('brand-3');
    });

    it('still refuses to run unscoped for a multi-brand admin who sent none', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1', 'brand-2']));

        await expect(resolveUsersBrandFilter(prisma, actor, undefined)).rejects.toThrow(BadRequestException);
    });

    it('refuses an admin with no assignments at all rather than running unscoped', async () => {
        const prisma = makePrisma(assignedAdmin([]), []);

        await expect(resolveUsersBrandFilter(prisma, actor, undefined)).rejects.toThrow(ForbiddenException);
    });

    it('fails closed when the caller has no admin record at all', async () => {
        const prisma = makePrisma(null);

        await expect(resolveUsersBrandFilter(prisma, actor, 'brand-1')).rejects.toThrow(ForbiddenException);
    });
});

describe('assertCanChangeUserStatus', () => {
    // The target is looked up with findFirst so it can be brand-scoped; the
    // caller's own record is still a findUnique by admin id.
    const prismaWith = (target: unknown, self: unknown) => ({
        admin: {
            findFirst: jest.fn().mockResolvedValue(target),
            findUnique: jest.fn().mockResolvedValue(self),
        },
    }) as never;

    it('allows acting on an ordinary user who holds no admin record', async () => {
        await expect(assertCanChangeUserStatus(prismaWith(null, null), actor, 'user-2', 'brand-1')).resolves.toBeUndefined();
    });

    it('refuses self-deactivation', async () => {
        await expect(assertCanChangeUserStatus(prismaWith(null, null), actor, actor.userId, 'brand-1')).rejects.toThrow(
            ForbiddenException,
        );
    });

    // Brand scoping alone does not close this: an admin could still deactivate
    // their own brand's super admin, and JwtStrategy re-checks isActive on every
    // request, so their live sessions die immediately.
    it('refuses to deactivate an admin the caller does not outrank', async () => {
        const prisma = prismaWith({ accessLevel: 5 }, { accessLevel: 2, canManageAdmins: true });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2', 'brand-1')).rejects.toThrow(ForbiddenException);
    });

    it('refuses at EQUAL access level, not just above it', async () => {
        const prisma = prismaWith({ accessLevel: 3 }, { accessLevel: 3, canManageAdmins: true });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2', 'brand-1')).rejects.toThrow(ForbiddenException);
    });

    it('refuses when the caller cannot manage admins at all, however senior', async () => {
        const prisma = prismaWith({ accessLevel: 1 }, { accessLevel: 9, canManageAdmins: false });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2', 'brand-1')).rejects.toThrow(ForbiddenException);
    });

    it('allows a manager to act on a strictly junior admin', async () => {
        const prisma = prismaWith({ accessLevel: 1 }, { accessLevel: 5, canManageAdmins: true });

        await expect(assertCanChangeUserStatus(prisma, actor, 'user-2', 'brand-1')).resolves.toBeUndefined();
    });
});
