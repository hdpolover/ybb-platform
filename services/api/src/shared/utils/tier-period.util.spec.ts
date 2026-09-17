// src/shared/utils/tier-period.util.spec.ts
import {
    CategoryPhaseTier,
    effectiveStart,
    getCategoryRegistrationPhase,
    getTiersRegistrationPhase,
    hasTierPeriodEnded,
    isCategoryRegistrationAvailable,
    resolveTierPeriod,
    TierValidityPeriod,
} from './tier-period.util';

describe('tier-period.util', () => {
    const period = (startDate: string, endDate: string): TierValidityPeriod => ({
        startDate: new Date(startDate),
        endDate: new Date(endDate),
    });

    describe('resolveTierPeriod', () => {
        it('picks the period containing referenceDate', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'),
                period('2026-02-01T00:00:00Z', '2026-02-28T00:00:00Z'),
            ];
            const referenceDate = new Date('2026-01-15T00:00:00Z');
            expect(resolveTierPeriod(periods, referenceDate, referenceDate)).toBe(periods[0]);
        });

        it('falls back to the first upcoming/active period when referenceDate matches none', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'), // lapsed
                period('2026-03-01T00:00:00Z', '2026-03-31T00:00:00Z'), // upcoming
            ];
            const now = new Date('2026-02-15T00:00:00Z');
            expect(resolveTierPeriod(periods, now, now)).toBe(periods[1]);
        });

        it('falls back to the last configured period when all have lapsed', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-10T00:00:00Z'),
                period('2026-01-11T00:00:00Z', '2026-01-20T00:00:00Z'),
            ];
            const now = new Date('2026-06-01T00:00:00Z');
            expect(resolveTierPeriod(periods, now, now)).toBe(periods[1]);
        });

        it('returns undefined for an empty period list', () => {
            expect(resolveTierPeriod([], new Date(), new Date())).toBeUndefined();
        });

        it('locks an invoice to the period active at invoice.createdAt even if now has moved on', () => {
            const periods = [
                period('2026-01-01T00:00:00Z', '2026-01-31T00:00:00Z'),
                period('2026-02-01T00:00:00Z', '2026-02-28T00:00:00Z'),
            ];
            const invoiceCreatedAt = new Date('2026-01-15T00:00:00Z');
            const now = new Date('2026-02-15T00:00:00Z');
            expect(resolveTierPeriod(periods, invoiceCreatedAt, now)).toBe(periods[0]);
        });

        describe('WIB end-of-day boundary', () => {
            // A period whose endDate is "today" (UTC-midnight, as picked by an
            // admin) must stay open through 23:59:59.999 WIB, not close at
            // 07:00 WIB (UTC midnight) as raw `endDate >= now` would. A second,
            // later period makes the "no longer selected" assertion meaningful
            // (resolveTierPeriod always falls back to *some* period otherwise).
            const currentPeriod = period('2026-07-01T00:00:00Z', '2026-07-15T00:00:00Z');
            const futurePeriod = period('2026-08-01T00:00:00Z', '2026-08-15T00:00:00Z');
            const periods = [currentPeriod, futurePeriod];

            it('is still open at 08:00 WIB (01:00 UTC) on the end day', () => {
                const now = new Date('2026-07-15T01:00:00Z'); // 08:00 WIB
                expect(resolveTierPeriod(periods, now, now)).toBe(currentPeriod);
            });

            it('is still open at 23:00 WIB (16:00 UTC) on the end day', () => {
                const now = new Date('2026-07-15T16:00:00Z'); // 23:00 WIB
                expect(resolveTierPeriod(periods, now, now)).toBe(currentPeriod);
            });

            it('is closed the next WIB morning, so the next period takes over', () => {
                const now = new Date('2026-07-16T01:00:00Z'); // 08:00 WIB, next day
                expect(resolveTierPeriod(periods, now, now)).toBe(futurePeriod);
            });
        });

        describe('earliest-period start widening (2026-09-01 MEYS incident)', () => {
            it('treats a first period stored at 23:59 WIB as open earlier that WIB day', () => {
                // MEYS "Period 1": admin picked 1 Sept as the opening day, but the row
                // was stored as 2026-09-01T16:59:00Z (23:59 WIB on 1 Sept) instead of
                // WIB midnight. Registration should still read as open at, say, 09:00
                // WIB on 1 Sept (02:00 UTC), not "closed until 23:59".
                const firstPeriod = period('2026-09-01T16:59:00Z', '2026-09-30T16:59:00Z');
                const periods = [firstPeriod];
                const now = new Date('2026-09-01T02:00:00Z'); // 09:00 WIB, 1 Sept
                expect(resolveTierPeriod(periods, now, now)).toBe(firstPeriod);
            });

            it('does NOT widen a mid-chain period whose start intentionally hands over at 23:59 WIB', () => {
                // Installment 1 ends 23:59 WIB on day X; installment 2 starts 23:59 WIB
                // on the same day X. That handover instant must stay exact — widening
                // installment 2's start to WIB midnight would make it overlap
                // installment 1 for nearly a full day (two prices valid at once).
                const installment1 = period('2026-09-01T00:00:00Z', '2026-09-10T16:59:00Z');
                const installment2 = period('2026-09-10T16:59:00Z', '2026-09-30T16:59:00Z');
                const periods = [installment1, installment2];

                // 12:00 WIB on 10 Sept (05:00 UTC) is after installment1's WIB-widened
                // start but before installment2's exact 23:59 WIB handover — must still
                // resolve to installment1, not installment2.
                const now = new Date('2026-09-10T05:00:00Z');
                expect(resolveTierPeriod(periods, now, now)).toBe(installment1);
            });
        });
    });

    describe('hasTierPeriodEnded', () => {
        const p = period('2026-07-01T00:00:00Z', '2026-07-15T00:00:00Z');

        it('is false at 08:00 WIB on the end day', () => {
            expect(hasTierPeriodEnded(p, new Date('2026-07-15T01:00:00Z'))).toBe(false);
        });

        it('is false at 23:00 WIB on the end day', () => {
            expect(hasTierPeriodEnded(p, new Date('2026-07-15T16:00:00Z'))).toBe(false);
        });

        it('is true the next WIB morning', () => {
            expect(hasTierPeriodEnded(p, new Date('2026-07-16T01:00:00Z'))).toBe(true);
        });
    });

