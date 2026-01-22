import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { MetricsService } from '../monitoring/metrics.service';

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
  private readonly pool: Pool;

  constructor(private readonly metricsService: MetricsService) {
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: process.env.NODE_ENV === 'development' 
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });

    this.pool = pool;
  }


  /**
   * Connect to the database when the module initializes
   */
  async onModuleInit() {
    await this.$connect();

    // Monitoring: Update pool size every 5 seconds
    setInterval(() => {
      this.metricsService.prismaPoolConnectionsOpen.set(this.pool.totalCount);
    }, 5000);

    const metricsService = this.metricsService;

    // Use Prisma Extensions for Soft Delete since middleware ($use) is deprecated/removed in v7
    // Chain extensions: Monitoring (Inner) -> Soft Delete (Outer)
    const extendedClient = this
      .$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              const start = Date.now();
              try {
                const result = await query(args);
                const duration = (Date.now() - start) / 1000;
                
                metricsService.prismaQueryDuration.observe({ model, operation }, duration);
                metricsService.prismaQueryTotal.inc({ model, operation });

                return result;
              } catch (error) {
                const duration = (Date.now() - start) / 1000;
                metricsService.prismaQueryDuration.observe({ model, operation }, duration);
                metricsService.prismaQueryTotal.inc({ model, operation });
                throw error;
              }
            },
          },
        },
      })
      .$extends({
      query: {
        $allModels: {
          async findUnique({ model, operation, args, query }) {
            if (modelHasDeletedAt(model)) {
              // Change to findFirst to support deletedAt filter
              // We need to cast the operation to findFirst and ensure args are compatible
              return (extendedClient as any)[toCamelCase(model)].findFirst({
                ...args,
                where: { ...args.where, deletedAt: null },
              });
            }
            return query(args);
          },
          async findFirst({ model, operation, args, query }) {
            if (modelHasDeletedAt(model)) {
              args.where = { deletedAt: null, ...args.where };
            }
            return query(args);
          },
          async findMany({ model, operation, args, query }) {
            if (modelHasDeletedAt(model)) {
              const safeWhere = args.where as any;
              if (safeWhere?.deletedAt === undefined) {
                args.where = { deletedAt: null, ...(args.where as any) };
              }
            }
            return query(args);
          },
          async delete({ model, operation, args, query }) {
            if (modelHasDeletedAt(model)) {
              return (extendedClient as any)[toCamelCase(model)].update({
                ...args,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
          },
          async deleteMany({ model, operation, args, query }) {
            if (modelHasDeletedAt(model)) {
              return (extendedClient as any)[toCamelCase(model)].updateMany({
                ...args,
                data: { deletedAt: new Date() },
              });
            }
            return query(args);
          },
        },
      },
    });

    // Patch the current instance to use the extended client methods
    // We patch ALL models to ensure monitoring logic applies to everything
    // Not just soft-delete models
    const models = Prisma.dmmf.datamodel.models;
    for (const model of models) {
      // Always patch the model to use the extended client (which includes monitoring)
      const camelCaseName = toCamelCase(model.name);
      Object.defineProperty(this, camelCaseName, {
        get: () => (extendedClient as any)[camelCaseName],
        configurable: true,
      });
    }
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
    return record?.deletedAt !== null;
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

// Helpers
function toCamelCase(str: string) {
  return str.charAt(0).toLowerCase() + str.slice(1);
}

function modelHasDeletedAt(modelName: string) {
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  return model?.fields.some((f) => f.name === 'deletedAt') ?? false;
}
