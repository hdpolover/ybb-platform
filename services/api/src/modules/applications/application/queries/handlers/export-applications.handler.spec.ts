/**
 * Unit tests for ExportApplicationsHandler
 *
 * Covers:
 *  - dynamic-column derivation (form fields + both essay systems, multi-program union)
 *  - per-row rendering (dateOfBirth, institution/occupation, country resolution)
 *  - the where-clause builder, including the M116 country/registrationPaymentStatus/
 *    programPaymentStatus filters
 *  - M105: groupBy (not findMany+distinct) for program-id resolution
 *  - M115: the keyset pagination scan — the critical regression test, pinning that
 *    every row is visited exactly once across tied submittedAt values and the
 *    NULL-submittedAt (draft) trailing group, even when batch boundaries land
 *    mid-tie.
 *
 * The handler's row/where/pagination logic is exercised directly via its private
 * methods (cast to `any`) rather than only through `execute()` + a mocked
 * ExcelService — since M105 replaced buffering + ExcelService.generateExcel with a
 * real streaming ExcelJS WorkbookWriter, asserting on rendered rows is far more
 * direct and robust done at the `buildRow`/`buildWhere`/`streamRows` level than by
 * re-parsing a written xlsx stream.
 */

import { ExportApplicationsHandler } from './export-applications.handler';
import { ExportApplicationsQuery } from '../export-applications.query';

// ── where-clause matcher for the in-memory Prisma fake ─────────────────────────
// Interprets the small subset of Prisma where-clause shapes this handler emits
// (equality, contains/mode, in, not, lt/lte/gt/gte, nested relation objects,
// AND/OR arrays) against a plain fixture record.

function evalCondition(value: unknown, condition: unknown): boolean {
    if (condition instanceof Date) {
        return value instanceof Date && value.getTime() === condition.getTime();
    }
    if (condition === null) return value === null || value === undefined;
    if (typeof condition !== 'object') return value === condition;

    const cond = condition as Record<string, unknown>;
    if ('equals' in cond) return evalCondition(value, cond.equals);
    if ('contains' in cond) {
        const s = String(value ?? '').toLowerCase();
        return s.includes(String(cond.contains).toLowerCase());
    }
    if ('in' in cond) return (cond.in as unknown[]).includes(value);
    if ('not' in cond) {
        const notVal = cond.not;
        if (notVal === null) return value !== null && value !== undefined;
        return !evalCondition(value, notVal);
    }
    if ('lt' in cond) return value != null && (value as never) < (cond.lt as never);
    if ('lte' in cond) return value != null && (value as never) <= (cond.lte as never);
    if ('gt' in cond) return value != null && (value as never) > (cond.gt as never);
    if ('gte' in cond) return value != null && (value as never) >= (cond.gte as never);

    // Nested relation filter object (e.g. participant: { originCountry: {...} }).
    return evalWhereOnRecord(value as Record<string, unknown> | null | undefined, cond);
}

function evalWhereOnRecord(record: Record<string, unknown> | null | undefined, where: unknown): boolean {
    if (!where) return true;
    const cond = where as Record<string, unknown>;
    if ('AND' in cond) return (cond.AND as unknown[]).every((c) => evalWhereOnRecord(record, c));
    if ('OR' in cond) return (cond.OR as unknown[]).some((c) => evalWhereOnRecord(record, c));
    return Object.entries(cond).every(([key, sub]) => evalCondition(record ? (record as never)[key] : undefined, sub));
}

function compareByOrderBy(a: Record<string, unknown>, b: Record<string, unknown>, orderBy: Record<string, 'asc' | 'desc'>[]): number {
    for (const clause of orderBy) {
        const [field, dir] = Object.entries(clause)[0] as [string, 'asc' | 'desc'];
        const av = a[field];
        const bv = b[field];
        let cmp = 0;
        if (av == null && bv == null) cmp = 0;
        else if (av == null) cmp = -1;
        else if (bv == null) cmp = 1;
        else if (av instanceof Date || bv instanceof Date) cmp = new Date(av as never).getTime() - new Date(bv as never).getTime();
        else if (av < bv) cmp = -1;
        else if (av > bv) cmp = 1;
        if (cmp !== 0) return dir === 'desc' ? -cmp : cmp;
    }
    return 0;
}

