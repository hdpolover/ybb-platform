import { INestApplication, Injectable, Logger, OnModuleInit, Optional } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { MetricsService } from '../monitoring/metrics.service';

type PrismaServiceOptions = {
  connectionString?: string;
  poolEnvPrefix?: string;
  enablePoolMetrics?: boolean;
  clientRole?: 'primary' | 'replica' | 'primary_fallback';
};

// main.ts boots one HTTP Nest app + several RMQ consumer Nest apps in a single
// process (see createConsumerApp calls in main.ts), each with its own copy of
// the @Global PrismaModule. Without this registry every one of those DI
// containers would open its own pg.Pool against the same database. Keyed by
// connection string and refcounted so the underlying pool is only closed once
// the last PrismaService instance using it has shut down.
type PoolRegistryEntry = { pool: Pool; refCount: number };
const poolRegistry = new Map<string, PoolRegistryEntry>();

function acquirePool(
  connectionString: string,
  poolConfig: { max: number; min: number; idleTimeoutMillis: number; connectionTimeoutMillis: number },
): { pool: Pool; reused: boolean } {
  const existing = poolRegistry.get(connectionString);
  if (existing) {
    existing.refCount += 1;
    return { pool: existing.pool, reused: true };
  }

  const pool = new Pool({
    connectionString,
    max: poolConfig.max,
    min: poolConfig.min,
    idleTimeoutMillis: poolConfig.idleTimeoutMillis,
    connectionTimeoutMillis: poolConfig.connectionTimeoutMillis,
  });
  poolRegistry.set(connectionString, { pool, refCount: 1 });
  return { pool, reused: false };
}

