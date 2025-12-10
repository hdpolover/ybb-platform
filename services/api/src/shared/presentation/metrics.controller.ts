import { Controller, Get, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Response } from 'express';
import { CacheMetricsService } from '../infrastructure/cache/cache-metrics.service';
import { CacheWarmingService } from '../infrastructure/cache/cache-warming.service';
import { Public } from '../decorators/public.decorator';

@ApiTags('metrics')
@Controller('metrics')
export class MetricsController {
    constructor(
        private readonly metricsService: CacheMetricsService,
        private readonly warmingService: CacheWarmingService,
    ) { }

    @Get()
    @Public()
    @ApiOperation({ summary: 'Get Prometheus metrics' })
    @ApiResponse({ status: 200, description: 'Prometheus formatted metrics' })
    async getMetrics(@Res() res: Response) {
        const metrics = await this.metricsService.getMetrics();
        res.set('Content-Type', 'text/plain; charset=utf-8');
        res.send(metrics);
    }

    @Get('cache/stats')
    @ApiOperation({ summary: 'Get cache statistics' })
    @ApiResponse({ status: 200, description: 'Cache hit/miss stats' })
    async getCacheStats() {
        return this.metricsService.getStats();
    }

    @Get('cache/warm')
    @ApiOperation({ summary: 'Trigger cache warming manually' })
    @ApiResponse({ status: 200, description: 'Cache warming triggered' })
    async warmCache() {
        return this.warmingService.refreshCache();
    }
}
