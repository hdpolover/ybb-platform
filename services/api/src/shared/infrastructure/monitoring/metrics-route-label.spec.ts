// src/shared/infrastructure/monitoring/metrics-route-label.spec.ts
import { Request } from 'express';
import { resolveMetricsRouteLabel } from './metrics-route-label';

function makeRequest(overrides: Partial<Request>): Request {
    return overrides as Request;
}

describe('resolveMetricsRouteLabel (M75 / M90)', () => {
    it('labels with the matched route pattern, not the raw URL', () => {
        const req = makeRequest({
            route: { path: '/v1/programs/:identifier' } as any,
            baseUrl: '',
            originalUrl: '/v1/programs/summer-camp-2026',
        });

        expect(resolveMetricsRouteLabel(req)).toBe('/v1/programs/:identifier');
    });

    it('includes a mounted baseUrl so nested routers stay distinguishable', () => {
        const req = makeRequest({
            route: { path: '/:id' } as any,
            baseUrl: '/v1/admin/users',
            originalUrl: '/v1/admin/users/123',
        });

        expect(resolveMetricsRouteLabel(req)).toBe('/v1/admin/users/:id');
    });

    it('collapses an unmatched request (404 / scanner probe) into a single bounded bucket', () => {
        const req = makeRequest({
            route: undefined,
            originalUrl: '/wp-admin/setup-config.php',
        });

        expect(resolveMetricsRouteLabel(req)).toBe('unmatched');
    });

    it('never mints a distinct label per scanned path: two different unmatched URLs collapse to the same bucket', () => {
        const first = resolveMetricsRouteLabel(
            makeRequest({ route: undefined, originalUrl: '/.env' }),
        );
        const second = resolveMetricsRouteLabel(
            makeRequest({ route: undefined, originalUrl: '/phpmyadmin/index.php' }),
        );

        // This is the actual defect this fix closes: unbounded cardinality from
        // labeling by raw URL. Both distinct scanner paths must resolve to the
        // exact same label value so they add zero new time series between them.
        expect(first).toBe(second);
        expect(first).toBe('unmatched');
    });

    it('treats an empty route path as unmatched rather than an empty-string label', () => {
        const req = makeRequest({ route: { path: '' } as any, baseUrl: '' });

        expect(resolveMetricsRouteLabel(req)).toBe('unmatched');
    });
});
