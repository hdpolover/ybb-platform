import { PrismaClient, TimelineCompletionType, TimelineType, FaqCategory, PricingFeeType, ApplicationCategory } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

// -------------------------------------------------------------
// Fix for Prisma 7 + Postgres Adapter in Seed Script
// -------------------------------------------------------------
const connectionString = process.env.DATABASE_URL;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });
// -------------------------------------------------------------

async function main() {
  console.log('🌱 Starting Comprehensive Content Seeding...');

  // ==========================================
  // 1. DATA CONSTANTS
  // ==========================================
  
  const IYS_CATEGORY = {
    slug: 'iys',
    name: 'Istanbul Youth Summit',
    website: 'https://istanbulyouthsummit.com',
    color: '#E1306C',
    banner: 'https://images.unsplash.com/photo-1543269865-cbf427effbad?q=80&w=2070&auto=format&fit=crop'
  };
  
  const YAF_CATEGORY = {
    slug: 'youth-academic-forum',
    name: 'Youth Academic Forum',
    website: 'https://youthacademicforum.com',
    color: '#15803d', // Green
    banner: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop'
  };

  const AYIMUN_CATEGORY = {
    slug: 'ayimun',
    name: 'Asia Youth International MUN',
    website: 'https://modelunitednations.org',
    color: '#0056B3', // Blue
    banner: 'https://images.unsplash.com/photo-1555529669-e69e7aa0ba9a?q=80&w=2070&auto=format&fit=crop'
  };

  // ==========================================
  // 2. HELPER FUNCTIONS
  // ==========================================
  
  const upsertCategory = async (data: any) => {
    console.log(`Creating/Updating Category: ${data.name}...`);
    return await prisma.programCategory.upsert({
      where: { slug: data.slug },
      update: {
        name: data.name,
        websiteUrl: data.website,
        primaryColor: data.color,
        bannerUrl: data.banner,
        description: `${data.name} is a global platform for youth leadership and development.`
      },
      create: {
        name: data.name,
        slug: data.slug,
        websiteUrl: data.website,
        primaryColor: data.color,
        bannerUrl: data.banner,
        description: `${data.name} is a global platform for young leaders.`
      },
    });
  };

  const upsertProgram = async (categoryId: string, slug: string, name: string, year: number, deadlineMonth: number) => {
    console.log(`Creating/Updating Program: ${name}...`);
    return await prisma.program.upsert({
      where: {
        programCategoryId_slug: { programCategoryId: categoryId, slug },
      },
      update: {
        name,
        year,
        startDate: new Date(`${year}-07-15`),
        endDate: new Date(`${year}-07-18`),
        isPublished: true,
        isVisibleToUsers: true,
        status: 'published',
      },
      create: {
        programCategoryId: categoryId,
        name,
        slug,
        year,
        startDate: new Date(`${year}-07-15`),
        endDate: new Date(`${year}-07-18`),
        applicationDeadline: new Date(`${year}-0${deadlineMonth}-30`),
        isPublished: true,
        isVisibleToUsers: true,
        status: 'published',
        description: `
          <h2>Welcome to ${name}</h2>
          <p>Join over 500 delegates from around the world for a transformative experience.</p>
          <ul>
            <li>Global Networking</li>
            <li>Leadership Training</li>
            <li>Cultural Exchange</li>
          </ul>
        `,
        location: 'International Venue',
        bannerUrl: 'https://images.unsplash.com/photo-1544928147-79a2dbc1f389?q=80&w=1974&auto=format&fit=crop',
      },
    });
  };

  // ==========================================
  // 3. EXECUTION
  // ==========================================

  // --- IYS SETUP ---
  const iysCat = await upsertCategory(IYS_CATEGORY);
  const iysProgram = await upsertProgram(iysCat.id, 'istanbul-youth-summit-2025', 'Istanbul Youth Summit 2025', 2025, 3);
  await seedTestimonials(iysCat.id, iysProgram.id);
  await seedSponsors(iysCat.id);
  await seedTeam(iysCat.id, iysProgram.id);
  await seedFaqs(iysProgram.id);
  await seedGallery(iysProgram.id);
  await seedPartners(iysProgram.id);
  await seedPricingTiers(iysProgram.id);

  // --- YAF SETUP ---
  const yafCat = await upsertCategory(YAF_CATEGORY);
  const yafProgram = await upsertProgram(yafCat.id, 'youth-academic-forum-2025', 'Youth Academic Forum 2025', 2025, 6);
  await seedTestimonials(yafCat.id, yafProgram.id);
  await seedSponsors(yafCat.id);
  await seedGallery(yafProgram.id);
  await seedPartners(yafProgram.id);
  await seedPricingTiers(yafProgram.id);
  
  // --- AYIMUN SETUP ---
  const ayimunCat = await upsertCategory(AYIMUN_CATEGORY);
  const ayimunProgram = await upsertProgram(ayimunCat.id, 'ayimun-2025', 'Asia Youth International MUN 2025', 2025, 5);
  await seedTestimonials(ayimunCat.id, ayimunProgram.id);
  await seedSponsors(ayimunCat.id);
  await seedFaqs(ayimunProgram.id);
  await seedPricingTiers(ayimunProgram.id);

  console.log('✅ Content Seeding Completed Successfully!');
}

