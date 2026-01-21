import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting specific brand seeding for WYF and JYS...');

  // ==========================================
  // 1. World Youth Fest
  // ==========================================
  
  const wyfBrand = await prisma.programCategory.upsert({
    where: { slug: 'world-youth-fest' },
    update: {
      name: 'World Youth Fest',
      websiteUrl: 'https://worldyouthfest.com',
      contactEmail: 'admin@worldyouthfest.com',
      logoUrl: 'https://cdn.youthbreaktheboundaries.com/brands/wyf-logo.png', // Placeholder
      primaryColor: '#F59E0B', // Amber
      isActive: true,
    },
    create: {
      name: 'World Youth Fest',
      slug: 'world-youth-fest',
      description: 'World Youth Fest is a global platform for youth.',
      websiteUrl: 'https://worldyouthfest.com',
      contactEmail: 'admin@worldyouthfest.com',
      logoUrl: 'https://cdn.youthbreaktheboundaries.com/brands/wyf-logo.png', // Placeholder
      primaryColor: '#F59E0B', // Amber
      isActive: true,
    },
  });
  console.log(`✅ Brand created/updated: ${wyfBrand.name}`);

  // Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: wyfBrand.id },
    update: {},
    create: {
      programCategoryId: wyfBrand.id,
      isMaintenanceMode: false,
      usdInIdr: 16000,
      footerNavigation: [
        {
          title: "Quick Links",
          items: [
            { label: "Home", url: "/" },
            { label: "Programs", url: "/programs" }
          ]
        }
      ]
    }
  });

  // Program: World Youth Fest 2025
  const wyf2025 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: wyfBrand.id,
        slug: 'world-youth-fest-2025',
      },
    },
    update: {},
    create: {
      programCategoryId: wyfBrand.id,
      name: 'World Youth Fest 2025',
      slug: 'world-youth-fest-2025',
      description: 'The biggest youth festival in the world.',
      shortDescription: 'Join us in Kuala Lumpur.',
      year: 2025,
      startDate: new Date('2025-07-20'),
      endDate: new Date('2025-07-23'),
      applicationDeadline: new Date('2025-05-30'),
      location: 'Kuala Lumpur, Malaysia',
      capacity: 800,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      logoUrl: 'https://cdn.youthbreaktheboundaries.com/programs/wyf2025-logo.png',
      requireEmailVerification: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2025-01-01'),
      registrationCloseDate: new Date('2025-05-30'),
      requirePayment: true,
      registrationFee: 100.00,
      currency: 'USD',
    },
  });
  console.log(`✅ Program created/updated: ${wyf2025.name}`);

  // Content for WYF 2025
  await seedProgramContent(prisma, wyf2025.id);


  // ==========================================
  // 2. Japan Youth Summit
  // ==========================================

  const jysBrand = await prisma.programCategory.upsert({
    where: { slug: 'japan-youth-summit' },
    update: {
      name: 'Japan Youth Summit',
      websiteUrl: 'https://japanyouthsummit.com',
      contactEmail: 'admin@japanyouthsummit.com',
      logoUrl: 'https://cdn.youthbreaktheboundaries.com/brands/jys-logo.png', // Placeholder
      primaryColor: '#EF4444', // Red
      isActive: true,
    },
    create: {
      name: 'Japan Youth Summit',
      slug: 'japan-youth-summit',
      description: 'Japan Youth Summit connects future leaders in Osaka.',
      websiteUrl: 'https://japanyouthsummit.com',
      contactEmail: 'admin@japanyouthsummit.com',
      logoUrl: 'https://cdn.youthbreaktheboundaries.com/brands/jys-logo.png', // Placeholder
      primaryColor: '#EF4444', // Red
      isActive: true,
    },
  });
  console.log(`✅ Brand created/updated: ${jysBrand.name}`);

  // Settings
  await prisma.programCategorySetting.upsert({
    where: { programCategoryId: jysBrand.id },
    update: {},
    create: {
      programCategoryId: jysBrand.id,
      isMaintenanceMode: false,
      usdInIdr: 16000,
      footerNavigation: [
        {
          title: "Quick Links",
          items: [
            { label: "Home", url: "/" },
            { label: "Programs", url: "/programs" }
          ]
        }
      ]
    }
  });

  // Program: Japan Youth Summit 2025
  const jys2025 = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: jysBrand.id,
        slug: 'japan-youth-summit-2025',
      },
    },
    update: {},
    create: {
      programCategoryId: jysBrand.id,
      name: 'Japan Youth Summit 2025',
      slug: 'japan-youth-summit-2025',
      description: 'Exchange ideas and culture in the heart of Japan.',
      shortDescription: 'Leadership summit in Osaka.',
      year: 2025,
      startDate: new Date('2025-08-10'),
      endDate: new Date('2025-08-13'),
      applicationDeadline: new Date('2025-06-15'),
      location: 'Osaka, Japan',
      capacity: 400,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      logoUrl: 'https://cdn.youthbreaktheboundaries.com/programs/jys2025-logo.png',
      requireEmailVerification: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2025-02-01'),
      registrationCloseDate: new Date('2025-06-15'),
      requirePayment: true,
      registrationFee: 200.00,
      currency: 'USD',
    },
  });
  console.log(`✅ Program created/updated: ${jys2025.name}`);

  // Content for JYS 2025
  await seedProgramContent(prisma, jys2025.id);

  console.log('🎉 Brand seeding completed!');
}

