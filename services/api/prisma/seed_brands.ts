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
  await prisma.programTimeline.create({
    data: {
      programId,
      title: 'Registration',
      date: new Date('2025-02-01'),
      description: 'Opening of registration.',
      order: 1,
      isActive: true
    }
  });
  await prisma.programTimeline.create({
    data: {
      programId,
      title: 'Event Days',
      date: new Date('2025-08-10'),
      description: 'The main event.',
      order: 2,
      isActive: true
    }
  });

  // 2. Schedule
  await prisma.programSchedule.create({
    data: {
      programId,
      day: 'Day 1',
      startTime: '08:00',
      endTime: '12:00',
      activity: 'Opening',
      description: 'Opening Ceremony',
      order: 1,
    }
  });

  // 3. Speakers
  await prisma.programSpeaker.create({
    data: {
      programId,
      name: 'Famous Speaker',
      title: 'Expert',
      bio: 'An expert in the field.',
      photoUrl: 'https://randomuser.me/api/portraits/lego/1.jpg',
      order: 1
    }
  });

  // 4. Pricing Tiers
  await prisma.programPricingTier.create({
    data: {
      programId,
      name: 'Full Funded',
      description: 'Competitive selection.',
      price: 0,
      currency: 'USD',
      feeType: 'registration_fee',
      target: 'fully_funded',
      isActive: true
    }
  });
  await prisma.programPricingTier.create({
    data: {
      programId,
      name: 'Self Funded',
      description: 'Guaranteed spot upon payment.',
      price: 150,
      currency: 'USD',
      feeType: 'full_fee',
      target: 'self_funded',
      isActive: true
    }
  });
  
  // 5. FAQs
  await prisma.programFaq.create({
    data: {
      programId,
      question: 'Where is it?',
      answer: 'See program details.',
      category: 'general', 
      order: 1
    }
  });

}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
