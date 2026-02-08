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

        // Group by program to clear them first
        const paymentPeriodsProgramIds = [...new Set(periods.map((p: any) => p.payment_id))]; // payment_id is not program_id
        // Better to just clear all PricingTiers for brands we are migrating
        for (const p of periods) {
            const [pg]: any = await conn.execute('SELECT program_id FROM program_payments WHERE id = ?', [p.payment_id]);
            if (pg.length > 0) {
                const program = await prisma.program.findUnique({ where: { legacyId: pg[0].program_id } });
                if (program) {
                    await prisma.programPricingTier.deleteMany({ where: { programId: program.id } });
                }
            }
        }

        for (const p of periods) {
            const [pg]: any = await conn.execute('SELECT program_id FROM program_payments WHERE id = ?', [p.payment_id]);
            if (pg.length > 0) {
                const program = await prisma.program.findUnique({
                    where: { legacyId: pg[0].program_id }
                });

                if (program) {
                    await prisma.programPricingTier.create({
                        data: {
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

    } catch (e) {
        error('Metadata migration failed');
        console.error(e);
    } finally {
        await conn.end();
    }
}
