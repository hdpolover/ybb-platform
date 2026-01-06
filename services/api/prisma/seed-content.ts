import { PrismaClient, FaqCategory } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding program content...');

  // 1. Get existing Program and Program Category
  // We need at least one program to attach content to.
  // If no program exists, we'll create a dummy hierarchy.
  
  let category = await prisma.programCategory.findFirst({ where: { slug: 'ayimun' } });
  if (!category) {
    category = await prisma.programCategory.create({
      data: {
        name: 'Asia Youth International Model United Nations',
        slug: 'ayimun',
        description: 'Mock UN conference',
        websiteUrl: 'https://modelunitednations.org',
        contactEmail: 'admin@modelunitednations.org',
        primaryColor: '#0056B3',
      },
    });
    console.log('Created dummy category: AYIMUN');
  }

  let program = await prisma.program.findFirst({ 
    where: { 
        programCategoryId: category.id,
        year: 2025 
    } 
  });

  if (!program) {
    program = await prisma.program.create({
      data: {
        programCategoryId: category.id,
        name: 'Asia Youth International MUN 2025',
        slug: 'ayimun-2025',
        description: 'Model United Nations conference in Malaysia.',
        shortDescription: 'Join 500+ delegates in KL.',
        year: 2025,
        startDate: new Date('2025-05-15'),
        endDate: new Date('2025-05-18'),
        applicationDeadline: new Date('2025-03-31'),
        location: 'Kuala Lumpur, Malaysia',
        status: 'published',
        isPublished: true,
        isVisibleToUsers: true,
        isActive: true,
      },
    });
    console.log('Created dummy program: AYIMUN 2025');
  }

  const programId = program.id;

  // --- 2. Seed Timeline ---
  await prisma.programTimeline.deleteMany({ where: { programId } });
  await prisma.programTimeline.createMany({
    data: [
      {
        programId,
        title: 'Registration Opens',
        date: new Date('2024-11-01'),
        description: 'Early bird registration begins for all delegates.',
        icon: 'check-circle',
        order: 1,
      },
      {
        programId,
        title: 'Registration Closes',
        date: new Date('2025-03-31'),
        description: 'Last day to submit applications and payments.',
        icon: 'clock',
        order: 2,
      },
      {
        programId,
        title: 'Program Start',
        date: new Date('2025-05-15'),
        description: 'Arrival of delegates in Kuala Lumpur.',
        icon: 'plane',
        order: 3,
      },
    ],
  });
  console.log('- Seeded Timelines');

  // --- 3. Seed Schedules ---
  await prisma.programSchedule.deleteMany({ where: { programId } });
  await prisma.programSchedule.createMany({
    data: [
      {
        programId,
        day: 'Day 1',
        startTime: '09:00',
        endTime: '12:00',
        activity: 'Opening Ceremony',
        location: 'Grand Ballroom',
        description: 'Official opening speeches and cultural performances.',
        order: 1,
      },
      {
        programId,
        day: 'Day 1',
        startTime: '13:00',
        endTime: '17:00',
        activity: 'Committee Session I',
        location: 'Breakout Rooms',
        description: 'First session of council debates.',
        order: 2,
      },
      {
        programId,
        day: 'Day 2',
        startTime: '09:00',
        endTime: '17:00',
        activity: 'Committee Session II & III',
        location: 'Breakout Rooms',
        description: 'Full day of council sessions.',
        order: 3,
      },
      {
        programId,
        day: 'Day 3',
        startTime: '19:00',
        endTime: '22:00',
        activity: 'Gala Dinner',
        location: 'Rooftop Garden',
        description: 'Awarding night and farewell dinner.',
        order: 4,
      },
    ],
  });
  console.log('- Seeded Schedules');

  // --- 4. Seed Speakers ---
  await prisma.programSpeaker.deleteMany({ where: { programId } });
  await prisma.programSpeaker.createMany({
    data: [
      {
        programId,
        name: 'Jane Doe',
        title: 'UN Representative',
        organization: 'United Nations',
        bio: 'Jane has over 15 years of experience in diplomatic relations.',
        photoUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
        order: 1,
      },
      {
        programId,
        name: 'Dr. John Smith',
        title: 'Professor of International Relations',
        organization: 'University of Malay',
        bio: 'An expert in Southeast Asian politics and conflict resolution.',
        photoUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
        order: 2,
      },
    ],
  });
  console.log('- Seeded Speakers');

  // --- 5. Seed Gallery ---
  await prisma.programGallery.deleteMany({ where: { programId } });
  await prisma.programGallery.createMany({
    data: [
      {
        programId,
        title: 'Opening Ceremony 2024',
        imageUrl: 'https://images.unsplash.com/photo-1544928147-79a794764548?q=80&w=2785&auto=format&fit=crop',
        type: 'image',
        order: 1,
      },
      {
        programId,
        title: 'Committee Sessions',
        imageUrl: 'https://images.unsplash.com/photo-1551818255-e6e10975bc17?q=80&w=2873&auto=format&fit=crop',
        type: 'image',
        order: 2,
      },
      {
        programId,
        title: 'Cultural Night',
        imageUrl: 'https://images.unsplash.com/photo-1514525253440-b39345208668?q=80&w=2787&auto=format&fit=crop',
        type: 'image',
        order: 3,
      },
    ],
  });
  console.log('- Seeded Gallery');

  // --- 6. Seed Testimonials ---
  await prisma.programTestimonial.deleteMany({ where: { programId } });
  await prisma.programTestimonial.createMany({
    data: [
      {
        programId,
        name: 'Sarah Lee',
        role: 'Delegate from South Korea',
        testimonial: 'This program changed my life! I met so many amazing people.',
        avatarUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
        rating: 5,
        isFeatured: true,
        order: 1,
      },
      {
        programId,
        name: 'Ahmed Al-Fayed',
        role: 'Delegate from Egypt',
        testimonial: 'The debate quality was top-notch. Highly recommended.',
        avatarUrl: 'https://randomuser.me/api/portraits/men/86.jpg',
        rating: 5,
        isFeatured: true,
        order: 2,
      },
    ],
  });
  console.log('- Seeded Testimonials');

  // --- 7. Seed FAQs ---
  await prisma.programFaq.deleteMany({ where: { programId } });
  await prisma.programFaq.createMany({
    data: [
      {
        programId,
        question: 'Is accommodation included?',
        answer: 'Yes, accommodation is included in the full-board package at a 4-star hotel.',
        category: FaqCategory.accommodation,
        order: 1,
      },
      {
        programId,
        question: 'Do I need a visa?',
        answer: 'It depends on your nationality. We will provide an invitation letter to support your visa application.',
        category: FaqCategory.visa,
        order: 2,
      },
      {
        programId,
        question: 'Is there an age limit?',
        answer: 'The program is open to youth aged 17-30 years old.',
        category: FaqCategory.registration,
        order: 3,
      },
      {
        programId,
        question: 'Can I bring a guest?',
        answer: 'Guests are allowed but must register separately as observers.',
        category: FaqCategory.general,
        order: 4,
      },
      {
        programId,
        question: 'Is flight ticket included?',
        answer: 'No, flight tickets are not included in the registration fee.',
        category: FaqCategory.payment,
        order: 5,
      },
    ],
  });
  console.log('- Seeded FAQs');

  // --- 8. Seed Pricing Tiers ---
  await prisma.programPricingTier.deleteMany({ where: { programId } });
  await prisma.programPricingTier.createMany({
    data: [
      {
        programId,
        name: 'Early Bird - Full Delegate',
        price: 350.00,
        currency: 'USD',
        description: 'Includes accommodation, meals, and kit.',
        validFrom: new Date('2024-11-01'),
        validUntil: new Date('2024-12-31'),
        benefits: ["Hotel Accommodation", "3 Meals/Day", "Conference Kit", "Certificate"],
        order: 1,
      },
      {
        programId,
        name: 'Regular - Full Delegate',
        price: 450.00,
        currency: 'USD',
        description: 'Standard rate including accommodation.',
        validFrom: new Date('2025-01-01'),
        validUntil: new Date('2025-03-31'),
        benefits: ["Hotel Accommodation", "3 Meals/Day", "Conference Kit", "Certificate"],
        order: 2,
      },
    ],
  });
  console.log('- Seeded Pricing Tiers');
  
  // --- 9. Seed Requirements ---
   await prisma.programRequirement.deleteMany({ where: { programId } });
   await prisma.programRequirement.createMany({
    data: [
      {
        programId,
        name: 'Passport Scan',
        type: 'file',
        isRequired: true,
        fileMaxSize: 2048,
        fileAllowedTypes: 'pdf,jpg,png',
        description: 'Please upload a clear scan of your passport ID page.',
        order: 1,
      },
      {
        programId,
        name: 'Motivation Letter',
        type: 'text',
        isRequired: true,
        description: 'Why do you want to join this program? (Max 500 words)',
        order: 2,
      },
      {
        programId,
        name: 'T-Shirt Size',
        type: 'select',
        isRequired: true,
        options: ["XS", "S", "M", "L", "XL", "XXL"],
        order: 3,
      }
    ]
   });
   console.log('- Seeded Requirements');

  // --- 10. Seed Brand Sponsors ---
  await prisma.sponsor.deleteMany({ where: { programCategoryId: category.id } });
  await prisma.sponsor.createMany({
    data: [
      {
        programCategoryId: category.id,
        name: 'University of Malay',
        type: 'organization',
        tier: 'platinum',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/en/thumb/5/53/University_of_Malaya_coat_of_arms.svg/1200px-University_of_Malaya_coat_of_arms.svg.png',
        websiteUrl: 'https://um.edu.my',
        description: 'Leading research university in Malaysia.',
        order: 1,
      },
      {
        programCategoryId: category.id,
        name: 'Malaysia Airlines',
        type: 'organization',
        tier: 'gold',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Malaysia_Airlines_Logo.svg/1200px-Malaysia_Airlines_Logo.svg.png',
        websiteUrl: 'https://www.malaysiaairlines.com',
        description: 'Official Airline Partner.',
        order: 2,
      },
      {
        programCategoryId: category.id,
        name: 'CNN Indonesia',
        type: 'media_partner',
        tier: 'partner',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9f/CNN_Indonesia.svg/1200px-CNN_Indonesia.svg.png',
        websiteUrl: 'https://www.cnnindonesia.com',
        description: 'Official Media Partner.',
        order: 3,
      },
      {
        programCategoryId: category.id,
        name: 'Bank Central Asia',
        type: 'organization',
        tier: 'silver',
        logoUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/5/5c/Bank_Central_Asia.svg/1200px-Bank_Central_Asia.svg.png',
        websiteUrl: 'https://www.bca.co.id',
        description: 'Financial Partner.',
        order: 4,
      }
    ]
  });
  console.log('- Seeded Brand Sponsors');

  console.log('Seed completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
