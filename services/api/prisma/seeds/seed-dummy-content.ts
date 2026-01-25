
import { prisma, log } from './utils';
import { BRANDS } from './seed-brands';
import { ApplicationCategory, PricingFeeType, FaqCategory } from '@prisma/client';

export async function seedDummyContent() {
  log('🌱 Seeding Dummy Content (Brands, Timelines, FAQs, etc.)...');

  // ===========================================================================
  // 1. Program Categories (Brands)
  // ===========================================================================
  log('... Seeding Program Categories');

  const categoriesData = [
    {
      name: 'Global Leadership Summit',
      slug: 'global-leadership-summit',
      description: 'Empowering the next generation of global leaders.',
      websiteUrl: 'https://example.com/gls',
      logoUrl: 'https://placehold.co/400x100/4F46E5/FFF?text=GLS+Logo',
      bannerUrl: 'https://placehold.co/1200x400/4F46E5/FFF?text=GLS+Banner',
      contactEmail: 'contact@example.com',
      contactPhone: '+1234567890',
      primaryColor: '#4F46E5', // Indigo
      defaultLocation: 'New York, USA',
    },
    {
      name: 'Asia Tech Innovators',
      slug: 'asia-tech-innovators',
      description: 'Where technology meets asian creativity.',
      websiteUrl: 'https://example.com/ati',
      logoUrl: 'https://placehold.co/400x100/10B981/FFF?text=ATI+Logo',
      bannerUrl: 'https://placehold.co/1200x400/10B981/FFF?text=ATI+Banner',
      contactEmail: 'hello@asiatech.com',
      contactPhone: '+6512345678',
      primaryColor: '#10B981', // Emerald
      defaultLocation: 'Singapore',
    }
  ];

  for (const cat of categoriesData) {
    const brand = await prisma.programCategory.upsert({
      where: { slug: cat.slug },
      update: {},
      create: {
        ...cat,
        isActive: true,
      },
    });

    // Create a dummy program for each
    await seedDummyProgram(brand.id, cat.slug, cat.name);
  }

  // Also seed dummy content for existing brands (WYF, YAF, JYS) if they exist
  const existingBrands = await prisma.programCategory.findMany({
      where: {
          slug: { in: [BRANDS.WYF, BRANDS.YAF, BRANDS.JYS] }
      }
  });

  for (const brand of existingBrands) {
      await seedDummyProgram(brand.id, brand.slug, brand.name);
  }

  log('✅ Dummy Content Seeded.');
}

async function seedDummyProgram(brandId: string, brandSlug: string, brandName: string) {
    // Determine year and details based on slug
    const year = 2026;
    const programSlug = `${brandSlug}-${year}`;
    const programName = `${brandName} ${year}`;
    
    // Create/Upsert Program
    const program = await prisma.program.upsert({
        where: {
            programCategoryId_slug: { programCategoryId: brandId, slug: programSlug }
        },
        update: {},
        create: {
            programCategoryId: brandId,
            name: programName,
            slug: programSlug,
            year: year,
            description: `Join us for the ${programName}. A transformative experience.`,
            shortDescription: `The official ${year} edition of ${brandName}.`,
            startDate: new Date(`${year}-08-15`),
            endDate: new Date(`${year}-08-18`),
            applicationDeadline: new Date(`${year}-05-01`),
            location: 'TBD',
            isActive: true,
            isPublished: true,
            allowRegistration: true,
            requirePayment: true,
            status: 'published',
            thumbnailUrl: `https://placehold.co/600x400?text=${brandName.replace(/ /g, '+')}`,
            bannerUrl: `https://placehold.co/1200x600?text=${brandName.replace(/ /g, '+')}+Banner`,
        }
    });

    // Seed Timeline
    await prisma.programTimeline.deleteMany({ where: { programId: program.id } });
    await prisma.programTimeline.createMany({
        data: [
            {
                programId: program.id,
                title: 'Registration Opens',
                date: new Date(`${year}-01-01`),
                description: 'Applications open for all tracks.',
                order: 1,
            },
            {
                programId: program.id,
                title: 'Early Bird Deadline',
                date: new Date(`${year}-03-01`),
                description: 'Last chance for discounted fee.',
                order: 2,
            },
            {
                programId: program.id,
                title: 'Final Deadline',
                date: new Date(`${year}-05-01`),
                description: 'Submission closes.',
                order: 3,
            }
        ]
    });

    // Seed FAQs
    await prisma.programFaq.deleteMany({ where: { programId: program.id } });
    await prisma.programFaq.createMany({
        data: [
            {
                programId: program.id,
                question: `What is ${brandName}?`,
                answer: `${brandName} is a global platform for youth innovation.`,
                category: FaqCategory.general,
                order: 1,
            },
            {
                programId: program.id,
                question: 'Is accommodation provided?',
                answer: 'Yes, accommodation is included in the full package.',
                category: FaqCategory.accommodation,
                order: 2,
            },
            {
                programId: program.id,
                question: 'How can I pay?',
                answer: 'We accept Credit Cards and Bank Transfers.',
                category: FaqCategory.payment,
                order: 3,
            }
        ]
    });

    // Seed Pricing
    await prisma.programPricingTier.deleteMany({ where: { programId: program.id } });
    await prisma.programPricingTier.createMany({
        data: [
            {
                programId: program.id,
                name: 'Regular Access',
                description: 'Full access to the 3-day event.',
                price: 350.00,
                currency: 'USD',
                feeType: PricingFeeType.full_fee,
                allowedCategories: [ApplicationCategory.self_funded],
                order: 1,
            },
            {
                programId: program.id,
                name: 'Scholarship Registration',
                description: 'Admin fee for fully funded applicants.',
                price: 15.00,
                currency: 'USD',
                feeType: PricingFeeType.registration_fee,
                allowedCategories: [ApplicationCategory.fully_funded],
                order: 2,
            }
        ]
    });

    // Seed Participation Categories
    // @ts-ignore - types might not be generated yet
    if (prisma.programParticipationCategory) {
      // @ts-ignore
      await prisma.programParticipationCategory.deleteMany({ where: { programId: program.id } });
      // @ts-ignore
      await prisma.programParticipationCategory.createMany({
        data: [
          {
            programId: program.id,
            name: 'High School Students',
            description: 'For students currently enrolled in high school (ages 15-18).',
            benefits: 'Certificate of Participation, Mentorship Sessions, Networking with Peers',
            eligibility: 'Must be currently enrolled in high school. Must have parental consent.',
            order: 1,
          },
          {
            programId: program.id,
            name: 'Future Innovators',
            description: 'For university students and young professionals (ages 18-30).',
            benefits: 'Access to Investor Pitch, Advanced Workshops, Career Fair',
            eligibility: 'Must be 18+ years old. Open to all nationalities.',
            order: 2,
          }
        ]
      });
    }
}