// ==========================================
// 4. CONTENT SEEDERS
// ==========================================

async function seedTestimonials(categoryId: string, programId: string) {
  // console.log(`  - Seeding Testimonials for ${categoryId.substring(0,8)}...`);
  await prisma.programTestimonial.deleteMany({ where: { programCategoryId: categoryId } });
  
  await prisma.programTestimonial.createMany({
    data: [
      {
        programCategoryId: categoryId,
        programId: programId,
        name: 'Alice Johnson',
        role: 'Best Delegate 2024',
        company: 'Harvard University',
        testimonial: 'An incredible experience that changed my perspective on global leadership. Highly recommended!',
        avatarUrl: 'https://randomuser.me/api/portraits/women/44.jpg',
        category: 'alumni',
        isFeatured: true,
        order: 1
      },
      {
        programCategoryId: categoryId,
        programId: programId,
        name: 'David Smith',
        role: 'Participant',
        company: 'University of Tokyo',
        testimonial: 'The networking opportunities were unmatched. I met brilliant minds from all over the world.',
        avatarUrl: 'https://randomuser.me/api/portraits/men/32.jpg',
        category: 'alumni',
        isFeatured: true,
        order: 2
      },
       {
        programCategoryId: categoryId,
        programId: programId,
        name: 'Maria Rodriguez',
        role: 'Speaker',
        company: 'UN Women',
        testimonial: 'Seeing so many passionate young leaders gives me hope for the future.',
        avatarUrl: 'https://randomuser.me/api/portraits/women/65.jpg',
        category: 'speaker',
        isFeatured: false,
        order: 3
      }
    ]
  });
}

async function seedSponsors(categoryId: string) {
  // console.log(`  - Seeding Sponsors...`);
  await prisma.sponsor.deleteMany({ where: { programCategoryId: categoryId } });

  await prisma.sponsor.createMany({
    data: [
      {
        programCategoryId: categoryId,
        name: 'TechCorp',
        type: 'organization',
        tier: 'platinum',
        logoUrl: 'https://placehold.co/400x200/2563eb/ffffff?text=TechCorp',
        websiteUrl: 'https://example.com',
        order: 1
      },
      {
        programCategoryId: categoryId,
        name: 'EduFoundation',
        type: 'organization',
        tier: 'gold',
        logoUrl: 'https://placehold.co/400x200/ea580c/ffffff?text=EduFoundation',
        websiteUrl: 'https://example.com',
        order: 2
      },
      {
        programCategoryId: categoryId,
        name: 'Global News',
        type: 'media_partner',
        tier: 'media',
        logoUrl: 'https://placehold.co/400x200/dc2626/ffffff?text=GlobalNews',
        websiteUrl: 'https://example.com',
        order: 3
      }
    ]
  });
}

