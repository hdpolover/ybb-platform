// services/api/test/integration/scoring-schema-created-by-admin-fk.spec.ts
//
// Regression test for the production outage where SuperAdmins could not save
// a scoring rubric: ScoringSchema.createdById (and ApplicationReview.reviewerId
// / .overrideById) are foreign keys to admins(id), but the controllers were
// passing user.userId (users.id) -- a different row related only via
// admins.user_id. Prisma mocks in every other spec hide this entirely because
// they never touch a real foreign key constraint. This spec runs against a
// real Postgres database so the FK is actually enforced, the same way
// scoring-rubric-version-conflict.spec.ts proves the real P2002 shape rather
// than a hand-built fixture.
import { PrismaClient, ScoringStage } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

// Same host translation used by scoring-rubric-version-conflict.spec.ts and
// src/scripts/*.ts: DATABASE_URL points at the docker-network hostname
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

// Probe synchronously before Jest collects `it` blocks so a missing local
// database skips this suite cleanly instead of failing CI/dev runs that
// never had docker-compose up. Same pattern as
// scoring-rubric-version-conflict.spec.ts.
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
    `[scoring-schema-created-by-admin-fk.spec.ts] No database reachable at ${connectionString.replace(/:[^:@]*@/, ':****@')}. ` +
      'Skipping the createdById FK probe instead of failing the run.',
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describeIfDbAvailable('ScoringSchema.createdById foreign key to admins(id)', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let brandId: string;
  let programId: string;
  let plainUserId: string; // users.id with NO admin profile
  let adminId: string; // admins.id, the correct FK target

  beforeAll(async () => {
    const brand = await prisma.brand.create({
      data: {
        name: `CreatedBy FK Probe Brand ${runId}`,
        slug: `created-by-fk-probe-${runId}`,
      },
    });
    brandId = brand.id;

    const program = await prisma.program.create({
      data: {
        brandId,
        name: `CreatedBy FK Probe Program ${runId}`,
        slug: `created-by-fk-probe-${runId}`,
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        applicationDeadline: new Date('2026-06-01'),
      },
    });
    programId = program.id;

    // A plain participant-style user: a users.id that does NOT have a
    // corresponding admins row. This is the exact shape of the bug: a JWT's
    // userId is always a users.id, but ScoringSchema.createdById needs an
    // admins.id, and those are not interchangeable.
    const plainUser = await prisma.user.create({
      data: {
        email: `plain-user-${runId}@example.test`,
        brandId,
        passwordHash: 'not-a-real-hash',
      },
    });
    plainUserId = plainUser.id;

    // A real admin: a users row plus its linked admins row, exactly the
    // relationship admins.user_id -> users.id describes.
    const adminUser = await prisma.user.create({
      data: {
        email: `admin-user-${runId}@example.test`,
        brandId,
        passwordHash: 'not-a-real-hash',
      },
    });
    const admin = await prisma.admin.create({
      data: {
        userId: adminUser.id,
        fullName: `Admin Probe ${runId}`,
      },
    });
    adminId = admin.id;
  });

  afterAll(async () => {
    await prisma.scoringSchema.deleteMany({ where: { programId } });
    await prisma.admin.deleteMany({ where: { id: adminId } });
    await prisma.user.deleteMany({ where: { brandId } });
    await prisma.program.delete({ where: { id: programId } });
    await prisma.brand.delete({ where: { id: brandId } });
  });

  it('succeeds when createdById references a real admins.id', async () => {
    const schema = await prisma.scoringSchema.create({
      data: {
        programId,
        stage: ScoringStage.application,
        name: 'Valid admin-authored rubric',
        version: 1,
        createdById: adminId,
      },
    });

    expect(schema.createdById).toBe(adminId);
  });

  it('raises a foreign key violation when createdById is a users.id instead of an admins.id', async () => {
    // This is the exact production failure: the controller passed
    // user.userId (a users.id) into a column that is a foreign key to
    // admins(id). plainUserId is a real row in users, just not in admins,
    // so this proves the constraint rejects it rather than silently
    // succeeding against the wrong table.
    let observedError: unknown;
    try {
      await prisma.scoringSchema.create({
        data: {
          programId,
          stage: ScoringStage.interview,
          name: 'Rubric wrongly attributed to a users.id',
          version: 1,
          createdById: plainUserId,
        },
      });
      fail('expected creating a ScoringSchema with a users.id as createdById to throw a FK violation');
    } catch (error) {
      observedError = error;
    }

    expect((observedError as { code?: string })?.code).toBe('P2003');
    expect((observedError as { message?: string })?.message).toContain(
      'scoring_schemas_created_by_id_fkey',
    );
  });
});
