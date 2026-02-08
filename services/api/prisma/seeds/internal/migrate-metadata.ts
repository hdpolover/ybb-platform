import { createMysqlConnection } from './mysql-config';
import { prisma, log, error } from '../utils';

export async function migrateMetadata() {
    log('🌏 Migrating Brand Settings, FAQs, Timelines, and Pricing...');
    const conn = await createMysqlConnection();

    try {
        // 1. Brand Settings (from web_settings)
        const [webSettings]: any = await conn.execute('SELECT * FROM web_settings');
        for (const setting of webSettings) {
            const brand = await prisma.brand.findUnique({
                where: { legacyId: setting.program_category_id }
            });

            if (brand) {
                await prisma.brandSetting.upsert({
                    where: { brandId: brand.id },
                    update: {
                        isMaintenanceMode: setting.is_maintenance_mode === 1,
                        usdInIdr: setting.usd_in_idr || 16000,
                    },
                    create: {
                        brandId: brand.id,
                        isMaintenanceMode: setting.is_maintenance_mode === 1,
                        usdInIdr: setting.usd_in_idr || 16000,
                    }
                });
            }
        }
        log(`✅ Brand Settings synced (${webSettings.length} records)`);

        // 2. Program FAQs (from program_faqs)
        const [faqs]: any = await conn.execute('SELECT * FROM program_faqs WHERE is_deleted = 0');

        // Group by program to clear them first
        const faqProgramIds = [...new Set(faqs.map((f: any) => f.program_id))];
        for (const lpId of faqProgramIds) {
            const program = await prisma.program.findUnique({ where: { legacyId: lpId as number } });
            if (program) {
                await prisma.programFaq.deleteMany({ where: { programId: program.id } });
            }
        }

        for (const f of faqs) {
            const program = await prisma.program.findUnique({
                where: { legacyId: f.program_id }
            });

            if (program) {
                // Map category
                let category: any = 'general';
                if (f.faq_category === 'registration') category = 'registration';
                if (f.faq_category === 'payments') category = 'payment';
                if (f.faq_category === 'event_details') category = 'event_details';

                await prisma.programFaq.create({
                    data: {
                        programId: program.id,
                        question: f.question,
                        answer: f.answer,
                        category,
                        order: f.order_number || 0,
                        isActive: f.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program FAQs synced (${faqs.length} records)`);

        // 3. Program Timelines (from program_schedules)
        const [schedules]: any = await conn.execute('SELECT * FROM program_schedules WHERE is_deleted = 0');

        // Group by program to clear them first
        const scheduleProgramIds = [...new Set(schedules.map((s: any) => s.program_id))];
        for (const lpId of scheduleProgramIds) {
            const program = await prisma.program.findUnique({ where: { legacyId: lpId as number } });
            if (program) {
                await prisma.programTimeline.deleteMany({ where: { programId: program.id } });
            }
        }

        for (const s of schedules) {
            const program = await prisma.program.findUnique({
                where: { legacyId: s.program_id }
            });

            if (program) {
                await prisma.programTimeline.create({
                    data: {
                        programId: program.id,
                        title: s.name,
                        description: s.description,
                        date: s.start_date,
                        endDate: s.end_date,
                        order: s.order_number || 0,
                        isActive: s.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Timelines synced (${schedules.length} records)`);

        // 4. Program Pricing (from program_payment_periods)
        const [periods]: any = await conn.execute('SELECT * FROM program_payment_periods WHERE is_deleted = 0');
        for (const p of periods) {
            const [pg]: any = await conn.execute('SELECT program_id FROM program_payments WHERE id = ?', [p.payment_id]);
            if (pg.length > 0) {
                const program = await prisma.program.findUnique({
                    where: { legacyId: pg[0].program_id }
                });

                if (program) {
                    const tierId = `00000000-0000-0000-0000-${p.id.toString().padStart(12, '0')}`;
                    await prisma.programPricingTier.upsert({
                        where: { id: tierId },
                        update: {
                            programId: program.id,
                            name: p.name,
                            description: p.description,
                            isActive: p.is_active === 1,
                            feeType: 'full_fee',
                            price: 0,
                            currency: 'USD',
                            allowedCategories: ['self_funded', 'fully_funded'],
                        },
                        create: {
                            id: tierId,
                            programId: program.id,
                            name: p.name,
                            description: p.description,
                            isActive: p.is_active === 1,
                            feeType: 'full_fee',
                            price: 0,
                            currency: 'USD',
                            allowedCategories: ['self_funded', 'fully_funded'],
                            validityPeriods: {
                                create: {
                                    startDate: p.start_date,
                                    endDate: p.end_date,
                                }
                            }
                        }
                    });
                }
            }
        }
        log(`✅ Program Pricing synced (${periods.length} records)`);

        // 5. Sponsors (from program_sponsors)
        const [mysqlSponsors]: any = await conn.execute('SELECT * FROM program_sponsors WHERE is_deleted = 0');
        for (const s of mysqlSponsors) {
            const program = await prisma.program.findUnique({
                where: { legacyId: s.program_id }
            });

            if (program) {
                await prisma.sponsor.upsert({
                    where: { id: `legacy-sponsor-${s.id}` }, // Temporary ID or handle duplication
                    update: {
                        brandId: program.brandId,
                        name: s.name,
                        type: 'partner',
                        description: s.description,
                        logoUrl: s.img_url,
                        isActive: s.is_active === 1,
                    },
                    create: {
                        brandId: program.brandId,
                        name: s.name,
                        type: 'partner',
                        description: s.description,
                        logoUrl: s.img_url,
                        isActive: s.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Sponsors synced (${mysqlSponsors.length} records)`);

        // 6. Landing Page Content (from web_setting_about and web_setting_home)
        const [aboutSettings]: any = await conn.execute('SELECT * FROM web_setting_about WHERE is_deleted = 0');
        for (const about of aboutSettings) {
            const program = await prisma.program.findUnique({ where: { legacyId: about.program_id } });
            if (program) {
                const description = [
                    about.about_program,
                    about.why_program,
                    about.what_program,
                    program.description
                ].filter(Boolean).join('<br/><br/>');

                await prisma.program.update({
                    where: { id: program.id },
                    data: { description }
                });
            }
        }

        const [homeSettings]: any = await conn.execute('SELECT * FROM web_setting_home WHERE is_deleted = 0');
        for (const home of homeSettings) {
            const program = await prisma.program.findUnique({ where: { legacyId: home.program_id } });
            if (program) {
                // If banner exists, update it
                if (home.banner1_img_url) {
                    await prisma.program.update({
                        where: { id: program.id },
                        data: { bannerUrl: home.banner1_img_url }
                    });
                }
            }
        }
        log(`✅ Landing Page content enriched`);

    } catch (e) {
        error('Metadata migration failed');
        console.error(e);
    } finally {
        await conn.end();
    }
} if (require.main === module) {
    migrateMetadata().catch(console.error);
}
