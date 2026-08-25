// src/shared/utils/active-participant.filter.spec.ts
import { ACTIVE_PARTICIPANT_WHERE, isActiveParticipant } from './active-participant.filter';

describe('active-participant.filter', () => {
  it('ACTIVE_PARTICIPANT_WHERE requires both the participant and the user to be live', () => {
    expect(ACTIVE_PARTICIPANT_WHERE).toEqual({
      deletedAt: null,
      user: { isActive: true, deletedAt: null },
    });
  });

  describe('isActiveParticipant', () => {
    const active = { deletedAt: null, user: { isActive: true, deletedAt: null } };

    it('returns true for a live participant/user', () => {
      expect(isActiveParticipant(active)).toBe(true);
    });

    it('returns false when the participant is soft-deleted', () => {
      expect(isActiveParticipant({ ...active, deletedAt: new Date() })).toBe(false);
    });

    it('returns false when the user is deactivated', () => {
      expect(isActiveParticipant({ ...active, user: { isActive: false, deletedAt: null } })).toBe(false);
    });

    it('returns false when the user is soft-deleted', () => {
      expect(
        isActiveParticipant({ ...active, user: { isActive: true, deletedAt: new Date() } }),
      ).toBe(false);
    });

    it('returns false when participant is null/undefined', () => {
      expect(isActiveParticipant(null)).toBe(false);
      expect(isActiveParticipant(undefined)).toBe(false);
    });
  });
});