/** In-memory Prisma fake implementing real keyset/groupBy semantics against a fixed row list. */
function buildKeysetPrismaMock(
    allApps: Record<string, unknown>[],
    fields: unknown[] = [],
    essays: unknown[] = [],
) {
    const findMany = jest.fn().mockImplementation((args: { where?: unknown; orderBy?: Record<string, 'asc' | 'desc'>[]; take?: number }) => {
        let filtered = allApps.filter((a) => evalWhereOnRecord(a, args.where));
        if (Array.isArray(args.orderBy)) {
            filtered = [...filtered].sort((a, b) => compareByOrderBy(a, b, args.orderBy as never));
        }
        if (args.take) filtered = filtered.slice(0, args.take);
        return Promise.resolve(filtered);
    });
    const groupBy = jest.fn().mockImplementation((args: { where?: unknown }) => {
        const filtered = allApps.filter((a) => evalWhereOnRecord(a, args.where));
        const ids = Array.from(new Set(filtered.map((a) => a.programId as string)));
        return Promise.resolve(ids.map((programId) => ({ programId })));
    });

    return {
        participantApplication: { findMany, groupBy },
        applicationFormField: { findMany: jest.fn().mockResolvedValue(fields) },
        programEssay: { findMany: jest.fn().mockResolvedValue(essays) },
    };
}

