// services/api/prisma/migrations/20260810120000_scoring_versioning_and_review_status/migration.spec.ts
// Integration test against the real dev database (see services/api npm run test:integration
// wiring). Asserts the migration actually reshaped the schema, not just that Prisma types compile.
import { PrismaClient } from '@prisma/client';
import { Pool, type PoolClient } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

// Same host translation used by src/scripts/*.ts: DATABASE_URL points at the
// docker-network hostname "postgres-api", which only resolves inside a
// container. Outside docker (e.g. this test run) it maps to the port
// published on localhost by docker-compose.yml.
function resolveConnectionString(): string {
  let connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

  const isDocker =
    process.env.IS_DOCKER === 'true' ||
    existsSync('/.dockerenv') ||
    (process.env.HOSTNAME && process.env.HOSTNAME.includes('ybb-api'));

  if (connectionString.includes('postgres-api') && !isDocker) {
    connectionString = connectionString.replace('postgres-api:5432', 'localhost:5438');
  }

  return connectionString;
}

const connectionString = resolveConnectionString();

// This suite needs a live Postgres holding the applied migration. That is
// not guaranteed everywhere `npm run test:integration` might run (a fresh
// checkout with no docker-compose up, a CI runner with no database service
// wired -- .github/workflows/deploy.yml currently has no test step and no
// database service). Rather than fail the whole run when unreachable, probe
// the connection synchronously before Jest collects any `it` blocks and
// skip the suite cleanly if nothing answers. A synchronous child process is
// used deliberately: Jest builds its test tree by calling describe/it
// bodies synchronously at collection time, so an async connectivity check
// cannot gate `describe.skip` vs `describe` the way this one does.
function isDatabaseReachable(target: string): boolean {
  const url = new URL(target);
  const host = url.hostname;
  const port = url.port || '5432';
  const probe = `
    const net = require('net');
    const socket = net.createConnection({ host: '${host}', port: ${port}, timeout: 2000 });
    socket.on('connect', () => { socket.end(); process.exit(0); });
    socket.on('error', () => process.exit(1));
    socket.on('timeout', () => { socket.destroy(); process.exit(1); });
  `;
  try {
    execSync(`node -e "${probe.replace(/"/g, '\\"')}"`, { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

const dbAvailable = isDatabaseReachable(connectionString);
const describeIfDbAvailable = dbAvailable ? describe : describe.skip;

if (!dbAvailable) {
  // eslint-disable-next-line no-console
  console.warn(
    `[migration.spec.ts] No database reachable at ${connectionString.replace(/:[^:@]*@/, ':****@')}. ` +
      'Skipping migration integration tests instead of failing the run.',
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describeIfDbAvailable('20260810120000_scoring_versioning_and_review_status', () => {
  it('adds version, created_by_id, pass_threshold to scoring_schemas with the documented defaults', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string; column_default: string | null }>
    >`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns
      WHERE table_name = 'scoring_schemas'
        AND column_name IN ('version', 'created_by_id', 'pass_threshold')
    `;
    const byName = Object.fromEntries(rows.map((r) => [r.column_name, r]));

    expect(byName.version).toBeDefined();
    expect(byName.version.column_default).toContain('1');

    expect(byName.created_by_id).toBeDefined();

    expect(byName.pass_threshold).toBeDefined();
    expect(byName.pass_threshold.data_type).toBe('numeric');
    expect(byName.pass_threshold.column_default).toContain('75');
  });

  it('backfills pass_threshold=75 for every row and assigns sequential versions per (program_id, stage)', async () => {
    const rows = await prisma.$queryRaw<
      Array<{ program_id: string; stage: string; version: number; pass_threshold: string }>
    >`
      SELECT program_id, stage, version, pass_threshold FROM scoring_schemas
      ORDER BY program_id, stage, version
    `;

    // pass_threshold is backfilled uniformly; version is ranked per group,
    // NOT blanket 1, because a (program_id, stage) pair can legitimately
    // have more than one row (e.g. one soft-deleted, one active) -- nothing
    // enforced uniqueness on that pair before this migration.
    for (const row of rows) {
      expect(Number(row.pass_threshold)).toBe(75);
      expect(Number.isInteger(row.version)).toBe(true);
      expect(row.version).toBeGreaterThanOrEqual(1);
    }

    const groups = new Map<string, number[]>();
    for (const row of rows) {
      const key = `${row.program_id}:${row.stage}`;
      const versions = groups.get(key) ?? [];
      versions.push(row.version);
      groups.set(key, versions);
    }
    for (const versions of groups.values()) {
      const sorted = [...versions].sort((a, b) => a - b);
      expect(sorted).toEqual(Array.from({ length: sorted.length }, (_, i) => i + 1));
    }
  });

  it('enforces uniqueness on (program_id, stage, version)', async () => {
    const newConstraint = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'scoring_schemas_program_id_stage_version_key'
    `;
    expect(newConstraint.length).toBe(1);
  });

  it('enforces at most one active, non-deleted schema per (program_id, stage)', async () => {
    const idx = await prisma.$queryRaw<Array<{ indexname: string }>>`
      SELECT indexname FROM pg_indexes
      WHERE tablename = 'scoring_schemas'
        AND indexname = 'scoring_schemas_one_active_per_program_stage_uidx'
    `;
    expect(idx.length).toBe(1);

    const rows = await prisma.$queryRaw<Array<{ program_id: string; stage: string; c: bigint }>>`
      SELECT program_id, stage, COUNT(*) AS c
      FROM scoring_schemas
      WHERE is_active AND deleted_at IS NULL
      GROUP BY program_id, stage
      HAVING COUNT(*) > 1
    `;
    expect(rows).toEqual([]);
  });

  it('converts application_reviews.status to the ReviewStatus enum, defaulting unrecognized values to draft', async () => {
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'ReviewStatus'
      ORDER BY enumlabel
    `;
    expect(enumValues.map((r) => r.enumlabel)).toEqual(['draft', 'submitted']);

    const columnType = await prisma.$queryRaw<Array<{ udt_name: string }>>`
      SELECT udt_name FROM information_schema.columns
      WHERE table_name = 'application_reviews' AND column_name = 'status'
    `;
    expect(columnType[0].udt_name).toBe('ReviewStatus');
  });

  it('the USING clause actually maps a stray/unrecognized status value to draft, not just the column type', async () => {
    // The real application_reviews table has already been cast by this
    // migration, so there is no way to feed it a pre-migration value
    // in place. Reproduce the pre-migration column shape in a scratch
    // table on a dedicated connection (TEMP TABLE is connection-scoped),
    // seed a value the migration never expected ('legacy_unexpected_value'
    // is neither 'draft' nor 'submitted'), then run the exact ALTER
    // COLUMN ... USING expression from the migration against it and
    // assert on the resulting data, not on the column's type.
    const client: PoolClient = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`
        CREATE TEMP TABLE "_migration_using_clause_check" (
          "status" VARCHAR(50) NOT NULL DEFAULT 'draft'
        ) ON COMMIT DROP
      `);
      await client.query(
        `INSERT INTO "_migration_using_clause_check" ("status") VALUES ($1), ($2), ($3)`,
        ['draft', 'submitted', 'legacy_unexpected_value'],
      );

      await client.query(`ALTER TABLE "_migration_using_clause_check" ALTER COLUMN "status" DROP DEFAULT`);
      await client.query(`
        ALTER TABLE "_migration_using_clause_check"
        ALTER COLUMN "status" TYPE "ReviewStatus"
        USING (
          CASE
            WHEN "status" IN ('draft', 'submitted') THEN "status"::"ReviewStatus"
            ELSE 'draft'::"ReviewStatus"
          END
        )
      `);

      const { rows } = await client.query<{ status: string }>(
        `SELECT "status" FROM "_migration_using_clause_check" ORDER BY "status"`,
      );

      // 'draft' stays 'draft', 'submitted' stays 'submitted', and the
      // stray value collapses to 'draft' -- so 'draft' now appears twice.
      expect(rows.map((r) => r.status).sort()).toEqual(['draft', 'draft', 'submitted']);

      await client.query('ROLLBACK');
    } catch (err) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  });

  it('adds finalist and not_selected to ScoreStatus', async () => {
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel FROM pg_enum
      JOIN pg_type ON pg_enum.enumtypid = pg_type.oid
      WHERE pg_type.typname = 'ScoreStatus'
      ORDER BY enumlabel
    `;
    expect(enumValues.map((r) => r.enumlabel)).toEqual(
      expect.arrayContaining(['finalist', 'not_selected']),
    );
  });

  it('adds stage, override_by_id, override_reason to application_reviews and enforces (application_id, stage) uniqueness', async () => {
    const columns = await prisma.$queryRaw<Array<{ column_name: string }>>`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'application_reviews'
        AND column_name IN ('stage', 'override_by_id', 'override_reason')
    `;
    expect(columns.map((c) => c.column_name).sort()).toEqual([
      'override_by_id',
      'override_reason',
      'stage',
    ]);

    const constraint = await prisma.$queryRaw<Array<{ conname: string }>>`
      SELECT conname FROM pg_constraint WHERE conname = 'application_reviews_application_id_stage_key'
    `;
    expect(constraint.length).toBe(1);
  });
});
