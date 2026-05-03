import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { existsSync } from 'fs';
import * as dotenv from 'dotenv';

type BackfillResult = {
  brandId: string;
  brandName: string;
  successes: string[];
  failures: Array<{ task: string; error: string }>;
};

const DEFAULT_FAQ_LIMIT = 200;

dotenv.config();

function createPrismaClient(): { prisma: PrismaClient; pool: Pool } {
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

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });
  return { prisma, pool };
}

function getApiBaseUrl(): string {
  const raw =
    process.env.LANDING_WARM_BASE_URL ||
    process.env.API_BASE_URL ||
    `http://localhost:${process.env.PORT || '4000'}/v1`;
  return raw.replace(/\/$/, '');
}

async function warmPath(apiBaseUrl: string, path: string): Promise<void> {
  const response = await fetch(`${apiBaseUrl}${path}`);
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`HTTP ${response.status} for ${path}: ${body.slice(0, 300)}`);
  }
}

async function warmBrandSnapshots(
  prisma: PrismaClient,
  apiBaseUrl: string,
  brandId: string,
  brandName: string,
): Promise<BackfillResult> {
  const successes: string[] = [];
  const failures: Array<{ task: string; error: string }> = [];

  const runTask = async (task: string, fn: () => Promise<void>): Promise<void> => {
    try {
      await fn();
      successes.push(task);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      failures.push({ task, error: message });
    }
  };

  const brandQuery = encodeURIComponent(brandId);
  await runTask('home', async () => warmPath(apiBaseUrl, `/landing/home?url=${brandQuery}`));
  await runTask('about', async () => warmPath(apiBaseUrl, `/landing/about?url=${brandQuery}`));
  await runTask('programs', async () => warmPath(apiBaseUrl, `/landing/programs?url=${brandQuery}`));
  await runTask('partners-sponsors', async () => warmPath(apiBaseUrl, `/landing/partners-sponsors?url=${brandQuery}`));
  await runTask('announcements', async () => warmPath(apiBaseUrl, `/landing/announcements?url=${brandQuery}`));
  await runTask('faqs:first-page', async () => warmPath(
    apiBaseUrl,
    `/landing/faqs?url=${brandQuery}&page=1&limit=${DEFAULT_FAQ_LIMIT}`,
  ));
  await runTask('settings', async () => warmPath(apiBaseUrl, `/landing/settings?url=${brandQuery}`));

  const programSlugs = await prisma.program.findMany({
    where: {
      brandId,
      isPublished: true,
      deletedAt: null,
    },
    select: { slug: true },
    orderBy: { startDate: 'desc' },
  });

  for (const { slug } of programSlugs) {
    const encodedSlug = encodeURIComponent(slug);
    await runTask(`program-detail:${slug}`, async () =>
      warmPath(apiBaseUrl, `/landing/programs/${encodedSlug}?url=${brandQuery}`),
    );
  }

  return { brandId, brandName, successes, failures };
}

async function main(): Promise<void> {
  const { prisma, pool } = createPrismaClient();
  const apiBaseUrl = getApiBaseUrl();

  try {
    const brands = await prisma.brand.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
      },
      orderBy: { name: 'asc' },
    });

    if (brands.length === 0) {
      console.log('[landing:snapshots:backfill] No active brands found. Nothing to warm.');
      return;
    }

    console.log(`[landing:snapshots:backfill] API base: ${apiBaseUrl}`);
    console.log(`[landing:snapshots:backfill] Warming snapshots for ${brands.length} brand(s)...`);

    const results: BackfillResult[] = [];
    for (const brand of brands) {
      console.log(`[landing:snapshots:backfill] Brand ${brand.name} (${brand.id})`);
      const result = await warmBrandSnapshots(prisma, apiBaseUrl, brand.id, brand.name);
      results.push(result);
    }

    const totalSuccesses = results.reduce((sum, item) => sum + item.successes.length, 0);
    const totalFailures = results.reduce((sum, item) => sum + item.failures.length, 0);

    console.log(`[landing:snapshots:backfill] Completed. successes=${totalSuccesses} failures=${totalFailures}`);

    if (totalFailures > 0) {
      for (const result of results) {
        for (const failure of result.failures) {
          console.error(
            `[landing:snapshots:backfill] FAILED brand=${result.brandName} task=${failure.task} error=${failure.error}`,
          );
        }
      }
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

void main();
