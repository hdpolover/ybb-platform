// services/api/scripts/2026-08-25-clear-duplicate-program-logo.ts
/**
 * Clears program logos that are byte-identical COPIES of their brand's logo.
 *
 * Public logo resolution is `program?.logoUrl || brand.logoUrl`
 * (settings.strategy.ts). That precedence is intentional for a program with
 * a genuinely program-specific logo, but Istanbul Youth Summit's program row
 * holds an exact copy of the brand logo, so it overrides nothing and only
 * serves to pin the public site to a stale URL: every brand-level logo edit
 * saves successfully and changes nothing visible, forever.
 *
 * Only rows where `program.logo_url = brand.logo_url` are touched. A program
 * with a distinct logo (China, Middle East) is a real override and is left
 * alone.
 *
 * A raw UPDATE bypasses all three landing cache layers, so this purges via
 * LandingCacheInvalidationService — the same entry point every write-path
 * handler uses — scoped to the affected brands only, NOT the all-brands
 * fan-out.
 *
 * USAGE (from services/api):
 *   npx ts-node -r tsconfig-paths/register scripts/2026-08-25-clear-duplicate-program-logo.ts          # dry run
 *   npx ts-node -r tsconfig-paths/register scripts/2026-08-25-clear-duplicate-program-logo.ts --apply
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/shared/infrastructure/prisma/prisma.service';
import { LandingCacheInvalidationService } from '../src/modules/brands/application/services/landing-cache-invalidation.service';

async function main() {
    const apply = process.argv.includes('--apply');
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });

    try {
        const prisma = app.get(PrismaService);
        const invalidation = app.get(LandingCacheInvalidationService);

        const duplicates = await prisma.$queryRaw<
            Array<{ id: string; slug: string; brand_id: string; brand_name: string; logo_url: string }>
        >`
            SELECT p.id, p.slug, p.brand_id, b.name AS brand_name, p.logo_url
            FROM programs p
            JOIN brands b ON b.id = p.brand_id
            WHERE p.deleted_at IS NULL
              AND p.logo_url IS NOT NULL
              AND p.logo_url = b.logo_url
        `;

        if (duplicates.length === 0) {
            console.log('No duplicate program logos found. Nothing to do.');
            return;
        }

        console.log(`Found ${duplicates.length} program logo(s) that duplicate the brand logo:`);
        for (const d of duplicates) {
            console.log(`  ${d.brand_name} / ${d.slug} (${d.id})`);
            console.log(`    ${d.logo_url}`);
        }

        if (!apply) {
            console.log('\nDry run. Re-run with --apply to clear them and purge caches.');
            return;
        }

        const { count } = await prisma.program.updateMany({
            where: { id: { in: duplicates.map(d => d.id) } },
            data: { logoUrl: null },
        });
        console.log(`\nCleared ${count} program logo(s).`);

        // Purge only the affected brands. The raw update above fired no
        // invalidation of its own, so until this runs the public site keeps
        // serving the stale logo from Redis / the snapshot table / Next.js.
        const brandIds = [...new Set(duplicates.map(d => d.brand_id))];
        for (const brandId of brandIds) {
            await invalidation.invalidate(brandId, {
                clearSnapshot: true,
                bustProgramCache: true,
                swallowErrors: false,
                revalidate: { kind: 'homeAndSettings' },
            });
            console.log(`Purged landing caches for brand ${brandId}.`);
        }
    } finally {
        await app.close();
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
