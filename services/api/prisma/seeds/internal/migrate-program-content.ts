import { createMysqlConnection } from './mysql-config';
import { prisma, log, error } from '../utils';

export async function migrateProgramContent() {
    log('🎭 Migrating Deep Program Content (Schedules, Essays, Speakers, Awards, etc.)...');
    const conn = await createMysqlConnection();

    const generateId = (prefix: string, legacyId: number) => {
        // prefix should be 8 chars max, e.g. "00000001"
        return `${prefix}-0000-0000-0000-${legacyId.toString().padStart(12, '0')}`;
    };

    try {
        // 1. Program Schedules (from program_rundowns)
        const [rundowns]: any = await conn.execute('SELECT * FROM program_rundowns WHERE is_deleted = 0');
        for (const r of rundowns) {
            const program = await prisma.program.findUnique({
                where: { legacyId: r.program_id }
            });

            if (program) {
                const scheduleId = generateId('10000000', r.id);
                await prisma.programSchedule.upsert({
                    where: { id: scheduleId },
                    update: {
                        day: r.start_date ? r.start_date.toISOString().split('T')[0] : 'TBA',
                        startTime: r.start_date ? r.start_date.toTimeString().substring(0, 5) : null,
                        endTime: r.end_date ? r.end_date.toTimeString().substring(0, 5) : null,
                        activity: r.title,
                        description: r.description,
                        order: r.order_number || 0,
                        isActive: r.is_active === 1,
                    },
                    create: {
                        id: scheduleId,
                        programId: program.id,
                        day: r.start_date ? r.start_date.toISOString().split('T')[0] : 'TBA',
                        startTime: r.start_date ? r.start_date.toTimeString().substring(0, 5) : null,
                        endTime: r.end_date ? r.end_date.toTimeString().substring(0, 5) : null,
                        activity: r.title,
                        description: r.description,
                        order: r.order_number || 0,
                        isActive: r.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Schedules synced (${rundowns.length} records)`);

        // 2. Program Essays (from program_essays)
        const [essays]: any = await conn.execute('SELECT * FROM program_essays WHERE is_deleted = 0');
        for (const e of essays) {
            const program = await prisma.program.findUnique({
                where: { legacyId: e.program_id }
            });

            if (program) {
                const essayId = generateId('20000000', e.id);
                await prisma.programEssay.upsert({
                    where: { id: essayId },
                    update: {
                        question: e.questions,
                        wordLimit: e.max_word_count,
                        isActive: e.is_active === 1,
                        isRequired: true,
                    },
                    create: {
                        id: essayId,
                        programId: program.id,
                        question: e.questions,
                        wordLimit: e.max_word_count,
                        isActive: e.is_active === 1,
                        isRequired: true,
                    }
                });
            }
        }
        log(`✅ Program Essays synced (${essays.length} records)`);

        // 3. Program Speakers (from program_speakers)
        const [speakers]: any = await conn.execute('SELECT * FROM program_speakers WHERE is_deleted = 0');
        for (const s of speakers) {
            const program = await prisma.program.findUnique({
                where: { legacyId: s.program_id }
            });

            if (program) {
                const speakerId = generateId('30000000', s.id);
                await prisma.programSpeaker.upsert({
                    where: { id: speakerId },
                    update: {
                        name: s.name,
                        title: s.title,
                        organization: s.organization,
                        bio: s.bio,
                        photoUrl: s.photo_url,
                        email: s.email,
                        linkedinUrl: s.linkedin_url,
                        twitterUrl: s.instagram_url,
                        order: s.order_number || 0,
                        isActive: s.is_active === 1,
                    },
                    create: {
                        id: speakerId,
                        programId: program.id,
                        name: s.name,
                        title: s.title,
                        organization: s.organization,
                        bio: s.bio,
                        photoUrl: s.photo_url,
                        email: s.email,
                        linkedinUrl: s.linkedin_url,
                        twitterUrl: s.instagram_url,
                        order: s.order_number || 0,
                        isActive: s.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Speakers synced (${speakers.length} records)`);

        // 4. Program Awards (from program_awards)
        const [awards]: any = await conn.execute('SELECT * FROM program_awards WHERE is_deleted = 0');
        for (const a of awards) {
            const program = await prisma.program.findUnique({
                where: { legacyId: a.program_id }
            });

            if (program) {
                const awardId = generateId('40000000', a.id);
                await prisma.programAward.upsert({
                    where: { id: awardId },
                    update: {
                        name: a.title,
                        description: a.description,
                        category: a.award_type,
                        tier: a.award_type,
                        order: a.order_number || 0,
                        isActive: a.is_active === 1,
                    },
                    create: {
                        id: awardId,
                        programId: program.id,
                        name: a.title,
                        description: a.description,
                        category: a.award_type,
                        tier: a.award_type,
                        order: a.order_number || 0,
                        isActive: a.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Awards synced (${awards.length} records)`);

        // 5. Program Subthemes (from program_subthemes)
        const [subthemes]: any = await conn.execute('SELECT * FROM program_subthemes WHERE is_deleted = 0');
        for (const st of subthemes) {
            const program = await prisma.program.findUnique({
                where: { legacyId: st.program_id }
            });

            if (program) {
                const subthemeId = generateId('70000000', st.id);
                await prisma.programSubtheme.upsert({
                    where: { id: subthemeId },
                    update: {
                        name: st.name,
                        description: st.desc,
                        isActive: st.is_active === 1,
                    },
                    create: {
                        id: subthemeId,
                        programId: program.id,
                        name: st.name,
                        description: st.desc,
                        isActive: st.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Subthemes synced (${subthemes.length} records)`);

        // 6. Program Gallery (from program_photos)
        const [photos]: any = await conn.execute('SELECT * FROM program_photos WHERE is_deleted = 0');
        for (const p of photos) {
            const brand = await prisma.brand.findUnique({
                where: { legacyId: p.program_category_id },
                include: { programs: { orderBy: { year: 'desc' }, take: 1 } }
            });

            if (brand && brand.programs.length > 0) {
                const program = brand.programs[0];
                const galleryId = generateId('50000000', p.id);
                await prisma.programGallery.upsert({
                    where: { id: galleryId },
                    update: {
                        imageUrl: p.img_url,
                        title: p.title,
                        description: p.description,
                        isActive: p.is_active === 1,
                    },
                    create: {
                        id: galleryId,
                        programId: program.id,
                        imageUrl: p.img_url,
                        title: p.title,
                        description: p.description,
                        isActive: p.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Gallery synced (${photos.length} records)`);

        // 7. Program Testimonials (from program_testimonies)
        const [testimonies]: any = await conn.execute('SELECT * FROM program_testimonies WHERE is_deleted = 0');
        for (const t of testimonies) {
            const brand = await prisma.brand.findUnique({
                where: { legacyId: t.program_category_id }
            });

            if (brand) {
                const testimonialId = generateId('60000000', t.id);
                await prisma.programTestimonial.upsert({
                    where: { id: testimonialId },
                    update: {
                        brandId: brand.id,
                        name: t.person_name,
                        testimonial: t.testimony,
                        role: t.occupation,
                        company: t.institution,
                        avatarUrl: t.img_url,
                        isActive: t.is_active === 1,
                    },
                    create: {
                        id: testimonialId,
                        brandId: brand.id,
                        name: t.person_name,
                        testimonial: t.testimony,
                        role: t.occupation,
                        company: t.institution,
                        avatarUrl: t.img_url,
                        isActive: t.is_active === 1,
                    }
                });
            }
        }
        log(`✅ Program Testimonials synced (${testimonies.length} records)`);

    } catch (e) {
        error('Deep Program Content migration failed');
        console.error(e);
    } finally {
        await conn.end();
    }
}

if (require.main === module) {
    migrateProgramContent().catch(console.error);
}
