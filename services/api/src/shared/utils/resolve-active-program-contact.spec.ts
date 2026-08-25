// services/api/src/shared/utils/resolve-active-program-contact.spec.ts
//
// NOTE ON DEVIATION FROM TASK 13'S BRIEF: the brief's Step 1 spec asserted
// `prisma.program.findFirst` was called once, with a hand-typed
// `{ isPublished: true, isActive: true }` where and a two-element orderBy.
// The resolver addendum overrides that: resolveActiveProgramContact must be
// a thin wrapper over the shared active-program-resolver module (rule
// 1 -> rule 2 -> rule 3 fallback), not a rule-1-only reimplementation of the
// predicate. This spec tests the actual required behavior — including the
// rule 2 fallback the addendum introduced — rather than the brief's stale
// assertions, which described a resolver that would still return no contact
// info for Vietnam Youth Summit / Korea Youth Summit.
import { resolveActiveProgramContact } from './resolve-active-program-contact';
import { activeProgramQuery, anyProgramFallbackQuery } from './active-program-resolver';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';

function mkPrisma(findFirst: jest.Mock): PrismaService {
    return { program: { findFirst } } as unknown as PrismaService;
}

describe('resolveActiveProgramContact', () => {
    it('rule 1: queries via the shared activeProgramQuery builder with a contact-only select', async () => {
        const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce({
            contactEmail: 'x@example.com',
            contactPhone: null,
            contactWhatsapp: null,
            contactAddress: null,
        });
        const prisma = mkPrisma(findFirst);

        await resolveActiveProgramContact(prisma, 'brand-1');

        expect(findFirst).toHaveBeenCalledWith({
            ...activeProgramQuery('brand-1'),
            select: { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true },
        });
    });

    it('maps the resolved program contact fields through', async () => {
        const findFirst = jest.fn().mockResolvedValueOnce({
            contactEmail: 'hello@brand.com',
            contactPhone: '+62811',
            contactWhatsapp: '62811',
            contactAddress: 'Jakarta',
        });
        const prisma = mkPrisma(findFirst);

        const result = await resolveActiveProgramContact(prisma, 'brand-1');

        expect(result).toEqual({
            contactEmail: 'hello@brand.com',
            contactPhone: '+62811',
            contactWhatsapp: '62811',
            contactAddress: 'Jakarta',
        });
    });

    it('null-coalesces individual program fields (a program row can have some contact fields set and others null)', async () => {
        const findFirst = jest.fn().mockResolvedValueOnce({
            contactEmail: 'x@example.com',
            contactPhone: null,
            contactWhatsapp: null,
            contactAddress: null,
        });
        const prisma = mkPrisma(findFirst);

        const result = await resolveActiveProgramContact(prisma, 'brand-1');

        expect(result).toEqual({ contactEmail: 'x@example.com', contactPhone: null, contactWhatsapp: null, contactAddress: null });
    });

    it('rule 2: falls back to the most recent non-deleted program (Vietnam Youth Summit shape — published, inactive)', async () => {
        const findFirst = jest
            .fn()
            .mockResolvedValueOnce(null) // rule 0: no program with an open registration window
            .mockResolvedValueOnce(null) // rule 1: no published+active program
            .mockResolvedValueOnce({
                contactEmail: 'vys@ybbfoundation.com',
                contactPhone: '+84 123-456-789',
                contactWhatsapp: null,
                contactAddress: 'Ho Chi Minh City & Hanoi, Vietnam',
            });
        const prisma = mkPrisma(findFirst);

        const result = await resolveActiveProgramContact(prisma, 'brand-vys');

        expect(findFirst).toHaveBeenNthCalledWith(2, {
            ...activeProgramQuery('brand-vys'),
            select: { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true },
        });
        expect(findFirst).toHaveBeenNthCalledWith(3, {
            ...anyProgramFallbackQuery('brand-vys'),
            select: { contactEmail: true, contactPhone: true, contactWhatsapp: true, contactAddress: true },
        });
        expect(result).toEqual({
            contactEmail: 'vys@ybbfoundation.com',
            contactPhone: '+84 123-456-789',
            contactWhatsapp: null,
            contactAddress: 'Ho Chi Minh City & Hanoi, Vietnam',
        });
    });

    it('returns all-null fields, not a rejection, when the brand has no resolvable program at all (rule 3)', async () => {
        const findFirst = jest.fn().mockResolvedValue(null);
        const prisma = mkPrisma(findFirst);

        const result = await resolveActiveProgramContact(prisma, 'brand-empty');

        expect(result).toEqual({ contactEmail: null, contactPhone: null, contactWhatsapp: null, contactAddress: null });
        expect(findFirst).toHaveBeenCalledTimes(3);
    });
});
