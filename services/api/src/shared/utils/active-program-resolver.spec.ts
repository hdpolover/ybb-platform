// services/api/src/shared/utils/active-program-resolver.spec.ts
import {
    activeProgramQuery,
    anyProgramFallbackQuery,
    resolveActiveProgram,
} from './active-program-resolver';

describe('activeProgramQuery / anyProgramFallbackQuery', () => {
    it('rule 1 query filters on isPublished/isActive; rule 2 fallback does not', () => {
        expect(activeProgramQuery('b1').where).toEqual({
            brandId: 'b1',
            deletedAt: null,
            isPublished: true,
            isActive: true,
        });
        expect(anyProgramFallbackQuery('b1').where).toEqual({ brandId: 'b1', deletedAt: null });
    });

    it('both rules order by year desc, createdAt desc, id asc — the stable tiebreak', () => {
        const expectedOrderBy = [{ year: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }];
        expect(activeProgramQuery('b1').orderBy).toEqual(expectedOrderBy);
        expect(anyProgramFallbackQuery('b1').orderBy).toEqual(expectedOrderBy);
    });
});

describe('resolveActiveProgram', () => {
    it('resolves via rule 1 when a published+active program exists (unchanged from today)', async () => {
        const published = { id: 'p1', name: 'CYS 2026' };
        const findFirst = jest.fn().mockResolvedValueOnce(published);

        const result = await resolveActiveProgram(findFirst, 'brand-china');

        expect(result).toEqual({ program: published, rule: 1 });
        expect(findFirst).toHaveBeenCalledTimes(1);
        expect(findFirst).toHaveBeenCalledWith(activeProgramQuery('brand-china'));
    });

    it('falls back to rule 2 for the Vietnam shape — published=true, isActive=false; rule 1 finds nothing', async () => {
        const vietnamProgram = { id: 'p-vys', name: 'Vietnam Youth Summit 2026', isPublished: true, isActive: false };
        const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(vietnamProgram);

        const result = await resolveActiveProgram(findFirst, 'brand-vys');

        expect(result).toEqual({ program: vietnamProgram, rule: 2 });
        expect(findFirst).toHaveBeenNthCalledWith(1, activeProgramQuery('brand-vys'));
        expect(findFirst).toHaveBeenNthCalledWith(2, anyProgramFallbackQuery('brand-vys'));
    });

    it('falls back to rule 2 for the Korea shape — isPublished=false, isActive=true; rule 1 finds nothing', async () => {
        const koreaProgram = { id: 'p-kys', name: '4th Korea Youth Summit', isPublished: false, isActive: true };
        const findFirst = jest.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(koreaProgram);

        const result = await resolveActiveProgram(findFirst, 'brand-kys');

        expect(result).toEqual({ program: koreaProgram, rule: 2 });
    });

    it('resolves to null with rule 3 when the brand has no non-deleted programs at all', async () => {
        const findFirst = jest.fn().mockResolvedValue(null);

        const result = await resolveActiveProgram(findFirst, 'brand-empty');

        expect(result).toEqual({ program: null, rule: 3 });
        expect(findFirst).toHaveBeenCalledTimes(2);
    });

    it('never calls the rule-2 fallback query when rule 1 already resolved a program', async () => {
        const findFirst = jest.fn().mockResolvedValueOnce({ id: 'p1' });

        await resolveActiveProgram(findFirst, 'brand-china');

        expect(findFirst).not.toHaveBeenCalledWith(anyProgramFallbackQuery('brand-china'));
    });
});

describe('id ASC tiebreak stability', () => {
    // Mirrors what Postgres does with ACTIVE_PROGRAM_ORDER_BY — we can't
    // exercise a real ORDER BY in a unit test, so this proves that the
    // declared order (year desc, createdAt desc, id asc) yields one
    // deterministic winner regardless of input array order, which is what
    // "stable across runs and across processes" requires.
    function sortByActiveProgramOrder<T extends { year: number; createdAt: string; id: string }>(programs: T[]): T[] {
        return [...programs].sort((a, b) => {
            if (a.year !== b.year) return b.year - a.year;
            if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt);
            return a.id.localeCompare(b.id);
        });
    }

    it('picks the same winner by id regardless of input order when year and createdAt collide', () => {
        const tied = [
            { id: 'zzz-program', year: 2026, createdAt: '2026-01-01T00:00:00Z' },
            { id: 'aaa-program', year: 2026, createdAt: '2026-01-01T00:00:00Z' },
            { id: 'mmm-program', year: 2026, createdAt: '2026-01-01T00:00:00Z' },
        ];

        const sortedForward = sortByActiveProgramOrder(tied);
        const sortedReversed = sortByActiveProgramOrder([...tied].reverse());

        expect(sortedForward[0].id).toBe('aaa-program');
        expect(sortedReversed[0].id).toBe('aaa-program');
        expect(sortedForward).toEqual(sortedReversed);
    });
});
