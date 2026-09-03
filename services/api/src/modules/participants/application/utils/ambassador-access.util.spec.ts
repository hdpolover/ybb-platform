import { ForbiddenException, NotFoundException } from '@nestjs/common';
import {
    resolveAmbassadorProgramScope,
    assertAmbassadorAccess,
    assertAmbassadorCreateAccess,
} from './ambassador-access.util';

// One fixture per kind the classifier can return. The 'assigned' persona is the
// one whose absence from the users spec let a live admin lockout through two
// reviews (N17), so it is here and it asserts PASSES as well as refusals - a
// refusal-only test would have passed against that broken code too.
const platformAdmin = {
    accessLevel: 5, canManageAdmins: true, canAssignRoles: true, customPermissions: [],
    role: { name: 'super_admin', permissions: ['platform_access'] },
    adminBrands: [], adminPrograms: [],
};
const brandAdmin = (brandIds: string[]) => ({
    accessLevel: 2, canManageAdmins: false, canAssignRoles: false, customPermissions: [],
    role: { name: 'admin', permissions: [] },
    adminBrands: brandIds.map((brandId) => ({ brandId, permissions: [] })),
    adminPrograms: [],
});
const assignedAdmin = (programIds: string[]) => ({
    accessLevel: 1, canManageAdmins: false, canAssignRoles: false, customPermissions: [],
    role: { name: 'reviewer', permissions: [] },
    adminBrands: [],
    adminPrograms: programIds.map((programId) => ({ programId, permissions: [] })),
});

const actor = { userId: 'u', email: 'a@b.c', brandId: 'brand-1', adminId: 'adm-1' } as never;

const makePrisma = (admin: unknown, opts: { brandPrograms?: string[]; ambassador?: unknown; program?: unknown } = {}) =>
    ({
        admin: { findUnique: jest.fn().mockResolvedValue(admin) },
        program: {
            findMany: jest.fn().mockResolvedValue((opts.brandPrograms ?? []).map((id) => ({ id }))),
            findUnique: jest.fn().mockResolvedValue(
                opts.program === undefined
                    ? { id: 'prog-1', brandId: 'brand-1', name: 'P', deletedAt: null }
                    : opts.program,
            ),
        },
        // `in`, not `??`: passing an explicit null must mean "no such
        // ambassador", and `null ?? default` would silently hand back the default.
        ambassador: {
            findFirst: jest.fn().mockResolvedValue(
                'ambassador' in opts ? opts.ambassador : { programId: 'prog-1' },
            ),
        },
    }) as never;

describe('resolveAmbassadorProgramScope', () => {
    it('returns null for a platform admin, meaning no restriction', async () => {
        await expect(resolveAmbassadorProgramScope(makePrisma(platformAdmin), actor)).resolves.toBeNull();
    });

    it('expands a brand admin to every programme in their brands', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1', 'brand-2']), { brandPrograms: ['p1', 'p2', 'p3'] });

        await expect(resolveAmbassadorProgramScope(prisma, actor)).resolves.toEqual(['p1', 'p2', 'p3']);
    });

    it('returns a program-scoped admin their own programme list', async () => {
        await expect(
            resolveAmbassadorProgramScope(makePrisma(assignedAdmin(['p9', 'p10'])), actor),
        ).resolves.toEqual(['p9', 'p10']);
    });

    // An empty list must stay an empty list. If a caller mistook it for "no
    // restriction" the route would return every brand - the exact shape that
    // made the users list leak when its parameter was simply omitted.
    it('returns an EMPTY list, never null, for an admin scoped to nothing', async () => {
        await expect(resolveAmbassadorProgramScope(makePrisma(assignedAdmin([])), actor)).resolves.toEqual([]);
    });

    it('fails closed to an empty list when the caller has no admin record', async () => {
        await expect(resolveAmbassadorProgramScope(makePrisma(null), actor)).resolves.toEqual([]);
    });
});

describe('assertAmbassadorAccess', () => {
    it('lets a platform admin act on any ambassador', async () => {
        await expect(
            assertAmbassadorAccess(makePrisma(platformAdmin), actor, 'amb-1'),
        ).resolves.toBeUndefined();
    });

    it('lets a program-scoped admin act on an ambassador in their programme', async () => {
        const prisma = makePrisma(assignedAdmin(['prog-1']), { ambassador: { programId: 'prog-1' } });

        await expect(assertAmbassadorAccess(prisma, actor, 'amb-1')).resolves.toBeUndefined();
    });

    it('lets a brand admin act on an ambassador in one of their brands programmes', async () => {
        const prisma = makePrisma(brandAdmin(['brand-1']), {
            brandPrograms: ['prog-1'], ambassador: { programId: 'prog-1' },
        });

        await expect(assertAmbassadorAccess(prisma, actor, 'amb-1')).resolves.toBeUndefined();
    });

    // 404 rather than 403 on purpose: a 403 confirms the id exists, which turns
    // these id-keyed routes into a cross-brand existence oracle.
    it('answers 404, not 403, for an ambassador outside the caller scope', async () => {
        const prisma = makePrisma(assignedAdmin(['prog-other']), { ambassador: { programId: 'prog-1' } });

        await expect(assertAmbassadorAccess(prisma, actor, 'amb-1')).rejects.toThrow(NotFoundException);
    });

    it('answers 404 for an ambassador that does not exist', async () => {
        const prisma = makePrisma(assignedAdmin(['prog-1']), { ambassador: null });

        await expect(assertAmbassadorAccess(prisma, actor, 'amb-1')).rejects.toThrow(NotFoundException);
    });
});

describe('assertAmbassadorCreateAccess', () => {
    it('lets a program-scoped admin create in a programme they hold', async () => {
        await expect(
            assertAmbassadorCreateAccess(makePrisma(assignedAdmin(['prog-1'])), actor, 'prog-1'),
        ).resolves.toBeUndefined();
    });

    // This route mints and emails login credentials, so an unchecked programme
    // id in the body is account creation inside someone else's brand.
    it('refuses a programme the caller does not hold', async () => {
        await expect(
            assertAmbassadorCreateAccess(makePrisma(assignedAdmin(['prog-other'])), actor, 'prog-1'),
        ).rejects.toThrow(ForbiddenException);
    });

    it('refuses an admin with no assignments at all', async () => {
        await expect(
            assertAmbassadorCreateAccess(makePrisma(assignedAdmin([])), actor, 'prog-1'),
        ).rejects.toThrow(ForbiddenException);
    });
});
