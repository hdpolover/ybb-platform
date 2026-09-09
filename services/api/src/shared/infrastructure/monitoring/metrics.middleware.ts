import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';
import { resolveMetricsRouteLabel } from './metrics-route-label';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
    constructor(private readonly metricsService: MetricsService) {}

    use(req: Request, res: Response, next: NextFunction) {
        const start = Date.now();
        const { method } = req;

        res.on('finish', () => {
            // req.route is only populated by Express AFTER routing has run, so it
            // must be read here (post-handler), not at the top of use(). This is
            // the matched route PATTERN (e.g. "/v1/programs/:identifier"), never
            // the raw URL: labeling from the raw URL let every distinct path a
            // client requests (including unauthenticated scanner 404s and slug
            // path params) mint a new, permanent Prometheus time series for the
            // life of the process -- an unbounded-cardinality memory DoS reachable
            // by anyone on the internet. Unmatched requests (404s, scanner noise)
            // collapse into a single 'unmatched' bucket instead of being labeled
            // individually.
            const route = resolveMetricsRouteLabel(req);
            const duration = Date.now() - start;
            const statusCode = res.statusCode.toString();

            this.metricsService.httpRequestsTotal
                .labels(method, route, statusCode)
                .inc();

            this.metricsService.httpRequestDuration
                .labels(method, route, statusCode)
                .observe(duration / 1000);
        });

        next();
    }
}