async function seedTeam(categoryId: string, programId: string) {
  //  console.log(`  - Seeding Team...`);
   await prisma.programTeam.deleteMany({ where: { programCategoryId: categoryId } });
   
   await prisma.programTeam.createMany({
     data: [
       {
         programCategoryId: categoryId,
         programId: programId,
         name: 'Hendra Polover',
         role: 'Program Director',
         bio: 'Passionate about youth development and technology.',
         photoUrl: 'https://randomuser.me/api/portraits/men/1.jpg',
         linkedinUrl: 'https://linkedin.com',
         order: 1
       },
       {
         programCategoryId: categoryId,
         programId: programId,
         name: 'Sarah Lee',
         role: 'Head of Operations',
         bio: 'Ensuring everything runs smoothly.',
         photoUrl: 'https://randomuser.me/api/portraits/women/2.jpg',
         order: 2
       }
     ]
   });
}

async function seedFaqs(programId: string) {
  // console.log(`  - Seeding FAQs...`);
  await prisma.programFaq.deleteMany({ where: { programId } });
  
  await prisma.programFaq.createMany({
    data: [
      {
        programId,
        question: 'How do I apply?',
        answer: 'Click the "Apply Now" button on the dashboard and fill out the form.',
        category: FaqCategory.registration,
        order: 1
      },
      {
        programId,
        question: 'Is there a registration fee?',
        answer: 'Yes, there is a commitment fee. However, fully funded scholarships are available.',
        category: FaqCategory.payment,
        order: 2
      },
      {
        programId,
        question: 'Do I need a visa?',
        answer: 'Depends on your nationality. Please check with the Turkish embassy in your country.',
        category: FaqCategory.general,
        order: 3
      }
    ]
  });
}

async function seedGallery(programId: string) {
  // console.log(`  - Seeding Gallery...`);
  await prisma.programGallery.deleteMany({ where: { programId } });
  
  await prisma.programGallery.createMany({
    data: [
      {
        programId,
        imageUrl: 'https://images.unsplash.com/photo-1544531696-297afda3046e?q=80&w=2000&auto=format&fit=crop',
        title: 'Opening Ceremony',
        type: 'image',
        order: 1
      },
      {
        programId,
        imageUrl: 'https://images.unsplash.com/photo-1515168816969-950d6f543167?q=80&w=1974&auto=format&fit=crop',
        title: 'Conference Hall',
        type: 'image',
        order: 2
      },
      {
        programId,
        imageUrl: 'https://images.unsplash.com/photo-1523580494863-6f3031224c94?q=80&w=2070&auto=format&fit=crop',
        title: 'Workshops',
        type: 'image',
        order: 3
      }
    ]
  });
}

async function seedPartners(programId: string) {
  // console.log(`  - Seeding Partners...`);
  await prisma.programPartner.deleteMany({ where: { programId } });
  
  await prisma.programPartner.createMany({
    data: [
      {
        programId,
        name: 'Local University',
        type: 'university',
        role: 'Exclusive Knowledge Partner',
        logoUrl: 'https://placehold.co/400x200/16a34a/ffffff?text=Univ',
        description: 'Hosting venue and academic support.',
        order: 1
      },
      {
        programId,
        name: 'Ministry of Youth',
        type: 'government',
        role: 'Official Supporter',
        logoUrl: 'https://placehold.co/400x200/dc2626/ffffff?text=Ministry',
        order: 2
      }
    ]
  });
}

async function seedPricingTiers(programId: string) {
  // console.log(`  - Seeding Pricing Tiers...`);
  await prisma.programPricingTier.deleteMany({ where: { programId } });

  await prisma.programPricingTier.createMany({
    data: [
      {
        programId,
        name: 'Fully Funded',
        price: 15.00, // Commitment fee?
        currency: 'USD',
        description: 'Competition for Full Scholarship',
        benefits: ["Flight Included", "Hotel Included", "Meals Included"],
        icon: 'award',
        allowedCategories: [ApplicationCategory.fully_funded],
        feeType: PricingFeeType.registration_fee,
        order: 1
      },
      {
        programId,
        name: 'Self Funded',
        price: 20.00,
        currency: 'USD',
        description: 'Direct Registration',
        benefits: ["Hotel Included", "Meals Included"],
        icon: 'user-check',
        allowedCategories: [ApplicationCategory.self_funded],
        feeType: PricingFeeType.registration_fee,
        order: 2
      }
    ]
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