// The rule changed from "widen only the chronologically-earliest start" to
// "widen unless a preceding period is still open then". These pin both halves:
// the new coverage, and the overlap invariant the old rule existed to protect.
describe('start-boundary widening', () => {
    const wib = (iso: string) => new Date(iso);
    // WIB is UTC+7, so WIB calendar day D runs D-1T17:00:00Z .. DT16:59:59.999Z.
    const WIB_MIDNIGHT_8_SEP = wib('2026-09-07T17:00:00Z');

    // Asserted on effectiveStart directly, not through resolveTierPeriod: that
    // function's activeOrUpcoming fallback returns the same period either way,
    // so it cannot distinguish this rule from the earliest-only one it replaced.
    it('widens an UNCHAINED later period, which the earliest-only rule missed', () => {
        const batch1 = { startDate: wib('2026-08-31T17:00:00Z'), endDate: wib('2026-09-04T00:00:00Z') };
        // Stored at 23:59 WIB on 8 Sep, so it read as closed all opening day.
        const batch2 = { startDate: wib('2026-09-08T16:59:00Z'), endDate: wib('2026-09-20T00:00:00Z') };

        expect(effectiveStart(batch2, [batch1, batch2])).toEqual(WIB_MIDNIGHT_8_SEP);
    });

    it('does NOT widen an exactly-chained handover, so two installments never overlap', () => {
        // Installment 2 starts exactly when installment 1 ends, 23:59 WIB 4 Sep.
        const handover = wib('2026-09-04T16:59:00Z');
        const inst1 = { startDate: wib('2026-08-31T17:00:00Z'), endDate: handover };
        const inst2 = { startDate: handover, endDate: wib('2026-09-30T00:00:00Z') };

        // Widening this would make both installments valid at once - the
        // ~280-overlapping-pairs regression the earlier rule existed to avoid.
        expect(effectiveStart(inst2, [inst1, inst2])).toEqual(handover);
    });

    it('does NOT widen a same-day handover that is not exactly chained', () => {
        const inst1 = { startDate: wib('2026-08-31T17:00:00Z'), endDate: wib('2026-09-04T00:00:00Z') };
        const rawStart = wib('2026-09-03T20:00:00Z'); // mid-day 4 Sep WIB
        const inst2 = { startDate: rawStart, endDate: wib('2026-09-30T00:00:00Z') };

        expect(effectiveStart(inst2, [inst1, inst2])).toEqual(rawStart);
    });

    it('still widens the earliest period, the case the old rule was written for', () => {
        // MEYS 7th shape: single period stored at 23:59 WIB on its opening day.
        const only = { startDate: wib('2026-09-08T16:59:00Z'), endDate: wib('2026-09-20T00:00:00Z') };

        expect(effectiveStart(only, [only])).toEqual(WIB_MIDNIGHT_8_SEP);
    });

    // DOCUMENTATION, not a regression guard: this passes under the old
    // earliest-only rule too, because resolveTierPeriod's activeOrUpcoming
    // fallback returns batch2 either way. Kept because it records the
    // user-visible outcome; the four assertions above are what actually
    // discriminate the rules.
    it('makes an unchained period resolvable on its opening morning (documents the outcome; does not discriminate)', () => {
        const batch1 = { startDate: wib('2026-08-31T17:00:00Z'), endDate: wib('2026-09-04T00:00:00Z') };
        const batch2 = { startDate: wib('2026-09-08T16:59:00Z'), endDate: wib('2026-09-20T00:00:00Z') };
        const openingMorning = wib('2026-09-08T02:00:00Z'); // 09:00 WIB

        expect(resolveTierPeriod([batch1, batch2], openingMorning, openingMorning)).toBe(batch2);
    });
});

