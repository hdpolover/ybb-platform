import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { CacheMetricsService } from '../infrastructure/cache/cache-metrics.service';
import { CacheWarmingService } from '../infrastructure/cache/cache-warming.service';
import { MetricsService } from '../infrastructure/monitoring/metrics.service';
import { Public } from '../decorators/public.decorator';

@ApiTags('System')
@Controller('metrics')
export class MetricsController {
    constructor(
        private readonly cacheMetricsService: CacheMetricsService,
        private readonly warmingService: CacheWarmingService,
        private readonly metricsService: MetricsService,
    ) { }

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get Prometheus metrics' })
    @ApiResponse({ status: 200, description: 'Prometheus formatted metrics' })
    async getMetrics(@Res() res: Response) {
        // Combine metrics from global registry and cache specific registry
        // Note: Ideally allow MetricsService to be the SINGLE source of truth
        // For now, we return the global one which includes HTTP stats
        const metrics = await this.metricsService.getMetrics();
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(metrics);
    }

    @Get('cache/stats')
    @ApiOperation({ summary: 'Get cache statistics' })
    @ApiResponse({ status: 200, description: 'Cache hit/miss stats' })
    async getCacheStats() {
        return this.cacheMetricsService.getStats();
    }

    @Get('cache/warm')
    @ApiOperation({ summary: 'Trigger cache warming manually' })
    @ApiResponse({ status: 200, description: 'Cache warming triggered' })
    async warmCache() {
        return this.warmingService.refreshCache();
    }
}
