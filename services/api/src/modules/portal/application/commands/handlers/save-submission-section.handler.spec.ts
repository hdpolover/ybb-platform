import { Test, TestingModule } from '@nestjs/testing';
import { SaveSubmissionSectionHandler } from './save-submission-section.handler';
import { PrismaService } from '@shared/infrastructure/prisma/prisma.service';
import { CacheService } from '@shared/infrastructure/cache/cache.service';
import { PortalCacheService } from '../../services/portal-cache.service';
import { SaveSubmissionSectionCommand } from '../../queries/portal-queries';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('SaveSubmissionSectionHandler', () => {
    let handler: SaveSubmissionSectionHandler;

    // tx is a disjoint object from mockPrisma (never `cb(mockPrisma)`) so that
    // "was this call routed through the row-locked transaction" and "did the
    // outer client see this call" stay independently observable - see
    // test/utils/prisma-tx-mock.ts's docstring for why that separation matters.
    const mockTx = {
        $queryRaw: jest.fn(),
        participantApplication: {
            update: jest.fn(),
        },
        programParticipationCategory: {
            findFirst: jest.fn(),
        },
    };

    const mockPrisma = {
        participantApplication: {
            findFirst: jest.fn(),
        },
        $transaction: jest.fn((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx)),
    };

    const mockCacheService = {
        invalidateKey: jest.fn().mockResolvedValue(undefined),
        invalidatePortalCache: jest.fn().mockResolvedValue(undefined),
    };

    const mockPortalCacheService = {
        getParticipantProfile: jest.fn(),
    };

    /**
     * Wires the locked-row read (`tx.$queryRaw ... FOR UPDATE`) to return the
     * given personalData/essayAnswers/uploadedFiles/status. This is the row
     * the merge and the guard-rail checks actually operate on post-fix, so
     * every test that used to seed `findFirst` with these fields now seeds
     * this instead.
     */
    function mockLockedRow(row: {
        id?: string;
        status?: string;
        personalData?: unknown;
        essayAnswers?: unknown;
        uploadedFiles?: unknown;
    }) {
        mockTx.$queryRaw.mockResolvedValue([
            {
                id: row.id ?? 'app-1',
                status: row.status ?? 'draft',
                personalData: row.personalData ?? {},
                essayAnswers: row.essayAnswers ?? {},
                uploadedFiles: row.uploadedFiles ?? {},
            },
        ]);
    }

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                SaveSubmissionSectionHandler,
                { provide: PrismaService, useValue: mockPrisma },
                { provide: CacheService, useValue: mockCacheService },
                { provide: PortalCacheService, useValue: mockPortalCacheService },
            ],
        }).compile();

        handler = module.get<SaveSubmissionSectionHandler>(SaveSubmissionSectionHandler);
        jest.clearAllMocks();
        mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx));
        mockTx.participantApplication.update.mockResolvedValue({});
    });

    // The rule itself is unit-tested in current-application.query.spec.ts, but
    // nothing asserted this handler actually USES it. Its sibling
    // portal-submit-application got that assertion; this one did not, so a
    // reintroduced bare findFirst - or a typo'd participant id - would write a
    // participant's section edits onto the wrong application row silently.
    it('resolves the application through the shared rule, not its own clause', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });
        // Resolve nothing: we only care which query was issued. The handler then
        // throws, which is fine - the assertion is on the call it already made.
        mockPrisma.participantApplication.findFirst.mockResolvedValue(null);

        await expect(
            handler.execute(new SaveSubmissionSectionCommand('user-1', 'personal_info', {}, 'prog-1')),
        ).rejects.toThrow();

        const args = mockPrisma.participantApplication.findFirst.mock.calls[0][0];
        expect(args.where).toMatchObject({
            participantId: 'participant-1',
            programId: 'prog-1',
            deletedAt: null,
        });
        expect(args.orderBy[0]).toEqual({ withdrawnAt: { sort: 'asc', nulls: 'first' } });
    });

    it('should save personal_info section data', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
        mockLockedRow({ personalData: { country: 'Indonesia' } });

        const result = await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'personal_info', {
                full_name: 'John Doe',
                email: 'john@example.com',
            }),
        );

        expect(result.success).toBe(true);
        expect(result.section).toBe('personal_info');

        // Verify merge behavior — existing country should be preserved
        expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                personalData: {
                    country: 'Indonesia',
                    full_name: 'John Doe',
                    email: 'john@example.com',
                },
            },
        });
    });

    it('should save essays section data', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
        mockLockedRow({ essayAnswers: { 'essay-1': 'Previous answer' } });

        const result = await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'essays', {
                'essay-2': 'New essay answer',
            }),
        );

        expect(result.success).toBe(true);
        expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                essayAnswers: {
                    'essay-1': 'Previous answer',
                    'essay-2': 'New essay answer',
                },
            },
        });
    });

    it('should throw BadRequestException for invalid section', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
        });

        await expect(
            handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'invalid_section', {}),
            ),
        ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException for non-draft application', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
        mockLockedRow({ status: 'submitted' });

        await expect(
            handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'personal_info', {}),
            ),
        ).rejects.toThrow(BadRequestException);
        expect(mockTx.participantApplication.update).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException when no participant found', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue(null);

        await expect(
            handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'personal_info', {}),
            ),
        ).rejects.toThrow(NotFoundException);
    });

    it('should invalidate caches after saving', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
        mockLockedRow({});

        await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'personal_info', {}),
        );

        // Portal reads are keyed per program, so a section save must clear every
        // program variant for this user, not just the bare `:latest` key.
        expect(mockCacheService.invalidatePortalCache).toHaveBeenCalledWith('user-1');
    });

    it('normalizes phone country code fields to dial code format', async () => {
        mockPortalCacheService.getParticipantProfile.mockResolvedValue({
            id: 'participant-1',
            userId: 'user-1',
        });

        mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
        mockLockedRow({});

        await handler.execute(
            new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                phone_country_code: 'ID',
                emergency_country_code: '+905538803144',
            }),
        );

        expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
            where: { id: 'app-1' },
            data: {
                personalData: {
                    phone_country_code: '+62',
                    emergency_country_code: '+90',
                },
            },
        });
    });

    // ── the race this handler exists to close ─────────────────────────────

    describe('concurrent-save row lock (M61)', () => {
        it('takes the row lock via SELECT ... FOR UPDATE inside the transaction, scoped to the resolved application id', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });
            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            mockLockedRow({});

            await handler.execute(new SaveSubmissionSectionCommand('user-1', 'personal_info', {}));

            expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
            expect(mockTx.$queryRaw).toHaveBeenCalledTimes(1);
            // Tagged-template call: first arg is the strings array, remaining args
            // are the interpolated values — the locked application id must be one
            // of them, and the query text must carry FOR UPDATE.
            const [strings, ...values] = mockTx.$queryRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
            expect(strings.join('')).toContain('FOR UPDATE');
            expect(values).toContain('app-1');
        });

        // This is the regression test for the bug itself: it proves the merge
        // uses the value the row lock just read, not a stale value captured
        // before the lock. Without the fix (findFirst outside any transaction,
        // no lock), a handler reading `application.personalData` from an EARLIER
        // snapshot would merge against `{ nationality: 'stale-snapshot' }` here
        // and silently drop whatever the concurrent save had just written.
        it('merges against the value read under the row lock, not any earlier snapshot', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });
            // The outer, pre-lock findFirst only resolves the application id in
            // the fixed implementation — it must carry no personalData for this
            // test to be meaningful, so if the handler regressed to merging
            // against THIS call's data instead of the locked read, the assertion
            // below would fail loudly instead of passing by coincidence.
            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            // The locked read reflects a concurrent save that landed between the
            // outer findFirst and this transaction acquiring the lock.
            mockLockedRow({ personalData: { nationality: 'ID', institution: 'Written by concurrent save' } });

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'personal_info', { full_name: 'Late Writer' }),
            );

            expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        nationality: 'ID',
                        institution: 'Written by concurrent save',
                        full_name: 'Late Writer',
                    },
                },
            });
        });

        it('runs the update on the tx client, never on the outer (non-transactional) prisma client', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });
            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            mockLockedRow({});

            await handler.execute(new SaveSubmissionSectionCommand('user-1', 'personal_info', {}));

            expect(mockTx.participantApplication.update).toHaveBeenCalled();
            expect((mockPrisma as unknown as { participantApplication: { update?: jest.Mock } })
                .participantApplication.update).toBeUndefined();
        });
    });

    describe('save-time phone normalization', () => {
        it('normalizes a valid national-format phone to E.164 using nationality as the region hint', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            mockLockedRow({ personalData: { nationality: 'PK', full_name: 'Existing Name' } });

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    phone: '03255252525',
                }),
            );

            expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        nationality: 'PK',
                        full_name: 'Existing Name',
                        phone: '+923255252525',
                    },
                },
            });
        });

        it('stores an invalid/garbage phone exactly as entered, without throwing', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            mockLockedRow({});

            const result = await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    phone: 'abc123',
                }),
            );

            expect(result.success).toBe(true);
            expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: { phone: 'abc123' },
                },
            });
        });

        it('preserves unrelated personal_data fields untouched when normalizing the phone', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            mockLockedRow({ personalData: { nationality: 'KZ', country: 'Kazakhstan', institution: 'ABC University' } });

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    phone: '+77012345678',
                    emergency_contact_name: 'Jane Doe',
                }),
            );

            expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        nationality: 'KZ',
                        country: 'Kazakhstan',
                        institution: 'ABC University',
                        phone: '+77012345678',
                        emergency_contact_name: 'Jane Doe',
                    },
                },
            });
        });

        it('leaves personal_data untouched when the section payload has no phone key', async () => {
            mockPortalCacheService.getParticipantProfile.mockResolvedValue({
                id: 'participant-1',
                userId: 'user-1',
            });

            mockPrisma.participantApplication.findFirst.mockResolvedValue({ id: 'app-1', programId: null });
            mockLockedRow({ personalData: { phone: '+77012345678' } });

            await handler.execute(
                new SaveSubmissionSectionCommand('user-1', 'contact_information', {
                    institution: 'Some University',
                }),
            );

            expect(mockTx.participantApplication.update).toHaveBeenCalledWith({
                where: { id: 'app-1' },
                data: {
                    personalData: {
                        phone: '+77012345678',
                        institution: 'Some University',
                    },
                },
            });
        });
    });
});
