
import { PrismaClient, PricingFeeType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';
import { v4 as uuidv4 } from 'uuid';

// -------------------------------------------------------------
// Fix for Prisma 7 + Postgres Adapter in Seed Script
// -------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// -------------------------------------------------------------

async function main() {
  console.log('🌱 Starting Comprehensive YAF Seeding...');

  // ==========================================
  // 1. DATA CONSTANTS
  // ==========================================
  
  const CATEGORY_SLUG = 'youth-academic-forum';
  const PROGRAM_SLUG = 'youth-academic-forum-2025';

  // ==========================================
  // 2. CATEGORY SETUP
  // ==========================================
  
  console.log('Creating/Updating Category...');
  const category = await prisma.programCategory.upsert({
    where: { slug: CATEGORY_SLUG },
    update: {
      name: 'Youth Academic Forum',
      description: 'A global platform for young scholars to present research and engage in academic discourse.',
      about: 'The Youth Academic Forum (YAF) is a prestigious international conference designed to foster academic excellence among youth. We provide a platform for young researchers, students, and aspiring scholars to present their work, engage in critical discussions, and network with like-minded peers from around the globe.',
      vision: 'To build a generation of critical thinkers and academic leaders who contribute to global knowledge.',
      mission: 'To provide accessible academic platforms for youth to showcase their research and innovation.',
      bannerUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop', // Lecture hall
      websiteUrl: 'https://youthacademicforum.com',
      logoUrl: 'https://pub-4569e4e5d557452e89e34c3dc0142998.r2.dev/yaf-logo-placeholder.png',
      primaryColor: '#15803d', // Green
      socialMediaLinks: {
        instagram: 'https://instagram.com/youthacademicforum',
        linkedin: 'https://linkedin.com/company/youthacademicforum'
      }
    },
    create: {
      name: 'Youth Academic Forum',
      slug: CATEGORY_SLUG,
      description: 'A global platform for young scholars to present research and engage in academic discourse.',
      about: 'The Youth Academic Forum (YAF) is a prestigious international conference designed to foster academic excellence among youth.',
      vision: 'To build a generation of critical thinkers and academic leaders.',
      mission: 'To provide accessible academic platforms for youth.',
      bannerUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop',
      websiteUrl: 'https://youthacademicforum.com',
      primaryColor: '#15803d',
    },
  });

  // ==========================================
  // 3. PROGRAM SETUP
  // ==========================================
  
  console.log('Creating/Updating Program...');
  const program = await prisma.program.upsert({
    where: {
      programCategoryId_slug: {
        programCategoryId: category.id,
        slug: PROGRAM_SLUG,
      },
    },
    update: {
      name: 'Youth Academic Forum 2025',
      shortDescription: 'Join the premier academic conference for youth in Bali, Indonesia.',
      description: `
        <h2>Welcome to YAF 2025</h2>
        <p>The Youth Academic Forum 2025 is set to be our biggest event yet. Taking place in the cultural heart of Bali, this year's theme "Innovation for Sustainable Development" challenges participants to bring their best research and ideas to the table.</p>
        <h3>Why Participate?</h3>
        <ul>
            <li><strong>Global Networking:</strong> Meet delegates from over 30 countries.</li>
            <li><strong>Expert Mentorship:</strong> Get feedback from distinguished professors.</li>
            <li><strong>Publication Opportunity:</strong> Best papers will be published in our partner journals.</li>
        </ul>
      `,
      location: 'Bali, Indonesia',
      year: 2025,
      startDate: new Date('2025-08-15'),
      endDate: new Date('2025-08-18'),
      status: 'published',
      isPublished: true,
      isVisibleToUsers: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2025-01-01'),
      registrationCloseDate: new Date('2025-06-30'),
      bannerUrl: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=1974&auto=format&fit=crop', // Seminar
      thumbnailUrl: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?q=80&w=1949&auto=format&fit=crop', // Reading
    },
    create: {
      programCategoryId: category.id,
      name: 'Youth Academic Forum 2025',
      slug: PROGRAM_SLUG,
      shortDescription: 'Join the premier academic conference for youth in Bali, Indonesia.',
      description: '<p>The Youth Academic Forum 2025 is set to be our biggest event yet...</p>',
      location: 'Bali, Indonesia',
      year: 2025,
      startDate: new Date('2025-08-15'),
      endDate: new Date('2025-08-18'),
      status: 'published',
      isPublished: true,
      isVisibleToUsers: true,
      allowRegistration: true,
      registrationOpenDate: new Date('2025-01-01'),
      registrationCloseDate: new Date('2025-06-30'),
      applicationDeadline: new Date('2025-06-30'),
      bannerUrl: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=1974&auto=format&fit=crop',
    },
  });

  // ==========================================
  // 4. SPONSORS & PARTNERS
  // ==========================================
  console.log('Seeding Sponsors...');
  // Clear existing sponsors for this category to avoid duplicates/mess (optional, but cleaner for seeding)
  await prisma.sponsor.deleteMany({ where: { programCategoryId: category.id } });
  
  await prisma.sponsor.createMany({
    data: [
      {
        programCategoryId: category.id,
        name: 'Global Education Org',
        type: 'organization',
        tier: 'platinum',
        logoUrl: 'https://placehold.co/400x200/2563eb/ffffff?text=GEO',
        websiteUrl: 'https://example.com',
        order: 1
      },
      {
        programCategoryId: category.id,
        name: 'Tech Future Institute',
        type: 'organization',
        tier: 'gold',
        logoUrl: 'https://placehold.co/400x200/ea580c/ffffff?text=TechFuture',
        websiteUrl: 'https://example.com',
        order: 2
      },
      {
        programCategoryId: category.id,
        name: 'Bali University',
        type: 'university',
        tier: 'silver',
        logoUrl: 'https://placehold.co/400x200/16a34a/ffffff?text=Bali+Univ',
        websiteUrl: 'https://example.com',
        order: 3
      },
      {
        programCategoryId: category.id,
        name: 'The Academic Daily',
        type: 'media_partner',
        tier: 'media',
        logoUrl: 'https://placehold.co/400x200/dc2626/ffffff?text=News',
        websiteUrl: 'https://example.com',
        order: 4
      }
    ]
  });

  // ==========================================
  // 5. TESTIMONIALS
  // ==========================================
  console.log('Seeding Testimonials...');
  await prisma.programTestimonial.deleteMany({ where: { programCategoryId: category.id } });

  await prisma.programTestimonial.createMany({
    data: [
      {
        programCategoryId: category.id,
        programId: program.id,
        name: 'Sarah Jenkins',
        role: 'Best Presenter 2024',
        company: 'Oxford University Student',
        testimonial: 'YAF gave me the confidence to present my research on a global stage. The feedback from the mentors was invaluable for my academic career.',
        avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
        category: 'alumni',
        order: 1,
        isFeatured: true
      },
      {
        programCategoryId: category.id,
        programId: program.id,
        name: 'Michael Chen',
        role: 'Delegate 2023',
        company: 'NUS Singapore',
        testimonial: 'Networked with amazing people from 50 different countries. Truly a life changing experience in professional development.',
        avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
        category: 'alumni',
        order: 2,
        isFeatured: true
      },
      {
        programCategoryId: category.id,
        programId: program.id,
        name: 'Dr. Amira Patel',
        role: 'Keynote Speaker',
        company: 'UNESCO',
        testimonial: 'I was impressed by the quality of papers presented by these young minds. YAF is doing important work for the future of academia.',
        avatarUrl: 'https://randomuser.me/api/portraits/women/68.jpg',
        category: 'speaker',
        order: 3,
        isFeatured: false
      }
    ]
  });

  // ==========================================
  // 6. GALLERY & VIDEOS
  // ==========================================
  console.log('Seeding Gallery...');
  await prisma.programGallery.deleteMany({ where: { programId: program.id } });

  await prisma.programGallery.createMany({
    data: [
      {
        programId: program.id,
        type: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1544531696-297afda3046e?q=80&w=2000&auto=format&fit=crop',
        title: 'Opening Ceremony',
        order: 1
      },
      {
        programId: program.id,
        type: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1515168816969-950d6f543167?q=80&w=1974&auto=format&fit=crop',
        title: 'Panel Discussion',
        order: 2
      },
      {
        programId: program.id,
        type: 'image',
        imageUrl: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?q=80&w=2000&auto=format&fit=crop',
        title: 'Gala Dinner',
        order: 3
      },
      {
        programId: program.id,
        type: 'video',
        imageUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg', // Thumbnail
        videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        title: 'YAF 2024 Highlights',
        order: 4
      }
    ]
  });

  // ==========================================
  // 7. SOCIAL FEED
  // ==========================================
  console.log('Seeding Social Feed...');
  await prisma.programSocialFeed.deleteMany({ where: { programCategoryId: category.id } });

  await prisma.programSocialFeed.createMany({
    data: [
      {
        programCategoryId: category.id,
        platform: 'instagram',
        postId: 'C123456789',
        imageUrl: 'https://images.unsplash.com/photo-1523287562758-66c7fc58967f?q=80&w=2000&auto=format&fit=crop',
        permalink: 'https://instagram.com/p/12345',
        caption: 'Registration is NOW OPEN for YAF 2025! 🚀 #YAF2025 #Academic #Conference',
        postedAt: new Date()
      },
      {
        programCategoryId: category.id,
        platform: 'instagram',
        postId: 'C987654321',
        imageUrl: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?q=80&w=2000&auto=format&fit=crop',
        permalink: 'https://instagram.com/p/67890',
        caption: 'Throwback to our amazing speakers last year. Who are you excited to see? 🎤',
        postedAt: new Date(Date.now() - 86400000 * 2) // 2 days ago
      },
      {
        programCategoryId: category.id,
        platform: 'instagram',
        postId: 'C112233445',
        imageUrl: 'https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=2000&auto=format&fit=crop',
        permalink: 'https://instagram.com/p/11223',
        caption: 'Bali awaits! 🌴 Are you ready for the academic journey of a lifetime?',
        postedAt: new Date(Date.now() - 86400000 * 5) // 5 days ago
      }
    ]
  });

  // ==========================================
  // 8. PRICING TIERS
  // ==========================================
  console.log('Seeding Pricing Tiers...');
  await prisma.programPricingTier.deleteMany({ where: { programId: program.id } });

  await prisma.programPricingTier.createMany({
    data: [
      {
        programId: program.id,
        name: 'Fully Funded',
        description: 'Compete for our prestigious fully funded scholarship covering flights, accommodation, and entry.',
        price: 0,
        currency: 'USD',
        feeType: 'registration_fee',
        benefits: ['Flight Tickets', '5-Star Accommodation', 'Meals included', 'Conference Kit', 'Gala Dinner'],
        capacity: 10,
        order: 1
      },
      {
        programId: program.id,
        name: 'Partial Scholarship',
        description: 'Accommodation and meals covered. Participants cover their own travel.',
        price: 150,
        currency: 'USD',
        feeType: 'registration_fee',
        benefits: ['5-Star Accommodation', 'Meals included', 'Conference Kit', 'Gala Dinner'],
        capacity: 50,
        order: 2
      },
      {
        programId: program.id,
        name: 'Self-Funded (Regular)',
        description: 'Full access to the conference and amenities.',
        price: 450,
        currency: 'USD',
        feeType: 'registration_fee',
        benefits: ['4-Star Accommodation', 'Meals included', 'Conference Kit', 'Gala Dinner', 'City Tour'],
        capacity: 200,
        order: 3
      }
    ]
  });

  // ==========================================
  // 9. AWARDS
  // ==========================================
  console.log('Seeding Awards...');
  await prisma.programAward.deleteMany({ where: { programId: program.id } });

  await prisma.programAward.createMany({
    data: [
      {
        programId: program.id,
        name: 'Best Paper Award',
        description: 'Awarded to the most impactful research paper presented.',
        category: 'Research',
        tier: 'gold',
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/1903/1903162.png',
        color: '#fbbf24',
        order: 1
      },
      {
        programId: program.id,
        name: 'Best Presenter',
        description: 'Awarded for exceptional public speaking and delivery.',
        category: 'Presentation',
        tier: 'silver',
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/2918/2918991.png',
        color: '#94a3b8',
        order: 2
      },
      {
        programId: program.id,
        name: 'Most Innovative',
        description: 'For the most creative solution to a global problem.',
        category: 'Innovation',
        tier: 'bronze',
        iconUrl: 'https://cdn-icons-png.flaticon.com/512/3135/3135715.png',
        color: '#b45309',
        order: 3
      }
    ]
  });

  // ==========================================
  // 10. TIMELINE
  // ==========================================
  console.log('Seeding Timeline...');
  await prisma.programTimeline.deleteMany({ where: { programId: program.id } });

  await prisma.programTimeline.createMany({
    data: [
      {
        programId: program.id,
        title: 'Registration Opens',
        date: new Date('2025-01-01'),
        description: 'Early bird registration begins for all categories.',
        icon: '📝',
        order: 1
      },
      {
        programId: program.id,
        title: 'Submission Deadline',
        date: new Date('2025-06-30'),
        description: 'Final day to submit abstracts and papers.',
        icon: '⚠️',
        order: 2
      },
      {
        programId: program.id,
        title: 'Announcement',
        date: new Date('2025-07-15'),
        description: 'Announcement of accepted delegates.',
        icon: '📢',
        order: 3
      },
      {
        programId: program.id,
        title: 'Conference Day',
        date: new Date('2025-08-15'),
        description: 'The event begins in Bali!',
        icon: '🎉',
        order: 4
      }
    ]
  });

    // ==========================================
  // 11. FAQ & RESOURCES
  // ==========================================
  console.log('Seeding FAQ & Resources...');
  await prisma.programFaq.deleteMany({ where: { programId: program.id } });
  
  await prisma.programFaq.createMany({
    data: [
        {
            programId: program.id,
            question: "Who can apply?",
            answer: "Youths aged 15-35 from any country are welcome to apply.",
            order: 1,
            category: "general"
        },
        {
            programId: program.id,
            question: "Is flight included?",
            answer: "Only for Full Scholarship winners. Others must arrange their own travel to Bali.",
            order: 2,
            category: "event_details"
        }
    ]
  });

  await prisma.programResource.deleteMany({ where: { programId: program.id } });

  await prisma.programResource.create({
    data: {
        programId: program.id,
        title: "Delegate Guidelines 2025",
        description: "Everything you need to know about the conference rules and preparation.",
        fileUrl: "https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf",
        type: "guide",
        isPublic: true
    }
  });


  console.log('✅ YAF Seeding Completed Successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
