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

// M88/M165: the interceptor resolved its address as
// `request.ip || request.headers['x-forwarded-for']`. req.ip is Traefik's
// container address for every request, and the header fallback took the WHOLE
// comma-joined chain. That value is written to DataChangeLog.ipAddress
// (@db.VarChar(45)), so a long chain raises Postgres 22001 and fails the audited
// write itself — not merely its audit row. It now goes through resolveClientIp,
// which returns a single validated address or nothing.
describe('audit trail client address', () => {
    // Exercised through the shared resolver the interceptor now calls, which is
    // where the behaviour actually lives.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { resolveClientIp } = jest.requireActual('@shared/utils/client-ip') as {
        resolveClientIp: (req: unknown) => string | null;
    };

    it('never returns a comma-joined chain, whatever the header contains', () => {
        const resolved = resolveClientIp({
            headers: { 'x-forwarded-for': '203.0.113.9, 198.51.100.7, 172.68.1.1' },
            ip: '10.0.0.5',
        });
        expect(resolved).not.toContain(',');
        expect((resolved ?? '').length).toBeLessThanOrEqual(45);
    });

    it('never returns the array form a repeated header produces', () => {
        const resolved = resolveClientIp({
            headers: { 'x-forwarded-for': ['203.0.113.9', '198.51.100.7'] },
            ip: '10.0.0.5',
        });
        expect(typeof resolved === 'string' || resolved === null).toBe(true);
        expect(resolved).not.toContain(',');
    });

    it('prefers the real caller over Traefik\'s container address', () => {
        // The old `request.ip ||` short-circuit meant the container address won
        // every time, so every audit row recorded the same internal hop.
        expect(
            resolveClientIp({
                headers: { 'x-forwarded-for': '203.0.113.9, 172.68.1.1', 'cf-connecting-ip': '203.0.113.9' },
                ip: '10.0.0.5',
            }),
        ).toBe('203.0.113.9');
    });
});
