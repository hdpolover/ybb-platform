import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  computeSystemFieldTypeFixes,
  type CatalogEntry,
  type FieldTypeFix,
} from '../../src/modules/programs/application/services/system-field-type-reconciler';

function parseArgs() {
  const dryRun =
    process.argv.includes('--dry-run') || process.env.DRY_RUN === '1';
  const programArg = process.argv.find((a) => a.startsWith('--program='));
  const programSlug = programArg ? programArg.split('=')[1] : undefined;
  return { dryRun, programSlug };
}

export async function reconcileSystemFieldTypes(
  prisma: PrismaClient,
  options: { programSlug?: string; dryRun?: boolean } = {},
): Promise<{ fixes: FieldTypeFix[]; appliedCount: number }> {
  const dryRun = options.dryRun ?? false;

  const defs = await prisma.systemFormFieldDefinition.findMany({
    where: { isActive: true, deletedAt: null },
    select: { key: true, type: true, defaultOptions: true },
  });
  const catalogByKey = new Map<string, CatalogEntry>(
    defs.map((d) => [d.key, { type: d.type, defaultOptions: d.defaultOptions }]),
  );

  const fields = await prisma.applicationFormField.findMany({
    where: {
      source: 'system',
      deletedAt: null,
      ...(options.programSlug
        ? { program: { slug: options.programSlug } }
        : {}),
    },
    select: { id: true, systemFieldKey: true, type: true, options: true },
  });

  const fixes = computeSystemFieldTypeFixes(fields, catalogByKey);

  if (dryRun || fixes.length === 0) {
    return { fixes, appliedCount: 0 };
  }

  for (const fix of fixes) {
    await prisma.applicationFormField.update({
      where: { id: fix.id },
      data: {
        type: fix.toType,
        ...(fix.fillOptions ? { options: fix.newOptions as never } : {}),
      },
    });
  }

  return { fixes, appliedCount: fixes.length };
}

if (require.main === module) {
  const { dryRun, programSlug } = parseArgs();
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';

  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  // eslint-disable-next-line no-console
  console.log(
    `${dryRun ? '>>> DRY RUN' : '>>> APPLYING'} system field type reconcile` +
      `${programSlug ? ` for program "${programSlug}"` : ' (all programs)'}.`,
  );

  reconcileSystemFieldTypes(prisma, { programSlug, dryRun })
    .then((result) => {
      // eslint-disable-next-line no-console
      console.log('Fixes:', JSON.stringify(result.fixes, null, 2));
      // eslint-disable-next-line no-console
      console.log(
        dryRun
          ? `Dry run: ${result.fixes.length} field(s) would change. Re-run without --dry-run to apply.`
          : `Applied ${result.appliedCount} field type fix(es).`,
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
