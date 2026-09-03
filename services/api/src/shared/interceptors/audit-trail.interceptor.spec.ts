import { resolveAuditActor } from './audit-trail.interceptor';
import { ChangedByType } from '@prisma/client';

describe('resolveAuditActor', () => {
    it('attributes an ordinary admin action to the admin', () => {
        expect(resolveAuditActor({ adminId: 'adm-1', userId: 'usr-1' })).toEqual({
            actorId: 'adm-1',
            actorType: ChangedByType.admin,
        });
    });

    it('attributes an ordinary participant action to the participant', () => {
        expect(resolveAuditActor({ userId: 'usr-1' })).toEqual({
            actorId: 'usr-1',
            actorType: ChangedByType.participant,
        });
    });

    // The gap this closes. An impersonation session is a participant session by
    // design - it carries no adminId - so every action taken while impersonating
    // was logged as the participant, with no route back to the admin. That had
    // happened across 228 redeemed tickets before this.
    it('attributes an impersonated action to the ADMIN behind it, not the participant', () => {
        expect(
            resolveAuditActor({ userId: 'participant-1', impersonatedByAdminId: 'adm-9' }),
        ).toEqual({ actorId: 'adm-9', actorType: ChangedByType.admin });
    });

    // The impersonation claim must win even though the session looks exactly
    // like the participant's own, which is the whole reason it was invisible.
    it('prefers the impersonator over the participant on the same token', () => {
        const { actorId } = resolveAuditActor({
            userId: 'participant-1',
            impersonatedByAdminId: 'adm-9',
        });

        expect(actorId).not.toBe('participant-1');
    });

    it('falls back to system when there is no user at all', () => {
        expect(resolveAuditActor(undefined)).toEqual({
            actorId: null,
            actorType: ChangedByType.system,
        });
    });
});
