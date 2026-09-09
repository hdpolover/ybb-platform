// src/shared/infrastructure/monitoring/metrics.middleware.spec.ts
import { EventEmitter } from 'events';
import { MetricsMiddleware } from './metrics.middleware';
import { MetricsService } from './metrics.service';

// Minimal Express-shaped req/res doubles. res is a real EventEmitter so
// res.on('finish', ...) / mockRes.emit('finish') behave like Express's
// post-handler hook, which is the whole point of M75/M90: req.route is only
// populated by Express AFTER routing runs, so the label must be read inside
// that callback, not at the top of use().
function makeRes(statusCode = 200) {
    const res = new EventEmitter() as EventEmitter & { statusCode: number };
    res.statusCode = statusCode;
    return res;
}

describe('MetricsMiddleware (M75 / M90 regression)', () => {
    let metricsService: MetricsService;
    let labelsSpy: jest.SpyInstance;

    beforeEach(() => {
        metricsService = new MetricsService();
        labelsSpy = jest.fn().mockReturnValue({ inc: jest.fn(), observe: jest.fn() });
        (metricsService as any).httpRequestsTotal = { labels: labelsSpy };
        (metricsService as any).httpRequestDuration = { labels: labelsSpy };
    });

    it('labels a matched request with the route pattern, not req.originalUrl', () => {
        const middleware = new MetricsMiddleware(metricsService);
        const req: any = {
            method: 'GET',
            originalUrl: '/v1/programs/summer-camp-2026?utm=x',
            baseUrl: '',
            route: undefined, // not yet populated when use() runs
        };
        const res = makeRes(200);

        middleware.use(req, res as any, jest.fn());

        // Simulate Express populating req.route once the handler matches, then
        // firing 'finish' -- this is what actually happens in production.
        req.route = { path: '/v1/programs/:identifier' };
        res.emit('finish');

        expect(labelsSpy).toHaveBeenCalledWith('GET', '/v1/programs/:identifier', '200');
        expect(labelsSpy).not.toHaveBeenCalledWith(
            'GET',
            expect.stringContaining('summer-camp-2026'),
            expect.anything(),
        );
    });

    it('collapses an unmatched 404 (scanner probe) into the bounded "unmatched" label instead of the raw path', () => {
        const middleware = new MetricsMiddleware(metricsService);
        const req: any = {
            method: 'GET',
            originalUrl: '/.git/config',
            baseUrl: '',
            route: undefined,
        };
        const res = makeRes(404);

        middleware.use(req, res as any, jest.fn());
        // 404: Express never matches a route, so req.route stays undefined.
        res.emit('finish');

        expect(labelsSpy).toHaveBeenCalledWith('GET', 'unmatched', '404');
    });

    it('two different scanner paths that both 404 produce the same label, not two new series', () => {
        const middleware = new MetricsMiddleware(metricsService);

        for (const path of ['/wp-login.php', '/.env', '/admin/config.json']) {
            const req: any = { method: 'GET', originalUrl: path, baseUrl: '', route: undefined };
            const res = makeRes(404);
            middleware.use(req, res as any, jest.fn());
            res.emit('finish');
        }

        const routeLabelsUsed = labelsSpy.mock.calls.map((call) => call[1]);
        expect(new Set(routeLabelsUsed)).toEqual(new Set(['unmatched']));
    });
});