async function seedProgramContent(prisma: PrismaClient, programId: string) {
  // 1. Timeline
  const timelineData = [
    { title: 'Registration Opens', date: '2025-02-01', description: 'Early bird registration begins.', order: 1 },
    { title: 'Regular Registration', date: '2025-04-01', description: 'Regular registration period.', order: 2 },
    { title: 'Registration Closes', date: '2025-06-15', description: 'Last day to apply.', order: 3 },
    { title: 'Announcement', date: '2025-07-01', description: 'Selected participants announced.', order: 4 },
    { title: 'Program Start', date: '2025-08-10', description: 'Welcome to the event!', order: 5 },
  ];

  for (const t of timelineData) {
    await prisma.programTimeline.create({
      data: {
        programId,
        title: t.title,
        date: new Date(t.date),
        description: t.description,
        order: t.order,
        isActive: true
      }
    });
  }

  // 2. Schedule
  const scheduleData = [
    { day: 'Day 1', start: '08:00', end: '12:00', activity: 'Opening Ceremony', desc: 'Welcome speech and cultural performance.', loc: 'Grand Hall' },
    { day: 'Day 1', start: '13:00', end: '17:00', activity: 'Keynote Session', desc: 'Insights from global leaders.', loc: 'Grand Hall' },
    { day: 'Day 2', start: '09:00', end: '12:00', activity: 'Group Discussion', desc: 'Brainstorming solutions for SDGs.', loc: 'Meeting Rooms' },
    { day: 'Day 2', start: '13:00', end: '16:00', activity: 'Project Presentation', desc: 'Groups present their ideas.', loc: 'Meeting Rooms' },
    { day: 'Day 3', start: '09:00', end: '17:00', activity: 'City Tour', desc: 'Exploring the cultural heritage.', loc: 'City Center' },
    { day: 'Day 3', start: '19:00', end: '22:00', activity: 'Gala Dinner & Awards', desc: 'Closing ceremony and awarding night.', loc: 'Ballroom' },
  ];

  for (const [index, s] of scheduleData.entries()) {
    await prisma.programSchedule.create({
      data: {
        programId,
        day: s.day,
        startTime: s.start,
        endTime: s.end,
        activity: s.activity,
        description: s.desc,
        location: s.loc,
        order: index + 1,
        isActive: true
      }
    });
  }

  // 3. Speakers
  const speakerData = [
    { name: 'Dr. Sarah Connor', title: 'Environmental Scientist', bio: 'Expert in climate change and sustainability.', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
    { name: 'James T. Kirk', title: 'Leadership Coach', bio: 'Inspiring youth to reach the stars.', photo: 'https://randomuser.me/api/portraits/men/32.jpg' },
    { name: 'Yuki Tanaka', title: 'Social Entrepreneur', bio: 'Founder of Tech for Good Japan.', photo: 'https://randomuser.me/api/portraits/women/68.jpg' },
    { name: 'Ahmed Al-Fayed', title: 'Policy Analyst', bio: 'Specialist in international relations.', photo: 'https://randomuser.me/api/portraits/men/85.jpg' },
  ];

  for (const [index, s] of speakerData.entries()) {
    await prisma.programSpeaker.create({
      data: {
        programId,
        name: s.name,
        title: s.title,
        bio: s.bio,
        photoUrl: s.photo,
        order: index + 1,
        isActive: true
      }
    });
  }

  // 4. Pricing Tiers
  await prisma.programPricingTier.create({
    data: {
      programId,
      name: 'Fully Funded',
      description: 'Competitive selection. Includes flights, accommodation, and meals.',
      price: 0,
      currency: 'USD',
      feeType: 'registration_fee',
      target: 'fully_funded',
      isActive: true,
      order: 1,
      benefits: ['Return Flights', 'Hotel Accommodation', 'Meals & Transport', 'Certificate', 'Merchandise Kit']
    }
  });
  
  await prisma.programPricingTier.create({
    data: {
      programId,
      name: 'Partial Funded',
      description: 'Covering accommodation and meals. Flights not included.',
      price: 250,
      currency: 'USD',
      feeType: 'full_fee',
      target: 'partial_funded', // Assuming enum has this or similar
      isActive: true,
      order: 2,
      benefits: ['Hotel Accommodation', 'Meals & Transport', 'Certificate', 'Merchandise Kit']
    }
  });

  await prisma.programPricingTier.create({
    data: {
      programId,
      name: 'Self Funded',
      description: 'Guaranteed spot upon payment. Full access to the event.',
      price: 450,
      currency: 'USD',
      feeType: 'full_fee',
      target: 'self_funded',
      isActive: true,
      order: 3,
      benefits: ['Access to all sessions', 'Certificate', 'Merchandise Kit', 'Networking Dinner']
    }
  });
  
  // 5. FAQs
  const faqData = [
    { q: 'Is flight ticket included?', a: 'Flight tickets are only included for Fully Funded participants.', cat: 'general' },
    { q: 'Do I need a visa?', a: 'Participants are responsible for their own visa. We will provide an invitation letter.', cat: 'visa' },
    { q: 'Can I bring my parents?', a: 'The program is designed for youth. Parents may accompany but cannot attend sessions.', cat: 'general' },
    { q: 'What is the refund policy?', a: 'Registration fees are non-refundable.', cat: 'payment' },
    { q: 'Is halal food available?', a: 'Yes, all meals provided are No Pork / No Lard. Halal options are available.', cat: 'accommodation' },
  ];

  for (const [index, f] of faqData.entries()) {
    await prisma.programFaq.create({
      data: {
        programId,
        question: f.q,
        answer: f.a,
        category: f.cat as any, 
        order: index + 1,
        isActive: true
      }
    });
  }

  // 6. Sponsors
  const sponsorData = [
    { name: 'Global Youth Alliance', type: 'organization', logo: 'https://placehold.co/400x200/png' },
    { name: 'TechFuture Inc.', type: 'corporate', logo: 'https://placehold.co/400x200/png' },
    { name: 'Visit Osaka', type: 'government', logo: 'https://placehold.co/400x200/png' },
  ];
  
  // Note: Sponsors are linked to ProgramCategory (Brand), not Program directly in schema usually, 
  // but looking at schema: model Sponsor { programCategoryId ... }
  // We need to fetch the program to get the category ID first.
  const program = await prisma.program.findUnique({ where: { id: programId }, select: { programCategoryId: true }});
  
  if (program) {
      for (const [index, s] of sponsorData.entries()) {
        await prisma.sponsor.create({
            data: {
                programCategoryId: program.programCategoryId,
                name: s.name,
                type: s.type,
                logoUrl: s.logo,
                order: index + 1,
                isActive: true
            }
        });
      }
  }

  // 7. Gallery
  for (let i = 1; i <= 6; i++) {
    await prisma.programGallery.create({
        data: {
            programId,
            imageUrl: `https://picsum.photos/800/600?random=${i}`,
            title: `Event Highlight ${i}`,
            type: 'image',
            order: i,
            isActive: true
        }
    });
  }

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
