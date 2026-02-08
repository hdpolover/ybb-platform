import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MetricsService } from '../monitoring/metrics.service';

/**
 * Transaction Service
 * 
 * Infrastructure Layer - Transaction Management
 * 
 * Provides a centralized way to execute database transactions with:
 * - Automatic error handling
 * - Performance monitoring
 * - Consistent logging
 * - Timeout configuration
 */
@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
  ) {}

  /**
   * Execute a transaction with monitoring and error handling
   * 
   * @param callback - The transaction operations to execute
   * @param options - Transaction configuration
   * @returns Promise with the transaction result
   * 
   * @example
   * ```typescript
   * const result = await this.transactionService.execute(
   *   async (tx) => {
   *     const user = await tx.user.create({ data: {...} });
   *     const participant = await tx.participant.create({ data: {...} });
   *     return { user, participant };
   *   },
   *   { 
   *     name: 'create-user-with-profile',
   *     timeout: 10000 
   *   }
   * );
   * ```
   */
  async execute<T>(
    callback: (tx: any) => Promise<T>,
    options?: {
      name?: string;
      timeout?: number;
      maxWait?: number;
    },
  ): Promise<T> {
    const transactionName = options?.name || 'unnamed';
    const startTime = Date.now();

    // Start metrics timer
    const timer = this.metrics.prismaQueryDuration.startTimer({
      operation: 'transaction',
      model: transactionName,
    });

    try {
      this.logger.debug(`Starting transaction: ${transactionName}`);

      const result = await this.prisma.$transaction(callback, {
        maxWait: options?.maxWait || 5000, // 5 seconds default
        timeout: options?.timeout || 10000, // 10 seconds default
      });

      const duration = Date.now() - startTime;
      this.logger.debug(`Transaction completed: ${transactionName} (${duration}ms)`);

      // Record success metric
      this.metrics.prismaQueryTotal.inc({
        operation: 'transaction',
        model: transactionName,
        status: 'success',
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(
        `Transaction failed: ${transactionName} (${duration}ms)`,
        error.stack,
      );

      // Record failure metric
      this.metrics.prismaQueryTotal.inc({
        operation: 'transaction',
        model: transactionName,
        status: 'error',
      });

      // Re-throw for handler to catch
      throw error;
    } finally {
      timer();
    }
  }

  /**
   * Execute a transaction with automatic retry on failure
   * 
   * Useful for handling deadlocks or transient failures
   * 
   * @param callback - The transaction operations to execute
   * @param options - Transaction and retry configuration
   * @returns Promise with the transaction result
   * 
   * @example
   * ```typescript
   * const result = await this.transactionService.executeWithRetry(
   *   async (tx) => {
   *     return await tx.user.update({ where: { id }, data: {...} });
   *   },
   *   { 
   *     name: 'update-user',
   *     maxRetries: 3,
   *     retryDelay: 100
   *   }
   * );
   * ```
   */
  async executeWithRetry<T>(
    callback: (tx: any) => Promise<T>,
    options?: {
      name?: string;
      timeout?: number;
      maxWait?: number;
      maxRetries?: number;
      retryDelay?: number;
    },
  ): Promise<T> {
    const maxRetries = options?.maxRetries || 3;
    const retryDelay = options?.retryDelay || 100;
    let lastError: any;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.execute(callback, {
          name: `${options?.name || 'retry-transaction'} [attempt ${attempt}]`,
          timeout: options?.timeout,
          maxWait: options?.maxWait,
        });
      } catch (error) {
        lastError = error;

        // Check if error is retryable (deadlock, timeout, etc.)
        const isRetryable = this.isRetryableError(error);

        if (!isRetryable || attempt === maxRetries) {
          throw error;
        }

        this.logger.warn(
          `Transaction failed (attempt ${attempt}/${maxRetries}), retrying in ${retryDelay}ms...`,
        );

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, retryDelay * attempt));
      }
    }

    throw lastError;
  }

  /**
   * Check if a database error is retryable
   * 
   * Common retryable errors:
   * - Deadlock detected
   * - Lock wait timeout
   * - Connection issues
   */
  private isRetryableError(error: any): boolean {
    const errorCode = error?.code;
    const errorMessage = error?.message?.toLowerCase() || '';

    // PostgreSQL error codes
    const retryableCodes = [
      'P2034', // Transaction conflict
      '40001', // Serialization failure
      '40P01', // Deadlock detected
    ];

    return (
      retryableCodes.includes(errorCode) ||
      errorMessage.includes('deadlock') ||
      errorMessage.includes('timeout') ||
      errorMessage.includes('connection')
    );
  }
}
