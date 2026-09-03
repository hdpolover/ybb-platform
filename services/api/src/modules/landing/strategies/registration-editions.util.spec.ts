import { editionStatus } from './registration-editions.util';

// The exact prod shape that produced the reported bug on korea-youth-summit-4th:
// registration switched off, but the open date six days in the past and the close
// date months away, so a dates-only rule reported it as open.
const baseProgram = {
    status: 'published',
    isPublished: true,
    isActive: true,
    allowRegistration: true,
    registrationOpenDate: new Date('2026-08-28T16:59:00Z'),
    registrationCloseDate: new Date('2027-03-05T16:59:00Z'),
};
const NOW = new Date('2026-09-03T12:00:00Z');

describe('editionStatus', () => {
    it('reports a genuinely open edition as open', () => {
        expect(editionStatus(baseProgram, NOW)).toBe('open');
    });

    // The regression this fixes. allowRegistration exists to be a kill switch;
    // before this it killed nothing on the marketing surfaces, so the landing
    // page showed "Register Now" beside fee cards that correctly said closed.
    it('respects allowRegistration as a kill switch, even inside the date window', () => {
        expect(editionStatus({ ...baseProgram, allowRegistration: false }, NOW)).toBe('closed');
    });

    it('respects isPublished and status', () => {
        expect(editionStatus({ ...baseProgram, isPublished: false }, NOW)).toBe('closed');
        expect(editionStatus({ ...baseProgram, status: 'draft' }, NOW)).toBe('closed');
    });

    it('still respects isActive and the date window', () => {
        expect(editionStatus({ ...baseProgram, isActive: false }, NOW)).toBe('closed');
        expect(
            editionStatus({ ...baseProgram, registrationOpenDate: new Date('2026-09-05T00:00:00Z') }, NOW),
        ).toBe('closed');
        expect(
            editionStatus({ ...baseProgram, registrationCloseDate: new Date('2026-09-01T00:00:00Z') }, NOW),
        ).toBe('closed');
    });

    it('treats absent dates as unbounded, not as closed', () => {
        expect(
            editionStatus({ ...baseProgram, registrationOpenDate: null, registrationCloseDate: null }, NOW),
        ).toBe('open');
    });
});
