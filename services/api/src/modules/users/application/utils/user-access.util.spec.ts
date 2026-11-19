import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { resolveUsersScope, assertUserInScope, assertCanChangeUserStatus } from './user-access.util';

// Shapes resolveRevenueAccessScope reads: accessLevel/role/permissions decide
// platform vs program-assigned. adminBrands is deliberately present on the
// brand-row persona: under the 2026-11-19 policy it must grant nothing.
const platformAdmin = {
    accessLevel: 5,
    canManageAdmins: true,
    canAssignRoles: true,
    customPermissions: [],
    role: { name: 'super_admin', permissions: ['platform_access'] },
    adminBrands: [],
    adminPrograms: [],
};

const assignedAdmin = (programIds: string[], brandIds: string[] = []) => ({
    accessLevel: 1,
    canManageAdmins: false,
    canAssignRoles: false,
    customPermissions: [],
    role: { name: 'reviewer', permissions: [] },
    adminBrands: brandIds.map((brandId) => ({ brandId, permissions: [] })),
    adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});

// programs: the admin's assigned programmes as the DB returns them (id + brand).
const makePrisma = (admin: unknown, programs: Array<{ id: string; brandId: string }> = [], userCount = 0) => ({
    admin: { findUnique: jest.fn().mockResolvedValue(admin), findFirst: jest.fn() },
    program: { findMany: jest.fn().mockResolvedValue(programs) },
    user: { count: jest.fn().mockResolvedValue(userCount) },
}) as never;

const actor = { userId: 'user-1', email: 'a@b.c', brandId: 'brand-1', adminId: 'admin-1' };

describe('resolveUsersScope', () => {
    it('allows a platform admin to list across every brand', async () => {
        await expect(resolveUsersScope(makePrisma(platformAdmin), actor, undefined)).resolves.toEqual({
            brandId: null,
            programIds: null,
        });
        await expect(resolveUsersScope(makePrisma(platformAdmin), actor, 'brand-9')).resolves.toEqual({
            brandId: 'brand-9',
            programIds: null,
        });
    });

    it('scopes an assigned admin to the applicants of their programmes in that brand', async () => {
        const prisma = makePrisma(assignedAdmin(['program-1', 'program-2']), [
            { id: 'program-1', brandId: 'brand-7' },
            { id: 'program-2', brandId: 'brand-8' },
        ]);

        await expect(resolveUsersScope(prisma, actor, 'brand-7')).resolves.toEqual({
            brandId: 'brand-7',
            programIds: ['program-1'],
        });
    });

    it('infers the brand when the admin has programmes in exactly one', async () => {
        const prisma = makePrisma(assignedAdmin(['program-1']), [{ id: 'program-1', brandId: 'brand-7' }]);

        await expect(resolveUsersScope(prisma, actor)).resolves.toEqual({ brandId: 'brand-7', programIds: ['program-1'] });
    });

    it('refuses a brand none of their programmes belong to', async () => {
        const prisma = makePrisma(assignedAdmin(['program-1']), [{ id: 'program-1', brandId: 'brand-7' }]);

        await expect(resolveUsersScope(prisma, actor, 'brand-other')).rejects.toThrow(ForbiddenException);
    });

    it('refuses the brand of a brand row when no programme is assigned there', async () => {
        const prisma = makePrisma(assignedAdmin([], ['brand-1']), []);

        await expect(resolveUsersScope(prisma, actor, 'brand-1')).rejects.toThrow(ForbiddenException);
        await expect(resolveUsersScope(prisma, actor)).rejects.toThrow(ForbiddenException);
    });

    it('still refuses to run unscoped for an admin with programmes in several brands', async () => {
        const prisma = makePrisma(assignedAdmin(['program-1', 'program-2']), [
            { id: 'program-1', brandId: 'brand-1' },
            { id: 'program-2', brandId: 'brand-2' },
        ]);

        await expect(resolveUsersScope(prisma, actor, undefined)).rejects.toThrow(BadRequestException);
    });

    it('fails closed when the caller has no admin record at all', async () => {
        await expect(resolveUsersScope(makePrisma(null), actor, 'brand-1')).rejects.toThrow(ForbiddenException);
    });
});

describe('assertUserInScope', () => {
    const notFound = () => new NotFoundException('User u not found');

    it('passes a platform scope without a lookup', async () => {
        const prisma = makePrisma(platformAdmin);
        await expect(assertUserInScope(prisma, { brandId: null, programIds: null }, 'u', notFound)).resolves.toBeUndefined();
        expect((prisma as any).user.count).not.toHaveBeenCalled();
    });

    it('404s a user with no application in the scoped programmes', async () => {
        const prisma = makePrisma(null, [], 0);
        await expect(
            assertUserInScope(prisma, { brandId: 'brand-7', programIds: ['program-1'] }, 'u', notFound),
        ).rejects.toThrow(NotFoundException);
        expect((prisma as any).user.count).toHaveBeenCalledWith({
            where: {
                id: 'u',
                brandId: 'brand-7',
                participant: { applications: { some: { programId: { in: ['program-1'] }, deletedAt: null } } },
            },
        });
    });

    it('passes an applicant to a scoped programme', async () => {
        const prisma = makePrisma(null, [], 1);
        await expect(
            assertUserInScope(prisma, { brandId: 'brand-7', programIds: ['program-1'] }, 'u', notFound),
        ).resolves.toBeUndefined();
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
