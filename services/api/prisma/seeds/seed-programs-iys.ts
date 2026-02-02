import { prisma, log, error } from './utils';
import { BRANDS } from './seed-brands';
import { ApplicationCategory, PricingFeeType, FaqCategory } from '@prisma/client';

export async function seedIYSPrograms() {
  log('🌱 Seeding IYS Programs...');

  const brand = await prisma.brand.findUnique({ where: { slug: BRANDS.IYS } });
  if (!brand) return error('IYS Brand not found');

  // ==========================================
  // 1. IYS 2025 (Inactive/Past)
  // ==========================================
  await prisma.program.upsert({
    where: {
      brandId_slug: { brandId: brand.id, slug: 'istanbul-youth-summit-2025' },
    },
    update: {
      isActive: false,
      isPublished: true,
      status: 'completed',
      allowRegistration: false,
      registrationFee: null,
    },
    create: {
      brandId: brand.id,
      name: 'Istanbul Youth Summit 2025',
      slug: 'istanbul-youth-summit-2025',
      description: 'The 8th Istanbul Youth Summit (IYS 2025) was a massive success.',
      shortDescription: 'The 8th edition of IYS held in Feb 2025.',
      year: 2025,
      startDate: new Date('2025-02-10'),
      endDate: new Date('2025-02-13'),
      applicationDeadline: new Date('2024-11-30'),
      location: 'Istanbul, Turkey',
      capacity: 500,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: false,
      status: 'completed',
      allowRegistration: false,
      requirePayment: true,
      benefitsDescription: "1. International Certificate\n2. Networking\n3. Mentorship",
      thumbnailUrl: 'https://placehold.co/600x400?text=IYS+2025',
    },
  });

  // ==========================================
  // 2. IYS 2026 (Active/Upcoming)
  // ==========================================
  const iys2026 = await prisma.program.upsert({
    where: {
      brandId_slug: { brandId: brand.id, slug: 'istanbul-youth-summit-2026' },
    },
    update: {
      isActive: true,
      isPublished: true,
      status: 'published',
      allowRegistration: true,
    },
    create: {
      brandId: brand.id,
      name: 'Istanbul Youth Summit 2026',
      slug: 'istanbul-youth-summit-2026',
      description: 'The 9th Istanbul Youth Summit (IYS 2026) aims to connect youth leaders worldwide in the historical city of Istanbul. Theme: "Innovating for a Sustainable Future".',
      shortDescription: 'Join the largest youth summit in Istanbul, May 2026.',
      year: 2026,
      startDate: new Date('2026-05-18'),
      endDate: new Date('2026-05-21'),
      applicationDeadline: new Date('2026-03-30'),
      location: 'Istanbul, Turkey',
      capacity: 600,
      isPublished: true,
      isVisibleToUsers: true,
      isActive: true,
      status: 'published',
      allowRegistration: true,
      requirePayment: true,
      benefitsDescription: "1. Leadership Training\n2. Cross-cultural Exchange\n3. Project Funding Opportunity\n4. International Networking",
      bannerUrl: 'https://placehold.co/1200x600?text=IYS+2026+Banner',
      thumbnailUrl: 'https://placehold.co/600x400?text=IYS+2026',
    },
  });

  // ==========================================
  // 3. Seed Content for IYS 2026
  // ==========================================
  
  // Essays
  const essays = [
    { 
      question: "What motivates you to join IYS 2026?", 
      description: "Elaborate on your personal and professional goals.",
      isRequired: true,
      wordLimit: 500
    },
    { 
      question: "Propose a social project idea related to the SDGs.", 
      description: "Briefly outline the problem and your proposed solution.",
      isRequired: true,
      wordLimit: 800
    },
    {
      question: "Describe your leadership experience.",
      description: "Mention specific roles and achievements.",
      isRequired: true,
      wordLimit: 600
    }
  ];

  await prisma.programEssay.deleteMany({ where: { programId: iys2026.id } });
  for (const [i, e] of essays.entries()) {
      await prisma.programEssay.create({
          data: { programId: iys2026.id, ...e, order: i + 1, isActive: true }
      });
  }

  // Subthemes
  const subthemes = [
    { name: "Digital Transformation", description: "Adapting to the digital era and AI." },
    { name: "Green Energy", description: "Sustainable energy solutions for the future." },
    { name: "Public Health", description: "Global health resilience and equity." },
    { name: "Quality Education", description: "Ensuring inclusive and equitable quality education." },
  ];
  await prisma.programSubtheme.deleteMany({ where: { programId: iys2026.id } });
  for (const s of subthemes) {
      await prisma.programSubtheme.create({ data: { programId: iys2026.id, ...s, isActive: true } });
  }

  // Pricing
  await prisma.programPricingTier.deleteMany({ where: { programId: iys2026.id } });
  
  // Tier 1: Fully Funded
  await prisma.programPricingTier.create({
      data: {
          programId: iys2026.id,
          name: 'Fully Funded Scholarship',
          description: 'Highly competitive scholarship covering all costs.',
          price: 15.00,
          currency: 'USD',
          feeType: PricingFeeType.registration_fee,
          allowedCategories: [ApplicationCategory.fully_funded],
          benefits: ['Flight Ticket', 'Accommodation', 'All Meals', 'Gala Dinner', 'Conference Kit'],
          requirements: ['Essay Submission', 'Interview', 'Eligible Age 17-30'],
          order: 1,
          isActive: true
      }
  });

  // Tier 2: Self Funded
  await prisma.programPricingTier.create({
      data: {
          programId: iys2026.id,
          name: 'Self Funded',
          description: 'Guaranteed entry for self-funded delegates.',
          price: 450.00,
          currency: 'USD',
          feeType: PricingFeeType.full_fee,
          allowedCategories: [ApplicationCategory.self_funded],
          benefits: ['Accommodation (4 Days)', 'Meals during session', 'Conference Kit', 'Gala Dinner'],
          requirements: ['Proof of Payment', 'Valid Passport'],
          order: 2,
          isActive: true
      }
  });

  // Speakers
  await prisma.programSpeaker.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programSpeaker.createMany({
      data: [
          {
              programId: iys2026.id,
              name: "Prof. Ahmet Yilmaz",
              title: "Economics Professor",
              organization: "Istanbul University",
              bio: "Expert in emerging markets and youth employment.",
              photoUrl: "https://placehold.co/200x200?text=Ahmet",
              order: 1,
              isActive: true
          },
          {
              programId: iys2026.id,
              name: "Elena Rodriguez",
              title: "Climate Activist",
              organization: "Green Earth Alliance",
              bio: "Advocate for sustainable urban planning.",
              photoUrl: "https://placehold.co/200x200?text=Elena",
              order: 2,
              isActive: true
          },
          {
              programId: iys2026.id,
              name: "Michael Chen",
              title: "Tech Entrepreneur",
              organization: "InnovateAsia",
              bio: "Founder of multiple successful startups in the ed-tech space.",
              photoUrl: "https://placehold.co/200x200?text=Michael",
              order: 3,
              isActive: true
          }
      ]
  });

  // Gallery
  await prisma.programGallery.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programGallery.createMany({
      data: [
          {
              programId: iys2026.id,
              type: 'video',
              title: 'IYS Previous Highlights',
              imageUrl: 'https://placehold.co/800x600?text=Video+Thumb',
              videoUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', // Placeholder
              order: 1,
              isActive: true
          },
          {
              programId: iys2026.id,
              type: 'image',
              title: 'Grand Opening',
              imageUrl: 'https://placehold.co/800x600?text=Opening',
              order: 2,
              isActive: true
          },
          {
              programId: iys2026.id,
              type: 'image',
              title: 'Cultural Night',
              imageUrl: 'https://placehold.co/800x600?text=Cultural+Night',
              order: 3,
              isActive: true
          }
      ]
  });

  // Schedule
  await prisma.programSchedule.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programSchedule.createMany({
      data: [
          {
              programId: iys2026.id,
              day: 'Day 1: May 18',
              startTime: '14:00',
              endTime: '20:00',
              activity: 'Arrival & Welcome Dinner',
              description: 'Airport transfer, check-in, and opening networking dinner.',
              location: 'Grand Istanbul Hotel',
              order: 1,
              isActive: true
          },
          {
              programId: iys2026.id,
              day: 'Day 2: May 19',
              startTime: '09:00',
              endTime: '17:00',
              activity: 'Grand Symposium',
              description: 'Keynote sessions and panel discussions.',
              location: 'Convention Center',
              order: 2,
              isActive: true
          },
          {
              programId: iys2026.id,
              day: 'Day 3: May 20',
              startTime: '09:00',
              endTime: '22:00',
              activity: 'Project Presentation & Cultural Night',
              description: 'Delegates present their social projects. Evening cultural performances and awarding.',
              location: 'Convention Center',
              order: 3,
              isActive: true
          },
          {
              programId: iys2026.id,
              day: 'Day 4: May 21',
              startTime: '08:00',
              endTime: '12:00',
              activity: 'Departure',
              description: 'Breakfast and airport transfers.',
              location: 'Grand Istanbul Hotel',
              order: 4,
              isActive: true
          }
      ]
  });

  // FAQs
  await prisma.programFaq.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programFaq.createMany({
    data: [
      {
        programId: iys2026.id,
        question: "Can I apply without a passport?",
        answer: "Yes, you can apply now, but you must have a valid passport at least 2 months before the event dates.",
        category: FaqCategory.general,
        order: 1,
        isActive: true
      },
      {
        programId: iys2026.id,
        question: "Is flight ticket included for Self-Funded?",
        answer: "No, self-funded delegates must cover their flight expenses. We only cover accommodation and meals.",
        category: FaqCategory.payment,
        order: 2,
        isActive: true
      },
      {
        programId: iys2026.id,
        question: "How do I pay the registration fee?",
        answer: "You can pay via Credit Card, Virtual Account (IDR), or PayPal directly on the dashboard.",
        category: FaqCategory.payment,
        order: 3,
        isActive: true
      }
    ]
  });

  // Timeline
  await prisma.programTimeline.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programTimeline.createMany({
    data: [
      {
        programId: iys2026.id,
        title: "Registration Opens",
        date: new Date('2025-11-01'),
        description: "Early bird registration starts for all categories.",
        order: 1,
        isActive: true
      },
      {
        programId: iys2026.id,
        title: "Registration Closes",
        date: new Date('2026-03-30'),
        description: "Last day to submit applications.",
        order: 2,
        isActive: true
      },
      {
        programId: iys2026.id,
        title: "Announcement of Delegates",
        date: new Date('2026-04-05'),
        description: "Selected participants will be notified via email.",
        order: 3,
        isActive: true
      },
      {
        programId: iys2026.id,
        title: "Payment Deadline",
        date: new Date('2026-04-15'),
        description: "Deadline for self-funded delegates to complete payment.",
        order: 4,
        isActive: true
      },
      {
        programId: iys2026.id,
        title: "Summit Dates",
        date: new Date('2026-05-18'),
        endDate: new Date('2026-05-21'),
        description: "The main event in Istanbul.",
        order: 5,
        isActive: true
      }
    ]
  });

  // Program Partners
  await prisma.programPartner.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programPartner.createMany({
    data: [
      {
        programId: iys2026.id,
        name: "Istanbul Tourism Board",
        type: "government",
        role: "Official Supporter",
        logoUrl: "https://placehold.co/200x100?text=Istanbul+Tourism",
        websiteUrl: "https://istanbul.gov.tr",
        order: 1,
        isActive: true
      },
      {
        programId: iys2026.id,
        name: "Turkish Airlines",
        type: "corporate",
        role: "Travel Partner",
        logoUrl: "https://placehold.co/200x100?text=Turkish+Airlines",
        websiteUrl: "https://turkishairlines.com",
        order: 2,
        isActive: true
      }
    ]
  });

  // Resources (Guidebooks)
  await prisma.programResource.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programResource.createMany({
    data: [
      {
        programId: iys2026.id,
        title: "IYS 2026 Delegate Handbook",
        description: "Comprehensive guide for all selected delegates.",
        fileUrl: "https://example.com/files/handbook.pdf",
        type: "guide",
        isPublic: false,
        order: 1,
        isActive: true
      },
      {
        programId: iys2026.id,
        title: "Sponsorship Proposal",
        description: "Use this to seek funding from local sponsors.",
        fileUrl: "https://example.com/files/proposal.pdf",
        type: "proposal",
        isPublic: true,
        order: 2,
        isActive: true
      }
    ]
  });

  // Announcements
  await prisma.programAnnouncement.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programAnnouncement.createMany({
    data: [
      {
        programId: iys2026.id,
        title: "Registration Extended!",
        content: "Due to high demand, we are extending the registration deadline by 5 days.",
        category: "News",
        isPinned: true,
        publishDate: new Date(),
        isActive: true
      },
      {
        programId: iys2026.id,
        title: "Keynote Speaker Revealed",
        content: "We are thrilled to announce Prof. Ahmet Yilmaz as our opening keynote speaker.",
        category: "Update",
        isPinned: false,
        publishDate: new Date(),
        isActive: true
      }
    ]
  });

  // Awards
  await prisma.programAward.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programAward.createMany({
    data: [
      {
        programId: iys2026.id,
        name: "Best Delegate",
        category: "Individual",
        tier: "gold",
        description: "Awarded to the most active and contributing delegate.",
        tags: ["Trophy", "Certificate"],
        iconUrl: "https://placehold.co/100x100?text=Best+Delegate",
        order: 1,
        isActive: true
      },
      {
        programId: iys2026.id,
        name: "Best Social Project",
        category: "Group",
        tier: "gold",
        description: "Awarded to the group with the most impactful project proposal.",
        tags: ["Funding", "Mentorship"],
        iconUrl: "https://placehold.co/100x100?text=Best+Project",
        order: 2,
        isActive: true
      }
    ]
  });

  // Program Committee
  await prisma.programTeam.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programTeam.createMany({
    data: [
      {
        programId: iys2026.id,
        name: "Sarah Connor",
        role: "Project Manager",
        bio: "Leading the operations for IYS 2026.",
        photoUrl: "https://placehold.co/300x300?text=Sarah",
        order: 1,
        isActive: true
      },
      {
        programId: iys2026.id,
        name: "David Kim",
        role: "Event Coordinator",
        bio: "Managing venue and logistics.",
        photoUrl: "https://placehold.co/300x300?text=David",
        order: 2,
        isActive: true
      }

    ]
  });

  // Program Pricing Validity Periods (Waves)
  // Assuming Tier 2 Self Funded has an ID. We need to fetch it or finding it from the loop might be tricky if we don't store ref.
  // Ideally we query them back.
  const pricingTiers = await prisma.programPricingTier.findMany({ where: { programId: iys2026.id } });
  const selfFundedTier = pricingTiers.find(t => t.feeType === PricingFeeType.full_fee);
  
  if (selfFundedTier) {
      await prisma.pricingTierValidityPeriod.deleteMany({ where: { pricingTierId: selfFundedTier.id } });
      await prisma.pricingTierValidityPeriod.createMany({
          data: [
              {
                  pricingTierId: selfFundedTier.id,
                  description: "Early Bird Wave",
                  startDate: new Date('2025-11-01'),
                  endDate: new Date('2025-12-31'),
              },
              {
                  pricingTierId: selfFundedTier.id,
                  description: "Regular Wave",
                  startDate: new Date('2026-01-01'),
                  endDate: new Date('2026-03-30'),
              }
          ]
      });
  }

  // Program Requirements (Documents)
  await prisma.programRequirement.deleteMany({ where: { programId: iys2026.id } });
  await prisma.programRequirement.createMany({
      data: [
          {
              programId: iys2026.id,
              name: "Passport",
              description: "Scan of your valid passport (identity page).",
              type: "document",
              fileAllowedTypes: "pdf,jpg,jpeg,png",
              fileMaxSize: 5120, // 5MB
              isRequired: true,
              order: 1,
              isActive: true
          },
          {
              programId: iys2026.id,
              name: "Photo",
              description: "Formal close-up photo.",
              type: "document",
              fileAllowedTypes: "jpg,jpeg,png",
              fileMaxSize: 2048,
              isRequired: true,
              order: 2,
              isActive: true
          },
          {
              programId: iys2026.id,
              name: "Agreement to Terms",
              description: "I agree to the terms and conditions and code of conduct.",
              type: "checkbox",
              isRequired: true,
              order: 3,
              isActive: true
          }
      ]
  });

  // Application Form Fields
  await prisma.applicationFormField.deleteMany({ where: { programId: iys2026.id } });
  await prisma.applicationFormField.createMany({
      data: [
          // Personal Info Section
          {
              programId: iys2026.id,
              section: "personal_info",
              label: "Full Name",
              name: "full_name",
              type: "text",
              placeholder: "Enter as written in passport",
              isRequired: true,
              order: 1,
              isActive: true
          },
          {
              programId: iys2026.id,
              section: "personal_info",
              label: "WhatsApp Number",
              name: "whatsapp_number",
              type: "text",
              placeholder: "+62...",
              helpText: "Include country code",
              isRequired: true,
              order: 2,
              isActive: true
          },
          {
              programId: iys2026.id,
              section: "personal_info",
              label: "Date of Birth",
              name: "birth_date",
              type: "date",
              isRequired: true,
              order: 3,
              isActive: true
          },
           {
              programId: iys2026.id,
              section: "personal_info",
              label: "T-Shirt Size",
              name: "tshirt_size",
              type: "select",
              options: ["S", "M", "L", "XL", "XXL"],
              isRequired: true,
              order: 4,
              isActive: true
          },
          // Essay Section (Synced with programmed essays if needed, but this table allows custom form building)
          // Usually essays are handled by ProgramEssay table, but here we can add extra fields if needed.
          // Let's assume this form builder is for the "Personal Data" step and "Additional Info".
          {
              programId: iys2026.id,
              section: "additional_info",
              label: "Dietary Restrictions",
              name: "dietary_restrictions",
              type: "textarea",
              placeholder: "Halal, Vegetarian, Allergies...",
              isRequired: false,
              order: 1,
              isActive: true
          }
      ]
  });

  log('✅ IYS Programs seeded (2025: Inactive, 2026: Active with content)');
}