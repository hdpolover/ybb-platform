// services/api/test/integration/application-review-endpoints.spec.ts
//
// Task 7's reviewer could not verify the `applicationId_stage` compound-key
// Prisma query against a real database, because everything was unit-level
// with mocked Prisma. Closes that gap: runs the ApplicationReview compound
// key lookup/create/read-back against real Postgres. Follows the same
// DB-availability probe pattern as scoring-rubric-version-conflict.spec.ts so
// this skips cleanly on machines without a database rather than failing.
import { PrismaClient, ScoringStage, ReviewStatus } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';
import * as bcrypt from 'bcrypt';

dotenv.config();

// Same host translation used by src/scripts/*.ts and by the sibling
// scoring-rubric-version-conflict.spec.ts: DATABASE_URL points at the
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

// Probe synchronously before Jest collects `it` blocks so a missing local
// database skips this suite cleanly instead of failing CI/dev runs that
// never had docker-compose up.
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
    `[application-review-endpoints.spec.ts] No database reachable at ${connectionString.replace(/:[^:@]*@/, ':****@')}. ` +
      'Skipping the applicationId_stage compound-key probe instead of failing the run.',
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describeIfDbAvailable('ApplicationReview (applicationId, stage) compound key', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let brandId: string;
  let programId: string;
  let applicationId: string;
  let adminId: string;
  let schemaId: string;

  beforeAll(async () => {
    const brand = await prisma.brand.create({
      data: {
        name: `Review Endpoints Probe Brand ${runId}`,
        slug: `review-endpoints-probe-${runId}`,
      },
    });
    brandId = brand.id;

    const program = await prisma.program.create({
      data: {
        brandId,
        name: `Review Endpoints Probe Program ${runId}`,
        slug: `review-endpoints-probe-${runId}`,
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        applicationDeadline: new Date('2026-06-01'),
      },
    });
    programId = program.id;

    const adminUser = await prisma.user.create({
      data: {
        email: `review-endpoints-admin-${runId}@test.com`,
        passwordHash: await bcrypt.hash('pass123', 10),
        brandId,
        isActive: true,
        emailVerified: true,
      },
    });
    const admin = await prisma.admin.create({
      data: { userId: adminUser.id, fullName: 'Review Endpoints Probe Admin' },
    });
    adminId = admin.id;

    const participantUser = await prisma.user.create({
      data: {
        email: `review-endpoints-participant-${runId}@test.com`,
        passwordHash: await bcrypt.hash('pass123', 10),
        brandId,
        isActive: true,
        emailVerified: true,
      },
    });
    const participant = await prisma.participant.create({
      data: { userId: participantUser.id, fullName: 'Review Endpoints Probe Participant' },
    });

    const application = await prisma.participantApplication.create({
      data: { programId, participantId: participant.id },
    });
    applicationId = application.id;

    const schema = await prisma.scoringSchema.create({
      data: { programId, stage: ScoringStage.application, name: 'Probe Rubric', version: 1 },
    });
    schemaId = schema.id;
  });

  afterAll(async () => {
    await prisma.applicationScoreItem.deleteMany({ where: { review: { applicationId } } });
    await prisma.applicationReview.deleteMany({ where: { applicationId } });
    await prisma.scoringSchema.deleteMany({ where: { programId } });
    await prisma.participantApplication.deleteMany({ where: { programId } });
    await prisma.participant.deleteMany({ where: { user: { brandId } } });
    await prisma.admin.deleteMany({ where: { user: { brandId } } });
    await prisma.user.deleteMany({ where: { brandId } });
    await prisma.program.delete({ where: { id: programId } });
    await prisma.brand.delete({ where: { id: brandId } });
  });

  it('findUnique on the applicationId_stage compound key executes without error and returns null for an absent review', async () => {
    const found = await prisma.applicationReview.findUnique({
      where: { applicationId_stage: { applicationId, stage: ScoringStage.interview } },
    });

    expect(found).toBeNull();
  });

  it('creates a review and reads it back via the applicationId_stage compound key', async () => {
    const created = await prisma.applicationReview.create({
      data: {
        applicationId,
        schemaId,
        reviewerId: adminId,
        stage: ScoringStage.application,
        totalScore: 87.5,
        status: ReviewStatus.draft,
      },
    });

    const found = await prisma.applicationReview.findUnique({
      where: { applicationId_stage: { applicationId, stage: ScoringStage.application } },
    });

    expect(found).not.toBeNull();
    expect(found?.id).toBe(created.id);
    expect(found?.totalScore.toNumber()).toBe(87.5);
    expect(found?.status).toBe(ReviewStatus.draft);
  });
});
