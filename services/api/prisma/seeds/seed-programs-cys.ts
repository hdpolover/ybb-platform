import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';
import { CYS_2026_DATA } from './data/cys-2026-data';
import { buildLegacySubmissionFormFields } from './data/shared-submission-form-fields';
import {
  PricingFeeType,
  FaqCategory,
  ApplicationCategory,
} from '@prisma/client';

export async function seedCYSPrograms() {
  log('🌱 Seeding Exhaustive CYS Programs...');

  const brand = await prisma.brand.findUnique({ where: { slug: BRANDS.CYS } });
  if (!brand) return error('CYS Brand not found');

  const {
    program: programData,
    participationCategories,
    subthemes,
    objectives,
    timeline,
    schedule,
    pricingTiers,
    requirements,
    essays,
    faqs,
    awards,
    team,
    resources,
    announcements,
    participationInfo,
  } = CYS_2026_DATA;

  // ==========================================
  // CYS 2026 Main Program
  // ==========================================
  const programFields = {
    name: programData.name,
    slug: programData.slug,
    theme: programData.theme,
    description: programData.description,
    shortDescription: programData.shortDescription,
    year: programData.year,
    location: programData.location,
    startDate: new Date(programData.startDate),
    endDate: new Date(programData.endDate),
    applicationDeadline: new Date(programData.applicationDeadline),
    thumbnailUrl: programData.thumbnailUrl,
    bannerUrl: programData.bannerUrl,
    logoUrl: programData.logoUrl,
    videoUrl: programData.videoUrl,
    benefitsDescription: programData.benefitsDescription,
    requirementsDescription: programData.requirementsDescription,
    termsAndConditions: programData.termsAndConditions,
  };

  const cys2026 = await prisma.program.upsert({
    where: {
      brandId_slug: { brandId: brand.id, slug: programData.slug },
    },
    update: {
      isActive: true,
      isPublished: true,
      status: 'published',
      allowRegistration: true,
      isVisibleToUsers: true,
      ...programFields,
    },
    create: {
      id: 'c1a2e3f4-0001-4000-8000-111122223334',
      brandId: brand.id,
      ...programFields,
      capacity: 400,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      allowRegistration: true,
      requirePayment: true,
    },
  });

  const cysContentSeeded =
    (await prisma.programEssay.count({ where: { programId: cys2026.id } })) > 0 ||
    (await prisma.applicationFormField.count({ where: { programId: cys2026.id } })) > 0;
  if (cysContentSeeded) {
    log('  → CYS 2026 content already seeded, skipping');
    log('✅ Exhaustive CYS Programs seeded');
    return;
  }

  // ==========================================
  // Objectives
  // ==========================================
  await prisma.programObjective.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programObjective.createMany({
    data: objectives.map(o => ({ programId: cys2026.id, ...o })),
  });

  // ==========================================
  // Participation Categories
  // ==========================================
  await prisma.programParticipationCategory.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programParticipationCategory.createMany({
    data: participationCategories.map(c => ({ programId: cys2026.id, ...c })),
  });

  // ==========================================
  // Subthemes
  // ==========================================
  await prisma.programSubtheme.deleteMany({ where: { programId: cys2026.id } });
  for (const s of subthemes) {
    await prisma.programSubtheme.create({
      data: { programId: cys2026.id, ...s, isActive: true },
    });
  }

  // ==========================================
  // Timeline
  // ==========================================
  await prisma.programTimeline.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programTimeline.createMany({
    data: timeline.map(t => ({
      programId: cys2026.id,
      title: t.title,
      description: t.description,
      date: new Date(t.date),
      endDate: t.endDate ? new Date(t.endDate) : null,
      order: t.order,
      isActive: true,
    })),
  });

  // ==========================================
  // Schedule
  // ==========================================
  await prisma.programSchedule.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programSchedule.createMany({
    data: schedule.map(s => ({
      programId: cys2026.id,
      ...s,
    })),
  });

  // ==========================================
  // Pricing Tiers
  // ==========================================
  await prisma.programPricingTier.deleteMany({ where: { programId: cys2026.id } });
  for (const tier of pricingTiers) {
    await prisma.programPricingTier.create({
      data: {
        programId: cys2026.id,
        name: tier.name,
        description: tier.description,
        price: tier.price,
        currency: tier.currency,
        feeType: tier.feeType as PricingFeeType,
        allowedCategories: tier.allowedCategories as ApplicationCategory[],
        benefits: tier.benefits,
        isActive: true,
      },
    });
  }

  // ==========================================
  // Requirements
  // ==========================================
  await prisma.programRequirement.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programRequirement.createMany({
    data: requirements.map(r => ({
      programId: cys2026.id,
      ...r,
      isActive: true,
    })),
  });

  // ==========================================
  // Application Form Fields
  // ==========================================
  await prisma.applicationFormField.deleteMany({ where: { programId: cys2026.id } });
  await prisma.applicationFormField.createMany({
    data: buildLegacySubmissionFormFields().map(f => ({
      programId: cys2026.id,
      ...f,
      isActive: true,
    })),
  });

  // ==========================================
  // Essays
  // ==========================================
  await prisma.programEssay.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programEssay.createMany({
    data: essays.map(e => ({
      programId: cys2026.id,
      ...e,
      isActive: true,
    })),
  });

  // ==========================================
  // FAQs
  // ==========================================
  await prisma.programFaq.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programFaq.createMany({
    data: faqs.map(faq => ({
      programId: cys2026.id,
      question: faq.question,
      answer: faq.answer,
      category: faq.category as FaqCategory,
      order: faq.order,
      isActive: true,
    })),
  });

  // ==========================================
  // Awards
  // ==========================================
  await prisma.programAward.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programAward.createMany({
    data: awards.map(a => ({
      programId: cys2026.id,
      ...a,
    })),
  });

  // ==========================================
  // Team
  // ==========================================
  await prisma.programTeam.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programTeam.createMany({
    data: team.map(t => ({
      programId: cys2026.id,
      ...t,
      isActive: true,
    })),
  });

  // ==========================================
  // Resources
  // ==========================================
  await prisma.programResource.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programResource.createMany({
    data: resources.map(r => ({
      programId: cys2026.id,
      ...r,
    })),
  });

  // ==========================================
  // Announcements
  // ==========================================
  await prisma.programAnnouncement.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programAnnouncement.createMany({
    data: announcements.map(a => ({
      programId: cys2026.id,
      ...a,
    })),
  });

  // ==========================================
  // Participation Info
  // ==========================================
  await prisma.programParticipationInfo.deleteMany({ where: { programId: cys2026.id } });
  for (const info of participationInfo) {
    await prisma.programParticipationInfo.create({
      data: {
        programId: cys2026.id,
        category: info.category as ApplicationCategory,
        benefits: info.benefits,
        requirements: info.requirements,
      },
    });
  }

  // ==========================================
  // Gallery Images
  // ==========================================
  await prisma.programGallery.deleteMany({ where: { programId: cys2026.id, type: 'image' } });
  await prisma.programGallery.createMany({
    data: [
      { programId: cys2026.id, type: 'image', title: 'Opening Ceremony', imageUrl: 'https://placehold.co/800x600/E62C4F/FFF?text=Opening+Ceremony', order: 1, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Keynote Session', imageUrl: 'https://placehold.co/800x600/C0392B/FFF?text=Keynote+Session', order: 2, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Panel Discussion', imageUrl: 'https://placehold.co/800x600/922B21/FFF?text=Panel+Discussion', order: 3, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Cultural Night', imageUrl: 'https://placehold.co/800x600/E62C4F/FFF?text=Cultural+Night', order: 4, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Group Workshop', imageUrl: 'https://placehold.co/800x600/C0392B/FFF?text=Group+Workshop', order: 5, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Innovation Lab', imageUrl: 'https://placehold.co/800x600/922B21/FFF?text=Innovation+Lab', order: 6, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Networking Dinner', imageUrl: 'https://placehold.co/800x600/E62C4F/FFF?text=Networking+Dinner', order: 7, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'City Tour Beijing', imageUrl: 'https://placehold.co/800x600/C0392B/FFF?text=City+Tour+Beijing', order: 8, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Awards Ceremony', imageUrl: 'https://placehold.co/800x600/922B21/FFF?text=Awards+Ceremony', order: 9, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Closing Ceremony', imageUrl: 'https://placehold.co/800x600/E62C4F/FFF?text=Closing+Ceremony', order: 10, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Delegates Group Photo', imageUrl: 'https://placehold.co/800x600/C0392B/FFF?text=Group+Photo', order: 11, isActive: true },
      { programId: cys2026.id, type: 'image', title: 'Leadership Training', imageUrl: 'https://placehold.co/800x600/922B21/FFF?text=Leadership+Training', order: 12, isActive: true },
    ],
  });

  // ==========================================
  // Gallery Videos (highlight videos)
  // ==========================================
  await prisma.programGallery.deleteMany({ where: { programId: cys2026.id, type: 'video' } });
  await prisma.programGallery.createMany({
    data: [
      { programId: cys2026.id, type: 'video', title: 'CYS 2026 Official Trailer', description: 'The official trailer for China Youth Summit 2026.', imageUrl: 'https://placehold.co/800x450/E62C4F/FFF?text=CYS+2026+Trailer', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', order: 1, isActive: true },
      { programId: cys2026.id, type: 'video', title: 'Day 1 Recap', description: 'Highlights from the first day of CYS 2026.', imageUrl: 'https://placehold.co/800x450/C0392B/FFF?text=Day+1+Recap', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', order: 2, isActive: true },
      { programId: cys2026.id, type: 'video', title: 'Cultural Immersion', description: 'Exploring Chinese culture through immersive activities.', imageUrl: 'https://placehold.co/800x450/922B21/FFF?text=Cultural+Immersion', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', order: 3, isActive: true },
    ],
  });

  // ==========================================
  // Speakers
  // ==========================================
  await prisma.programSpeaker.deleteMany({ where: { programId: cys2026.id } });
  await prisma.programSpeaker.createMany({
    data: [
      { programId: cys2026.id, name: 'Dr. Li Wei', title: 'Professor of International Relations', organization: 'Peking University', bio: 'Dr. Li Wei is a leading scholar in international youth diplomacy with over 15 years of experience in cross-cultural education programs across Asia. He has authored numerous papers on youth empowerment and global citizenship.', photoUrl: 'https://placehold.co/400x500/E62C4F/FFF?text=Dr+Li+Wei', email: 'liwei@pku.edu.cn', order: 1, isActive: true },
      { programId: cys2026.id, name: 'Sarah Chen', title: 'CEO & Founder', organization: 'Asia Youth Network', bio: 'Sarah Chen founded Asia Youth Network in 2018, connecting over 50,000 young leaders across 30 countries. Her work focuses on sustainable development and social entrepreneurship.', photoUrl: 'https://placehold.co/400x500/C0392B/FFF?text=Sarah+Chen', linkedinUrl: 'https://linkedin.com/in/sarahchen', order: 2, isActive: true },
      { programId: cys2026.id, name: 'Kenji Yamamoto', title: 'Director of Innovation', organization: 'Global Youth Foundation', bio: 'Kenji brings 10 years of experience leading innovation programs for youth across Asia-Pacific. He specializes in design thinking and social impact.', photoUrl: 'https://placehold.co/400x500/922B21/FFF?text=Kenji+Yamamoto', order: 3, isActive: true },
      { programId: cys2026.id, name: 'Fatima Al-Rahman', title: 'UN Youth Delegate', organization: 'United Nations', bio: 'Fatima served as a UN Youth Delegate representing sustainable development goals. She is passionate about climate action and has spoken at over 40 international conferences.', photoUrl: 'https://placehold.co/400x500/E62C4F/FFF?text=Fatima+Al-Rahman', order: 4, isActive: true },
    ],
  });

  // ==========================================
  // Alumni Testimonials (for alumni stories section)
  // ==========================================
  const existingAlumniTestimonials = await prisma.programTestimonial.findMany({
    where: { brandId: brand.id, category: 'alumni' },
  });
  if (existingAlumniTestimonials.length === 0) {
    await prisma.programTestimonial.createMany({
      data: [
        { brandId: brand.id, programId: cys2026.id, name: 'Zhang Mei', role: 'Software Engineer', testimonial: 'CYS gave me the confidence to pursue my dreams internationally. The connections I made here led to my career breakthrough.', category: 'alumni', type: 'text', avatarUrl: 'https://placehold.co/100x100/E62C4F/FFF?text=ZM', thumbnailUrl: 'https://placehold.co/400x300/E62C4F/FFF?text=Zhang+Mei+Story', isFeatured: true, order: 1, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Raj Patel', role: 'Social Entrepreneur', testimonial: 'The innovation challenge at CYS inspired me to launch my social enterprise. Two years later, we have impacted 10,000 lives.', category: 'alumni', type: 'text', avatarUrl: 'https://placehold.co/100x100/C0392B/FFF?text=RP', thumbnailUrl: 'https://placehold.co/400x300/C0392B/FFF?text=Raj+Patel+Story', isFeatured: true, order: 2, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Yuki Tanaka', role: 'Climate Activist', testimonial: 'Meeting leaders from 60+ countries opened my eyes to the global climate movement. CYS was the catalyst for my advocacy work.', category: 'alumni', type: 'video', videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', avatarUrl: 'https://placehold.co/100x100/922B21/FFF?text=YT', thumbnailUrl: 'https://placehold.co/400x300/922B21/FFF?text=Yuki+Tanaka+Story', isFeatured: true, order: 3, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Amira Hassan', role: 'Policy Analyst', testimonial: 'CYS taught me that leadership is about service. The mentorship I received shaped my approach to public policy.', category: 'alumni', type: 'text', avatarUrl: 'https://placehold.co/100x100/E62C4F/FFF?text=AH', thumbnailUrl: 'https://placehold.co/400x300/E62C4F/FFF?text=Amira+Hassan+Story', isFeatured: false, order: 4, isActive: true },
      ],
    });
  }

  // ==========================================
  // YouTube Shorts (gallery type='short')
  // ==========================================
  const existingShorts = await prisma.programGallery.findMany({
    where: { programId: cys2026.id, type: 'short' },
  });
  if (existingShorts.length === 0) {
    await prisma.programGallery.createMany({
      data: [
        { programId: cys2026.id, type: 'short', title: 'Day 1 Highlights', videoUrl: 'https://www.youtube.com/embed/TnCyfXh_p2M?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/E62C4F/FFF?text=Short+1', order: 1, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Cultural Exchange', videoUrl: 'https://www.youtube.com/embed/Jwgd05MZ4iI?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/C0392B/FFF?text=Short+2', order: 2, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Workshop Moments', videoUrl: 'https://www.youtube.com/embed/vsNbESxF1wM?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/922B21/FFF?text=Short+3', order: 3, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Innovation Challenge', videoUrl: 'https://www.youtube.com/embed/PKJyaMElURY?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/E62C4F/FFF?text=Short+4', order: 4, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Opening Ceremony', videoUrl: 'https://www.youtube.com/embed/2h8vSDcr5PI?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/C0392B/FFF?text=Short+5', order: 5, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Delegate Stories', videoUrl: 'https://www.youtube.com/embed/2OViDwjKre0?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/922B21/FFF?text=Short+6', order: 6, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Awards Night', videoUrl: 'https://www.youtube.com/embed/HX5Wesz0jgk?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/E62C4F/FFF?text=Short+7', order: 7, isActive: true },
        { programId: cys2026.id, type: 'short', title: 'Closing Ceremony', videoUrl: 'https://www.youtube.com/embed/DxDSMQLvyS0?rel=0&mute=1', imageUrl: 'https://placehold.co/360x640/C0392B/FFF?text=Short+8', order: 8, isActive: true },
      ],
    });
  }

  // ==========================================
  // Delegate Testimonials (scrolling cards)
  // ==========================================
  const existingDelegateTestimonials = await prisma.programTestimonial.findMany({
    where: { brandId: brand.id, category: 'delegate' },
  });
  if (existingDelegateTestimonials.length === 0) {
    await prisma.programTestimonial.createMany({
      data: [
        { brandId: brand.id, programId: cys2026.id, name: 'Aiko Tanaka', role: 'Delegate 2024', company: 'Japan', testimonial: 'CYS transformed how I collaborate and lead. The network I built is priceless.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/E62C4F/FFF?text=AT', isFeatured: true, order: 1, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Rafi Pratama', role: 'Finalist 2023', company: 'Indonesia', testimonial: 'Hands-on mentorship and global exposure boosted my confidence tremendously.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/C0392B/FFF?text=RP', isFeatured: false, order: 2, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Mina Park', role: 'Participant 2022', company: 'South Korea', testimonial: 'I learned to turn ideas into action while meeting inspiring people from many fields.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/922B21/FFF?text=MP', isFeatured: false, order: 3, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Samuel Lee', role: 'Delegate 2025', company: 'United States', testimonial: 'An empowering space to innovate for sustainability and cross-cultural understanding.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/E62C4F/FFF?text=SL', isFeatured: false, order: 4, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Nadia Putri', role: 'Alumni', company: 'Indonesia', testimonial: 'Opportunities and friendships that last well beyond the program.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/C0392B/FFF?text=NP', isFeatured: false, order: 5, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Akira Watanabe', role: 'Volunteer', company: 'Japan', testimonial: 'Incredible energy and impact. Every session felt deeply meaningful.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/922B21/FFF?text=AW', isFeatured: false, order: 6, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Sophie Müller', role: 'Delegate 2024', company: 'Germany', testimonial: 'I leave with a global mindset, a project idea, and 300 new friends.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/E62C4F/FFF?text=SM', isFeatured: false, order: 7, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Chen Wei', role: 'Participant 2023', company: 'China', testimonial: 'The innovation challenge pushed me to think beyond borders and lead with empathy.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/C0392B/FFF?text=CW', isFeatured: false, order: 8, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Amara Diallo', role: 'Delegate 2025', company: 'Senegal', testimonial: 'CYS gave me the confidence to speak up and the platform to be heard globally.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/922B21/FFF?text=AD', isFeatured: false, order: 9, isActive: true },
        { brandId: brand.id, programId: cys2026.id, name: 'Lucas Ferreira', role: 'Alumni', company: 'Brazil', testimonial: 'A life-changing week that shaped my career path and gave me a second family.', category: 'delegate', type: 'text', avatarUrl: 'https://placehold.co/80x80/E62C4F/FFF?text=LF', isFeatured: false, order: 10, isActive: true },
      ],
    });
  }

  // ==========================================
  // Previous CYS Programs (past editions)
  // ==========================================
  const pastEditions = [
    {
      id: 'c1a2e3f4-0001-4000-8000-111122223325',
      slug: 'china-youth-summit-2025',
      name: 'China Youth Summit 2025',
      year: 2025,
      startDate: new Date('2025-07-02'),
      endDate: new Date('2025-07-15'),
      location: 'Beijing, China',
      thumbnailUrl: 'https://placehold.co/600x400/E62C4F/FFF?text=CYS+2025',
      bannerUrl: 'https://placehold.co/1200x400/E62C4F/FFF?text=CYS+Beijing+2025',
      shortDescription: 'The fifth edition of China Youth Summit — Building Bridges, Shaping Futures.',
    },
    {
      id: 'c1a2e3f4-0001-4000-8000-111122223324',
      slug: 'china-youth-summit-2024',
      name: 'China Youth Summit 2024',
      year: 2024,
      startDate: new Date('2024-07-03'),
      endDate: new Date('2024-07-16'),
      location: 'Shanghai, China',
      thumbnailUrl: 'https://placehold.co/600x400/C0392B/FFF?text=CYS+2024',
      bannerUrl: 'https://placehold.co/1200x400/C0392B/FFF?text=CYS+Shanghai+2024',
      shortDescription: 'The fourth edition of China Youth Summit — Youth in Action for Sustainable China.',
    },
  ];

  for (const edition of pastEditions) {
    await prisma.program.upsert({
      where: { brandId_slug: { brandId: brand.id, slug: edition.slug } },
      update: {
        status: 'completed',
        isActive: false,
        isPublished: true,
        thumbnailUrl: edition.thumbnailUrl,
        bannerUrl: edition.bannerUrl,
      },
      create: {
        id: edition.id,
        brandId: brand.id,
        name: edition.name,
        slug: edition.slug,
        year: edition.year,
        startDate: edition.startDate,
        endDate: edition.endDate,
        location: edition.location,
        status: 'completed',
        applicationDeadline: edition.endDate,
        shortDescription: edition.shortDescription,
        thumbnailUrl: edition.thumbnailUrl,
        bannerUrl: edition.bannerUrl,
        isPublished: true,
        isActive: false,
        isVisibleToUsers: true,
        allowRegistration: false,
        requirePayment: false,
      },
    });
  }

  log('✅ Exhaustive CYS Programs seeded');
}
