import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { UnitOfWork } from '@shared/infrastructure/database/unit-of-work.service';

/**
 * Health Check Controller
 * 
 * Provides health and status endpoints for monitoring and observability.
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly unitOfWork: UnitOfWork) {}

  /**
   * Basic health check endpoint
   * 
   * @returns Health status
   */
  @Get()
  @ApiOperation({ summary: 'Basic health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  async healthCheck() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  }

  /**
   * Circuit breaker status endpoint
   * 
   * Monitors the database circuit breaker state for alerting.
   * 
   * States:
   * - closed: Normal operation
   * - open: Too many failures, rejecting requests
   * - half_open: Testing if database has recovered
   * 
   * @returns Circuit breaker state and counters
   */
  @Get('circuit-breaker')
  @ApiOperation({ summary: 'Get circuit breaker status' })
  @ApiResponse({ 
    status: 200, 
    description: 'Circuit breaker state',
    schema: {
      example: {
        state: 'closed',
        failureCount: 0,
        successCount: 0,
        healthy: true,
        message: 'Database operations are functioning normally'
      }
    }
  })
  async getCircuitBreakerState() {
    const { state, failureCount, successCount } = this.unitOfWork.getCircuitState();
    
    const stateMessages = {
      closed: 'Database operations are functioning normally',
      open: 'Circuit breaker is OPEN - database operations are being rejected due to failures',
      half_open: 'Circuit breaker is testing recovery - monitoring database health',
    };

    return {
      state,
      failureCount,
      successCount,
      healthy: state === 'closed',
      message: stateMessages[state],
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Detailed health check with all subsystems
   * 
   * @returns Comprehensive health status
   */
  @Get('detailed')
  @ApiOperation({ summary: 'Detailed health check with subsystem status' })
  @ApiResponse({ status: 200, description: 'Detailed health information' })
  async detailedHealthCheck() {
    const circuitState = this.unitOfWork.getCircuitState();

    return {
      status: circuitState.state === 'closed' ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      subsystems: {
        database: {
          status: circuitState.state === 'closed' ? 'healthy' : 'unhealthy',
          circuitBreaker: circuitState,
        },
        api: {
          status: 'healthy',
          version: process.env.npm_package_version || '1.0.0',
        },
      },
    };
  }
}
