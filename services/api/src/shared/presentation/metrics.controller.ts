import { Controller, Get, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { CacheMetricsService } from '../infrastructure/cache/cache-metrics.service';
import { CacheWarmingService } from '../infrastructure/cache/cache-warming.service';
import { MetricsService } from '../infrastructure/monitoring/metrics.service';
import { Public } from '../decorators/public.decorator';
import { JwtAuthGuard } from '../../modules/auth/infrastructure/guards/jwt-auth.guard';
import { RolesGuard } from '../../modules/auth/infrastructure/guards/roles.guard';
import { Roles } from '../../modules/auth/application/decorators/roles.decorator';
import { UserRole } from '../../core/entities/user.entity';

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

    // Guards go on the ROUTES, not the class, and this is deliberate: RolesGuard
    // does not consult @Public(). A class-level @Roles(SUPER_ADMIN) is evaluated
    // for the scrape endpoint too, where JwtAuthGuard short-circuits on @Public()
    // and leaves no user on the request, so RolesGuard would 403 it and silently
    // break Prometheus. Matches CacheController's intent without its class-wide
    // shape, which that controller can use only because it has no public route.
    @Get('cache/stats')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Get cache statistics (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Cache hit/miss stats' })
    async getCacheStats() {
        return this.cacheMetricsService.getStats();
    }

    @Get('cache/warm')
    @UseGuards(JwtAuthGuard, RolesGuard)
    @Roles(UserRole.SUPER_ADMIN)
    @ApiBearerAuth()
    @ApiOperation({ summary: 'Trigger cache warming manually (Super Admin only)' })
    @ApiResponse({ status: 200, description: 'Cache warming triggered' })
    async warmCache() {
        return this.warmingService.refreshCache();
    }
}