function makeApp(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
        id: 'app-1',
        programId: 'prog-1',
        status: 'submitted',
        applicationCategory: 'self_funded',
        scoreTotal: null,
        scoreStatus: null,
        submittedAt: new Date('2026-01-01T00:00:00Z'),
        createdAt: new Date('2026-01-01T00:00:00Z'),
        registrationPaymentStatus: 'paid',
        programPaymentStatus: 'unpaid',
        personalData: {} as Record<string, unknown>,
        essayAnswers: {} as Record<string, unknown>,
        uploadedFiles: {} as Record<string, unknown>,
        participant: {
            fullName: 'Alice',
            phoneCountryCode: '62',
            phoneNumber: '81234',
            originCountry: 'Indonesia',
            birthdate: new Date('1990-01-01T00:00:00.000Z'),
            institution: null,
            occupation: null,
            deletedAt: null,
            user: { email: 'alice@example.com', isActive: true, deletedAt: null },
        },
        program: { name: 'China Youth Summit', brand: { id: 'brand-1' } },
        ...overrides,
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('ExportApplicationsHandler', () => {
    describe('buildWhere', () => {
        it('scopes by brandId and applies participant active-account gating', () => {
            const handler = new ExportApplicationsHandler({} as never);
            const where = (handler as never as { buildWhere: (q: ExportApplicationsQuery) => Record<string, unknown> })
                .buildWhere(new ExportApplicationsQuery('brand-1', 'prog-1'));

            expect(where.program).toEqual({ brand: { id: 'brand-1' } });
            expect(where.programId).toBe('prog-1');
            expect(where.participant).toEqual(
                expect.objectContaining({ deletedAt: null, user: expect.objectContaining({ isActive: true, deletedAt: null }) }),
            );
        });

        it('filters createdAt to the WIB calendar day, not UTC midnight', () => {
            const handler = new ExportApplicationsHandler({} as never);
            const where = (handler as never as { buildWhere: (q: ExportApplicationsQuery) => { createdAt: { gte: Date; lte: Date } } })
                .buildWhere(new ExportApplicationsQuery('brand-1', 'prog-1', undefined, undefined, undefined, '2026-08-31', '2026-08-31'));

            const { gte, lte } = where.createdAt;
            // 1 Sept 06:10 WIB — must be excluded from a "31 Aug only" filter.
            const excludedInstant = new Date('2026-08-31T23:10:00.000Z');
            // 31 Aug 07:30 WIB — must be included.
            const includedInstant = new Date('2026-08-31T00:30:00.000Z');

            expect(excludedInstant >= gte && excludedInstant <= lte).toBe(false);
            expect(includedInstant >= gte && includedInstant <= lte).toBe(true);
        });

        // M116: country/registrationPaymentStatus/programPaymentStatus were advertised
        // by @ApiQuery but never bound into the query or threaded into the where
        // clause, so an admin's on-screen filters silently didn't apply to the export.
        it('includes country/registrationPaymentStatus/programPaymentStatus in the where clause when supplied', () => {
            const handler = new ExportApplicationsHandler({} as never);
            const where = (handler as never as { buildWhere: (q: ExportApplicationsQuery) => Record<string, unknown> }).buildWhere(
                new ExportApplicationsQuery(
                    'brand-1', undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
                    'Indonesia', 'paid', 'unpaid',
                ),
            );

            expect(where.registrationPaymentStatus).toBe('paid');
            expect(where.programPaymentStatus).toBe('unpaid');
            expect(where.AND).toEqual(
                expect.arrayContaining([
                    expect.objectContaining({
                        OR: expect.arrayContaining([
                            expect.objectContaining({
                                participant: expect.objectContaining({
                                    originCountry: expect.objectContaining({ contains: 'Indonesia' }),
                                }),
                            }),
                        ]),
                    }),
                ]),
            );
        });

        it('omits country/registrationPaymentStatus/programPaymentStatus from the where clause when not supplied', () => {
            const handler = new ExportApplicationsHandler({} as never);
            const where = (handler as never as { buildWhere: (q: ExportApplicationsQuery) => Record<string, unknown> })
                .buildWhere(new ExportApplicationsQuery('brand-1', 'prog-1'));

            expect(where.registrationPaymentStatus).toBeUndefined();
            expect(where.programPaymentStatus).toBeUndefined();
            expect(where.AND).toBeUndefined();
        });
    });

    describe('execute — program-id resolution (M105)', () => {
        it('uses groupBy, not findMany+distinct, to resolve the distinct program ids', async () => {
            const apps = [makeApp({ id: 'a-1', programId: 'prog-1' }), makeApp({ id: 'a-2', programId: 'prog-2' })];
            const prisma = buildKeysetPrismaMock(apps);
            const handler = new ExportApplicationsHandler(prisma as never);

            const streamable = await handler.execute(new ExportApplicationsQuery('brand-1'));
            // Drain the underlying stream so the background write completes cleanly.
            await new Promise<void>((resolve, reject) => {
                const stream = streamable.getStream();
                stream.on('data', () => undefined);
                stream.on('end', () => resolve());
                stream.on('error', reject);
            });

            expect(prisma.participantApplication.groupBy).toHaveBeenCalledWith(
                expect.objectContaining({ by: ['programId'] }),
            );
            for (const call of prisma.participantApplication.findMany.mock.calls) {
                expect((call[0] as { distinct?: unknown }).distinct).toBeUndefined();
            }
        });
    });

    describe('streamRows — keyset pagination (M115)', () => {
        const ACTIVE_WHERE = { deletedAt: null, user: { isActive: true, deletedAt: null } };
        const TIED_SUBMITTED_AT = new Date('2026-01-01T00:00:00Z');

        function draftOrSubmittedApp(id: string, submittedAt: Date | null): Record<string, unknown> {
            return makeApp({
                id,
                programId: 'prog-1',
                submittedAt,
                participant: { ...(makeApp().participant as object), ...ACTIVE_WHERE, user: { email: 'x@example.com', isActive: true, deletedAt: null } },
            });
        }

        // The regression test: OFFSET pagination re-sorted on submittedAt, which is
        // NULL for every draft and non-unique for submitted rows, so ties/NULLs
        // straddling a batch boundary silently duplicated or dropped rows. This
        // fixture forces exactly that: 2500 submitted rows sharing ONE identical
        // submittedAt timestamp (batch boundaries at 1000 and 2000 land mid-tie),
        // plus 1500 draft rows with submittedAt=NULL (batch boundary at 1000 lands
        // mid-group there too). Without the keyset fix this reliably fails.
        it('visits every row exactly once — no duplicates, no drops — across tied submittedAt values and NULL-submittedAt drafts straddling batch boundaries', async () => {
            const submittedApps = Array.from({ length: 2500 }, (_, i) =>
                draftOrSubmittedApp(`s-${String(i + 1).padStart(5, '0')}`, TIED_SUBMITTED_AT));
            const draftApps = Array.from({ length: 1500 }, (_, i) =>
                draftOrSubmittedApp(`d-${String(i + 1).padStart(5, '0')}`, null));
            const allApps = [...submittedApps, ...draftApps];

            const prisma = buildKeysetPrismaMock(allApps);
            const handler = new ExportApplicationsHandler(prisma as never);
            const internal = handler as never as {
                buildWhere: (q: ExportApplicationsQuery) => Record<string, unknown>;
                streamRows: (where: Record<string, unknown>, ctx: unknown) => AsyncGenerator<Record<string, unknown>>;
            };

            const where = internal.buildWhere(new ExportApplicationsQuery('brand-1', 'prog-1'));
            const ctx = { dynamicDefs: [], fieldsByKey: new Map(), essaysByKey: new Map(), keysByProgram: new Map([['prog-1', new Set()]]) };

            const rows: Record<string, unknown>[] = [];
            for await (const row of internal.streamRows(where, ctx)) {
                rows.push(row);
            }

            expect(rows.length).toBe(allApps.length);
            const ids = rows.map((r) => r.id as string);
            expect(new Set(ids).size).toBe(allApps.length); // no duplicates
            expect(new Set(ids)).toEqual(new Set(allApps.map((a) => a.id as string))); // no drops

            // Pins that batching actually happened (not a single unbounded fetch):
            // phase 1 (2500 rows / 1000) = 3 calls, phase 2 (1500 rows / 1000) = 2 calls.
            const paginatedCalls = (prisma.participantApplication.findMany as jest.Mock).mock.calls;
            expect(paginatedCalls.length).toBe(5);
        });

        it('produces zero rows without throwing when there are no matching applications', async () => {
            const prisma = buildKeysetPrismaMock([]);
            const handler = new ExportApplicationsHandler(prisma as never);
            const internal = handler as never as {
                buildWhere: (q: ExportApplicationsQuery) => Record<string, unknown>;
                streamRows: (where: Record<string, unknown>, ctx: unknown) => AsyncGenerator<Record<string, unknown>>;
            };
            const where = internal.buildWhere(new ExportApplicationsQuery('brand-1', 'prog-empty'));
            const ctx = { dynamicDefs: [], fieldsByKey: new Map(), essaysByKey: new Map(), keysByProgram: new Map() };

            const rows: Record<string, unknown>[] = [];
            for await (const row of internal.streamRows(where, ctx)) rows.push(row);

            expect(rows).toEqual([]);
        });
    });

    describe('buildRow — dynamic columns', () => {
        const PROGRAM_1_FIELDS = [
            {
                programId: 'prog-1',
                name: 'emergency_phone_number',
                label: 'Emergency Phone',
                type: 'text',
                section: 'personal_info',
                order: 1,
                placeholder: null,
                validationRules: {},
            },
            {
                programId: 'prog-1',
                name: 'why_join',
                label: 'Why do you want to join?',
                type: 'textarea',
                section: 'essay',
                order: 2,
                placeholder: null,
                validationRules: {},
            },
            {
                programId: 'prog-1',
                name: 'id_card',
                label: 'ID Card',
                type: 'file',
                section: 'documents',
                order: 3,
                placeholder: null,
                validationRules: {},
            },
            {
                programId: 'prog-1',
                name: 'confirm',
                label: 'Confirm',
                type: 'checkbox',
                section: 'preview',
                order: 4,
                placeholder: null,
                validationRules: {},
            },
        ];
        const PROGRAM_2_FIELDS = [
            {
                programId: 'prog-2',
                name: 'dietary_pref',
                label: 'Dietary Preference',
                type: 'text',
                section: 'personal_info',
                order: 1,
                placeholder: null,
                validationRules: {},
            },
        ];
        const PROGRAM_1_ESSAYS = [
            { programId: 'prog-1', id: 'essay-uuid-1', question: 'Tell us about yourself', order: 5 },
        ];

        async function buildCtx(handler: ExportApplicationsHandler, programIds: string[]) {
            const result = await (handler as never as {
                buildDynamicColumns: (ids: string[]) => Promise<{
                    defs: { key: string; header: string; section: string; order: number }[];
                    fieldsByKey: Map<string, unknown>;
                    essaysByKey: Map<string, unknown>;
                    keysByProgram: Map<string, Set<string>>;
                }>;
            }).buildDynamicColumns(programIds);
            // buildRow's context param is named `dynamicDefs`, not `defs` — map it here
            // rather than renaming the handler's own return shape.
            return { dynamicDefs: result.defs, fieldsByKey: result.fieldsByKey, essaysByKey: result.essaysByKey, keysByProgram: result.keysByProgram, defs: result.defs };
        }

        function buildRowFor(handler: ExportApplicationsHandler, app: Record<string, unknown>, ctx: unknown) {
            return (handler as never as { buildRow: (a: unknown, c: unknown) => Record<string, unknown> }).buildRow(app, ctx);
        }

        it('derives dynamic columns from a single program\'s form fields and both essay systems', async () => {
            const prisma = buildKeysetPrismaMock([], PROGRAM_1_FIELDS, PROGRAM_1_ESSAYS);
            const handler = new ExportApplicationsHandler(prisma as never);
            const ctx = await buildCtx(handler, ['prog-1']);

            const app = makeApp({
                personalData: { emergency_phone_number: '+628123456' },
                essayAnswers: { why_join: 'I want to learn', 'essay-uuid-1': 'About me text' },
                uploadedFiles: { id_card: 'https://files.example.com/id-1.pdf' },
            });
            const row = buildRowFor(handler, app, ctx);

            expect(row.f_emergency_phone_number).toBe('+628123456');
            expect(row.f_why_join).toBe('I want to learn');
            expect(row.f_id_card).toBe('https://files.example.com/id-1.pdf');
            expect(row['e_essay-uuid-1']).toBe('About me text');
            expect((ctx as { defs: { key: string }[] }).defs.map((d) => d.key)).not.toContain('f_confirm');
        });

        it('unions columns across a multi-program export without misaligning values between programs', async () => {
            const prisma = buildKeysetPrismaMock([], [...PROGRAM_1_FIELDS, ...PROGRAM_2_FIELDS], PROGRAM_1_ESSAYS);
            const handler = new ExportApplicationsHandler(prisma as never);
            const ctx = await buildCtx(handler, ['prog-1', 'prog-2']);

            const alice = makeApp({ id: 'app-1', programId: 'prog-1', personalData: { emergency_phone_number: '+628123456' } });
            const bob = makeApp({ id: 'app-2', programId: 'prog-2', personalData: { dietary_pref: 'Vegetarian' } });

            const aliceRow = buildRowFor(handler, alice, ctx);
            const bobRow = buildRowFor(handler, bob, ctx);

            expect(aliceRow.f_emergency_phone_number).toBe('+628123456');
            expect(aliceRow.f_dietary_pref).toBe('');
            expect(bobRow.f_dietary_pref).toBe('Vegetarian');
            expect(bobRow.f_emergency_phone_number).toBe('');
        });
    });

    describe('buildRow — dateOfBirth resolution', () => {
        const handler = new ExportApplicationsHandler({} as never);
        const emptyCtx = { dynamicDefs: [], fieldsByKey: new Map(), essaysByKey: new Map(), keysByProgram: new Map() };
        function buildRowFor(app: Record<string, unknown>) {
            return (handler as never as { buildRow: (a: unknown, c: unknown) => Record<string, unknown> }).buildRow(app, emptyCtx);
        }

        it('prefers the personal_data birthdate over participant.birthdate', () => {
            const app = makeApp({
                personalData: { birthdate: '1998-05-12' },
                participant: { ...(makeApp().participant as object), birthdate: new Date('1990-01-01T00:00:00.000Z') },
            });
            expect(buildRowFor(app).dateOfBirth).toBe('1998-05-12');
        });

        it('falls back to participant.birthdate when it holds a real (non-Jan-1) date', () => {
            const app = makeApp({
                personalData: {},
                participant: { ...(makeApp().participant as object), birthdate: new Date('1995-07-20T00:00:00.000Z') },
            });
            expect(buildRowFor(app).dateOfBirth).toBe('1995-07-20');
        });

        it('leaves dateOfBirth blank when personal_data has none and participant.birthdate is the year-only placeholder', () => {
            const app = makeApp({
                personalData: {},
                participant: { ...(makeApp().participant as object), birthdate: new Date('1990-01-01T00:00:00.000Z') },
            });
            expect(buildRowFor(app).dateOfBirth).toBe('');
        });

        it('does NOT blank a genuine Jan-1 birthdate that came from personal_data itself', () => {
            const app = makeApp({
                personalData: { birthdate: '1990-01-01' },
                participant: { ...(makeApp().participant as object), birthdate: new Date('1990-01-01T00:00:00.000Z') },
            });
            expect(buildRowFor(app).dateOfBirth).toBe('1990-01-01');
        });
    });

    describe('buildRow — institution/occupation resolution', () => {
        const handler = new ExportApplicationsHandler({} as never);
        const emptyCtx = { dynamicDefs: [], fieldsByKey: new Map(), essaysByKey: new Map(), keysByProgram: new Map() };
        function buildRowFor(app: Record<string, unknown>) {
            return (handler as never as { buildRow: (a: unknown, c: unknown) => Record<string, unknown> }).buildRow(app, emptyCtx);
        }

        it('prefers personal_data over the participant column when both are present', () => {
            const app = makeApp({
                personalData: { institution: 'MIT', occupation: 'Student' },
                participant: { ...(makeApp().participant as object), institution: 'Legacy University', occupation: 'Legacy Job' },
            });
            const row = buildRowFor(app);
            expect(row.institution).toBe('MIT');
            expect(row.occupation).toBe('Student');
        });

        it('falls back to the participant column when personal_data has none', () => {
            const app = makeApp({
                personalData: {},
                participant: { ...(makeApp().participant as object), institution: 'Legacy University', occupation: 'Legacy Job' },
            });
            const row = buildRowFor(app);
            expect(row.institution).toBe('Legacy University');
            expect(row.occupation).toBe('Legacy Job');
        });

        it('renders an empty cell when neither personal_data nor the participant column has a value', () => {
            const app = makeApp({ personalData: {}, participant: { ...(makeApp().participant as object), institution: null, occupation: null } });
            const row = buildRowFor(app);
            expect(row.institution).toBe('');
            expect(row.occupation).toBe('');
        });
    });

    describe('buildRow — country resolution', () => {
        const handler = new ExportApplicationsHandler({} as never);
        const emptyCtx = { dynamicDefs: [], fieldsByKey: new Map(), essaysByKey: new Map(), keysByProgram: new Map() };
        function countryFor(originCountry: string | null, personalData: Record<string, unknown> = {}) {
            const app = makeApp({ personalData, participant: { ...(makeApp().participant as object), originCountry } });
            return (handler as never as { buildRow: (a: unknown, c: unknown) => Record<string, unknown> }).buildRow(app, emptyCtx).country;
        }

        it('renders the display name rather than the raw ISO code', () => {
            expect(countryFor('ID')).toBe('Indonesia');
        });

        it('falls back to the personal_data nationality when origin_country is empty', () => {
            expect(countryFor(null, { nationality: 'PK' })).toBe('Pakistan');
        });

        it('renders N/A when neither origin_country nor personal_data has a country', () => {
            expect(countryFor(null)).toBe('N/A');
        });
    });
});
