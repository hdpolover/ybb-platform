import { INestApplication, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

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
    const connectionString = process.env.DATABASE_URL;
    const pool = new Pool({ connectionString });
    const adapter = new PrismaPg(pool);

    super({
      adapter,
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

    // Use Prisma Extensions for Soft Delete since middleware ($use) is deprecated/removed in v7
    const extendedClient = this.$extends({
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
    // This allows existing code using `this.user` to get the soft-delete behavior
    const models = Prisma.dmmf.datamodel.models;
    for (const model of models) {
      if (modelHasDeletedAt(model.name)) {
        const camelCaseName = toCamelCase(model.name);
        Object.defineProperty(this, camelCaseName, {
          get: () => (extendedClient as any)[camelCaseName],
          configurable: true,
        });
      }
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
