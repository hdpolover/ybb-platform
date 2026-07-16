import { createMysqlConnection } from './mysql-config';
import { prisma } from './prisma-config';

const slugify = (text: string) => text.toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '');

export async function migratePrograms() {
    console.log('--- Starting Program Migration ---');
    const mysql = await createMysqlConnection();

    try {
        const [rows] = await mysql.execute('SELECT * FROM programs');
        const legacyPrograms = rows as any[];

        console.log(`Found ${legacyPrograms.length} programs in remote MySQL.`);

        for (const prog of legacyPrograms) {
            try {
                // Find corresponding Brand in new DB
                const brand = await prisma.brand.findUnique({
                    where: { legacyId: prog.program_category_id }
                });

                if (!brand) {
                    console.log(`[SKIP] No brand found for program ${prog.id} (Category ID: ${prog.program_category_id})`);
                    continue;
                }

                const brandId = brand.id;
                const slug = slugify(prog.name);
                const startDate = new Date(prog.start_date);
                const endDate = new Date(prog.end_date);
                const year = startDate.getFullYear();

                // First try find by legacyId
                let existing = await prisma.program.findUnique({ where: { legacyId: prog.id } });

                // Check if a record with the TARGET (brandId, slug) exists
                const target = await prisma.program.findUnique({
                    where: {
                        brandId_slug: {
                            brandId,
                            slug
                        }
                    }
                });

                if (target && (!existing || existing.id !== target.id)) {
                    // target exists at the location we want
                    if (!target.legacyId || target.legacyId === prog.id) {
                        console.log(`[MERGE] Merging record ${prog.id} into existing target ${target.id}`);
                        if (existing) {
                            // Release legacyId from existing so we can give it to target
                            await prisma.program.update({
                                where: { id: existing.id },
                                data: { legacyId: null }
                            });
                        }
                        existing = target;
                    } else {
                        console.error(`[CONFLICT] Slug ${slug} for Brand ${brandId} is taken by legacyId ${target.legacyId}. Skipping.`);
                        continue;
                    }
                }

                const programData = {
                    brandId,
                    name: prog.name,
                    slug,
                    year,
                    description: prog.description || '',
                    theme: prog.theme,
                    videoUrl: prog.registration_video_url,
                    allowRegistration: prog.is_registration_open === 1,
                    startDate,
                    endDate,
                    applicationDeadline: startDate, // Fallback
                    legacyId: prog.id,
                    status: prog.is_active === 1 ? 'published' : 'draft',
                    isActive: prog.is_active === 1,
                    isPublished: prog.is_active === 1,
                    isVisibleToUsers: true,
                };

                let upsertedProgram;
                if (existing) {
                    upsertedProgram = await prisma.program.update({
                        where: { id: existing.id },
                        data: programData
                    });
                } else {
                    upsertedProgram = await prisma.program.create({
                        data: {
                            ...programData,
                        },
                    });
                }

                // Seed Main Essay Question if exists
                if (prog.main_essay_question) {
                    await prisma.programEssay.upsert({
                        where: {
                            // No direct unique for question text, but we can use programId + order
                            id: (await prisma.programEssay.findFirst({
                                where: { programId: upsertedProgram.id, order: 1 }
                            }))?.id || '00000000-0000-0000-0000-000000000000'
                        },
                        update: {
                            question: prog.main_essay_question,
                        },
                        create: {
                            programId: upsertedProgram.id,
                            question: prog.main_essay_question,
                            order: 1,
                            isActive: true,
                        }
                    });
                }
                console.log(`Migrated Program: ${prog.name} (Legacy ID: ${prog.id})`);
            } catch (e) {
                console.error(`Error migrating program ${prog.id}:`, e);
            }
        }

        console.log('Program migration complete.');

        // Cleanup: Remove programs that are NOT in the remote MySQL
        const remoteIds = legacyPrograms.map(p => p.id);
        const allLocalProgs = await prisma.program.findMany();

        for (const local of allLocalProgs) {
            if (local.legacyId && !remoteIds.includes(local.legacyId)) {
                console.log(`[CLEANUP] Deleting program ${local.name} (Legacy ID ${local.legacyId} no longer in remote)`);
                await prisma.program.delete({ where: { id: local.id } });
            } else if (!local.legacyId) {
                console.log(`[CLEANUP] Deleting program ${local.name} (No legacyId, strictly matching remote)`);
                await prisma.program.delete({ where: { id: local.id } });
            }
        }
    } finally {
        await mysql.end();
    }
}

if (require.main === module) {
    migratePrograms().catch(console.error);
}
