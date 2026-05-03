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
    
    // Transaction Metrics
    public readonly transactionDuration: Histogram;
    public readonly transactionTotal: Counter;

    // Advanced Features Metrics
    // Circuit Breaker
    public readonly circuitBreakerState: Gauge;
    public readonly circuitBreakerFailuresTotal: Counter;
    public readonly circuitBreakerSuccessesTotal: Counter;
    public readonly circuitBreakerOpenedTotal: Counter;
    public readonly circuitBreakerTransitions: Counter;

    // Read Replica
    public readonly readReplicaQueriesTotal: Counter;
    public readonly readReplicaFallbackTotal: Counter;
    public readonly readReplicaDuration: Histogram;

    // Batch Operations
    public readonly batchOperationsTotal: Counter;
    public readonly batchOperationSize: Histogram;
    public readonly batchOperationDuration: Histogram;

    // Distributed Tracing
    public readonly tracedTransactionsTotal: Counter;

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

        // Transaction Metrics
        this.transactionDuration = new Histogram({
            name: 'db_transaction_duration_seconds',
            help: 'Duration of database transactions in seconds',
            labelNames: ['name'], // transaction name (e.g., 'user-registration')
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5], // 10ms to 5s
            registers: [this.registry],
        });

        this.transactionTotal = new Counter({
            name: 'db_transaction_total',
            help: 'Total number of database transactions',
            labelNames: ['name', 'status'], // status: success, failed
            registers: [this.registry],
        });

        // Advanced Features Metrics

        // Circuit Breaker Metrics
        this.circuitBreakerState = new Gauge({
            name: 'circuit_breaker_state',
            help: 'Circuit breaker state (0=closed, 1=open, 2=half_open)',
            registers: [this.registry],
        });

        this.circuitBreakerFailuresTotal = new Counter({
            name: 'circuit_breaker_failures_total',
            help: 'Total number of circuit breaker failures',
            registers: [this.registry],
        });

        this.circuitBreakerSuccessesTotal = new Counter({
            name: 'circuit_breaker_successes_total',
            help: 'Total number of circuit breaker successes',
            registers: [this.registry],
        });

        this.circuitBreakerOpenedTotal = new Counter({
            name: 'circuit_breaker_opened_total',
            help: 'Total number of times circuit breaker opened',
            registers: [this.registry],
        });

        this.circuitBreakerTransitions = new Counter({
            name: 'circuit_breaker_transitions_total',
            help: 'Total number of circuit breaker state transitions',
            labelNames: ['from_state', 'to_state'], // closed->open, open->half_open, etc.
            registers: [this.registry],
        });

        // Read Replica Metrics
        this.readReplicaQueriesTotal = new Counter({
            name: 'read_replica_queries_total',
            help: 'Total number of queries routed to read replica',
            labelNames: ['status'], // status: success, fallback
            registers: [this.registry],
        });

        this.readReplicaFallbackTotal = new Counter({
            name: 'read_replica_fallback_total',
            help: 'Total number of queries that fell back to primary database',
            labelNames: ['reason'], // reason: replica_unavailable, replica_error
            registers: [this.registry],
        });

        this.readReplicaDuration = new Histogram({
            name: 'read_replica_duration_seconds',
            help: 'Duration of read replica queries in seconds',
            labelNames: ['source'], // source: replica, primary_fallback
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5],
            registers: [this.registry],
        });

        // Batch Operations Metrics
        this.batchOperationsTotal = new Counter({
            name: 'batch_operations_total',
            help: 'Total number of batch operations',
            labelNames: ['name', 'status'], // status: success, failed
            registers: [this.registry],
        });

        this.batchOperationSize = new Histogram({
            name: 'batch_operation_size',
            help: 'Number of operations per batch',
            labelNames: ['name'],
            buckets: [1, 5, 10, 25, 50, 100, 250, 500],
            registers: [this.registry],
        });

        this.batchOperationDuration = new Histogram({
            name: 'batch_operation_duration_seconds',
            help: 'Duration of batch operations in seconds',
            labelNames: ['name', 'status'],
            buckets: [0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
            registers: [this.registry],
        });

        // Distributed Tracing Metrics
        this.tracedTransactionsTotal = new Counter({
            name: 'traced_transactions_total',
            help: 'Total number of transactions with trace IDs',
            labelNames: ['name', 'has_trace_id'],
            registers: [this.registry],
        });
    }

    onModuleInit() {
        // Metrics initialized
    }

    /**
     * Record transaction duration metric
     */
    recordTransactionDuration(name: string, durationMs: number): void {
        this.transactionDuration.observe({ name }, durationMs / 1000);
    }

    /**
     * Increment transaction counter
     */
    incrementTransactionCounter(name: string, status: 'success' | 'failed'): void {
        this.transactionTotal.inc({ name, status });
    }

    // Circuit Breaker Methods

    /**
     * Update circuit breaker state
     * @param state - 0=closed, 1=open, 2=half_open
     */
    setCircuitBreakerState(state: number): void {
        this.circuitBreakerState.set(state);
    }

    /**
     * Record circuit breaker state transition
     */
    recordCircuitBreakerTransition(fromState: string, toState: string): void {
        this.circuitBreakerTransitions.inc({ from_state: fromState, to_state: toState });
    }

    /**
     * Increment circuit breaker failure counter
     */
    incrementCircuitBreakerFailures(): void {
        this.circuitBreakerFailuresTotal.inc();
    }

    /**
     * Increment circuit breaker success counter
     */
    incrementCircuitBreakerSuccesses(): void {
        this.circuitBreakerSuccessesTotal.inc();
    }

    /**
     * Increment circuit breaker opened counter
     */
    incrementCircuitBreakerOpened(): void {
        this.circuitBreakerOpenedTotal.inc();
    }

    // Read Replica Methods

    /**
     * Record read replica query
     */
    recordReadReplicaQuery(status: 'success' | 'fallback', durationMs: number, source: 'replica' | 'primary_fallback'): void {
        this.readReplicaQueriesTotal.inc({ status });
        this.readReplicaDuration.observe({ source }, durationMs / 1000);
    }

    /**
     * Record read replica fallback
     */
    recordReadReplicaFallback(reason: string): void {
        this.readReplicaFallbackTotal.inc({ reason });
    }

    // Batch Operations Methods

    /**
     * Record batch operation
     */
    recordBatchOperation(name: string, operationCount: number, durationMs: number, status: 'success' | 'failed'): void {
        this.batchOperationsTotal.inc({ name, status });
        this.batchOperationSize.observe({ name }, operationCount);
        this.batchOperationDuration.observe({ name, status }, durationMs / 1000);
    }

    // Distributed Tracing Methods

    /**
     * Record traced transaction
     */
    recordTracedTransaction(name: string, hasTraceId: boolean): void {
        this.tracedTransactionsTotal.inc({ name, has_trace_id: hasTraceId ? 'true' : 'false' });
    }

    getRegistry(): Registry {
        return this.registry;
    }

    async getMetrics(): Promise<string> {
        return this.registry.metrics();
    }
}