function releasePool(connectionString: string): void {
  const entry = poolRegistry.get(connectionString);
  if (!entry) return;

  entry.refCount -= 1;
  if (entry.refCount <= 0) {
    poolRegistry.delete(connectionString);
    // The pg.Pool was handed to Prisma as an "external pool", which Prisma's
    // adapter never closes on $disconnect() (it assumes the caller owns the
    // pool's lifecycle) — so ending it here is the only thing that actually
    // releases these TCP connections.
    void entry.pool.end().catch(() => {});
  }
}

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
  private readonly logger = new Logger(PrismaService.name);
  private readonly pool: Pool;
  private readonly poolConfig: {
    max: number;
    min: number;
    idleTimeoutMillis: number;
    connectionTimeoutMillis: number;
  };
  private readonly slowQueryThresholdMs: number;
  private readonly enablePoolMetrics: boolean;
  private readonly clientRole: 'primary' | 'replica' | 'primary_fallback';
  private readonly connectionStringKey: string;
  private readonly poolReused: boolean;
  private poolMetricsInterval?: NodeJS.Timeout;

  constructor(
    private readonly metricsService: MetricsService,
    @Optional() options: PrismaServiceOptions = {},
  ) {
    const poolEnvPrefix = options.poolEnvPrefix?.trim() || 'DATABASE';
    const connectionString = options.connectionString || process.env.DATABASE_URL;
    const poolMax = parseNumberEnv(`${poolEnvPrefix}_POOL_MAX`, parseNumberEnv('DATABASE_POOL_MAX', 20));
    const poolMin = parseNumberEnv(`${poolEnvPrefix}_POOL_MIN`, parseNumberEnv('DATABASE_POOL_MIN', 2));
    const poolIdleTimeoutMs = parseNumberEnv(
      `${poolEnvPrefix}_POOL_IDLE_TIMEOUT_MS`,
      parseNumberEnv('DATABASE_POOL_IDLE_TIMEOUT_MS', 30_000),
    );
    const poolConnectionTimeoutMs = parseNumberEnv(
      `${poolEnvPrefix}_POOL_CONNECTION_TIMEOUT_MS`,
      parseNumberEnv('DATABASE_POOL_CONNECTION_TIMEOUT_MS', 10_000),
    );

    const poolConfig = {
      max: poolMax,
      min: Math.min(poolMin, poolMax),
      idleTimeoutMillis: poolIdleTimeoutMs,
      connectionTimeoutMillis: poolConnectionTimeoutMs,
    };

    const connectionStringKey = connectionString ?? '';
    const { pool, reused } = acquirePool(connectionStringKey, poolConfig);
    const adapter = new PrismaPg(pool);

    super({
      adapter,
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'info', 'warn', 'error']
        : ['error'],
    });

    this.pool = pool;
    this.poolConfig = poolConfig;
    this.slowQueryThresholdMs = parseNumberEnv('PRISMA_SLOW_QUERY_MS', 250);
    this.enablePoolMetrics = options.enablePoolMetrics ?? true;
    this.clientRole = options.clientRole ?? 'primary';
    this.connectionStringKey = connectionStringKey;
    this.poolReused = reused;
  }


  /**
   * Connect to the database when the module initializes
   */
  async onModuleInit() {
    await this.$connect();

    this.logger.log(
      `Prisma pool ${this.poolReused ? 'reused' : 'configured'} (role=${this.clientRole}, max=${this.poolConfig.max}, min=${this.poolConfig.min}, idleTimeoutMs=${this.poolConfig.idleTimeoutMillis}, connectionTimeoutMs=${this.poolConfig.connectionTimeoutMillis}, slowQueryMs=${this.slowQueryThresholdMs})`,
    );

    if (this.enablePoolMetrics) {
      // Monitoring: update pool gauges every 5s
      this.poolMetricsInterval = setInterval(() => {
        this.metricsService.updatePrismaPoolStats(this.pool.totalCount, this.pool.idleCount, this.pool.waitingCount);
      }, 5000);
      this.poolMetricsInterval.unref();
      this.metricsService.updatePrismaPoolStats(this.pool.totalCount, this.pool.idleCount, this.pool.waitingCount);
    }

    const metricsService = this.metricsService;
    const logger = this.logger;
    const slowQueryThresholdMs = this.slowQueryThresholdMs;

    // Use Prisma Extensions for Soft Delete since middleware ($use) is deprecated/removed in v7
    // Chain extensions: Monitoring (Inner) -> Soft Delete (Outer)
    const extendedClient = this
      .$extends({
        query: {
          $allModels: {
            async $allOperations({ model, operation, args, query }) {
              const metricModel = model || 'raw';
              const start = Date.now();
              try {
                const result = await query(args);
                const durationMs = Date.now() - start;
                const isSlow = durationMs >= slowQueryThresholdMs;
                metricsService.recordPrismaQuery(metricModel, operation, durationMs / 1000, isSlow);
                if (isSlow) {
                  logger.warn(
                    `Slow Prisma query detected (model=${metricModel}, operation=${operation}, durationMs=${durationMs})`,
                  );
                }

                return result;
              } catch (error) {
                const durationMs = Date.now() - start;
                const isSlow = durationMs >= slowQueryThresholdMs;
                metricsService.recordPrismaQuery(metricModel, operation, durationMs / 1000, isSlow);
                if (isSlow) {
                  logger.warn(
                    `Slow Prisma query failed (model=${metricModel}, operation=${operation}, durationMs=${durationMs})`,
                  );
                }
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
              applyNestedDeletedAtFilter(model, args);
              if (modelHasDeletedAt(model)) {
                const where = args.where || {};
                const newWhere: Record<string, unknown> = { deletedAt: null };

                // Flatten compound unique keys for findFirst compatibility
                // findUnique({ where: { compound_key: { a: 1, b: 2 } } }) -> findFirst({ where: { a: 1, b: 2, deletedAt: null } })
                for (const key of Object.keys(where)) {
                  const value = where[key];
                  if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
                    Object.assign(newWhere, value);
                  } else {
                    newWhere[key] = value;
                  }
                }

                return (extendedClient as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>)[toCamelCase(model)].findFirst({
                  ...args,
                  where: newWhere,
                });
              }
              return query(args);
            },
            async findFirst({ model, operation, args, query }) {
              applyNestedDeletedAtFilter(model, args);
              if (modelHasDeletedAt(model)) {
                args.where = { deletedAt: null, ...args.where };
              }
              return query(args);
            },
            async findMany({ model, operation, args, query }) {
              applyNestedDeletedAtFilter(model, args);
              if (modelHasDeletedAt(model)) {
                const safeWhere = args.where as Record<string, unknown>;
                if (safeWhere?.deletedAt === undefined) {
                  args.where = { deletedAt: null, ...(args.where as Record<string, unknown>) };
                }
              }
              return query(args);
            },
            async delete({ model, operation, args, query }) {
              if (modelHasDeletedAt(model)) {
                return (extendedClient as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>)[toCamelCase(model)].update({
                  ...args,
                  data: { deletedAt: new Date() },
                });
              }
              return query(args);
            },
            async deleteMany({ model, operation, args, query }) {
              if (modelHasDeletedAt(model)) {
                return (extendedClient as unknown as Record<string, Record<string, (...args: unknown[]) => unknown>>)[toCamelCase(model)].updateMany({
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
        get: () => (extendedClient as Record<string, unknown>)[camelCaseName],
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
    if (this.poolMetricsInterval) {
      clearInterval(this.poolMetricsInterval);
    }
    await this.$disconnect();
    releasePool(this.connectionStringKey);
  }

  /**
   * Soft delete helper
   * Updates deletedAt instead of actually deleting the record
   */
  async softDelete<T>(
    model: { update: (args: { where: object; data: object }) => Promise<T> },
    where: object,
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
  async restore<T>(model: { update: (args: { where: object; data: object }) => Promise<T> }, where: object): Promise<T> {
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
  isSoftDeleted(record: Record<string, unknown>): boolean {
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

type RelationField = { type: string; isList: boolean };
const relationFieldCache = new Map<string, Map<string, RelationField>>();
function getRelationFields(modelName: string): Map<string, RelationField> {
  const cached = relationFieldCache.get(modelName);
  if (cached) return cached;
  const model = Prisma.dmmf.datamodel.models.find((m) => m.name === modelName);
  const map = new Map<string, RelationField>();
  if (model) {
    for (const field of model.fields) {
      if (field.kind === 'object' && typeof field.type === 'string') {
        map.set(field.name, { type: field.type, isList: field.isList });
      }
    }
  }
  relationFieldCache.set(modelName, map);
  return map;
}

// Recursively walk an `include` or `select` argument and inject `deletedAt: null`
// into the `where` of any nested to-many relation that targets a soft-deletable
// model. To-one relations are skipped because Prisma rejects `where` on singular
// relation includes. Caller-explicit `where.deletedAt` is preserved.
function applyDeletedAtToIncludes(parentModel: string, includeOrSelect: unknown): unknown {
  if (!includeOrSelect || typeof includeOrSelect !== 'object' || Array.isArray(includeOrSelect)) {
    return includeOrSelect;
  }
  const relationFields = getRelationFields(parentModel);
  if (relationFields.size === 0) return includeOrSelect;

  const source = includeOrSelect as Record<string, unknown>;
  const result: Record<string, unknown> = { ...source };

  for (const [key, value] of Object.entries(source)) {
    const relation = relationFields.get(key);
    if (!relation) continue;
    const filterable = relation.isList && modelHasDeletedAt(relation.type);

    if (value === true) {
      if (filterable) {
        result[key] = { where: { deletedAt: null } };
      }
      continue;
    }

    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const config = { ...(value as Record<string, unknown>) };
      if (filterable) {
        const where = (config.where as Record<string, unknown> | undefined) ?? {};
        if (where.deletedAt === undefined) {
          config.where = { deletedAt: null, ...where };
        }
      }
      if (config.include) {
        config.include = applyDeletedAtToIncludes(relation.type, config.include);
      }
      if (config.select) {
        config.select = applyDeletedAtToIncludes(relation.type, config.select);
      }
      result[key] = config;
    }
  }
  return result;
}

function applyNestedDeletedAtFilter(
  modelName: string,
  args: { include?: unknown; select?: unknown },
) {
  if (args.include) {
    args.include = applyDeletedAtToIncludes(modelName, args.include);
  }
  if (args.select) {
    args.select = applyDeletedAtToIncludes(modelName, args.select);
  }
}

function parseNumberEnv(key: string, defaultValue: number): number {
  const raw = process.env[key];
  if (!raw) return defaultValue;

  const parsed = Number(raw);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return Math.floor(parsed);
}
