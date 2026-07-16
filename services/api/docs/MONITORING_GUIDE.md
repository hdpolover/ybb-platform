# Monitoring Guide

Complete guide to monitoring the YBB Platform API service with Prometheus and Grafana.

## Table of Contents
1. [Overview](#overview)
2. [Metrics Categories](#metrics-categories)
3. [Circuit Breaker Monitoring](#circuit-breaker-monitoring)
4. [Read Replica Monitoring](#read-replica-monitoring)
5. [Batch Operations Monitoring](#batch-operations-monitoring)
6. [Distributed Tracing Monitoring](#distributed-tracing-monitoring)
7. [Grafana Dashboards](#grafana-dashboards)
8. [Alerts](#alerts)

---

## Overview

The API service exposes Prometheus metrics at `/metrics` endpoint. These metrics cover:
- System resources (CPU, memory, event loop)
- HTTP requests and responses
- Database transactions and queries
- Business metrics (payments, applications, logins)
- Advanced features (circuit breaker, read replica, batching, tracing)

### Accessing Metrics

```bash
curl http://localhost:4000/metrics
```

---

## Metrics Categories

### 1. System Metrics (Auto-collected)
```promql
# CPU Usage
process_cpu_user_seconds_total
process_cpu_system_seconds_total

# Memory Usage
nodejs_heap_size_used_bytes
nodejs_heap_size_total_bytes
nodejs_external_memory_bytes

# Event Loop Lag
nodejs_eventloop_lag_seconds
```

### 2. HTTP Metrics
```promql
# Total Requests
http_requests_total{method="GET", route="/api/users", status_code="200"}

# Request Duration (P50, P95, P99)
histogram_quantile(0.95, rate(http_request_duration_seconds_bucket[5m]))
```

### 3. Database Transaction Metrics
```promql
# Transaction Duration
db_transaction_duration_seconds{name="user-registration"}

# Transaction Success Rate
rate(db_transaction_total{status="success"}[5m]) / 
rate(db_transaction_total[5m])
```

### 3.1 Database Query and Pool Metrics
```promql
# Slow query rate by model/operation
rate(prisma_slow_query_total[5m])

# Query latency (P95)
histogram_quantile(0.95, rate(prisma_query_duration_seconds_bucket[5m]))

# Pool pressure
prisma_pool_connections_open
prisma_pool_connections_idle
prisma_pool_connections_waiting
```

### 4. Business Metrics
```promql
# Payment Volume
rate(business_payments_total{status="success"}[1h])

# Payment Amount
rate(business_payment_amount_sum[1h])

# Application Conversion Rate
rate(business_applications_submitted_total[1h]) / 
rate(business_applications_started_total[1h])
```

---

## Circuit Breaker Monitoring

### Metrics

#### 1. Circuit State
```promql
# Current State (0=closed, 1=open, 2=half_open)
circuit_breaker_state

# Visualize State Over Time
circuit_breaker_state{instance="api-1"}
```

#### 2. Failure/Success Counters
```promql
# Total Failures
rate(circuit_breaker_failures_total[5m])

# Total Successes
rate(circuit_breaker_successes_total[5m])

# Failure Rate
rate(circuit_breaker_failures_total[5m]) / 
(rate(circuit_breaker_failures_total[5m]) + rate(circuit_breaker_successes_total[5m]))
```

#### 3. Circuit Opens
```promql
# Number of Times Circuit Opened
increase(circuit_breaker_opened_total[1h])

# Rate of Circuit Opens (per hour)
rate(circuit_breaker_opened_total[1h])
```

#### 4. State Transitions
```promql
# Transitions by Type
rate(circuit_breaker_transitions_total{from_state="closed", to_state="open"}[5m])
rate(circuit_breaker_transitions_total{from_state="open", to_state="half_open"}[5m])
rate(circuit_breaker_transitions_total{from_state="half_open", to_state="closed"}[5m])
```

### Grafana Panels

#### Panel 1: Circuit Breaker State
```json
{
  "title": "Circuit Breaker State",
  "targets": [
    {
      "expr": "circuit_breaker_state",
      "legendFormat": "State (0=closed, 1=open, 2=half_open)"
    }
  ],
  "type": "graph",
  "valueMaps": [
    { "value": "0", "text": "CLOSED" },
    { "value": "1", "text": "OPEN" },
    { "value": "2", "text": "HALF_OPEN" }
  ]
}
```

#### Panel 2: Failure Rate
```json
{
  "title": "Circuit Breaker Failure Rate",
  "targets": [
    {
      "expr": "rate(circuit_breaker_failures_total[5m]) / (rate(circuit_breaker_failures_total[5m]) + rate(circuit_breaker_successes_total[5m]))",
      "legendFormat": "Failure Rate"
    }
  ],
  "type": "graph",
  "yAxis": { "format": "percentunit" }
}
```

### Alerts

```yaml
# Circuit Breaker Open
- alert: CircuitBreakerOpen
  expr: circuit_breaker_state == 1
  for: 1m
  labels:
    severity: critical
  annotations:
    summary: "Circuit breaker is OPEN"
    description: "Database circuit breaker has opened due to repeated failures"

# High Failure Rate
- alert: CircuitBreakerHighFailureRate
  expr: rate(circuit_breaker_failures_total[5m]) / (rate(circuit_breaker_failures_total[5m]) + rate(circuit_breaker_successes_total[5m])) > 0.5
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High circuit breaker failure rate (>50%)"
```

---

## Read Replica Monitoring

### Metrics

#### 1. Query Distribution
```promql
# Queries to Replica vs Primary
rate(read_replica_queries_total{status="success"}[5m])  # Replica
rate(read_replica_queries_total{status="fallback"}[5m]) # Primary Fallback

# Replica Usage Percentage
rate(read_replica_queries_total{status="success"}[5m]) / 
rate(read_replica_queries_total[5m])
```

#### 2. Fallback Rate
```promql
# Fallback Events
rate(read_replica_fallback_total[5m])

# Fallback by Reason
rate(read_replica_fallback_total{reason="replica_unavailable"}[5m])
rate(read_replica_fallback_total{reason="replica_error"}[5m])
```

#### 3. Performance Comparison
```promql
# Replica Query Duration (P95)
histogram_quantile(0.95, rate(read_replica_duration_seconds_bucket{source="replica"}[5m]))

# Primary Fallback Duration (P95)
histogram_quantile(0.95, rate(read_replica_duration_seconds_bucket{source="primary_fallback"}[5m]))

# Performance Gain
(
  histogram_quantile(0.95, rate(read_replica_duration_seconds_bucket{source="primary_fallback"}[5m])) -
  histogram_quantile(0.95, rate(read_replica_duration_seconds_bucket{source="replica"}[5m]))
) / histogram_quantile(0.95, rate(read_replica_duration_seconds_bucket{source="primary_fallback"}[5m]))
```

### Grafana Panels

#### Panel 1: Query Distribution
```json
{
  "title": "Read Query Distribution",
  "targets": [
    {
      "expr": "rate(read_replica_queries_total{status=\"success\"}[5m])",
      "legendFormat": "Replica"
    },
    {
      "expr": "rate(read_replica_queries_total{status=\"fallback\"}[5m])",
      "legendFormat": "Primary (Fallback)"
    }
  ],
  "type": "graph",
  "stack": true
}
```

#### Panel 2: Replica Health
```json
{
  "title": "Replica Fallback Rate",
  "targets": [
    {
      "expr": "rate(read_replica_fallback_total[5m])",
      "legendFormat": "Fallback Rate"
    }
  ],
  "type": "graph"
}
```

### Alerts

```yaml
# High Fallback Rate
- alert: ReadReplicaHighFallbackRate
  expr: rate(read_replica_fallback_total[5m]) / rate(read_replica_queries_total[5m]) > 0.25
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High read replica fallback rate (>25%)"
    description: "Replica may be unhealthy or overloaded"

# Replica Unavailable
- alert: ReadReplicaUnavailable
  expr: rate(read_replica_queries_total{status="fallback"}[5m]) / rate(read_replica_queries_total[5m]) > 0.9
  for: 10m
  labels:
    severity: critical
  annotations:
    summary: "Read replica appears unavailable (>90% fallback)"
```

---

## Batch Operations Monitoring

### Metrics

#### 1. Batch Operation Volume
```promql
# Batch Operations per Second
rate(batch_operations_total[5m])

# Success Rate
rate(batch_operations_total{status="success"}[5m]) / 
rate(batch_operations_total[5m])
```

#### 2. Batch Size Distribution
```promql
# Average Batch Size
rate(batch_operation_size_sum[5m]) / 
rate(batch_operation_size_count[5m])

# P95 Batch Size
histogram_quantile(0.95, rate(batch_operation_size_bucket[5m]))
```

#### 3. Batch Duration
```promql
# P95 Duration by Operation
histogram_quantile(0.95, rate(batch_operation_duration_seconds_bucket{name="bulk-create-users"}[5m]))

# Duration per Operation (Efficiency)
rate(batch_operation_duration_seconds_sum[5m]) / 
rate(batch_operation_size_sum[5m])
```

### Grafana Panels

#### Panel 1: Batch Throughput
```json
{
  "title": "Batch Operations Throughput",
  "targets": [
    {
      "expr": "sum(rate(batch_operation_size_sum[5m]))",
      "legendFormat": "Operations/sec"
    }
  ],
  "type": "graph"
}
```

#### Panel 2: Batch Efficiency
```json
{
  "title": "Time per Operation (Lower is Better)",
  "targets": [
    {
      "expr": "rate(batch_operation_duration_seconds_sum[5m]) / rate(batch_operation_size_sum[5m])",
      "legendFormat": "{{name}}"
    }
  ],
  "type": "graph",
  "yAxis": { "format": "s" }
}
```

### Alerts

```yaml
# Batch Operation Failures
- alert: BatchOperationHighFailureRate
  expr: rate(batch_operations_total{status="failed"}[5m]) / rate(batch_operations_total[5m]) > 0.1
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "High batch operation failure rate (>10%)"

# Slow Batch Operations
- alert: BatchOperationSlow
  expr: histogram_quantile(0.95, rate(batch_operation_duration_seconds_bucket[5m])) > 10
  for: 5m
  labels:
    severity: warning
  annotations:
    summary: "Batch operations are slow (P95 > 10s)"
```

---

## Distributed Tracing Monitoring

### Metrics

#### 1. Traced Transaction Coverage
```promql
# Percentage of Transactions with Trace IDs
rate(traced_transactions_total{has_trace_id="true"}[5m]) / 
rate(traced_transactions_total[5m])
```

#### 2. Traced vs Untraced
```promql
# Traced Transactions
rate(traced_transactions_total{has_trace_id="true"}[5m])

# Untraced Transactions
rate(traced_transactions_total{has_trace_id="false"}[5m])
```

### Grafana Panels

#### Panel 1: Tracing Coverage
```json
{
  "title": "Distributed Tracing Coverage",
  "targets": [
    {
      "expr": "rate(traced_transactions_total{has_trace_id=\"true\"}[5m]) / rate(traced_transactions_total[5m])",
      "legendFormat": "Trace Coverage"
    }
  ],
  "type": "gauge",
  "thresholds": [
    { "value": 0, "color": "red" },
    { "value": 0.7, "color": "yellow" },
    { "value": 0.9, "color": "green" }
  ]
}
```

---

## Grafana Dashboards

### Dashboard 1: Advanced Features Overview

```json
{
  "title": "Advanced Features Overview",
  "panels": [
    {
      "title": "Circuit Breaker State",
      "gridPos": { "x": 0, "y": 0, "w": 6, "h": 4 }
    },
    {
      "title": "Read Replica Usage",
      "gridPos": { "x": 6, "y": 0, "w": 6, "h": 4 }
    },
    {
      "title": "Batch Throughput",
      "gridPos": { "x": 12, "y": 0, "w": 6, "h": 4 }
    },
    {
      "title": "Tracing Coverage",
      "gridPos": { "x": 18, "y": 0, "w": 6, "h": 4 }
    }
  ]
}
```

### Dashboard 2: Reliability Metrics

Focus on circuit breaker and error rates.

### Dashboard 3: Performance Metrics

Focus on read replica performance gains and batch operation efficiency.

---

## Quick Start

### 1. Check Metrics Endpoint

```bash
curl http://localhost:4000/metrics | grep circuit_breaker
curl http://localhost:4000/metrics | grep read_replica
curl http://localhost:4000/metrics | grep batch_operation
curl http://localhost:4000/metrics | grep traced_transactions
```

### 2. Import Grafana Dashboards

Use the JSON configurations provided above or import from `grafana-dashboards/` directory.

### 3. Configure Alerts

Add alert rules to Prometheus `alert.rules.yml` using examples from this guide.

### 4. Monitor Health

Use the `/health/circuit-breaker` endpoint for circuit breaker state:

```bash
curl http://localhost:4000/health/circuit-breaker
```

Response:
```json
{
  "state": "closed",
  "failureCount": 0,
  "successCount": 0,
  "healthy": true,
  "message": "Circuit breaker is operational"
}
```

---

## Best Practices

1. **Set Alert Thresholds**: Based on your SLAs and historical data
2. **Monitor Trends**: Use long-term graphs (24h, 7d) to spot patterns
3. **Correlate Metrics**: Compare circuit breaker state with error rates
4. **Regular Review**: Weekly review of dashboards to identify optimization opportunities
5. **Capacity Planning**: Use batch operation metrics to plan scaling

---

## Troubleshooting

### Circuit Breaker Frequently Opens
1. Check database health and connectivity
2. Review slow query logs
3. Increase connection pool size
4. Consider raising failure threshold if transient errors

### Read Replica High Fallback Rate
1. Verify replica connectivity
2. Check replica replication lag
3. Review replica resource usage (CPU, memory)
4. Ensure replica is in same region/AZ

### Batch Operations Slow
1. Reduce batch size
2. Add indexes for batch queries
3. Parallelize independent operations
4. Use bulk insert APIs when available

### Low Tracing Coverage
1. Ensure trace IDs are passed from API gateway
2. Check middleware configuration
3. Verify trace context propagation
