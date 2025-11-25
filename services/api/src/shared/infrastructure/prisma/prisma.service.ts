import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

/**
 * Prisma Service
 * 
 * Infrastructure Layer - Database Connection
 * 
 * This service provides the Prisma Client to repositories.
 * It follows clean architecture by being in the infrastructure layer
 * and being injected into repositories through dependency injection.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });
  }

  /**
   * Connect to the database when the module initializes
   */
  async onModuleInit() {
    await this.$connect();
  }

  /**
   * Graceful shutdown hook for Nest.js
   * Ensures proper cleanup of database connections
   */
  async enableShutdownHooks(app: INestApplication) {
    // Handled by onModuleDestroy
  }

  /**
   * Disconnect when module is destroyed
   */
  async onModuleDestroy() {
    await this.$disconnect();
  }

  /**
   * Soft delete helper
   * Updates deletedAt instead of actually deleting the record
   */
  async softDelete<T>(
    model: any,
    where: any,
    deletedBy?: string,
  ): Promise<T> {
    return model.update({
      where,
      data: {
        deletedAt: new Date(),
        deletedBy,
      },
    });
  }

  /**
   * Restore soft deleted record
   */
  async restore<T>(model: any, where: any): Promise<T> {
    return model.update({
      where,
      data: {
        deletedAt: null,
        deletedBy: null,
      },
    });
  }

  /**
   * Check if record is soft deleted
   */
  isSoftDeleted(record: any): boolean {
    return record.deletedAt !== null;
  }

  /**
   * Get active records only (not soft deleted)
   */
  getActiveRecordsFilter() {
    return {
      deletedAt: null,
    };
  }
}
