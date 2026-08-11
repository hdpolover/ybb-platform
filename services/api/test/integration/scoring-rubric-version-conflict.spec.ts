// services/api/test/integration/scoring-rubric-version-conflict.spec.ts
// Integration test against the real dev database. Provokes an actual
// Postgres unique-constraint violation on ScoringSchema's
// @@unique([programId, stage, version]) and asserts on the REAL shape of
// Prisma.PrismaClientKnownRequestError.meta.target, rather than trusting the
// hand-built fixture in upsert-scoring-rubric.handler.spec.ts. That unit spec
// proves the handler's isVersionConflict() branches correctly against
// whatever meta.target it is fed; this spec proves what Prisma+Postgres
// actually feed it, so the two can be compared and a mismatch caught.
import { PrismaClient, ScoringStage } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import { isVersionConflict } from '../../src/modules/programs/application/commands/handlers/upsert-scoring-rubric.handler';

dotenv.config();

// Same host translation used by src/scripts/*.ts and by the sibling
// migration.spec.ts: DATABASE_URL points at the docker-network hostname
// "postgres-api", which only resolves inside a container. Outside docker
// (e.g. this test run) it maps to the port published on localhost by
// docker-compose.yml.
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

// See prisma/migrations/20260810120000_.../migration.spec.ts for the full
// rationale: probe synchronously before Jest collects `it` blocks so a
// missing local database skips this suite cleanly instead of failing CI/dev
// runs that never had docker-compose up.
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
   
  console.warn(
    `[scoring-rubric-version-conflict.spec.ts] No database reachable at ${connectionString.replace(/:[^:@]*@/, ':****@')}. ` +
      'Skipping the P2002 shape probe instead of failing the run.',
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describeIfDbAvailable('ScoringSchema (programId, stage, version) unique constraint', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let brandId: string;
  let programId: string;

  beforeAll(async () => {
    const brand = await prisma.brand.create({
      data: {
        name: `Version Conflict Probe Brand ${runId}`,
        slug: `version-conflict-probe-${runId}`,
      },
    });
    brandId = brand.id;

    const program = await prisma.program.create({
      data: {
        brandId,
        name: `Version Conflict Probe Program ${runId}`,
        slug: `version-conflict-probe-${runId}`,
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        applicationDeadline: new Date('2026-06-01'),
      },
    });
    programId = program.id;
  });

  afterAll(async () => {
    await prisma.scoringSchema.deleteMany({ where: { programId } });
    await prisma.program.delete({ where: { id: programId } });
    await prisma.brand.delete({ where: { id: brandId } });
  });

  it('rejects a second insert at the same (programId, stage, version) with a real P2002, and isVersionConflict() recognizes it', async () => {
    await prisma.scoringSchema.create({
      data: { programId, stage: ScoringStage.application, name: 'First mint', version: 1 },
    });

    let observedError: unknown;
    try {
      await prisma.scoringSchema.create({
        data: { programId, stage: ScoringStage.application, name: 'Racing mint', version: 1 },
      });
      fail('expected the duplicate (programId, stage, version) insert to throw P2002');
    } catch (error) {
      observedError = error;
    }

    // Documents the ACTUAL runtime shape, observed against Prisma 7.3.0 +
    // @prisma/adapter-pg + Postgres: meta is `{}` (target is undefined
    // entirely, not an empty array or empty string), and the field names
    // only appear as backtick-quoted snake_case DB columns inside
    // error.message, e.g. "(`program_id`, `stage`, `version`)". This is why
    // isVersionConflict() cannot rely on meta.target alone -- see its
    // targetFieldsOf() fallback to message-parsing.
     
    console.log(
      '[scoring-rubric-version-conflict] observed error.meta:',
      JSON.stringify((observedError as { meta?: unknown })?.meta),
      '| error.message:',
      (observedError as { message?: string })?.message?.trim(),
    );

    expect((observedError as { code?: string })?.code).toBe('P2002');
    // This is the assertion that actually matters: the handler's own
    // isVersionConflict() -- the exact function used in production, not a
    // reimplementation of it -- must recognize this real error as a version
    // race. If Prisma's real meta.target shape (array vs string, camelCase
    // vs snake_case field names) ever diverges from what
    // VERSION_UNIQUE_CONSTRAINT_FIELDS expects, this fails here instead of
    // silently degrading every real version race into an unhandled 500.
    expect(isVersionConflict(observedError)).toBe(true);
  });

  it('does NOT treat a P2002 on a different constraint (legacyId) as a version conflict', async () => {
    const first = await prisma.scoringSchema.create({
      data: {
        programId,
        stage: ScoringStage.interview,
        name: 'Legacy-id holder',
        version: 1,
        legacyId: 999_990_001,
      },
    });

    let observedError: unknown;
    try {
      await prisma.scoringSchema.create({
        data: {
          programId,
          stage: ScoringStage.interview,
          name: 'Legacy-id collider',
          version: 2,
          legacyId: 999_990_001,
        },
      });
      fail('expected the duplicate legacyId insert to throw P2002');
    } catch (error) {
      observedError = error;
    }

     
    console.log(
      '[scoring-rubric-version-conflict] observed legacyId-collision error.meta:',
      JSON.stringify((observedError as { meta?: unknown })?.meta),
      '| error.message:',
      (observedError as { message?: string })?.message?.trim(),
    );

    expect((observedError as { code?: string })?.code).toBe('P2002');
    expect(isVersionConflict(observedError)).toBe(false);

    await prisma.scoringSchema.delete({ where: { id: first.id } });
  });
});
