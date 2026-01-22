import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
    private readonly registry: Registry;
    public readonly httpRequestsTotal: Counter;
    public readonly httpRequestDuration: Histogram;
    
    // Business Metrics
    public readonly userRegistrationsTotal: Counter;
    public readonly loginAttemptsTotal: Counter;

    constructor() {
        this.registry = new Registry();
        
        // 1. System Metrics (CPU, Memory, Event Loop)
        collectDefaultMetrics({ register: this.registry });

        // 2. HTTP Metrics
        this.httpRequestsTotal = new Counter({
            name: 'http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
            registers: [this.registry],
        });

        this.httpRequestDuration = new Histogram({
            name: 'http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 3, 5, 10], // 10ms to 10s
            registers: [this.registry],
        });

        // 3. Business Metrics
        this.userRegistrationsTotal = new Counter({
            name: 'business_user_registrations_total',
            help: 'Total number of user registrations',
            labelNames: ['provider', 'program_category'],
            registers: [this.registry],
        });

        this.loginAttemptsTotal = new Counter({
            name: 'business_login_attempts_total',
            help: 'Total number of login attempts',
            labelNames: ['status', 'provider'], // status: success, failure
            registers: [this.registry],
        });
    }

    onModuleInit() {
        // Metrics initialized
    }

    getRegistry(): Registry {
        return this.registry;
    }

    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}
