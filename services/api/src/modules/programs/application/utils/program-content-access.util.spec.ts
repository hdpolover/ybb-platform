import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { assertProgramContentAccess } from './program-content-access.util';

// Fixtures copied deliberately from users/application/utils/user-access.util.spec.ts
// rather than reinvented. That spec shipped with fixtures for the platform and
// brand personas but NONE for 'assigned', and that missing fixture is why a live
// admin lockout got through two independent reviews (see N17). Every kind the
// classifier can return needs one here.
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

const actor = { userId: 'user-1', email: 'a@b.c', brandId: 'brand-1', adminId: 'admin-1' } as never;

const makePrisma = (admin: unknown, program: unknown = { id: 'prog-1', brandId: 'brand-1', name: 'P', deletedAt: null }) =>
    ({
        admin: { findUnique: jest.fn().mockResolvedValue(admin) },
        program: { findUnique: jest.fn().mockResolvedValue(program) },
    }) as never;

describe('assertProgramContentAccess', () => {
    it('lets a platform admin write to any programme', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(platformAdmin), actor, 'prog-1'),
        ).resolves.toBeUndefined();
    });

    it('lets a brand admin write to a programme in a brand they own', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(brandAdmin(['brand-1', 'brand-9'])), actor, 'prog-1'),
        ).resolves.toBeUndefined();
    });

    it('refuses a brand admin a programme outside their brands', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(brandAdmin(['brand-other'])), actor, 'prog-1'),
        ).rejects.toThrow(NotFoundException);
    });

    // The persona whose absence from a sibling spec caused a live lockout. Note
    // this asserts a PASS, not just a refusal for an out-of-scope programme: a
    // refusal-only test would have passed against the broken #149 code too.
    it('lets a program-scoped admin write to a programme they are assigned to', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(assignedAdmin(['prog-1'])), actor, 'prog-1'),
        ).resolves.toBeUndefined();
    });

    it('refuses a program-scoped admin a programme they are not assigned to', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(assignedAdmin(['prog-other'])), actor, 'prog-1'),
        ).rejects.toThrow(NotFoundException);
    });

    // Spans two brands, proving the check is not collapsed to a single brand id.
    it('honours every programme an assigned admin holds, across brands', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(assignedAdmin(['prog-a', 'prog-1'])), actor, 'prog-1'),
        ).resolves.toBeUndefined();
    });

    it('refuses an admin with no assignments at all', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(assignedAdmin([])), actor, 'prog-1'),
        ).rejects.toThrow(NotFoundException);
    });

    // resolveRevenueAccessScope fails closed to 'assigned' with an empty list
    // when the caller has no Admin row, so this must refuse rather than pass.
    it('fails closed when the caller has no admin record', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(null), actor, 'prog-1'),
        ).rejects.toThrow(NotFoundException);
    });

    it('404s a programme that does not exist or is soft-deleted', async () => {
        await expect(
            assertProgramContentAccess(makePrisma(platformAdmin, null), actor, 'prog-1'),
        ).rejects.toThrow(NotFoundException);
        await expect(
            assertProgramContentAccess(
                makePrisma(platformAdmin, { id: 'prog-1', brandId: 'brand-1', name: 'P', deletedAt: new Date() }),
                actor,
                'prog-1',
            ),
        ).rejects.toThrow(NotFoundException);
    });
});
