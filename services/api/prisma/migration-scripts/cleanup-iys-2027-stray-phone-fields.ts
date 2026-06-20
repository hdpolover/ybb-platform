import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const PROGRAM_SLUG = 'istanbul-youth-summit-2027';
// Leftovers from an earlier half-done manual fix. Redundant once the unified
// `phone` / `emergency_contact_phone` fields (type:phone) render their own
// country-code dropdown.
const STRAY_FIELD_NAMES = [
  'phone_country_code',
  'emergency_contact_country_code',
] as const;

function parseArgs() {
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  return { dryRun };
}

export async function cleanupIys2027StrayPhoneFields(
  prisma: PrismaClient,
  options: { dryRun?: boolean } = {},
): Promise<{ matched: { id: string; name: string }[]; softDeletedCount: number }> {
  const dryRun = options.dryRun ?? false;

  const matched = await prisma.applicationFormField.findMany({
    where: {
      program: { slug: PROGRAM_SLUG },
      source: 'custom',
      deletedAt: null,
      name: { in: [...STRAY_FIELD_NAMES] },
    },
    select: { id: true, name: true },
  });

  if (dryRun || matched.length === 0) {
    return { matched, softDeletedCount: 0 };
  }

  const res = await prisma.applicationFormField.updateMany({
    where: { id: { in: matched.map((m) => m.id) } },
    data: { deletedAt: new Date() },
  });

  return { matched, softDeletedCount: res.count };
}

if (require.main === module) {
  const { dryRun } = parseArgs();
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // eslint-disable-next-line no-console
  console.log(
    dryRun
      ? '>>> DRY RUN: no IYS 2027 stray fields will be soft-deleted.'
      : '>>> APPLYING IYS 2027 stray phone field cleanup.',
  );

  cleanupIys2027StrayPhoneFields(prisma, { dryRun })
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('Matched stray fields:', result.matched);
      // eslint-disable-next-line no-console
      console.log(
        dryRun
          ? `Dry run: ${result.matched.length} field(s) would be soft-deleted.`
          : `Soft-deleted ${result.softDeletedCount} field(s).`,
      );
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
      await pool.end();
    });
}
