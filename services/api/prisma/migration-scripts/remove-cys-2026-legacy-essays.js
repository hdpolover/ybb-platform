const { Prisma, PrismaClient } = require('@prisma/client');

const PROGRAM_SLUG = 'china-youth-summit-2026';
const TARGET_QUESTIONS = [
  'Why do you want to join China Youth Summit 2026?',
  'Describe a social challenge facing youth in your country and propose a solution.',
];

function parseArgs() {
  const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  return { dryRun };
}

async function findMatchingEssays(prisma) {
  return prisma.$queryRaw(
    Prisma.sql`
      SELECT
        pe.id,
        pe.program_id AS "programId",
        pe.question,
        pe."order"
      FROM program_essays pe
      JOIN programs p ON p.id = pe.program_id
      WHERE p.slug = ${PROGRAM_SLUG}
        AND pe.question IN (${Prisma.join(TARGET_QUESTIONS)})
      ORDER BY pe."order" ASC
    `,
  );
}

async function deleteMatchingEssays(prisma) {
  const deleted = await prisma.$queryRaw(
    Prisma.sql`
      DELETE FROM program_essays pe
      USING programs p
      WHERE p.id = pe.program_id
        AND p.slug = ${PROGRAM_SLUG}
        AND pe.question IN (${Prisma.join(TARGET_QUESTIONS)})
      RETURNING pe.id
    `,
  );

  return deleted.length;
}

async function main() {
  const { dryRun } = parseArgs();
  const prisma = new PrismaClient();

  try {
    console.log(
      dryRun
        ? '>>> DRY RUN: no essay rows will be deleted.'
        : '>>> APPLYING essay cleanup for CYS 2026 legacy prompts.',
    );

    const matched = await findMatchingEssays(prisma);
    console.log('Matched rows:', matched);

    if (!dryRun && matched.length > 0) {
      const deletedCount = await deleteMatchingEssays(prisma);
      console.log(`Delete complete. Removed rows: ${deletedCount}`);
    } else if (dryRun) {
      console.log('Dry run complete. Re-run without --dry-run to apply deletion.');
    } else {
      console.log('No matching rows found. Nothing to delete.');
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
