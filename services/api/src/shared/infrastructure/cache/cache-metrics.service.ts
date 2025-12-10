import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

/**
 * Cache Metrics Service
 * 
 * Tracks cache performance metrics for Prometheus monitoring.
 * Exposes: hit rates, miss rates, and latency metrics.
 */
@Injectable()
export class CacheMetricsService implements OnModuleInit {
    private readonly registry: Registry;
    private readonly cacheHits: Counter;
    private readonly cacheMisses: Counter;
    private readonly cacheLatency: Histogram;
    private readonly cacheOperations: Counter;

    constructor() {
        this.registry = new Registry();

        // Collect default Node.js metrics (memory, CPU, event loop, etc.)
        collectDefaultMetrics({ register: this.registry });

        // Cache hit counter
        this.cacheHits = new Counter({
            name: 'cache_hits_total',
            help: 'Total number of cache hits',
            labelNames: ['cache_type'],
            registers: [this.registry],
        });

        // Cache miss counter
        this.cacheMisses = new Counter({
            name: 'cache_misses_total',
            help: 'Total number of cache misses',
            labelNames: ['cache_type'],
            registers: [this.registry],
        });

        // Cache latency histogram
        this.cacheLatency = new Histogram({
            name: 'cache_operation_duration_seconds',
            help: 'Duration of cache operations in seconds',
            labelNames: ['operation', 'cache_type'],
            buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1],
            registers: [this.registry],
        });

        // Cache operations counter (get, set, delete)
        this.cacheOperations = new Counter({
            name: 'cache_operations_total',
            help: 'Total number of cache operations',
            labelNames: ['operation', 'cache_type'],
            registers: [this.registry],
        });
    }

    async onModuleInit() {
        // Metrics are ready on startup
    }

    /**
     * Record a cache hit
     */
    recordHit(cacheType: string = 'redis') {
        this.cacheHits.labels(cacheType).inc();
        this.cacheOperations.labels('get', cacheType).inc();
    }

    /**
     * Record a cache miss
     */
    recordMiss(cacheType: string = 'redis') {
        this.cacheMisses.labels(cacheType).inc();
        this.cacheOperations.labels('get', cacheType).inc();
    }

    /**
     * Record cache operation latency
     */
    recordLatency(operation: string, durationMs: number, cacheType: string = 'redis') {
        this.cacheLatency.labels(operation, cacheType).observe(durationMs / 1000);
    }

    /**
     * Record a cache set operation
     */
    recordSet(cacheType: string = 'redis') {
        this.cacheOperations.labels('set', cacheType).inc();
    }

    /**
     * Record a cache delete operation
     */
    recordDelete(cacheType: string = 'redis') {
        this.cacheOperations.labels('delete', cacheType).inc();
    }

    /**
     * Get metrics in Prometheus format
     */
    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }

    /**
     * Get metrics registry (for combining with other metrics)
     */
    getRegistry(): Registry {
        return this.registry;
    }

    /**
     * Get cache statistics
     */
    async getStats(): Promise<{
        hits: number;
        misses: number;
        hitRate: number;
    }> {
        const hitsValue = await this.cacheHits.get();
        const missesValue = await this.cacheMisses.get();

        const totalHits = hitsValue.values.reduce((sum, v) => sum + v.value, 0);
        const totalMisses = missesValue.values.reduce((sum, v) => sum + v.value, 0);
        const total = totalHits + totalMisses;

        return {
            hits: totalHits,
            misses: totalMisses,
            hitRate: total > 0 ? (totalHits / total) * 100 : 0,
        };
    }
}
