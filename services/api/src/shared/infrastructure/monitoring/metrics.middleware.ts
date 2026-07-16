import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { MetricsService } from './metrics.service';

@Injectable()
export class MetricsMiddleware implements NestMiddleware {
    constructor(private readonly metricsService: MetricsService) {}

    use(req: Request, res: Response, next: NextFunction) {
        const start = Date.now();
        const { method, originalUrl } = req;
        // Normalize route to avoid high cardinality (e.g., /users/123 -> /users/:id)
        // This is a simple heuristic; strictly ideally this comes from the framework route metadata
        const route = this.normalizeUrl(originalUrl);

        res.on('finish', () => {
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

    private normalizeUrl(url: string): string {
        // Simple normalization: replace UUIDs with :id
        // Remove query params
        const cleanUrl = url.split('?')[0];
        return cleanUrl.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id');
    }
}
