// services/api/scripts/dump-brand-metadata.ts
/**
 * dump-brand-metadata.ts
 *
 * Phase 3 step 1 of the ownership-split migration (see
 * docs/superpowers/plans/2026-08-24-program-content-copy-phase-3.md, Task
 * 10). Dumps the RAW Brand.metadata JSON *and* the seven typed contact/SEO
 * columns for every non-deleted brand to a timestamped backup file before
 * anything backfills, switches reads, or strips keys (Tasks 11, 12, 21).
 *
 * This is the ONLY recoverable backup before Task 21 irreversibly drops the
 * seven typed Brand columns (contactEmail, contactPhone, contactWhatsapp,
 * contactAddress, metaTitle, metaDescription, metaKeywords). Task 12's
 * backfill deliberately skips writing a field when the target Program
 * already has a value, and (before the resolver addendum) could skip a
 * whole brand with no resolvable active program -- for any field left
 * un-backfilled, the Brand value would otherwise exist nowhere once Task 21
 * runs, recoverable only via Postgres PITR. An earlier draft of this script
 * dumped only Brand.metadata and would have missed these seven columns
 * entirely; this version dumps both.
 *
 * Read-only. Makes no changes to the database. Not gated behind --apply —
 * there is nothing to gate; this script never writes to Postgres.
 *
 * USAGE (from services/api, with DATABASE_URL pointing at the TARGET db):
 *   npx ts-node -r tsconfig-paths/register scripts/dump-brand-metadata.ts
 *
 * NEVER run this against production from an interactive agent session — see
 * this plan's Global Constraints. Running it against production, like every
 * other script in this phase, is a separate human-approved deployment step.
 */
import { join } from 'path';
import { config as loadEnv } from 'dotenv';
import { writeFileSync, mkdirSync } from 'fs';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

loadEnv({ path: join(__dirname, '..', '.env') });

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
    throw new Error('DATABASE_URL is not set (checked process.env and services/api/.env).');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface BrandMetadataDump {
    brandId: string;
    brandName: string;
    brandSlug: string;
    metadata: unknown;
    // The seven TYPED columns Task 21 also drops. These are NOT part of
    // `metadata`, so dumping metadata alone does not back them up. Dump
    // them here so every field Task 21 removes has a recoverable copy,
    // regardless of what Task 12's backfill did or didn't reach.
    contactEmail: string | null;
    contactPhone: string | null;
    contactWhatsapp: string | null;
    contactAddress: string | null;
    metaTitle: string | null;
    metaDescription: string | null;
    metaKeywords: string | null;
}

async function main(): Promise<void> {
    const brands = await prisma.brand.findMany({
        where: { deletedAt: null },
        select: {
            id: true, name: true, slug: true, metadata: true,
            contactEmail: true, contactPhone: true, contactWhatsapp: true,
            contactAddress: true, metaTitle: true, metaDescription: true,
            metaKeywords: true,
        },
        orderBy: { name: 'asc' },
    });

    const dump: BrandMetadataDump[] = brands.map((b) => ({
        brandId: b.id,
        brandName: b.name,
        brandSlug: b.slug,
        metadata: b.metadata,
        contactEmail: b.contactEmail,
        contactPhone: b.contactPhone,
        contactWhatsapp: b.contactWhatsapp,
        contactAddress: b.contactAddress,
        metaTitle: b.metaTitle,
        metaDescription: b.metaDescription,
        metaKeywords: b.metaKeywords,
    }));

    const backupDir = join(__dirname, 'backups');
    mkdirSync(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = join(backupDir, `dump-brand-metadata-${stamp}.json`);
    writeFileSync(backupPath, JSON.stringify(dump, null, 2));

    console.log(`[dump-brand-metadata] dumped metadata for ${dump.length} brand(s) -> ${backupPath}`);
    console.table(
        dump.map((d) => ({
            brand: d.brandName,
            metadataKeys:
                d.metadata && typeof d.metadata === 'object' && !Array.isArray(d.metadata)
                    ? Object.keys(d.metadata as object).length
                    : 0,
            hasContact: !!(d.contactEmail || d.contactPhone || d.contactWhatsapp || d.contactAddress),
            hasSeo: !!(d.metaTitle || d.metaDescription || d.metaKeywords),
        })),
    );
}

main()
    .catch((err) => {
        console.error('[dump-brand-metadata] FAILED:', err);
        process.exitCode = 1;
    })
    .finally(async () => {
        await prisma.$disconnect();
        await pool.end();
    });
