import { createMysqlConnection } from './mysql-config';
import { prisma } from './prisma-config';

const slugify = (text: string) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

export async function migrateBrands() {
    console.log('--- Starting Brand Migration ---');
    const mysql = await createMysqlConnection();

    try {
        const [rows] = await mysql.execute('SELECT * FROM program_categories');
        const categories = rows as any[];

        console.log(`Found ${categories.length} categories in remote MySQL.`);

        for (const cat of categories) {
            try {
                const slug = slugify(cat.name);

                // First try find by legacyId
                let existing = await prisma.brand.findUnique({ where: { legacyId: cat.id } });

                // If not found by legacyId, check if a brand with same name exists without legacyId
                if (!existing) {
                    const ghost = await prisma.brand.findUnique({ where: { name: cat.name } });
                    if (ghost && !ghost.legacyId) {
                        console.warn(`[CLEANUP] Deleting ghost brand ${cat.name} (no legacyId)`);
                        await prisma.brand.delete({ where: { id: ghost.id } });
                    } else if (ghost) {
                        existing = ghost;
                    }
                }

                const socialLinks = {
                    instagram: cat.instagram,
                    tiktok: cat.tiktok,
                    youtube: cat.youtube,
                    telegram: cat.telegram,
                };

                const brandData = {
                    name: cat.name,
                    slug,
                    description: cat.description,
                    about: cat.about || cat.benefits,
                    vision: cat.objectives,
                    mission: cat.core_values,
                    websiteUrl: cat.web_url,
                    logoUrl: cat.logo_url,
                    logoWhiteUrl: cat.logo_white_url,
                    logoColorUrl: cat.logo_color_url,
                    logoIconUrl: cat.logo_icon_url,
                    bannerUrl: cat.main_banner_url,
                    defaultLocation: cat.location,
                    socialMediaLinks: socialLinks,
                    requireEmailVerification: cat.verification_required === 1,
                    legacyId: cat.id,
                    isActive: cat.is_active === 1,
                };

                if (existing) {
                    await prisma.brand.update({
                        where: { id: existing.id },
                        data: brandData
                    });
                } else {
                    await prisma.brand.create({
                        data: brandData,
                    });
                }
                console.log(`Migrated Brand: ${cat.name} (Legacy ID: ${cat.id})`);
            } catch (e) {
                console.error(`Error migrating brand ${cat.id}:`, e);
            }
        }

        console.log('Brand migration complete.');

        // Cleanup: Remove brands that are NOT in the remote MySQL
        // to match "remove the ones not from remote db"
        const remoteIds = categories.map(c => c.id);
        const allLocalBrands = await prisma.brand.findMany();

        for (const local of allLocalBrands) {
            const shouldDelete =
                (local.legacyId && !remoteIds.includes(local.legacyId)) ||
                !local.legacyId;

            if (!shouldDelete) continue;

            const reason = local.legacyId
                ? `Legacy ID ${local.legacyId} no longer in remote`
                : 'No legacyId, strictly matching remote';

            try {
                await prisma.brand.delete({ where: { id: local.id } });
                console.log(`[CLEANUP] Deleted brand ${local.name} (${reason})`);
            } catch (e: any) {
                if (e?.code === 'P2003') {
                    console.warn(`[CLEANUP] Skipped brand ${local.name} — FK constraint (${reason})`);
                } else {
                    throw e;
                }
            }
        }
    } finally {
        await mysql.end();
    }
}

if (require.main === module) {
    migrateBrands().catch(console.error);
}
