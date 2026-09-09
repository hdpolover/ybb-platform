import { Request } from 'express';

/**
 * Shared unbounded-cardinality guard for Prometheus route labels.
 *
 * Do NOT label metrics from req.url/req.originalUrl. Those carry every
 * distinct path a caller ever requests -- including 404 scanner noise and
 * slug/id path params -- and each distinct label value becomes a permanent
 * time series for the life of the process (prom-client never evicts labels).
 * That is a memory DoS reachable by anyone on the internet, no auth required.
 *
 * Use the matched Express ROUTE PATTERN instead (e.g. "/v1/programs/:identifier"),
 * which is bounded by the number of routes we actually declare. req.route is
 * only populated AFTER Express has matched a route, so this must be called from
 * a post-routing hook (e.g. res.on('finish', ...)), never at request start.
 * Anything that never matched a route (404s, scanner probes) collapses into a
 * single 'unmatched' bucket so it can never grow the label set.
 */
export function resolveMetricsRouteLabel(req: Request): string {
    const routePath = req.route?.path;
    if (typeof routePath !== 'string' || routePath.length === 0) {
        return 'unmatched';
    }

    const baseUrl = typeof req.baseUrl === 'string' ? req.baseUrl : '';
    return `${baseUrl}${routePath}` || 'unmatched';
}
