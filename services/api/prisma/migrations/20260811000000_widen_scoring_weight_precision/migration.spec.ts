// services/api/prisma/migrations/20260811000000_widen_scoring_weight_precision/migration.spec.ts
// Integration test against the real dev database (see services/api npm run test:integration
// wiring). Proves the widened DECIMAL(9,6) columns actually round-trip a four-decimal
// fraction, which is the whole point of this migration -- the old DECIMAL(5,2) columns
// silently truncated 0.3333 down to 0.33 on write.
import { PrismaClient, ScoringStage } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import { execSync } from 'child_process';
import * as dotenv from 'dotenv';

dotenv.config();

// Same host translation used elsewhere in this migrations folder: DATABASE_URL points at
// the docker-network hostname "postgres-api", which only resolves inside a container.
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

// Probe synchronously before Jest collects `it` blocks so a missing local database skips
// this suite cleanly instead of failing runs that never had docker-compose up.
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
    `[widen-scoring-weight-precision migration.spec.ts] No database reachable at ${connectionString.replace(/:[^:@]*@/, ':****@')}. ` +
      'Skipping instead of failing the run.',
  );
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

afterAll(async () => {
  await prisma.$disconnect();
  await pool.end();
});

describeIfDbAvailable('scoring_categories.weight / scoring_criteria.weight precision', () => {
  const runId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  let brandId: string;
  let programId: string;
  let schemaId: string;

  beforeAll(async () => {
    const brand = await prisma.brand.create({
      data: {
        name: `Weight Precision Probe Brand ${runId}`,
        slug: `weight-precision-probe-${runId}`,
      },
    });
    brandId = brand.id;

    const program = await prisma.program.create({
      data: {
        brandId,
        name: `Weight Precision Probe Program ${runId}`,
        slug: `weight-precision-probe-${runId}`,
        year: 2026,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2026-12-31'),
        applicationDeadline: new Date('2026-06-01'),
      },
    });
    programId = program.id;

    const schema = await prisma.scoringSchema.create({
      data: { programId, stage: ScoringStage.application, name: 'Precision probe', version: 1 },
    });
    schemaId = schema.id;
  });

  afterAll(async () => {
    await prisma.scoringSchema.deleteMany({ where: { programId } });
    await prisma.program.delete({ where: { id: programId } });
    await prisma.brand.delete({ where: { id: brandId } });
  });

  it('round-trips a four-decimal category weight fraction without truncation', async () => {
    // The exact scenario from the bug report: three categories split 33.33 / 33.33 / 33.34
    // percent, i.e. fractions 0.3333 / 0.3333 / 0.3334. Under the old DECIMAL(5,2) columns
    // every one of these truncated to 0.33 on write.
    const category = await prisma.scoringCategory.create({
      data: { schemaId, name: 'Essay', weight: 0.3333, order: 0 },
    });

    const reloaded = await prisma.scoringCategory.findUniqueOrThrow({ where: { id: category.id } });
    expect(reloaded.weight.toNumber()).toBe(0.3333);
  });

  it('round-trips a four-decimal criterion weight fraction without truncation', async () => {
    const category = await prisma.scoringCategory.create({
      data: { schemaId, name: 'Achievement', weight: 0.3334, order: 1 },
    });
    const criterion = await prisma.scoringCriterion.create({
      data: { categoryId: category.id, name: 'Leadership', weight: 0.6667, maxScore: 100, order: 0 },
    });

    const reloaded = await prisma.scoringCriterion.findUniqueOrThrow({ where: { id: criterion.id } });
    expect(reloaded.weight.toNumber()).toBe(0.6667);
  });
});
