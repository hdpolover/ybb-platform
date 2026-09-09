import { resolveAuditActor, AuditTrailInterceptor } from './audit-trail.interceptor';
import { ChangedByType, ChangeType } from '@prisma/client';
import { of } from 'rxjs';

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

/**
 * N-2026-09-09-D: pricing-tier writes had no @AuditTrail at all, so nobody
 * could say who deactivated MEYS 6th's only fully_funded registration_fee
 * tier on 2026-09-08. program-application.controller.spec.ts pins that the
 * decorator is now wired to every pricing-tier/validity-period endpoint;
 * this pins the OTHER half - that DEFAULT_ENTITY_SELECTS actually narrows
 * the before-state fetch for those two entity types, the way M81 did for
 * the entities already in the map, rather than falling through to a
 * full-row snapshot.
 */
describe('AuditTrailInterceptor before-state select (N-2026-09-09-D)', () => {
    function buildContext(params: Record<string, string>) {
        const request = { params, method: 'PUT', route: { path: '/mock' }, url: '/mock', headers: {}, user: undefined };
        return {
            getHandler: () => function mockHandler() { /* noop */ },
            switchToHttp: () => ({ getRequest: () => request }),
        } as any;
    }

    async function runIntercept(entityType: string, entityId: string, findUnique: jest.Mock) {
        const reflector = { get: jest.fn().mockReturnValue({ entityType, action: ChangeType.update, idParam: 'id' }) };
        const modelName = entityType.charAt(0).toLowerCase() + entityType.slice(1);
        const prisma = { [modelName]: { findUnique } };
        const dataChangeLogService = { logWithDiff: jest.fn().mockResolvedValue(undefined) };
        const interceptor = new AuditTrailInterceptor(reflector as any, prisma as any, dataChangeLogService as any);
        const next = { handle: () => of({ id: entityId }) };

        await interceptor.intercept(buildContext({ id: entityId }), next as any);
    }

    it('narrows the ProgramPricingTier before-state fetch to every field a write path can change', async () => {
        const findUnique = jest.fn().mockResolvedValue({ id: 't1', isActive: false });
        await runIntercept('ProgramPricingTier', 't1', findUnique);

        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 't1' },
            select: {
                id: true,
                programId: true,
                name: true,
                description: true,
                price: true,
                currency: true,
                usdPrice: true,
                idrPrice: true,
                capacity: true,
                benefits: true,
                requirements: true,
                feeType: true,
                allowedCategories: true,
                icon: true,
                order: true,
                isActive: true,
                updatedAt: true,
                deletedAt: true,
            },
        });
    });

    it('narrows the PricingTierValidityPeriod before-state fetch to every field a write path can change', async () => {
        const findUnique = jest.fn().mockResolvedValue({ id: 'p1' });
        await runIntercept('PricingTierValidityPeriod', 'p1', findUnique);

        expect(findUnique).toHaveBeenCalledWith({
            where: { id: 'p1' },
            select: {
                id: true,
                pricingTierId: true,
                startDate: true,
                endDate: true,
                description: true,
                updatedAt: true,
            },
        });
    });
});
