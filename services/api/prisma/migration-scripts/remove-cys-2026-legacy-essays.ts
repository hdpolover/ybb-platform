import { Prisma, PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const PROGRAM_SLUG = 'china-youth-summit-2026';
const TARGET_QUESTIONS = [
    'Why do you want to join China Youth Summit 2026?',
    'Describe a social challenge facing youth in your country and propose a solution.',
] as const;

type EssayRow = {
    id: string;
    programId: string;
    question: string;
    order: number;
};

function parseArgs() {
    const dryRun = process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
    return { dryRun };
}

async function findMatchingEssays(prisma: PrismaClient): Promise<EssayRow[]> {
    return prisma.$queryRaw<EssayRow[]>(Prisma.sql`
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
    `);
}

async function deleteMatchingEssays(prisma: PrismaClient): Promise<number> {
    const deleted = await prisma.$queryRaw<{ id: string }[]>(Prisma.sql`
        DELETE FROM program_essays pe
        USING programs p
        WHERE p.id = pe.program_id
          AND p.slug = ${PROGRAM_SLUG}
          AND pe.question IN (${Prisma.join(TARGET_QUESTIONS)})
        RETURNING pe.id
    `);

    return deleted.length;
}

export async function removeCys2026LegacyEssays(
    prisma: PrismaClient,
    options: { dryRun?: boolean } = {},
): Promise<{ matched: EssayRow[]; deletedCount: number }> {
    const dryRun = options.dryRun ?? false;
    const matched = await findMatchingEssays(prisma);

    if (dryRun || matched.length === 0) {
        return { matched, deletedCount: 0 };
    }

    const deletedCount = await deleteMatchingEssays(prisma);
    return { matched, deletedCount };
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
            ? '>>> DRY RUN: no essay rows will be deleted.'
            : '>>> APPLYING essay cleanup for CYS 2026 legacy prompts.',
    );

    removeCys2026LegacyEssays(prisma, { dryRun })
        .then((result) => {
            // eslint-disable-next-line no-console
            console.log('Matched rows:', result.matched);
            // eslint-disable-next-line no-console
            console.log(
                dryRun
                    ? 'Dry run complete. Re-run without --dry-run to apply deletion.'
                    : `Delete complete. Removed rows: ${result.deletedCount}`,
            );
        })
        .catch((error) => {
            // eslint-disable-next-line no-console
            console.error(error);
            process.exit(1);
        })
        .finally(async () => {
            await prisma.$disconnect();
            await pool.end();
        });
}