// The per-category registration deadline. MEYS/CYS 2026 kept accepting Fully
// Funded signups and the Fully Funded fee after that tier's window ended,
// because signup and payment only consulted the programme-wide close date.
describe('getCategoryRegistrationPhase', () => {
    const FF = 'fully_funded';
    const SF = 'self_funded';
    const d = (iso: string) => new Date(iso);
    const tier = (overrides: Partial<CategoryPhaseTier> = {}): CategoryPhaseTier => ({
        feeType: 'registration_fee',
        isActive: true,
        deletedAt: null,
        allowedCategories: [FF],
        validityPeriods: [{ startDate: d('2026-07-01T00:00:00Z'), endDate: d('2026-08-31T00:00:00Z') }],
        ...overrides,
    });

    // WIB day 31 Aug runs 2026-08-30T17:00Z .. 2026-08-31T16:59:59.999Z.
    const DURING = d('2026-08-15T05:00:00Z');
    const LAST_EVENING_WIB = d('2026-08-31T16:00:00Z'); // 23:00 WIB on the end day
    const NEXT_MORNING_WIB = d('2026-08-31T17:00:00Z'); // 00:00 WIB the day after
    const BEFORE = d('2026-06-20T00:00:00Z');

    it('is open while a period contains now', () => {
        expect(getCategoryRegistrationPhase([tier()], FF, DURING)).toBe('open');
    });

    it('stays open through WIB end-of-day on the last day, and closes at WIB midnight', () => {
        expect(getCategoryRegistrationPhase([tier()], FF, LAST_EVENING_WIB)).toBe('open');
        expect(getCategoryRegistrationPhase([tier()], FF, NEXT_MORNING_WIB)).toBe('closed');
    });

    it('is upcoming before the first period starts', () => {
        expect(getCategoryRegistrationPhase([tier()], FF, BEFORE)).toBe('upcoming');
    });

    it('opens at WIB midnight of an opening day stored at 23:59 WIB (2026-09-01 incident)', () => {
        const t = tier({ validityPeriods: [{ startDate: d('2026-09-08T16:59:00Z'), endDate: d('2026-09-20T00:00:00Z') }] });
        expect(getCategoryRegistrationPhase([t], FF, d('2026-09-08T02:00:00Z'))).toBe('open');
    });

    it('does not open an exactly-chained period before its handover instant', () => {
        const handover = d('2026-09-04T16:59:00Z');
        const t = tier({
            validityPeriods: [
                { startDate: d('2026-08-31T17:00:00Z'), endDate: handover },
                { startDate: handover, endDate: d('2026-09-30T00:00:00Z') },
            ],
        });
        // Still open, through the first period - the phase does not care which.
        expect(getCategoryRegistrationPhase([t], FF, d('2026-09-04T10:00:00Z'))).toBe('open');
    });

    it('reads a gap between two periods as upcoming, not closed', () => {
        const t = tier({
            validityPeriods: [
                { startDate: d('2026-07-01T00:00:00Z'), endDate: d('2026-07-10T00:00:00Z') },
                { startDate: d('2026-08-01T00:00:00Z'), endDate: d('2026-08-10T00:00:00Z') },
            ],
        });
        expect(getCategoryRegistrationPhase([t], FF, d('2026-07-20T00:00:00Z'))).toBe('upcoming');
    });

    it('is open when ANY tier allowing the category is open', () => {
        const lapsed = tier();
        const extension = tier({ validityPeriods: [{ startDate: d('2026-09-01T00:00:00Z'), endDate: d('2026-09-30T00:00:00Z') }] });
        expect(getCategoryRegistrationPhase([lapsed, extension], FF, d('2026-09-10T00:00:00Z'))).toBe('open');
    });

    it('scopes to the requested category: a lapsed FF tier leaves SF open', () => {
        const ff = tier();
        const sf = tier({ allowedCategories: [SF], validityPeriods: [{ startDate: d('2026-07-01T00:00:00Z'), endDate: d('2026-11-30T00:00:00Z') }] });
        const now = d('2026-09-17T00:00:00Z');
        expect(getCategoryRegistrationPhase([ff, sf], FF, now)).toBe('closed');
        expect(getCategoryRegistrationPhase([ff, sf], SF, now)).toBe('open');
    });

    it('is unconfigured when no tier allows the category', () => {
        expect(getCategoryRegistrationPhase([tier({ allowedCategories: [SF] })], FF, DURING)).toBe('unconfigured');
        expect(getCategoryRegistrationPhase([], FF, DURING)).toBe('unconfigured');
        expect(getCategoryRegistrationPhase(undefined, FF, DURING)).toBe('unconfigured');
    });

    it('matches allowedCategories strictly: an empty list gates nobody', () => {
        expect(getCategoryRegistrationPhase([tier({ allowedCategories: [] })], FF, DURING)).toBe('unconfigured');
        expect(getCategoryRegistrationPhase([tier({ allowedCategories: null })], FF, DURING)).toBe('unconfigured');
    });

    it('ignores inactive, deleted and non-registration tiers', () => {
        const open = { validityPeriods: [{ startDate: d('2026-07-01T00:00:00Z'), endDate: d('2026-12-31T00:00:00Z') }] };
        const now = d('2026-09-17T00:00:00Z');
        expect(getCategoryRegistrationPhase([tier(), tier({ ...open, isActive: false })], FF, now)).toBe('closed');
        expect(getCategoryRegistrationPhase([tier(), tier({ ...open, deletedAt: d('2026-09-01T00:00:00Z') })], FF, now)).toBe('closed');
        expect(getCategoryRegistrationPhase([tier(), tier({ ...open, feeType: 'program_fee_1' })], FF, now)).toBe('closed');
    });

    it('treats absent isActive/deletedAt/feeType as already filtered by the query', () => {
        const bare: CategoryPhaseTier = { allowedCategories: [FF], validityPeriods: tier().validityPeriods };
        expect(getCategoryRegistrationPhase([bare], FF, DURING)).toBe('open');
    });

    describe('tier without validity periods', () => {
        const noPeriods = tier({ validityPeriods: [] });

        it('is open-ended when no programme dates are passed (historical switch/dashboard reading)', () => {
            expect(getCategoryRegistrationPhase([noPeriods], FF, d('2030-01-01T00:00:00Z'))).toBe('open');
            expect(getCategoryRegistrationPhase([tier({ validityPeriods: null })], FF, DURING)).toBe('open');
        });

        it('follows the programme registration window when programme dates are passed', () => {
            const dates = { registrationOpenDate: d('2026-07-01T00:00:00Z'), registrationCloseDate: d('2026-08-31T00:00:00Z') };
            expect(getCategoryRegistrationPhase([noPeriods], FF, BEFORE, dates)).toBe('upcoming');
            expect(getCategoryRegistrationPhase([noPeriods], FF, DURING, dates)).toBe('open');
            expect(getCategoryRegistrationPhase([noPeriods], FF, LAST_EVENING_WIB, dates)).toBe('open');
            expect(getCategoryRegistrationPhase([noPeriods], FF, NEXT_MORNING_WIB, dates)).toBe('closed');
        });

        it('reads a null programme date as unbounded on that side', () => {
            const openEnded = { registrationOpenDate: d('2026-07-01T00:00:00Z'), registrationCloseDate: null };
            expect(getCategoryRegistrationPhase([noPeriods], FF, d('2030-01-01T00:00:00Z'), openEnded)).toBe('open');
            expect(getCategoryRegistrationPhase([noPeriods], FF, BEFORE, { registrationOpenDate: null, registrationCloseDate: null })).toBe('open');
        });

        it('does NOT fall back to programme dates when the tier has periods that all lapsed', () => {
            const dates = { registrationOpenDate: null, registrationCloseDate: d('2026-12-31T00:00:00Z') };
            expect(getCategoryRegistrationPhase([tier()], FF, NEXT_MORNING_WIB, dates)).toBe('closed');
        });
    });

    // Pins the rule the switch-category guard and dashboard flag used before
    // they were routed through here: closed only when a tier exists, every
    // tier has periods, and every period ended.
    it('agrees with the previous FF-closed rule used by switch/dashboard', () => {
        const now = d('2026-09-17T00:00:00Z');
        const lapsed = tier();
        const noPeriods = tier({ validityPeriods: [] });
        const future = tier({ validityPeriods: [{ startDate: d('2026-10-01T00:00:00Z'), endDate: d('2026-10-31T00:00:00Z') }] });
        const previousRule = (tiers: CategoryPhaseTier[]) =>
            tiers.length > 0 &&
            tiers.every((t) => (t.validityPeriods?.length ?? 0) > 0 && t.validityPeriods!.every((p) => hasTierPeriodEnded(p, now)));

        for (const set of [[lapsed], [lapsed, noPeriods], [lapsed, future], [future], [noPeriods], [lapsed, lapsed]]) {
            expect(getCategoryRegistrationPhase(set, FF, now) === 'closed').toBe(previousRule(set));
        }
    });

    it('isCategoryRegistrationAvailable passes open and unconfigured only', () => {
        expect(isCategoryRegistrationAvailable('open')).toBe(true);
        expect(isCategoryRegistrationAvailable('unconfigured')).toBe(true);
        expect(isCategoryRegistrationAvailable('upcoming')).toBe(false);
        expect(isCategoryRegistrationAvailable('closed')).toBe(false);
    });
});

describe('getTiersRegistrationPhase', () => {
    const d = (iso: string) => new Date(iso);
    const periods = [{ startDate: d('2026-07-01T00:00:00Z'), endDate: d('2026-08-31T00:00:00Z') }];

    it('ignores allowedCategories entirely', () => {
        expect(getTiersRegistrationPhase([{ allowedCategories: [], validityPeriods: periods }], d('2026-08-01T00:00:00Z'))).toBe('open');
        expect(getTiersRegistrationPhase([{ allowedCategories: ['self_funded'], validityPeriods: periods }], d('2026-09-10T00:00:00Z'))).toBe('closed');
    });

    it('is unconfigured with nothing usable', () => {
        expect(getTiersRegistrationPhase([], d('2026-08-01T00:00:00Z'))).toBe('unconfigured');
        expect(getTiersRegistrationPhase([{ isActive: false, validityPeriods: periods }], d('2026-08-01T00:00:00Z'))).toBe('unconfigured');
    });
});
});
