import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import {
  classifyLegacyFieldName,
  LEGACY_ALIASES,
} from './classify-existing-form-fields';
import { MAGIC_FORM_FIELD_KEYS } from '../../src/modules/programs/application/constants/magic-form-fields';

type Report = {
  migratedToSystem: number;
  aliasedAndRenamed: number;
  keptAsCustom: number;
  flaggedInvalid: number;
  deduped: number;
  personalDataRowsUpdated: number;
};

async function loadCatalogKeys(prisma: PrismaClient): Promise<Set<string>> {
  const rows = await prisma.systemFormFieldDefinition.findMany({
    where: { isActive: true, deletedAt: null },
    select: { key: true },
  });
  return new Set(rows.map((r) => r.key));
}

function mergeLegacyMarker(
  existing: unknown,
  marker: Record<string, unknown>,
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, ...marker };
}

async function renamePersonalDataKeysForProgram(
  prisma: PrismaClient,
  programId: string,
  renames: Map<string, string>,
): Promise<number> {
  if (renames.size === 0) return 0;
  const BATCH = 200;
  let total = 0;
  let cursor: string | undefined;
  for (;;) {
    const apps = await prisma.participantApplication.findMany({
      where: {
        programId,
        deletedAt: null,
        ...(cursor ? { id: { gt: cursor } } : {}),
      },
      orderBy: { id: 'asc' },
      take: BATCH,
      select: { id: true, personalData: true },
    });
    if (apps.length === 0) break;
    for (const app of apps) {
      const data = (app.personalData as Record<string, unknown> | null) ?? {};
      const next: Record<string, unknown> = { ...data };
      let changed = false;
      for (const [legacy, canonical] of renames) {
        if (legacy in next && !(canonical in next)) {
          next[canonical] = next[legacy];
          delete next[legacy];
          changed = true;
        } else if (legacy in next && canonical in next) {
          delete next[legacy];
          changed = true;
        }
      }
      if (changed) {
        await prisma.participantApplication.update({
          where: { id: app.id },
          data: { personalData: next as never },
        });
        total += 1;
      }
    }
    cursor = apps[apps.length - 1].id;
    if (apps.length < BATCH) break;
  }
  return total;
}

async function dedupePerProgram(
  prisma: PrismaClient,
  programId: string,
): Promise<number> {
  const rows = await prisma.applicationFormField.findMany({
    where: { programId, deletedAt: null },
    orderBy: { updatedAt: 'desc' },
    select: { id: true, name: true },
  });
  const seen = new Set<string>();
  let removed = 0;
  for (const r of rows) {
    if (seen.has(r.name)) {
      await prisma.applicationFormField.update({
        where: { id: r.id },
        data: { deletedAt: new Date(), isActive: false },
      });
      removed += 1;
    } else {
      seen.add(r.name);
    }
  }
  return removed;
}

export async function migrateFormFieldCatalog(
  prisma: PrismaClient,
): Promise<Report> {
  const report: Report = {
    migratedToSystem: 0,
    aliasedAndRenamed: 0,
    keptAsCustom: 0,
    flaggedInvalid: 0,
    deduped: 0,
    personalDataRowsUpdated: 0,
  };

  const catalogKeys = await loadCatalogKeys(prisma);
  const magicKeys = new Set<string>(MAGIC_FORM_FIELD_KEYS);

  const programs = await prisma.program.findMany({ select: { id: true } });

  for (const { id: programId } of programs) {
    const fields = await prisma.applicationFormField.findMany({
      where: { programId, deletedAt: null },
    });

    const renames = new Map<string, string>();
    for (const f of fields) {
      const c = classifyLegacyFieldName(f.name, catalogKeys, magicKeys);
      if (c.status === 'aliased_to_system') {
        await prisma.applicationFormField.update({
          where: { id: f.id },
          data: {
            name: c.canonical,
            source: 'system',
            systemFieldKey: c.canonical,
            validationRules: mergeLegacyMarker(f.validationRules, {
              _legacy_name: f.name,
            }) as never,
          },
        });
        renames.set(f.name, c.canonical);
        report.aliasedAndRenamed += 1;
      } else if (c.status === 'system') {
        if (f.source !== 'system' || f.systemFieldKey !== c.canonical) {
          await prisma.applicationFormField.update({
            where: { id: f.id },
            data: { source: 'system', systemFieldKey: c.canonical },
          });
        }
        report.migratedToSystem += 1;
      } else {
        if (!c.valid) {
          await prisma.applicationFormField.update({
            where: { id: f.id },
            data: {
              source: 'custom',
              validationRules: mergeLegacyMarker(f.validationRules, {
                _legacy_invalid_key: true,
              }) as never,
            },
          });
          report.flaggedInvalid += 1;
        } else {
          if (f.source !== 'custom') {
            await prisma.applicationFormField.update({
              where: { id: f.id },
              data: { source: 'custom' },
            });
          }
          report.keptAsCustom += 1;
        }
      }
    }

    report.personalDataRowsUpdated += await renamePersonalDataKeysForProgram(
      prisma,
      programId,
      renames,
    );

    report.deduped += await dedupePerProgram(prisma, programId);
  }

  return report;
}

if (require.main === module) {
  const connectionString =
    process.env.DATABASE_URL ||
    'postgresql://ybb_user:ybb_password@localhost:5438/ybb_platform_db';
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  migrateFormFieldCatalog(prisma)
    .then((report) => {
      // eslint-disable-next-line no-console
      console.log('Form field catalog migration complete:', report);
      // eslint-disable-next-line no-console
      console.log('Legacy aliases applied:', LEGACY_ALIASES);
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
