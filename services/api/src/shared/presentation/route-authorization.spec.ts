// src/shared/presentation/route-authorization.spec.ts
//
// Guard coverage that would otherwise only be visible by reading decorators.
// Both routes below were reachable with no credentials at all (audit M74, M210),
// and a missing decorator produces no error, no failing test and no log — it just
// silently serves the data. These assert the metadata Nest actually reads.
import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '@modules/auth/application/decorators/roles.decorator';
import { UserRole } from '@core/entities/user.entity';
import { JwtAuthGuard } from '@modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '@modules/auth/infrastructure/guards/roles.guard';
import { AdminScopeGuard } from '@shared/guards/admin-scope.guard';
import { MetricsController } from './metrics.controller';
import { BrandsController } from '@modules/brands/presentation/brands.controller';

const reflector = new Reflector();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const guardsOn = (handler: any): unknown[] => Reflect.getMetadata('__guards__', handler) ?? [];
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rolesOn = (handler: any): UserRole[] | undefined => reflector.get(ROLES_KEY, handler);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const isPublic = (handler: any): boolean => Boolean(reflector.get('isPublic', handler));

describe('M74 — /v1/metrics cache routes are no longer anonymous', () => {
    it('requires SUPER_ADMIN on cache/stats and cache/warm', () => {
        for (const handler of [MetricsController.prototype.getCacheStats, MetricsController.prototype.warmCache]) {
            expect(guardsOn(handler)).toEqual(expect.arrayContaining([JwtAuthGuard, RolesGuard]));
            expect(rolesOn(handler)).toEqual([UserRole.SUPER_ADMIN]);
        }
    });

    // cache/warm is state-changing despite being a GET — it triggers a rebuild —
    // so leaving it open was an unauthenticated write, not just an info leak.
    it('keeps the Prometheus scrape endpoint public and role-free', () => {
        const scrape = MetricsController.prototype.getMetrics;
        expect(isPublic(scrape)).toBe(true);
        // The guards must NOT be class-level: RolesGuard ignores @Public(), so a
        // class-wide @Roles would 403 this route and break scraping.
        expect(rolesOn(scrape)).toBeUndefined();
        expect(rolesOn(MetricsController)).toBeUndefined();
    });
});

describe('M210 — GET /v1/brands/:id/programs is no longer anonymous', () => {
    it('requires an admin role and brand scoping', () => {
        const handler = BrandsController.prototype.listBrandPrograms;
        expect(guardsOn(handler)).toEqual(
            expect.arrayContaining([JwtAuthGuard, RolesGuard, AdminScopeGuard]),
        );
        expect(rolesOn(handler)).toEqual([UserRole.ADMIN, UserRole.SUPER_ADMIN]);
    });
});
