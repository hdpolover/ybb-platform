import { Injectable, OnModuleInit } from '@nestjs/common';
import { Counter, Histogram, Gauge, Registry, collectDefaultMetrics } from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
    private readonly registry: Registry;
    public readonly httpRequestsTotal: Counter;
    public readonly httpRequestDuration: Histogram;
    
    // Business Metrics
    public readonly userRegistrationsTotal: Counter;
    public readonly loginAttemptsTotal: Counter;
    
    // Phase 1: Business Intelligence
    public readonly paymentTotal: Counter;
    public readonly paymentAmount: Histogram;
    public readonly applicationStartedTotal: Counter;
    public readonly applicationSubmittedTotal: Counter;
    public readonly loginTotal: Counter;
    public readonly fileUploadsTotal: Counter;

    // Phase 2: Application Performance Deep Dive
    public readonly prismaQueryDuration: Histogram;
    public readonly prismaQueryTotal: Counter;
    public readonly prismaPoolConnectionsOpen: Gauge;
    public readonly externalApiDuration: Histogram;
    // jobQueueDepth is typically best monitored via RabbitMQ exporter, but we can declare it here if we want to push it manually
    public readonly jobQueueDepth: Gauge; 
    public readonly jobQueueConsumers: Gauge;
    public readonly jobProcessingDuration: Histogram;

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
            labelNames: ['provider', 'brand'],
            registers: [this.registry],
        });

        this.loginAttemptsTotal = new Counter({
            name: 'business_login_attempts_total',
            help: 'Total number of login attempts',
            labelNames: ['status', 'provider'], // status: success, failure
            registers: [this.registry],
        });

        // Phase 1 Implementations
        
        // 1.1 Revenue & Payments
        this.paymentTotal = new Counter({
            name: 'business_payments_total',
            help: 'Total number of payments',
            labelNames: ['currency', 'method', 'status'], // method: stripe, midtrans, manual; status: success, failed
            registers: [this.registry],
        });

        this.paymentAmount = new Histogram({
            name: 'business_payment_amount',
            help: 'Value of payments received',
            labelNames: ['currency', 'method', 'status'],
            buckets: [10000, 50000, 100000, 500000, 1000000, 5000000, 10000000], // Adjust buckets for IDR/USD mix if needed
            registers: [this.registry],
        });

        // 1.2 Application Funnel
        this.applicationStartedTotal = new Counter({
            name: 'business_applications_started_total',
            help: 'Total number of applications started (draft)',
            labelNames: ['brand'],
            registers: [this.registry],
        });

        this.applicationSubmittedTotal = new Counter({
            name: 'business_applications_submitted_total',
            help: 'Total number of applications submitted',
            labelNames: ['brand'],
            registers: [this.registry],
        });

        // 1.3 User Engagement
        this.loginTotal = new Counter({
            name: 'business_login_total',
            help: 'Total number of user logins',
            labelNames: ['method', 'result'], // method: google, email; result: success, failure
            registers: [this.registry],
        });

        this.fileUploadsTotal = new Counter({
            name: 'business_file_uploads_total',
            help: 'Total number of file uploads',
            labelNames: ['file_type'], // essay, photo, document
            registers: [this.registry],
        });

        // Phase 2 Implementations

        // 2.1 Database (Prisma)
        this.prismaQueryDuration = new Histogram({
            name: 'prisma_query_duration_seconds',
            help: 'Duration of Prisma queries in seconds',
            labelNames: ['model', 'operation'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 3],
            registers: [this.registry],
        });

        this.prismaQueryTotal = new Counter({
            name: 'prisma_query_total',
            help: 'Total number of Prisma queries',
            labelNames: ['model', 'operation'],
            registers: [this.registry],
        });

        this.prismaPoolConnectionsOpen = new Gauge({
            name: 'prisma_pool_connections_open',
            help: 'Number of open connections in the Prisma pool',
            registers: [this.registry],
        });

        // 2.2 External Services
        this.externalApiDuration = new Histogram({
            name: 'external_api_duration_seconds',
            help: 'Duration of external API calls in seconds',
            labelNames: ['service'], // payment_gateway, email_provider, storage
            buckets: [0.1, 0.5, 1, 3, 5, 10], 
            registers: [this.registry],
        });

        // 2.3 Job Queues
        this.jobQueueDepth = new Gauge({
            name: 'job_queue_depth',
            help: 'Depth of job queues',
            labelNames: ['queue_name'],
            registers: [this.registry],
        });

        this.jobQueueConsumers = new Gauge({
            name: 'job_queue_consumers',
            help: 'Number of consumers for job queues',
            labelNames: ['queue_name'],
            registers: [this.registry],
        });

        this.jobProcessingDuration = new Histogram({
            name: 'job_processing_duration_seconds',
            help: 'Duration of job processing in seconds',
            labelNames: ['queue_name', 'status'], // status: success, failed
            buckets: [0.1, 0.5, 1, 5, 10, 30, 60],
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
