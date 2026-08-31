import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';
import { CACHE_KEYS, CACHE_TTL } from '../../constants/cache-keys';

/**
 * Cache Warming Service
 * 
 * Pre-populates the cache with frequently accessed data on application startup.
 * This eliminates cold-start latency for popular resources.
 */
@Injectable()
export class CacheWarmingService implements OnModuleInit {
    private readonly logger = new Logger(CacheWarmingService.name);

    constructor(
        private readonly prisma: PrismaService,
        private readonly cacheService: CacheService,
    ) { }

    async onModuleInit() {
        // Run cache warming in background (don't block startup)
        this.warmCache().catch((error) => {
            this.logger.error('Cache warming failed:', error);
        });
    }

    private async warmCache() {
        this.logger.log('Starting cache warming...');
        const startTime = Date.now();

        try {
            await Promise.all([
                this.warmProgramsCache(),
                this.warmCategoriesCache(),
            ]);

            const duration = Date.now() - startTime;
            this.logger.log(`Cache warming completed in ${duration}ms`);
        } catch (error) {
            this.logger.error('Cache warming error:', error);
        }
    }

    /**
     * Pre-load published programs into cache
     */
    private async warmProgramsCache() {
        try {
            const programs = await this.prisma.program.findMany({
                where: {
                    isPublished: true,
                    deletedAt: null,
                    status: { not: 'draft' },
                },
                take: 50, // Limit to top 50 programs
                orderBy: { updatedAt: 'desc' },
                select: {
                    id: true,
                    name: true,
                    slug: true,
                    description: true,
                    shortDescription: true,
                    startDate: true,
                    endDate: true,
                    isPublished: true,
                    brandId: true,
                },
            });

            // Cache each program individually
            for (const program of programs) {
                const cacheKey = CACHE_KEYS.PROGRAM_DETAIL(program.id);
                await this.cacheService.set(cacheKey, program, CACHE_TTL.LONG);
            }

            this.logger.log(`Warmed cache with ${programs.length} programs`);
        } catch (error) {
            this.logger.warn('Failed to warm programs cache:', error);
        }
    }

    /**
     * Pre-load categories into cache
     */
    private async warmCategoriesCache() {
        try {
            const categories = await this.prisma.brand.findMany({
                where: { deletedAt: null },
                take: 20,
            });

            for (const category of categories) {
                const cacheKey = CACHE_KEYS.CATEGORY(category.id);
                await this.cacheService.set(cacheKey, category, CACHE_TTL.HOUR);
            }

            this.logger.log(`Warmed cache with ${categories.length} categories`);
        } catch (error) {
            this.logger.warn('Failed to warm categories cache:', error);
        }
    }

    /**
     * Manual cache refresh (can be called via admin endpoint)
     */
    async refreshCache(): Promise<{ success: boolean; message: string }> {
        await this.warmCache();
        return { success: true, message: 'Cache warming completed' };
    }
}
